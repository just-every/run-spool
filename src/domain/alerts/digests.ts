import { ownerDigestEnabled, personalDigestExists } from '../notifications/digest-identity';
import { scrub } from '../privacy';
import { primaryShortIdSql } from '../short-ids/lookup';
import { digestPeriod } from './calendar';
import { alertServiceBatch } from './scheduled-mail';
import { queueTeamDigests } from './team-digests';
import { statement as s,type AlertEnvironment } from './types';
export const scrubDigest=(value:string)=>value.split('\n').map(line=>scrub(line)).join('\n');
export async function queueDigests(env:AlertEnvironment,time:number){
 await queueTeamDigests(env,time);
 const settings=(await s(env.DB,'SELECT * FROM alert_digest_settings WHERE daily=1 OR weekly=1 OR personal_daily=1 OR personal_weekly=1').all<any>()).results;
 for(const c of settings)for(const scope of ['project','personal'])for(const kind of ['daily','weekly']){
  if(!c[scope==='personal'?'personal_'+kind:kind])continue;
  const period=digestPeriod(time,c.timezone,kind,c.hour);
  // Enabling does not backfill old periods; restore exports disable schedules.
  if(period.due<c.created)continue;
  const issues=(await s(env.DB,`WITH work AS (SELECT i.id,i.title,i.state,${primaryShortIdSql('i')} short_id,
   i.first_seen>=? AND i.first_seen<? new_work,
   EXISTS(SELECT 1 FROM alerts a WHERE a.project=i.project AND a.issue=i.id AND a.kind='regression' AND a.created>=? AND a.created<?) regressed,
   NOT EXISTS(SELECT 1 FROM issue_assignments x WHERE x.project=i.project AND x.issue=i.id) unowned
   FROM issues i WHERE i.project=?) SELECT * FROM work WHERE new_work OR regressed OR state='open' ORDER BY id`,period.start,period.end,period.start,period.end,c.project).all<any>()).results;
  const usage=(await s(env.DB,'SELECT reason,SUM(count) count FROM outcomes WHERE project=? AND window>=? AND window<? GROUP BY reason ORDER BY reason',c.project,period.start,period.end).all<any>()).results;
  const attention=(await s(env.DB,"SELECT source,state,reason,COUNT(*) count FROM follow_up_attention WHERE project=? AND state NOT IN ('completed','canceled') GROUP BY source,state,reason ORDER BY source,state,reason",c.project).all<any>()).results;
  const suppressed=await s(env.DB,'SELECT COUNT(*) n FROM alert_suppressed WHERE project=? AND released_at IS NULL',c.project).first<any>();
  const body=scrubDigest(`Spool ${kind} ${scope} digest for ${c.project}\nTimezone: ${c.timezone}. Completed calendar period: ${period.key}.\nUTC coverage: ${new Date(period.start).toISOString()} to ${new Date(period.end).toISOString()}.\nPersonal means the installation owner.\nNew: ${issues.filter(i=>i.new_work).length}; regressed: ${issues.filter(i=>i.regressed).length}; unowned: ${issues.filter(i=>i.unowned).length}; work total: ${issues.length}.\nNew / regressed / unowned work (first 50; full backlog stays in Spool):\n${issues.slice(0,50).map(i=>`${i.short_id?i.short_id+' ':''}${i.id}: ${scrub(i.title).slice(0,240)} | ${i.state}${i.new_work?' | new':''}${i.regressed?' | regressed':''}${i.unowned?' | unowned':''}`).join('\n')}\nCapture receipts / usage (including loss):\n${usage.map(r=>`${r.reason}: ${r.count}`).join('\n')}\nFailed or overdue automation / Needs attention:\n${attention.map(a=>`${a.source}: ${a.state} / ${a.reason}: ${a.count}`).join('\n')}\nHeld alert backlog: ${suppressed?.n??0}. Quiet hours and maintenance do not remove receipts or backlog.\nNo event payload is included.`);
  await alertServiceBatch(env,c.project,[s(env.DB,`INSERT INTO alert_scheduled_mail(id,project,kind,scope,period,body,created,updated) SELECT ?,?,?,?,?,?,?,? WHERE ?<>'personal' OR NOT (${ownerDigestEnabled('?','?')} OR ${personalDigestExists('?','?','?')}) ON CONFLICT(project,kind,scope,period) DO NOTHING`,crypto.randomUUID(),c.project,kind,scope,period.key,body,time,time,scope,c.project,kind,c.project,kind,period.key)]);
 }
}
