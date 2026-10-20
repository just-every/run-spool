import { statement as s,type AlertEnvironment } from './types';
import { localDate } from './calendar';
import { alertServiceBatch } from './scheduled-mail';
export async function expireSnoozes(env:AlertEnvironment,time:number){
 const rows=(await s(env.DB,'SELECT * FROM alert_snoozes WHERE historical=0 AND resumed_at IS NULL AND until<=?',time).all<any>()).results;
 for(const row of rows){
  const count=await s(env.DB,'SELECT COUNT(*) n FROM alert_suppressed WHERE snooze_id=?',row.id).first<any>();
  await alertServiceBatch(env,row.project,[
   s(env.DB,`INSERT INTO alert_scheduled_mail(id,project,kind,scope,period,body,created,updated)
    SELECT ?,project,'resumption','personal',id,?,?,? FROM alert_snoozes WHERE id=? AND resumed_at IS NULL AND historical=0
    ON CONFLICT(project,kind,scope,period) DO NOTHING`,'resume-'+row.id,`Spool snooze expired. ${row.scope}: ${row.target}. Held alerts: ${count?.n??0}. Capture continued. Inspect Alerts → Digests and snoozes and Needs attention; held deliveries remain listed until explicitly released.`,time,time,row.id),
   s(env.DB,'UPDATE alert_snoozes SET resumed_at=? WHERE id=? AND resumed_at IS NULL AND historical=0',time,row.id),
  ]);
 }
}
// The admission transaction records explicit snoozes. This also holds work
// waiting on configuration, and quiet hours are evaluated before expansion.
export function quietActive(c:any,time:number){const {hour}=localDate(time,c.timezone);return c.quiet_start!==null&&(c.quiet_start<c.quiet_end?hour>=c.quiet_start&&hour<c.quiet_end:hour>=c.quiet_start||hour<c.quiet_end)}
const holdable=`(i.expanded=0 AND i.state IN ('pending','blocked') OR EXISTS(SELECT 1 FROM alert_mail_jobs j WHERE j.id=i.id AND j.state='queued') OR EXISTS(SELECT 1 FROM integration_deliveries d WHERE d.namespace='spool.'||i.project AND d.id=i.id AND d.state='queued'))`;
export async function holdAlerts(env:AlertEnvironment,time:number){
 const projects=(await s(env.DB,`SELECT DISTINCT project FROM alert_snoozes WHERE historical=0 AND resumed_at IS NULL AND until>? UNION SELECT project FROM alert_digest_settings WHERE quiet_start IS NOT NULL`,time).all<any>()).results;
 for(const {project} of projects){
  const quiet=await s(env.DB,'SELECT timezone,quiet_start,quiet_end FROM alert_digest_settings WHERE project=?',project).first();
  await alertServiceBatch(env,project,[
   s(env.DB,`INSERT INTO alert_suppressed(delivery_id,project,snooze_id,reason,created)
    SELECT i.id,i.project,z.id,'snooze',? FROM alert_intents i JOIN alerts a ON a.id=i.alert_id JOIN alert_snoozes z ON z.project=i.project AND z.historical=0 AND z.resumed_at IS NULL AND z.until>?
     AND (z.scope='project' OR z.scope='issue' AND z.target=a.issue OR z.scope='rule' AND z.target=i.rule_id)
    WHERE i.project=? AND i.state<>'snoozed' AND ${holdable}
    ON CONFLICT(delivery_id) DO UPDATE SET released_at=NULL,snooze_id=excluded.snooze_id,reason='snooze'`,time,time,project),
   s(env.DB,`UPDATE alert_intents SET state='snoozed',code='snooze' WHERE state IN ('pending','blocked','queued','snoozed') AND code IS NOT 'retention_removed' AND project=? AND id IN(SELECT delivery_id FROM alert_suppressed WHERE project=? AND released_at IS NULL)`,project,project),
   ...(quiet&&quietActive(quiet,time)?[
    s(env.DB,`INSERT INTO alert_suppressed(delivery_id,project,reason,created) SELECT i.id,i.project,'quiet_hours',? FROM alert_intents i WHERE i.project=? AND i.state<>'snoozed' AND ${holdable}
     ON CONFLICT(delivery_id) DO UPDATE SET released_at=NULL,snooze_id=NULL,reason='quiet_hours'`,time,project),
    s(env.DB,`UPDATE alert_intents SET state='snoozed',code='quiet_hours' WHERE state IN ('pending','blocked','queued','snoozed') AND code IS NOT 'retention_removed' AND project=? AND id IN(SELECT delivery_id FROM alert_suppressed WHERE project=? AND reason='quiet_hours' AND released_at IS NULL)`,project,project),
   ]:[]),
  ]);
 }
}
