import {quietActive} from './snoozes';
import {auditCommit} from '../audit/context';
import { ownerBatch } from '../owner-authority';
import { timezone } from './calendar';
import { statement as s } from './types';
import { requireReviewedTest } from './destination-tests.server';
// Mounted inside the authenticated, same-origin project alert router.
export function controlsRoutes(routes:any,input:(c:any)=>Promise<any>){
 routes.get('/controls',async(c:any)=>{
  const p=c.req.param('project'),db=c.env.DB;
  return c.json({settings:await s(db,'SELECT * FROM alert_digest_settings WHERE project=?',p).first()??{timezone:'UTC',daily:0,weekly:0,personal_daily:0,personal_weekly:0,hour:9,quiet_start:null,quiet_end:null,destination:null},
   snoozes:(await s(db,`SELECT z.*,(SELECT COUNT(*) FROM alert_suppressed x WHERE x.snooze_id=z.id) suppressed FROM alert_snoozes z WHERE project=? ORDER BY created DESC`,p).all()).results,
   held:(await s(db,'SELECT x.*,h.rule_id,a.issue FROM alert_suppressed x LEFT JOIN alert_history h ON h.id=x.delivery_id LEFT JOIN alerts a ON a.id=h.alert_id WHERE x.project=? ORDER BY x.created DESC LIMIT 100',p).all()).results,
   digests:(await s(db,'SELECT * FROM alert_scheduled_mail WHERE project=? ORDER BY created DESC LIMIT 50',p).all()).results});
 });
 routes.put('/digest-settings',async(c:any)=>{
  const b=await input(c),p=c.req.param('project'),time=Date.now();
  if(!b||Object.keys(b).sort().join()!=='daily,destination,hour,personal_daily,personal_weekly,quiet_end,quiet_start,timezone,weekly'||['daily','weekly','personal_daily','personal_weekly'].some(k=>typeof b[k]!=='boolean')||!Number.isInteger(b.hour)||b.hour<0||b.hour>23||[b.quiet_start,b.quiet_end].some(x=>x!==null&&(!Number.isInteger(x)||x<0||x>23))||(b.quiet_start===null)!==(b.quiet_end===null)||b.quiet_start!==null&&b.quiet_start===b.quiet_end)throw new Error('Use complete digest settings and distinct quiet-hour endpoints');
  const zone=timezone(b.timezone);
  const testGuard=b.daily||b.weekly?await requireReviewedTest(c.env,p,b.destination,'mail'):null;
  if(b.destination!==null&&typeof b.destination!=='string')throw new Error('Use an email destination');
  await ownerBatch(c.env.DB,c.get('alertSession'),[s(c.env.DB,`INSERT INTO alert_digest_settings VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(project) DO UPDATE SET timezone=excluded.timezone,destination=excluded.destination,daily=excluded.daily,weekly=excluded.weekly,personal_daily=excluded.personal_daily,personal_weekly=excluded.personal_weekly,hour=excluded.hour,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,updated=excluded.updated`,p,zone,b.destination,Number(b.daily),Number(b.weekly),Number(b.personal_daily),Number(b.personal_weekly),b.hour,b.quiet_start,b.quiet_end,time,time),auditCommit(c.env.DB,'changes()>0'),...(testGuard?[testGuard]:[])]);
  return c.json({saved:true});
 });
 routes.post('/snoozes',async(c:any)=>{
  const b=await input(c),p=c.req.param('project'),time=Date.now();
  if(!b||Object.keys(b).sort().join()!=='scope,target,until'||!['issue','rule','project'].includes(b.scope)||typeof b.target!=='string'||!Number.isSafeInteger(b.until)||b.until<=time||b.until>time+366*86400000)throw new Error('Snooze requires a target and future expiry within one year');
  if(b.scope==='project'?b.target!==p:!await s(c.env.DB,`SELECT 1 FROM ${b.scope==='issue'?'issues':'alert_rules'} WHERE project=? AND id=?`,p,b.target).first())throw new Error('Snooze target not found');
  const id=crypto.randomUUID();await ownerBatch(c.env.DB,c.get('alertSession'),[s(c.env.DB,'INSERT INTO alert_snoozes(id,project,scope,target,until,created) VALUES(?,?,?,?,?,?)',id,p,b.scope,b.target,b.until,time),auditCommit(c.env.DB,'changes()>0')]);return c.json({id},201);
 });
 routes.post('/held/release',async(c:any)=>{
  const p=c.req.param('project'),time=Date.now();
  const quiet=await s(c.env.DB,'SELECT timezone,quiet_start,quiet_end FROM alert_digest_settings WHERE project=?',p).first();if(quiet&&quietActive(quiet,time))throw new Error('Quiet hours are active; change the settings or wait before releasing held alerts');
  await ownerBatch(c.env.DB,c.get('alertSession'),[
   s(c.env.DB,`UPDATE alert_intents SET state='pending',code=NULL WHERE project=? AND state='snoozed' AND id IN(SELECT delivery_id FROM alert_suppressed WHERE project=? AND released_at IS NULL) AND NOT EXISTS(SELECT 1 FROM alert_snoozes z JOIN alerts a ON a.id=alert_intents.alert_id WHERE z.project=? AND z.historical=0 AND z.resumed_at IS NULL AND z.until>? AND (z.scope='project' OR z.scope='issue' AND z.target=a.issue OR z.scope='rule' AND z.target=alert_intents.rule_id))
    AND NOT EXISTS(SELECT 1 FROM spool_team_snoozes z JOIN spool_project_teams t ON t.organization=z.organization AND t.team=z.team JOIN alerts a ON a.id=alert_intents.alert_id WHERE t.project=alert_intents.project AND z.historical=0 AND z.resumed_at IS NULL AND z.until>? AND (z.scope='team' OR z.scope='issue' AND z.target=a.issue OR z.scope='rule' AND z.target=alert_intents.rule_id))`,p,p,p,time,time),
   s(c.env.DB,`UPDATE alert_suppressed SET released_at=? WHERE project=? AND released_at IS NULL AND delivery_id IN(SELECT id FROM alert_intents WHERE project=? AND state<>'snoozed')`,time,p,p),
   auditCommit(c.env.DB,'changes()>0'),
  ]);return c.json({released:true});
 });
}
