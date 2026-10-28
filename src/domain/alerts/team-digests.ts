import { activeTeamRecipient } from '../members/notifications';
import { scrub } from '../privacy';
import { digestPeriod } from './calendar';
import { alertServiceBatch } from './scheduled-mail';
import { statement as s,type AlertEnvironment } from './types';

export async function queueTeamDigests(env:AlertEnvironment,time:number) {
 const settings=(await s(env.DB,'SELECT * FROM spool_team_digest_settings WHERE daily=1 OR weekly=1').all<any>()).results;
 for(const row of settings)for(const kind of ['daily','weekly'] as const){
  if(!row[kind]||!await activeTeamRecipient(env.DB,row.organization,row.team,row.member))continue;
  const period=digestPeriod(time,row.timezone,kind,row.hour);
  if(period.due<row.created)continue;
  const projects=(await s(env.DB,`SELECT t.project FROM spool_project_teams t JOIN spool_members m ON m.id=? AND m.organization=t.organization
   JOIN oa_operators o ON o.id=m.operator_id AND o.status='active'
   WHERE t.organization=? AND t.team=? AND m.state='active' AND (o.role='owner' OR m.role='admin' OR
    EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.project=t.project AND g.member=m.id)) ORDER BY t.project`,row.member,row.organization,row.team).all<{project:string}>()).results;
  if(!projects.length)continue;
  const lines:string[]=[];
  for(const {project} of projects){
   const [issues,usage,attention,held]=await Promise.all([
    s(env.DB,`SELECT id,title,state FROM issues WHERE project=? AND (first_seen>=? AND first_seen<? OR state='open') ORDER BY first_seen DESC LIMIT 50`,project,period.start,period.end).all<any>(),
    s(env.DB,'SELECT reason,SUM(count) count FROM outcomes WHERE project=? AND window>=? AND window<? GROUP BY reason ORDER BY reason',project,period.start,period.end).all<any>(),
    s(env.DB,"SELECT state,COUNT(*) count FROM follow_up_attention WHERE project=? AND state NOT IN ('completed','canceled') GROUP BY state ORDER BY state",project).all<any>(),
    s(env.DB,'SELECT COUNT(*) n FROM alert_suppressed WHERE project=? AND released_at IS NULL',project).first<any>(),
   ]);
   lines.push(`Project ${project}: work ${issues.results.length}; held alerts ${held?.n??0}.`);
   lines.push(...issues.results.map((issue:any)=>`${issue.id}: ${scrub(issue.title).slice(0,200)} | ${issue.state}`));
   lines.push(`Capture receipts / usage (including loss): ${usage.results.map((item:any)=>`${item.reason} ${item.count}`).join(', ')||'none'}.`);
   lines.push(`Needs attention: ${attention.results.map((item:any)=>`${item.state} ${item.count}`).join(', ')||'none'}.`);
  }
  const body=`Spool ${kind} team digest for ${row.team}\nTimezone: ${row.timezone}. Completed calendar period: ${period.key}.\nUTC coverage: ${new Date(period.start).toISOString()} to ${new Date(period.end).toISOString()}.\n${lines.join('\n')}\nFull backlog remains in Spool. Quiet hours and maintenance do not remove capture receipts or held alerts. No event payload is included.`;
  // The per-member key permits different project grants within the same team.
  await alertServiceBatch(env,projects[0].project,[s(env.DB,`INSERT INTO spool_team_mail(id,organization,team,member,kind,period,body,created,updated)
   VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(organization,team,member,kind,period) DO NOTHING`,crypto.randomUUID(),row.organization,row.team,row.member,kind,period.key,body,time,time)]);
 }
}
