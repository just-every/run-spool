import { eligibleEvent, eventFilter, ruleConfig, userKey } from './filters';
import { metricConfig } from './metric-rules';
import { metricQuery } from './metric-measure';
import { statement as s } from './types';
import { waitingForSession, waitingForUser } from './import-state';

export async function activateImportedAlerts(db: D1Database, time: number) {
  const rows = await s(db, `SELECT r.id,r.project,r.created,r.window_ms,r.kinds,c.config,m.reason
    FROM alert_metric_states m JOIN alert_rules r ON r.id=m.rule_id AND r.revision=m.revision
    JOIN alert_rule_configs c ON c.rule_id=r.id AND c.revision=r.revision
    WHERE r.enabled=0 AND r.revision=1 AND m.reason IN (?,?) ORDER BY m.updated,r.id LIMIT 50`,
    waitingForUser, waitingForSession).all<{id:string;project:string;created:number;window_ms:number;kinds:string;config:string;reason:string}>();
  for (const rule of rows.results) {
    if (rule.created > time) continue;
    const spike = rule.kinds === '["spike"]';
    const config = JSON.parse(rule.config);
    const filter = spike ? eventFilter(ruleConfig(config)) : null;
    const query = filter ? {
      sql: `SELECT 1 FROM events e LEFT JOIN event_identities x ON x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence
        JOIN issues i ON i.id=e.issue AND i.project=e.project
        WHERE e.project=? AND e.received>=? AND e.received<=? AND ${eligibleEvent()} AND ${filter.sql}
        AND ${userKey} IS NOT NULL AND i.state<>'suppressed' LIMIT 1`,
      args: [rule.project, rule.created, time, ...filter.args],
    } : metricQuery(rule.project,metricConfig(config),rule.created,time+1);
    const observed = spike ? `EXISTS(${query.sql})` : `EXISTS(SELECT 1 FROM (${query.sql}) measured WHERE measured.samples>0)`;
    await db.batch([
      s(db, `UPDATE alert_rules SET enabled=1 WHERE id=? AND revision=1 AND enabled=0
        AND EXISTS(SELECT 1 FROM alert_metric_states WHERE rule_id=? AND revision=1 AND reason=?) AND ${observed}`,
        rule.id, rule.id, rule.reason, ...query.args),
      ...spike ? [s(db,`INSERT INTO alert_cursors SELECT id,project,revision,? FROM alert_rules
        WHERE id=? AND enabled=1 AND revision=1 AND changes()=1 ON CONFLICT(rule_id) DO NOTHING`,
        Math.floor(time/rule.window_ms)*rule.window_ms,rule.id)] : [],
      s(db,`DELETE FROM alert_metric_states WHERE rule_id=? AND revision=1 AND reason=?
        AND EXISTS(SELECT 1 FROM alert_rules WHERE id=? AND revision=1 AND enabled=1)`,rule.id,rule.reason,rule.id),
      // Rotate the bounded scan even if a quiet project is still waiting.
      s(db,'UPDATE alert_metric_states SET updated=? WHERE rule_id=? AND revision=1 AND reason=?',time,rule.id,rule.reason),
    ]);
  }
}
