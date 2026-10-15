import { operatorMail } from '../../auth/mail.server.mjs';
import { localDevelopmentEnabled } from '../../auth/local.server.mjs';
import { validateConfig, validateMessage } from '../../modules/mail/src/core/validation.mjs';
import { authorizedDestination, destinationHash } from './destinations.server';
import { mailMessage } from './payload';
import { statement as s } from './types';
import type { AlertEnvironment, Intent } from './types';
function sender(env:AlertEnvironment) {
 if(!env.MAIL_PROVIDER||!env.MAIL_FROM)throw new Error('mail_unconfigured');
 if(env.MAIL_PROVIDER==='development') {
  if(env.RER_DEMO !== '1' && !localDevelopmentEnabled(env))throw new Error('mail_unconfigured');
 } else validateConfig({provider:env.MAIL_PROVIDER,mode:'production',apiKey:env.MAIL_API_KEY,...(env.MAIL_PROVIDER==='cloudflare'?{accountId:env.MAIL_ACCOUNT_ID}:{})});
 const result=operatorMail(env);if(!result)throw new Error('mail_unconfigured');return result;
}
export async function expandMail(env:AlertEnvironment,intent:Intent,time:number) {
 const destination=await authorizedDestination(env,intent);sender(env);
 const message=mailMessage(intent.id,intent.body,env.MAIL_FROM!,destination.recipient!);validateMessage(message,env.MAIL_PROVIDER);
 const digest=await destinationHash(env,JSON.stringify([destination.recipient,env.MAIL_FROM,env.MAIL_PROVIDER]));
 await s(env.DB,`INSERT INTO alert_mail_jobs(id,project,message,destination_hash,next_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,intent.id,intent.project,JSON.stringify(message),digest,time).run();
 const stored=await s(env.DB,'SELECT message,destination_hash FROM alert_mail_jobs WHERE id=? AND project=?',intent.id,intent.project).first<any>();
 if(stored.message!==JSON.stringify(message)||stored.destination_hash!==digest)throw new Error('mail_identity_conflict');
}
export async function recoverMail(env:AlertEnvironment,time:number) {
 await env.DB.batch([
  s(env.DB,`UPDATE alert_mail_attempts SET finished=?,state='uncertain',code='claim_expired' WHERE finished IS NULL AND id IN(SELECT claim FROM alert_mail_jobs WHERE state='sending' AND claim_until<=?)`,time,time),
  s(env.DB,`UPDATE alert_mail_jobs SET state='uncertain',code='claim_expired',claim=NULL,claim_until=NULL WHERE state='sending' AND claim_until<=?`,time),
 ]);
}
// `only` limits a run to the given jobs; claims keep any concurrent run from sending the same job twice.
export async function dispatchMail(env:AlertEnvironment,time:number,only?:string[]) {
 const started=Date.now(),clock=()=>time+Date.now()-started;
 await recoverMail(env,time);
 const jobs=(await s(env.DB,`SELECT j.*,i.rule_id,i.rule_revision,i.destination,i.channel FROM alert_mail_jobs j JOIN alert_intents i ON i.id=j.id WHERE j.state='queued' AND j.next_at<=? AND (? IS NULL OR j.id IN (SELECT value FROM json_each(?))) ORDER BY j.next_at,j.id LIMIT 30`,time,only?JSON.stringify(only):null,only?JSON.stringify(only):null).all<any>()).results;
 for(const job of jobs) {
  let mail;
  try {
   const destination=await authorizedDestination(env,job);mail=sender(env);
   if(await destinationHash(env,JSON.stringify([destination.recipient,env.MAIL_FROM,env.MAIL_PROVIDER]))!==job.destination_hash)throw 0;
   validateMessage(JSON.parse(job.message),env.MAIL_PROVIDER);
  } catch {
   await s(env.DB,`UPDATE alert_mail_jobs SET state='blocked',code='preflight_failed' WHERE id=? AND state='queued'`,job.id).run();continue;
  }
  const claim=crypto.randomUUID(),claimedAt=clock();
  const results=await env.DB.batch([
   s(env.DB,`UPDATE alert_mail_jobs SET state='sending',attempts=attempts+1,claim=?,claim_until=? WHERE id=? AND state='queued' AND next_at<=? AND attempts<max_attempts RETURNING id`,claim,claimedAt+60000,job.id,claimedAt),
   s(env.DB,`INSERT INTO alert_mail_attempts(id,delivery_id,number,started) SELECT claim,id,attempts,? FROM alert_mail_jobs WHERE id=? AND claim=?`,claimedAt,job.id,claim),
  ]);
  if(!results[0].results.length)continue;
  // This final durable authorization check prevents a queued revoked revision from starting an effect.
  const authority=await s(env.DB,`SELECT j.claim_until FROM alert_mail_jobs j JOIN alert_intents i ON i.id=j.id JOIN alert_rules r ON r.id=i.rule_id AND r.revision=i.rule_revision AND r.enabled=1 WHERE j.id=? AND j.claim=? AND j.state='sending' AND j.claim_until>?`,job.id,claim,clock()).first<{claim_until:number}>();
  if(!authority||authority.claim_until<=clock()){
   await finishMail(env,job.id,claim,'blocked','rule_revoked',null,clock(),null);continue;
  }
  let state='uncertain',code='response_unknown',receipt:string|null=null;
  try {const result=await mail.send(JSON.parse(job.message));state=result.status==='development'?'captured_locally':result.status==='rate_limited'?(job.attempts+1<job.max_attempts?'queued':'rejected'):result.status;code=result.code??`mail_${result.status}`;receipt=result.providerMessageId??null;} catch { /* A send started: the response cannot establish failure. */ }
  const finished=clock();
  const next=state==='queued'?finished+JSON.parse(job.retry_delays)[job.attempts]:null;
  await finishMail(env,job.id,claim,state,code,receipt,finished,next);
 }
 await recoverMail(env,clock());
}
async function finishMail(env:AlertEnvironment,id:string,claim:string,state:string,code:string,receipt:string|null,time:number,next:number|null) {
 await env.DB.batch([
  s(env.DB,`UPDATE alert_mail_attempts SET finished=?,state=?,code=? WHERE id=? AND finished IS NULL AND EXISTS(SELECT 1 FROM alert_mail_jobs WHERE id=? AND claim=? AND state='sending' AND claim_until>?)`,time,state,code,claim,id,claim,time),
  s(env.DB,`UPDATE alert_mail_jobs SET state=?,code=?,receipt=?,next_at=?,claim=NULL,claim_until=NULL WHERE id=? AND claim=? AND state='sending' AND claim_until>?`,state,code,receipt,next??time,id,claim,time),
 ]);
}
