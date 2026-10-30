import { legacyDigestStarted } from './digest-identity';
import { auditedBatch, auditCommit } from '../audit/context';
import { serviceActor, auditSubject, projectAuditLabel } from '../audit/identity';
import { sender } from '../alerts/mail';
import { digestPeriod } from '../alerts/calendar';
import type { AlertEnvironment } from '../alerts/types';
import { s } from '../operators/common';
import { hash, token } from '../privacy';

// Reused in the atomic claim and immediately before the provider boundary.
// Captured membership versions prevent a removed or narrowed recipient from
// regaining an old queued message after being re-added to a project.
export const recipientAuthority = (mail='q') => `EXISTS(SELECT 1 FROM spool_members m JOIN oa_operators o ON o.id=m.operator_id
 JOIN spool_project_teams t ON t.project=${mail}.project AND t.organization=m.organization
 LEFT JOIN spool_notification_preferences p ON p.project=t.project AND p.operator_id=o.id AND p.historical=0
 WHERE m.operator_id=${mail}.operator_id AND m.version=${mail}.member_version AND o.version=${mail}.operator_version
 AND m.state='active' AND o.status='active' AND (json_extract(p.email,'$.'||${mail}.type)=1 OR ${mail}.type='issue_alert' AND EXISTS(SELECT 1 FROM spool_personal_rule_settings x JOIN alert_rules r ON r.project=x.project AND r.id=x.rule_id AND r.enabled=1 JOIN alerts a ON a.project=x.project AND a.id=${mail}.source,json_each(r.kinds) k WHERE x.project=${mail}.project AND x.mandatory=1 AND x.historical=0 AND k.value=a.kind) OR
 ${mail}.type IN('daily_digest','weekly_digest') AND EXISTS(SELECT 1 FROM spool_personal_digest_settings d WHERE d.project=${mail}.project AND d.operator_id=o.id AND d.historical=0 AND CASE ${mail}.type WHEN 'daily_digest' THEN d.daily ELSE d.weekly END=1))
 AND (o.role='owner' OR m.role='admin' OR m.role IN('member','read-only') AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=t.project))
 AND NOT ${legacyDigestStarted(mail)}
 AND (${mail}.issue IS NULL OR EXISTS(SELECT 1 FROM issues WHERE project=${mail}.project AND id=${mail}.issue)
  AND (${mail}.type='issue_alert' OR NOT EXISTS(SELECT 1 FROM issue_subscriptions x WHERE x.project=${mail}.project AND x.issue=${mail}.issue AND x.operator_id=o.id AND x.reason='manual' AND x.state='unsubscribed'))))`;
