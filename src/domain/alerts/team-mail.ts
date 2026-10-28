import { activeTeamRecipient } from '../members/notifications';
import { sender } from './mail';
import { alertServiceBatch } from './scheduled-mail';
import { statement as s,type AlertEnvironment } from './types';

export async function scheduledTeamMail(env:AlertEnvironment,time:number) {
 const rows=(await s(env.DB,"SELECT * FROM spool_team_mail WHERE historical=0 AND state IN ('queued','running') ORDER BY created,id LIMIT 30").all<any>()).results;
 for(const row of rows){
  const project=(await s(env.DB,'SELECT project FROM spool_project_teams WHERE organization=? AND team=? ORDER BY project LIMIT 1',row.organization,row.team).first<{project:string}>())?.project;
  if(!project){await s(env.DB,"UPDATE spool_team_mail SET state='blocked',code='team_unavailable',updated=? WHERE id=? AND state='queued'",time,row.id).run();continue;}
  if(row.state==='running'){
   if(row.updated+60000<=time)await alertServiceBatch(env,project,[s(env.DB,"UPDATE spool_team_mail SET state='uncertain',code='claim_expired',updated=? WHERE id=? AND state='running' AND updated+60000<=?",time,row.id,time)]);
   continue;
  }
  const recipient=await activeTeamRecipient(env.DB,row.organization,row.team,row.member);
  // A summary is evidence for precisely its captured projects. A grant or team
  // change cannot turn an old queued body into authority over retired data.
  const scoped=async()=>!!await s(env.DB,`SELECT 1 FROM spool_members m JOIN oa_operators o ON o.id=m.operator_id
   WHERE m.id=? AND m.version=? AND m.state='active' AND o.status='active' AND m.organization=?
    AND json_valid(?) AND json_array_length(?)>0 AND NOT EXISTS(
     SELECT 1 FROM json_each(?) p WHERE NOT EXISTS(
      SELECT 1 FROM spool_project_teams t WHERE t.project=p.value AND t.organization=? AND t.team=?
       AND (o.role='owner' OR m.role='admin' OR m.role IN ('member','read-only') AND EXISTS(
        SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=t.project))))`,
   row.member,row.member_version,row.organization,row.projects,row.projects,row.projects,row.organization,row.team).first();
  let mail;try{mail=sender(env);if(!recipient||!await scoped())throw new Error('member_unavailable')}catch{
   await alertServiceBatch(env,project,[s(env.DB,"UPDATE spool_team_mail SET state='blocked',code=?,updated=? WHERE id=? AND state='queued'",recipient?'mail_unconfigured':'member_unavailable',time,row.id)]);continue;
  }
  const claim=await alertServiceBatch(env,project,[s(env.DB,`UPDATE spool_team_mail SET state='running',updated=? WHERE id=? AND state='queued' AND historical=0
   AND EXISTS(SELECT 1 FROM spool_members m JOIN oa_operators o ON o.id=m.operator_id WHERE m.id=spool_team_mail.member AND m.organization=spool_team_mail.organization AND m.state='active' AND o.status='active') RETURNING id`,time,row.id)]);
  if(!claim[0].results.length)continue;
  // Scope is checked again immediately before the provider edge, after claim.
  const current=await activeTeamRecipient(env.DB,row.organization,row.team,row.member);
  if(!current||!await scoped()){await alertServiceBatch(env,project,[s(env.DB,"UPDATE spool_team_mail SET state='blocked',code='member_unavailable',updated=? WHERE id=? AND state='running'",time,row.id)]);continue;}
  let state='uncertain',code='response_unknown';
  try{const result=await mail.send({deliveryId:row.id,from:env.MAIL_FROM!,to:[current.email],subject:row.kind==='resumption'?'Spool team snooze expired — held alerts need attention':`Spool ${row.kind} team error digest`,text:row.body});state=result.status==='development'?'accepted':result.status==='rate_limited'?'queued':result.status;code='mail_'+result.status}catch{}
  await alertServiceBatch(env,project,[s(env.DB,"UPDATE spool_team_mail SET state=?,code=?,updated=? WHERE id=? AND state='running' AND updated=?",state,code,time,row.id,time)]);
 }
}
