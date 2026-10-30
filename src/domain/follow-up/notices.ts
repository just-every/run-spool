import { dispatchStanding } from '../agent-door/standing';
import type { Bindings } from '../../auth/bindings';
import { createWebhookProtocol } from '../../modules/integrations/core/webhook';
import { validateDestination } from '../../modules/integrations/core/destination';
import { validateMessage } from '../../modules/mail/src/core/validation.mjs';
import { findDestination, destinationHash, keyBytes } from '../alerts/destinations.server';
import { sender } from '../alerts/mail';
import { auditSubject, serviceActor } from '../audit/identity';
import { recordAudit } from '../audit/record';
import { s, type Environment } from './types';
import { activeProjectRecipient } from '../members/notifications';

export async function queueNotices(env:Environment,time:number) {
 // A notice is keyed by the original attention item and destination, never by
 // another notice. Changing the alternate cannot recurse through its failures.
 await s(env.DB,`INSERT INTO follow_up_notices(id,attention,project,destination,channel,next_at,body)
  SELECT lower(hex(randomblob(16))),a.id,a.project,c.destination,c.channel,?,
   json_object('schema','spool.follow_up.v1','attentionId',a.id,'source',a.source,'reason',a.reason,'due',a.due)
  FROM follow_up_attention a JOIN follow_up_settings c ON c.project=a.project
  WHERE c.destination IS NOT NULL AND NOT EXISTS(SELECT 1 FROM spool_follow_up_alternates m WHERE m.project=a.project)
   AND a.historical=0 AND a.state NOT IN ('completed','canceled') AND a.source_id NOT LIKE 'team-mail:%' AND a.source_id NOT LIKE 'alternate:%'
  ON CONFLICT(attention,destination,channel) DO NOTHING`,time).run();
 await s(env.DB,`INSERT INTO follow_up_notices(id,attention,project,destination,channel,next_at,body)
  SELECT lower(hex(randomblob(16))),a.id,a.project,'member:'||m.member,'mail',?,
   json_object('schema','spool.follow_up.v1','attentionId',a.id,'source',a.source,'reason',a.reason,'due',a.due)
  FROM follow_up_attention a JOIN spool_follow_up_alternates m ON m.project=a.project
  WHERE a.historical=0 AND a.state NOT IN ('completed','canceled') AND a.source_id NOT LIKE 'team-mail:%' AND a.source_id NOT LIKE 'alternate:%'
  ON CONFLICT(attention,destination,channel) DO NOTHING`,time).run();
}

async function prepare(env:Environment,row:any,time:number) {
 const memberId=row.destination.startsWith('member:')?row.destination.slice(7):null;
 const destination:any=memberId?{recipient:(await activeProjectRecipient(env.DB,row.project,memberId))?.email}:await findDestination(env,row.project,row.destination,row.channel);
 if(memberId&&!destination.recipient)throw new Error('member_unavailable');
 if(row.channel==='mail') {
  const mail=sender(env),body=JSON.parse(row.body);
  const message={deliveryId:'follow-up-'+row.id,from:env.MAIL_FROM!,to:[destination.recipient!],subject:'Spool needs attention',
   text:`Spool automation needs the accountable alternate's attention. Item: ${body.attentionId}. Source: ${body.source}. Reason: ${body.reason}. Due: ${new Date(body.due).toISOString()}. Inspect Needs attention in Spool. An uncertain effect must be reconciled before retrying.`};
  validateMessage(message,env.MAIL_PROVIDER);
  return {digest:await destinationHash(env,JSON.stringify([destination.recipient,env.MAIL_FROM,env.MAIL_PROVIDER])),send:async()=>{
   const result=await mail.send(message);
   return result.status==='development'?{state:'completed',code:'suppressed_locally'}:
    result.status==='accepted'?{state:'completed',code:'mail_accepted'}:
    result.status==='rate_limited'?{state:'queued',code:'mail_rate_limited'}:
    result.status==='rejected'?{state:'failed',code:'mail_rejected'}:{state:'uncertain',code:'mail_response_unknown'};
  }};
 }
 if(!env.INTEGRATION_EGRESS)throw new Error('egress_unconfigured');
 const protocol=createWebhookProtocol({resolveDestination:async()=>destination.url!,signingKey:async()=>keyBytes(destination.key)});
 const wire=await protocol.prepare({id:'follow-up-'+row.id,tenant:'spool.'+row.project,destinationId:row.destination,event:'spool.automation.attention',protocol:'webhook',body:row.body},time);
 validateDestination(wire.url);
 return {digest:await destinationHash(env,wire.url),send:async()=>{
  const fact={source:'service' as const,actor:await serviceActor(env.DB,'webhook'),action:'notification.attempt' as const,subject:await auditSubject(env.DB,'delivery',row.id,row.project)};
  await recordAudit(env.DB,{...fact,outcome:'started'});
  try{
   const response=await env.INTEGRATION_EGRESS!.send(wire),outcome=protocol.classify(response,Date.now());
   await recordAudit(env.DB,{...fact,outcome:outcome.kind==='accepted'?'accepted':outcome.kind==='uncertain'?'uncertain':'failed'});
   return {state:outcome.kind==='accepted'?'completed':outcome.kind==='retryable'?'queued':outcome.kind==='rejected'?'failed':'uncertain',code:outcome.code};
  }catch(error){await recordAudit(env.DB,{...fact,outcome:'uncertain'});throw error;}
 }};
}

