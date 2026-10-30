import { auditedBatch, auditCommit } from '../audit/context';
import { serviceActor,auditSubject,projectAuditLabel } from '../audit/identity';
import { sender } from './mail';
import { statement as s,type AlertEnvironment } from './types';
import { scheduledTeamMail } from './team-mail';
export async function alertServiceBatch(env:AlertEnvironment,project:string,statements:D1PreparedStatement[]){
 return auditedBatch(env.DB,[...statements,auditCommit(env.DB,'changes()>0')],{actor:await serviceActor(env.DB,'alerts'),subject:await auditSubject(env.DB,'project',project,project),projectLabel:await projectAuditLabel(env.DB,project),action:'automation.follow_up'});
}
export async function scheduledMail(env:AlertEnvironment,time:number){
 await scheduledTeamMail(env,time);
 const rows=(await s(env.DB,"SELECT * FROM alert_scheduled_mail WHERE historical=0 AND state IN ('queued','running') ORDER BY created,id LIMIT 30").all<any>()).results;
 for(const row of rows){
  if(row.state==='running'){
   if(row.updated+60000<=time)await alertServiceBatch(env,row.project,[s(env.DB,"UPDATE alert_scheduled_mail SET state='uncertain',code='claim_expired',updated=? WHERE id=? AND state='running' AND updated+60000<=?",time,row.id,time)]);
   continue;
  }
  let recipient:string|undefined;
  if(row.scope==='personal')recipient=(await s(env.DB,"SELECT email FROM oa_operators WHERE role='owner' AND status='active'").first<any>())?.email;
  else {const settings=await s(env.DB,'SELECT destination FROM alert_digest_settings WHERE project=?',row.project).first<any>();
   if(settings?.destination){const {findDestination}=await import('./destinations.server');try{recipient=(await findDestination(env,row.project,settings.destination,'mail')).recipient}catch{}}
  }
  let mail;try{mail=sender(env);if(!recipient)throw 0}catch{
   await alertServiceBatch(env,row.project,[s(env.DB,"UPDATE alert_scheduled_mail SET state='blocked',code='mail_unconfigured',updated=? WHERE id=? AND state='queued'",time,row.id)]);continue;
  }
  const claim=await alertServiceBatch(env,row.project,[s(env.DB,"UPDATE alert_scheduled_mail SET state='running',updated=? WHERE id=? AND state='queued' AND historical=0 RETURNING id",time,row.id)]);
  if(!claim[0].results.length)continue;
  let state='uncertain',code='response_unknown';
  try{const result=await mail.send({deliveryId:row.id,from:env.MAIL_FROM!,to:[recipient!],subject:row.kind==='resumption'?'Spool snooze expired — held alerts need attention':`Spool ${row.kind} ${row.scope} error digest`,text:row.body});state=result.status==='development'?'accepted':result.status==='rate_limited'?'queued':result.status;code='mail_'+result.status}catch{}
  await alertServiceBatch(env,row.project,[s(env.DB,"UPDATE alert_scheduled_mail SET state=?,code=?,updated=? WHERE id=? AND state='running' AND updated=?",state,code,time,row.id,time)]);
 }
}
