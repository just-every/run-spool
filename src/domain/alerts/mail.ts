import { intentRecipients,keptRecipients,authorizeRecipients } from './targets';
import { dispatchStanding } from '../agent-door/standing';
import type { Bindings } from '../../auth/bindings';
import { auditLabelFromLookup, auditLabelStatements, subjectBinding } from '../audit/identity';
import { recordAudit } from '../audit/record';
import { operatorMail, productionMailConfig, recipientsAllowed } from '../../auth/mail.server.mjs';
import { localDevelopmentEnabled } from '../../auth/local.server.mjs';
import { parseAddress, validateConfig, validateMessage } from '../../modules/mail/src/core/validation.mjs';
import { authorizedDestination, destinationHash } from './destinations.server';
import { mailMessage } from './payload';
import { statement as s } from './types';
import type { AlertEnvironment, Intent } from './types';
export type MailAttribution={preparedBy:{label:string};approvers:readonly {name:string}[]};
/** Retain the configured sending mailbox while naming the real agent actor. */
export function agentMailFrom(from:string,attribution?:MailAttribution|null) {
 if(!attribution)return from;
 const label=attribution.preparedBy.label.replace(/[\x00-\x1f\x7f<>"\\\u2028\u2029]/g,' ').trim().slice(0,500);
 if(!label)throw new Error('mail_actor_required');
 return `${label} <${parseAddress(from).email}>`;
}
export function sender(env:AlertEnvironment) {
 if(!env.MAIL_PROVIDER||!env.MAIL_FROM)throw new Error('mail_unconfigured');
 if(env.MAIL_PROVIDER==='development') {
  if(env.RER_DEMO !== '1' && !localDevelopmentEnabled(env))throw new Error('mail_unconfigured');
 } else validateConfig(productionMailConfig(env));
 const result=operatorMail(env);if(!result)throw new Error('mail_unconfigured');
 return {...result,async send(message:Parameters<typeof result.send>[0]) {
  const aliases=await Promise.all([
   auditLabelStatements(env.DB,{kind:'service',authority:'mail'}),
   auditLabelStatements(env.DB,subjectBinding('delivery',message.deliveryId)),
  ]);
  const [,actor,,subject]=await env.DB.batch(aliases.flat());
  const fact={source:'service' as const,actor:{kind:'service' as const,label:auditLabelFromLookup(actor)},
   subject:{kind:'delivery' as const,label:auditLabelFromLookup(subject)},action:'notification.attempt' as const};
  await recordAudit(env.DB,{...fact,outcome:'started'});
  try{const reply=await result.send(message);await recordAudit(env.DB,{...fact,outcome:reply.status==='development'?'suppressed':reply.status==='accepted'?'accepted':reply.status==='uncertain'?'uncertain':'failed'});return reply}
  catch(error){await recordAudit(env.DB,{...fact,outcome:'uncertain'});throw error}
 }};
}
export async function expandMail(env:AlertEnvironment,intent:Intent,time:number) {
 const destination=await authorizedDestination(env,intent);sender(env);
 const recipients=destination.kind==='target'?(await intentRecipients(env,intent,destination,time)).map(r=>r.email):destination.recipient!;
 const message=mailMessage(intent.id,intent.body,env.MAIL_FROM!,recipients);validateMessage(message,env.MAIL_PROVIDER);
 const digest=await destinationHash(env,JSON.stringify([recipients,env.MAIL_FROM,env.MAIL_PROVIDER])),encoded=JSON.stringify(message);
 const db=env.DB;
 const [,updated,conflict]=await db.batch([
  s(db,`INSERT INTO alert_mail_jobs(id,project,message,destination_hash,next_at) SELECT ?,?,?,?,?
   WHERE EXISTS(SELECT 1 FROM alert_intents WHERE id=? AND project=? AND state IN ('pending','blocked') AND code IS NOT 'retention_removed')
   ON CONFLICT(id) DO NOTHING`,intent.id,intent.project,encoded,digest,time,intent.id,intent.project),
  s(db,`UPDATE alert_intents SET expanded=1,state='queued',code=NULL
   WHERE id=? AND project=? AND state IN ('pending','blocked') AND code IS NOT 'retention_removed'
   AND EXISTS(SELECT 1 FROM alert_mail_jobs WHERE id=? AND project=? AND message=? AND destination_hash=?)`,
   intent.id,intent.project,intent.id,intent.project,encoded,digest),
  s(db,`SELECT 1 FROM alert_mail_jobs WHERE id=? AND project=? AND (message<>? OR destination_hash<>?)`,intent.id,intent.project,encoded,digest),
 ]);
 if(conflict.results.length)throw new Error('mail_identity_conflict');
 return updated.meta.changes>0;
}
export async function recoverMail(env:AlertEnvironment,time:number) {
 if(!await s(env.DB,"SELECT 1 FROM alert_mail_jobs WHERE state='sending' AND claim_until<=? LIMIT 1",time).first())return;
 await env.DB.batch([
  s(env.DB,`UPDATE alert_mail_attempts SET finished=?,state='uncertain',code='claim_expired' WHERE finished IS NULL AND id IN(SELECT claim FROM alert_mail_jobs WHERE state='sending' AND claim_until<=?)`,time,time),
  s(env.DB,`UPDATE alert_mail_jobs SET state='uncertain',code='claim_expired',claim=NULL,claim_until=NULL WHERE state='sending' AND claim_until<=?`,time),
 ]);
}
// `only` limits a run to the given jobs; claims keep any concurrent run from sending the same job twice.
export async function dispatchMail(env:AlertEnvironment,time:number,only?:string[],attribution?:MailAttribution,recovered=false) {
 const started=Date.now(),clock=()=>time+Date.now()-started;
 if(!recovered)await recoverMail(env,time);
 const jobs=(await s(env.DB,`SELECT j.*,i.rule_id,i.rule_revision,i.destination,i.channel,
  EXISTS(SELECT 1 FROM spool_agent_custody c WHERE c.kind='alert' AND c.id=i.rule_id AND c.project=j.project) AS standing
  FROM alert_mail_jobs j JOIN alert_intents i ON i.id=j.id WHERE i.state<>'snoozed' AND j.state='queued' AND j.next_at<=? AND (? IS NULL OR j.id IN (SELECT value FROM json_each(?))) ORDER BY j.next_at,j.id LIMIT 30`,time,only?JSON.stringify(only):null,only?JSON.stringify(only):null).all<any>()).results;
 for(const job of jobs) {
  // Custody is recorded atomically with a rule revision. A delegated job
  // still goes through the live standing authority check before it can send.
  if(job.standing&&await dispatchStanding(env as Bindings&AlertEnvironment,'alert-mail',job.id,clock))continue;
  let mail;
  try {
   const destination=await authorizedDestination(env,job);mail=sender(env);
   const kept=destination.kind==='target'?await keptRecipients(env,job):null;
   if(destination.kind==='target'){if(!kept?.length)throw new Error('no_recipients');await authorizeRecipients(env,job.project,kept)}
   const recipients=kept?kept.map(r=>r.email):destination.recipient!;
   if(!recipientsAllowed(env,[recipients].flat()))throw 0;
   if(await destinationHash(env,JSON.stringify([recipients,env.MAIL_FROM,env.MAIL_PROVIDER]))!==job.destination_hash)throw 0;
   validateMessage(JSON.parse(job.message),env.MAIL_PROVIDER);
  } catch {
   await s(env.DB,`UPDATE alert_mail_jobs SET state='blocked',code='preflight_failed' WHERE id=? AND state='queued'`,job.id).run();continue;
  }
  const claim=crypto.randomUUID(),claimedAt=clock();
  const results=await env.DB.batch([
   s(env.DB,`UPDATE alert_mail_jobs SET state='sending',agent_attribution=coalesce(agent_attribution,?),attempts=attempts+1,claim=?,claim_until=? WHERE id=? AND state='queued' AND next_at<=? AND attempts<max_attempts RETURNING id`,attribution?JSON.stringify(attribution):null,claim,claimedAt+60000,job.id,claimedAt),
   s(env.DB,`INSERT INTO alert_mail_attempts(id,delivery_id,number,started) SELECT claim,id,attempts,? FROM alert_mail_jobs WHERE id=? AND claim=?`,claimedAt,job.id,claim),
  ]);
  if(!results[0].results.length)continue;
  // This final durable authorization check prevents a queued revoked revision from starting an effect.
  const authority=await s(env.DB,`SELECT j.claim_until,j.message,j.agent_attribution,
    (SELECT recipients FROM alert_intent_recipients WHERE intent=i.id AND project=i.project) recipients
   FROM alert_mail_jobs j JOIN alert_intents i ON i.id=j.id JOIN alert_rules r ON r.id=i.rule_id AND r.revision=i.rule_revision AND r.enabled=1
   WHERE i.state<>'snoozed' AND j.id=? AND j.claim=? AND j.state='sending' AND j.claim_until>?`,job.id,claim,clock())
   .first<{claim_until:number;message:string;agent_attribution:string|null;recipients:string|null}>();
  if(!authority||authority.claim_until<=clock()){
   await finishMail(env,job.id,claim,'blocked','rule_revoked',null,clock(),null);continue;
  }
  if(authority.recipients!==null){
   try{await authorizeRecipients(env,job.project,JSON.parse(authority.recipients))}catch{await finishMail(env,job.id,claim,'blocked','recipient_authority_changed',null,clock(),null);continue}
   if(!await s(env.DB,`SELECT 1 FROM alert_mail_jobs WHERE id=? AND claim=? AND state='sending' AND claim_until>?`,job.id,claim,clock()).first())continue;
  }
  let state='uncertain',code='response_unknown',receipt:string|null=null;
  try {const message=JSON.parse(authority.message);if(authority.agent_attribution){const source=JSON.parse(authority.agent_attribution);message.from=agentMailFrom(message.from,source);message.text+=`\n\nPrepared by ${source.preparedBy.label}.`+(source.approvers.length?` Approved by ${source.approvers.map((person:any)=>person.name).join(', ')}.`:'');}const result=await mail.send(message);state=result.status==='development'?'accepted':result.status==='rate_limited'?(job.attempts+1<job.max_attempts?'queued':'rejected'):result.status;code=result.code??`mail_${result.status}`;receipt=result.providerMessageId??null;} catch { /* A send started: the response cannot establish failure. */ }
  const finished=clock();
  const next=state==='queued'?finished+JSON.parse(job.retry_delays)[job.attempts]:null;
  await finishMail(env,job.id,claim,state,code,receipt,finished,next);
 }
 if(jobs.length&&!recovered)await recoverMail(env,clock());
}
async function finishMail(env:AlertEnvironment,id:string,claim:string,state:string,code:string,receipt:string|null,time:number,next:number|null) {
 await env.DB.batch([
  s(env.DB,`UPDATE alert_mail_attempts SET finished=?,state=?,code=? WHERE id=? AND finished IS NULL AND EXISTS(SELECT 1 FROM alert_mail_jobs WHERE id=? AND claim=? AND state='sending' AND claim_until>?)`,time,state,code,claim,id,claim,time),
  s(env.DB,`UPDATE alert_mail_jobs SET state=?,code=?,receipt=?,next_at=?,claim=NULL,claim_until=NULL WHERE id=? AND claim=? AND state='sending' AND claim_until>?`,state,code,receipt,next??time,id,claim,time),
 ]);
}