export async function dispatchNotices(env:Environment,time:number,only?:string[]) {
 await env.DB.batch([
  s(env.DB,"UPDATE follow_up_attempts SET state='uncertain',code='claim_expired',finished=? WHERE finished IS NULL AND id IN(SELECT claim FROM follow_up_notices WHERE state='running' AND claim_until<=?)",time,time),
  s(env.DB,"UPDATE follow_up_notices SET state='uncertain',code='claim_expired',claim=NULL,claim_until=NULL WHERE state='running' AND claim_until<=?",time),
 ]);
 const rows=(await s(env.DB,"SELECT * FROM follow_up_notices WHERE state='queued' AND next_at<=? AND (? IS NULL OR id IN (SELECT value FROM json_each(?))) ORDER BY next_at,id LIMIT 30",time,only?JSON.stringify(only):null,only?JSON.stringify(only):null).all<any>()).results;
 for(const row of rows) {
  if(await dispatchStanding(env as Bindings&Environment,'followup',row.id))continue;
  let prepared;
  try {
   prepared=await prepare(env,row,time);
   if(row.destination_hash!==null&&row.destination_hash!==prepared.digest)throw new Error('destination_changed');
  }catch{
   await s(env.DB,"UPDATE follow_up_notices SET state='blocked',code='preflight_failed' WHERE id=? AND state='queued'",row.id).run();continue;
  }
  const claim=crypto.randomUUID(),clockStart=Date.now(),now=()=>time+Date.now()-clockStart;
  const result=await env.DB.batch([
   s(env.DB,`UPDATE follow_up_notices SET state='running',claim=?,claim_until=?,attempts=attempts+1,destination_hash=COALESCE(destination_hash,?) WHERE id=? AND state='queued' AND attempts<4
    AND (EXISTS(SELECT 1 FROM follow_up_settings c WHERE c.project=follow_up_notices.project AND c.destination=follow_up_notices.destination AND c.channel=follow_up_notices.channel AND NOT EXISTS(SELECT 1 FROM spool_follow_up_alternates m WHERE m.project=c.project))
     OR EXISTS(SELECT 1 FROM spool_follow_up_alternates m WHERE m.project=follow_up_notices.project AND follow_up_notices.destination='member:'||m.member AND follow_up_notices.channel='mail'))
    AND EXISTS(SELECT 1 FROM follow_up_attention a WHERE a.id=attention AND a.historical=0 AND a.state NOT IN ('completed','canceled')) RETURNING id`,claim,now()+60000,prepared.digest,row.id),
   s(env.DB,'INSERT INTO follow_up_attempts(id,notice,project,number,started) SELECT claim,id,project,attempts,? FROM follow_up_notices WHERE id=? AND claim=?',now(),row.id,claim),
  ]);
  if(!result[0].results.length)continue;
  // Claim and current alternate are checked once more after preparation yields.
  const authority=await s(env.DB,`SELECT n.claim_until FROM follow_up_notices n WHERE n.id=? AND n.claim=? AND n.state='running' AND n.claim_until>?
   AND (EXISTS(SELECT 1 FROM follow_up_settings c WHERE c.project=n.project AND c.destination=n.destination AND c.channel=n.channel AND NOT EXISTS(SELECT 1 FROM spool_follow_up_alternates m WHERE m.project=n.project))
    OR EXISTS(SELECT 1 FROM spool_follow_up_alternates m WHERE m.project=n.project AND n.destination='member:'||m.member AND n.channel='mail'))`,row.id,claim,now()).first<{claim_until:number}>();
  let state='blocked',code='alternate_changed';
  if(authority&&authority.claim_until>now()&&(!row.destination.startsWith('member:')||await activeProjectRecipient(env.DB,row.project,row.destination.slice(7)))){
   state='uncertain';code='response_unknown';
   try{const result=await prepared.send();state=result.state;code=result.code;}catch{/* A started effect cannot establish rejection. */}
  }
  if(state==='queued'&&row.attempts+1>=4)state='failed';
  const finished=now();
  await env.DB.batch([
   s(env.DB,`UPDATE follow_up_attempts SET finished=?,state=?,code=? WHERE id=? AND finished IS NULL AND EXISTS(SELECT 1 FROM follow_up_notices WHERE id=? AND claim=? AND state='running' AND claim_until>?)`,finished,state,code,claim,row.id,claim,finished),
   s(env.DB,"UPDATE follow_up_notices SET state=?,code=?,next_at=?,claim=NULL,claim_until=NULL WHERE id=? AND claim=? AND state='running' AND claim_until>?",state,code,finished+1000*Math.pow(5,row.attempts),row.id,claim,finished),
  ]);
 }
}
