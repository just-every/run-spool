import { AuthError } from '../../modules/operator-auth/index.mjs';
import { auditCommit } from '../audit/context';
import { ownerBatch } from '../owner-authority';
import { activeTeamRecipient, memberForSession, requireTeamWriter, teamContext, teamWriterGuard } from '../members/notifications';
import { timezone } from './calendar';
import { statement as s } from './types';

// Mounted under /api/projects/:project/alerting; its project router has already
// authenticated the current session and same-origin write.
export function teamControls(routes:any,input:(c:any)=>Promise<any>) {
 routes.get('/team-controls',async(c:any)=>{
  const db=c.env.DB,project=c.req.param('project'),context=await teamContext(db,project);
  if(!context)return c.json({error:'Team not found'},404);
  const session=c.get('alertSession'),member=await memberForSession(db,session);
  const privileged=session.operator.role==='owner'||session.membership?.role==='admin';
  const settings=(await s(db,`SELECT organization,team,member,timezone,daily,weekly,hour,created,updated
   FROM spool_team_digest_settings WHERE organization=? AND team=? ${privileged?'':'AND member=?'} ORDER BY member`,context.organization,context.team,...privileged?[]:[member?.id??'']).all()).results;
  const snoozes=(await s(db,`SELECT z.*,(SELECT COUNT(*) FROM alert_suppressed x WHERE x.snooze_id=z.id AND x.project=?) suppressed
   FROM spool_team_snoozes z WHERE organization=? AND team=? ${privileged?'':"AND (z.scope='team' OR z.scope='issue' AND EXISTS(SELECT 1 FROM issues i WHERE i.id=z.target AND i.project=?) OR z.scope='rule' AND EXISTS(SELECT 1 FROM alert_rules r WHERE r.id=z.target AND r.project=?))"} ORDER BY created DESC LIMIT 100`,project,context.organization,context.team,...privileged?[]:[project,project]).all()).results;
  const mail=(await s(db,`SELECT id,member,kind,period,state,code,created,updated FROM spool_team_mail
   WHERE organization=? AND team=? ${privileged?'':'AND member=?'} ORDER BY created DESC LIMIT 50`,context.organization,context.team,...privileged?[]:[member?.id??'']).all()).results;
  let canManage=true;
  try{await requireTeamWriter(db,session,context.organization,context.team)}catch(error){if(!(error instanceof AuthError))throw error;canManage=false;}
  const recipients:any[]=[];
  if(canManage)for(const candidate of (await s(db,"SELECT id,name FROM spool_members WHERE organization=? AND state='active' ORDER BY created,id",context.organization).all<any>()).results){
   if(await activeTeamRecipient(db,context.organization,context.team,candidate.id))recipients.push(candidate);
  }
  return c.json({organization:context.organization,team:context.team,settings,snoozes,mail,canManage,recipients});
 });
 routes.put('/team-digests',async(c:any)=>{
  const db=c.env.DB,project=c.req.param('project'),session=c.get('alertSession'),context=await teamContext(db,project);
  if(!context)return c.json({error:'Team not found'},404);
  await requireTeamWriter(db,session,context.organization,context.team);
  const b=await input(c),time=Date.now();
  if(!b||Object.keys(b).sort().join()!=='daily,hour,member,timezone,weekly'||typeof b.member!=='string'||typeof b.daily!=='boolean'||typeof b.weekly!=='boolean'||!Number.isInteger(b.hour)||b.hour<0||b.hour>23)throw new Error('Complete team digest settings required');
  const zone=timezone(b.timezone);
  if(!await activeTeamRecipient(db,context.organization,context.team,b.member))throw new Error('Active team member required');
  await ownerBatch(db,session,[teamWriterGuard(db,session,context.organization,context.team),
   s(db,`INSERT INTO spool_team_digest_settings(organization,team,member,timezone,daily,weekly,hour,created,updated)
    VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(organization,team,member) DO UPDATE SET timezone=excluded.timezone,daily=excluded.daily,weekly=excluded.weekly,hour=excluded.hour,updated=excluded.updated`,context.organization,context.team,b.member,zone,Number(b.daily),Number(b.weekly),b.hour,time,time),auditCommit(db,'changes()>0')]);
  return c.json({saved:true});
 });
 routes.post('/team-snoozes',async(c:any)=>{
  const db=c.env.DB,project=c.req.param('project'),session=c.get('alertSession'),context=await teamContext(db,project);
  if(!context)return c.json({error:'Team not found'},404);
  await requireTeamWriter(db,session,context.organization,context.team);
  const b=await input(c),time=Date.now(),creator=await memberForSession(db,session);
  if(!creator||creator.organization!==context.organization)throw new Error('Active organization member required');
  if(!b||Object.keys(b).sort().join()!=='scope,target,until'||!['team','issue','rule'].includes(b.scope)||typeof b.target!=='string'||!Number.isSafeInteger(b.until)||b.until<=time||b.until>time+366*86400000)throw new Error('Team snooze needs a target and future expiry within one year');
  if(b.scope==='team'?b.target!==context.team:!await s(db,`SELECT 1 FROM ${b.scope==='issue'?'issues':'alert_rules'} x JOIN spool_project_teams t ON t.project=x.project WHERE x.id=? AND t.organization=? AND t.team=?`,b.target,context.organization,context.team).first())throw new Error('Team snooze target not found');
  const id=crypto.randomUUID();
  await ownerBatch(db,session,[teamWriterGuard(db,session,context.organization,context.team),
   s(db,'INSERT INTO spool_team_snoozes(id,organization,team,scope,target,until,created,creator) VALUES(?,?,?,?,?,?,?,?)',id,context.organization,context.team,b.scope,b.target,b.until,time,creator.id),auditCommit(db,'changes()>0')]);
  return c.json({id},201);
 });
}