export async function personalBatch(env:AlertEnvironment,project:string,jobs:D1PreparedStatement[]) {
 return auditedBatch(env.DB,[...jobs,auditCommit(env.DB,'changes()>0')],{actor:await serviceActor(env.DB,'mail'),subject:await auditSubject(env.DB,'project',project,project),projectLabel:await projectAuditLabel(env.DB,project),action:'notification.preferences'});
}
async function queuePersonalDigests(env:AlertEnvironment,time:number) {
 const db=env.DB,rows=(await s(db,`SELECT p.*,COALESCE(d.timezone,'UTC') timezone,COALESCE(d.hour,9) hour,COALESCE(d.daily,0) daily,COALESCE(d.weekly,0) weekly,COALESCE(d.updated,p.updated) digest_updated,
 m.version member_version,o.version operator_version FROM spool_notification_preferences p
 JOIN spool_members m ON m.operator_id=p.operator_id AND m.state='active' JOIN oa_operators o ON o.id=m.operator_id AND o.status='active'
 JOIN spool_project_teams t ON t.project=p.project AND t.organization=m.organization
 LEFT JOIN spool_personal_digest_settings d ON d.project=p.project AND d.operator_id=p.operator_id AND d.historical=0
 WHERE p.historical=0 AND (json_extract(p.email,'$.weekly_report')=1 OR d.daily=1 OR d.weekly=1)
 AND (o.role='owner' OR m.role='admin' OR m.role IN('member','read-only') AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=p.project))`).all<any>()).results;
 for(const row of rows)for(const type of ['weekly_report','daily_digest','weekly_digest']) {
  if(type==='weekly_report'?!JSON.parse(row.email).weekly_report:!row[type==='daily_digest'?'daily':'weekly'])continue;
  const period=digestPeriod(time,row.timezone,type==='daily_digest'?'daily':'weekly',row.hour);
  if(period.due<(type==='weekly_report'?row.updated:row.digest_updated))continue;
  await personalBatch(env,row.project,[s(db,`INSERT INTO spool_personal_mail(id,project,source,type,issue,operator_id,recipient_label,member_version,operator_version,created,updated,period_start,period_end,timezone)
   SELECT ?,?,?,?,NULL,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(
    SELECT 1 FROM alert_scheduled_mail a JOIN oa_operators o ON o.id=? AND o.role='owner'
    WHERE a.project=? AND a.scope='personal' AND a.historical=0 AND a.kind||'_digest'=? AND a.period=? AND a.state IN('running','accepted','uncertain'))
   ON CONFLICT(project,source,type,recipient_label) DO NOTHING`,crypto.randomUUID().replaceAll('-',''),row.project,type+':'+period.key,type,row.operator_id,row.actor_label,row.member_version,row.operator_version,time,time,period.start,period.end,row.timezone,row.operator_id,row.project,type,period.key)]);
 }
}
async function content(env:AlertEnvironment,row:any,time:number) {
 if(row.type==='issue_alert'){
  const rules=(await s(env.DB,`SELECT r.name FROM spool_personal_rule_settings x JOIN alert_rules r ON r.project=x.project AND r.id=x.rule_id AND r.enabled=1 JOIN alerts a ON a.project=x.project AND a.id=?,json_each(r.kinds) k WHERE x.project=? AND x.mandatory=1 AND x.historical=0 AND k.value=a.kind ORDER BY r.id`,row.source,row.project).all<any>()).results;
  if(rules.length)return `Spool issue alert notification. Project: ${row.project}.\nMandatory rules: ${rules.map(row=>row.name).join(', ')}. Optional personal alerts can be stopped with the link. Ask an organization administrator to change mandatory delivery.`;
 }
 if(!['weekly_report','daily_digest','weekly_digest'].includes(row.type))return `Spool ${row.type.replaceAll('_',' ')} notification.\nProject: ${row.project}.\nNo captured event payload or private account identity is included.`;
 const period={start:row.period_start,end:row.period_end},db=env.DB;
 const [issues,usage,held,pending]=await Promise.all([
  s(db,"SELECT COUNT(*) total,SUM(first_seen>=? AND first_seen<?) new_count,SUM(state='open') open_count FROM issues WHERE project=?",period.start,period.end,row.project).first<any>(),
  s(db,'SELECT reason,SUM(count) count FROM outcomes WHERE project=? AND window>=? AND window<? GROUP BY reason ORDER BY reason',row.project,period.start,period.end).all<any>(),
  s(db,'SELECT COUNT(*) n FROM alert_suppressed WHERE project=? AND released_at IS NULL',row.project).first<any>(),
  s(db,"SELECT state,COUNT(*) count FROM spool_personal_mail WHERE project=? AND operator_id=? AND state NOT IN('accepted','historical','canceled') GROUP BY state ORDER BY state",row.project,row.operator_id).all<any>(),
 ]);
 return `Spool ${row.type.replaceAll('_',' ')}. Project: ${row.project}.\nTimezone: ${row.timezone}. Calendar period: ${row.source.slice(row.source.indexOf(':')+1)}.\nNew issues: ${issues?.new_count??0}; open: ${issues?.open_count??0}; retained: ${issues?.total??0}.\nCapture receipts including loss: ${usage.results.map(r=>`${r.reason} ${r.count}`).join(', ')||'none'}.\nHeld alerts: ${held?.n??0}. Personal delivery backlog: ${pending.results.map(r=>`${r.state} ${r.count}`).join(', ')||'none'}.\nFull backlog remains in Spool. No captured event payload is included.`;
}
export async function personalNotifications(env:AlertEnvironment,time:number) {
 await queuePersonalDigests(env,time);
 await s(env.DB,`UPDATE spool_personal_mail SET state=(SELECT state FROM alert_mail_jobs WHERE id=rule_delivery),code=(SELECT code FROM alert_mail_jobs WHERE id=rule_delivery),updated=MAX(updated,?) WHERE state='delegated' AND historical=0 AND EXISTS(SELECT 1 FROM alert_mail_jobs WHERE id=rule_delivery)`,time).run();
 const db=env.DB;
 await s(db,"UPDATE spool_personal_mail SET state='uncertain',code='claim_expired',updated=? WHERE historical=0 AND state='running' AND updated+60000<=?",time,time).run();
 const rows=(await s(db,"SELECT * FROM spool_personal_mail WHERE historical=0 AND state='queued' ORDER BY created,id LIMIT 30").all<any>()).results;
 for(const row of rows) {
  let mail,origin:URL;
  try {mail=sender(env);origin=new URL(env.ALERT_PUBLIC_ORIGIN||env.AUTH_ORIGIN!);if(origin.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)||origin.username||origin.password)throw 0;}
  catch {await personalBatch(env,row.project,[s(db,"UPDATE spool_personal_mail SET state='blocked',code='mail_unconfigured',updated=? WHERE id=? AND state='queued'",time,row.id)]);continue;}
  const raw=token(),digest=await hash(raw);
  const claimed=await personalBatch(env,row.project,[
   s(db,`UPDATE spool_personal_mail AS q SET state='running',updated=? WHERE id=? AND historical=0 AND state='queued' AND ${recipientAuthority()} RETURNING id`,time,row.id),
   s(db,`INSERT INTO spool_personal_unsubscribe(token_hash,delivery,project,operator_id,type,member_version,operator_version,created)
    SELECT ?,id,project,operator_id,type,member_version,operator_version,? FROM spool_personal_mail WHERE id=? AND state='running' AND updated=? AND changes()>0`,digest,time,row.id,time),
  ]);
  if(!claimed[0].results.length){await personalBatch(env,row.project,[s(db,"UPDATE spool_personal_mail SET state='canceled',code='recipient_unavailable',updated=? WHERE id=? AND state='queued'",time,row.id)]);continue;}
  const body=await content(env,row,time);
  const recipient=await s(db,`SELECT o.email FROM spool_personal_mail q JOIN oa_operators o ON o.id=q.operator_id WHERE q.id=? AND q.state='running' AND q.updated=? AND ${recipientAuthority()}`,row.id,time).first<{email:string}>();
  if(!recipient){await personalBatch(env,row.project,[s(db,"UPDATE spool_personal_mail SET state='canceled',code='recipient_unavailable',updated=? WHERE id=? AND state='running'",time,row.id)]);continue;}
  const settings=new URL('/projects/'+encodeURIComponent(row.project)+'/settings',origin!);
  const target=new URL(row.issue?'/projects/'+encodeURIComponent(row.project)+'/issues/'+encodeURIComponent(row.issue):'/projects/'+encodeURIComponent(row.project)+'/releases',origin!);
  const unsubscribe=new URL('/notifications/unsubscribe/'+raw,origin!);
  const text=body+`\nOpen: ${target}\nSettings: ${settings}\nUnsubscribe from this type in this project: ${unsubscribe}`;
  let state='uncertain',code='response_unknown';
  try {const result=await mail!.send({deliveryId:row.id,from:env.MAIL_FROM!,to:[recipient.email],subject:'Spool personal '+row.type.replaceAll('_',' '),text});state=result.status==='development'?'accepted':result.status;code='mail_'+result.status;}
  catch { /* A started send with an unknown response is never blindly repeated. */ }
  await personalBatch(env,row.project,[s(db,"UPDATE spool_personal_mail SET state=?,code=?,updated=? WHERE id=? AND state='running' AND updated=?",state,code,time,row.id,time)]);
 }
}

export async function personalUnsubscribe(request:Request,env:AlertEnvironment):Promise<Response|null> {
 const path=new URL(request.url).pathname;
 if(!path.startsWith('/notifications/unsubscribe/'))return null;
 const headers={'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
 if(!['GET','POST'].includes(request.method))return new Response('Method not allowed',{status:405,headers});
 const raw=path.slice('/notifications/unsubscribe/'.length);
 if(!/^[a-f0-9]{64}$/.test(raw)||new URL(request.url).search)return new Response('Link unavailable',{status:404,headers});
 const digest=await hash(raw),db=env.DB;
 const row=await s(db,`SELECT u.*,p.recipient_label FROM spool_personal_unsubscribe u JOIN spool_personal_mail p ON p.id=u.delivery
 WHERE u.token_hash=? AND p.historical=0`,digest).first<any>();
 if(!row)return new Response('Link unavailable',{status:404,headers});
 // The token is a narrow capability: only its original recipient, type and
 // project can change, and removal or erasure retires the capability.
 const active=`EXISTS(SELECT 1 FROM spool_members m JOIN oa_operators o ON o.id=m.operator_id JOIN spool_project_teams t ON t.organization=m.organization
 WHERE m.operator_id=spool_notification_preferences.operator_id AND t.project=spool_notification_preferences.project
 AND m.version=? AND o.version=? AND m.state='active' AND o.status='active'
 AND (o.role='owner' OR m.role='admin' OR m.role IN('member','read-only') AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=t.project)))`;
 await personalBatch(env,row.project,[
  ...row.type.endsWith('_digest')?[s(db,`UPDATE spool_personal_digest_settings SET ${row.type==='daily_digest'?'daily':'weekly'}=0,revision=revision+1,updated=? WHERE project=? AND operator_id=? AND historical=0 AND ${row.type==='daily_digest'?'daily':'weekly'}=1 AND ${active.replaceAll('spool_notification_preferences','spool_personal_digest_settings')}`,Date.now(),row.project,row.operator_id,row.member_version,row.operator_version)]:[s(db,`UPDATE spool_notification_preferences SET email=json_set(email,?,json('false')),revision=revision+1,updated=? WHERE project=? AND operator_id=? AND historical=0 AND json_extract(email,?)=1 AND ${active}`, '$.'+row.type,Date.now(),row.project,row.operator_id,'$.'+row.type,row.member_version,row.operator_version)],
  auditCommit(db,'changes()>0'),
  s(db,`UPDATE spool_personal_mail SET state='canceled',code='unsubscribed',updated=MAX(updated,?) WHERE project=? AND operator_id=? AND type=? AND state='queued' AND changes()>0
   AND (type<>'issue_alert' OR NOT EXISTS(SELECT 1 FROM spool_personal_rule_settings x JOIN alert_rules r ON r.project=x.project AND r.id=x.rule_id AND r.enabled=1
    JOIN alerts a ON a.project=x.project AND a.id=spool_personal_mail.source,json_each(r.kinds) k WHERE x.project=spool_personal_mail.project AND x.mandatory=1 AND x.historical=0 AND k.value=a.kind))`,Date.now(),row.project,row.operator_id,row.type),
  ...row.type.endsWith('_digest')?[
   s(db,`UPDATE alert_digest_settings SET personal_${row.type==='daily_digest'?'daily':'weekly'}=0,updated=? WHERE project=? AND personal_${row.type==='daily_digest'?'daily':'weekly'}=1
    AND EXISTS(SELECT 1 FROM spool_notification_preferences WHERE project=alert_digest_settings.project AND operator_id=? AND historical=0 AND ${active})
    AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')`,Date.now(),row.project,row.operator_id,row.member_version,row.operator_version,row.operator_id),
   auditCommit(db,'changes()>0'),
   s(db,`UPDATE alert_scheduled_mail SET state='canceled',code='unsubscribed',updated=MAX(updated,?) WHERE project=? AND scope='personal' AND kind=? AND state='queued'
    AND EXISTS(SELECT 1 FROM spool_notification_preferences WHERE project=alert_scheduled_mail.project AND operator_id=? AND historical=0 AND ${active})
    AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')`,Date.now(),row.project,row.type==='daily_digest'?'daily':'weekly',row.operator_id,row.member_version,row.operator_version,row.operator_id),
  ]:[],
 ]);
 return new Response('Optional email notifications of this type are off for this project. Other members are unaffected.',{headers});
}
