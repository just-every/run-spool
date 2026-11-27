import { holdable } from '../alerts/snoozes';
import { waitingForSession, waitingForUser } from '../alerts/import-state';
import { suppressionEligible } from '../suppression/schedule';

// One statement records the tick and identifies which stages have work.
// ?1 the scheduled time, ?2 the wall clock (never before the schedule), ?3 the scheduled minute,
// ?4 the transaction expiry, ?5 the retention day, ?6 whether this is a quarter hour, ?7 and ?8 waiting reasons.
const attention = (project: string, source: string, id: string) =>
 `NOT EXISTS(SELECT 1 FROM follow_up_attention fa WHERE fa.project=${project} AND fa.source='${source}' AND fa.source_id=${id})`;
const lastStep = `(SELECT state FROM deployment_steps WHERE project=r.project AND deployment=r.id ORDER BY sequence DESC LIMIT 1)`;
const heldProjects = `SELECT project FROM alert_snoozes WHERE historical=0 AND resumed_at IS NULL AND until>?1
 UNION SELECT project FROM alert_digest_settings WHERE quiet_start IS NOT NULL
 UNION SELECT t.project FROM spool_team_snoozes z JOIN spool_project_teams t ON t.organization=z.organization AND t.team=z.team WHERE z.historical=0 AND z.resumed_at IS NULL AND z.until>?1`;
// A gate's sweep is due when one of its inputs changed or it has not run for an hour (work-gates.ts).
const gate = (name: string) => `NOT EXISTS(SELECT 1 FROM spool_work_gates WHERE name='${name}' AND pending=done AND ?1>=run_at AND ?1-run_at<3600000)`;

const followUp = `CASE
 WHEN EXISTS(SELECT 1 FROM follow_up_legacy_loss) THEN 1
 WHEN EXISTS(SELECT 1 FROM follow_up_fix_steps WHERE state='running' AND due<=?1) THEN 1
 WHEN EXISTS(SELECT 1 FROM follow_up_alert_work w WHERE ready=1 AND ready_at<=?1 AND ${attention('w.project', 'alert', 'w.source_id')}) THEN 1
 WHEN EXISTS(SELECT 1 FROM deployment_notices n JOIN deployment_runs r ON r.project=n.project AND r.id=n.deployment
  WHERE r.historical=0 AND r.deadline<=?1 AND (n.state IN ('blocked','uncertain','rejected','pending') OR ${lastStep}='timed_out')
  AND ${attention('n.project', 'deployment', 'n.deployment')}) THEN 1
 WHEN EXISTS(SELECT 1 FROM fix_leases l WHERE l.until<=?1 AND ${attention('l.project', 'fix', 'l.workflow')}) THEN 1
 WHEN EXISTS(SELECT 1 FROM follow_up_fix_steps f WHERE f.state IN ('uncertain','rejected') AND ${attention('f.project', 'fix', 'f.workflow')}) THEN 1
 WHEN EXISTS(SELECT 1 FROM alert_snoozes z WHERE z.historical=0 AND z.until<=?1
  AND EXISTS(SELECT 1 FROM alert_suppressed x WHERE x.snooze_id=z.id AND x.released_at IS NULL) AND ${attention('z.project', 'alert', "'snooze:'||z.id")}) THEN 1
 WHEN EXISTS(SELECT 1 FROM alert_suppressed x JOIN alert_history h ON h.id=x.delivery_id WHERE x.released_at IS NULL AND h.historical=0
  AND ${attention('x.project', 'alert', "'held:'||x.delivery_id")}) THEN 1
 WHEN EXISTS(SELECT 1 FROM alert_scheduled_mail m WHERE m.historical=0 AND m.state IN ('blocked','rejected','uncertain')
  AND ${attention('m.project', 'alert', "'scheduled:'||m.id")}) THEN 1
 WHEN EXISTS(SELECT 1 FROM spool_team_mail m JOIN spool_project_teams t ON t.organization=m.organization AND t.team=m.team
  WHERE m.historical=0 AND m.state IN ('blocked','rejected','uncertain')
  AND t.project=(SELECT project FROM spool_project_teams WHERE organization=m.organization AND team=m.team ORDER BY project LIMIT 1)
  AND ${attention('t.project', 'alert', "'team-mail:'||m.id")}) THEN 1
 WHEN EXISTS(SELECT 1 FROM spool_follow_up_alternates a JOIN spool_members m ON m.id=a.member LEFT JOIN oa_operators o ON o.id=m.operator_id
  WHERE (m.state<>'active' OR o.status IS NOT 'active' OR (o.role<>'owner' AND m.role<>'admin' AND NOT (m.role='member' AND EXISTS(
   SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=a.project AND g.role IN ('maintainer','member')))))
  AND ${attention('a.project', 'alert', "'alternate:'||a.member")}) THEN 1
 WHEN EXISTS(SELECT 1 FROM follow_up_attention fa WHERE fa.source='alert' AND fa.historical=0 AND fa.state='queued'
  AND EXISTS(SELECT 1 FROM alert_history h WHERE h.id=fa.source_id AND h.state NOT IN ('pending','queued','sending','retrying'))) THEN 1
 WHEN EXISTS(SELECT 1 FROM follow_up_attention fa WHERE fa.source='fix' AND fa.historical=0 AND fa.state<>'uncertain'
  AND EXISTS(SELECT 1 FROM follow_up_fix_steps f WHERE f.workflow=fa.source_id AND f.state='uncertain')) THEN 1
 WHEN EXISTS(SELECT 1 FROM follow_up_attention fa WHERE fa.source='deployment' AND fa.historical=0 AND fa.state='queued'
  AND EXISTS(SELECT 1 FROM deployment_notices n WHERE n.project=fa.project AND n.deployment=fa.source_id AND n.state<>'pending')) THEN 1
 WHEN EXISTS(SELECT 1 FROM follow_up_attention fa WHERE fa.source='alert' AND fa.state='blocked' AND fa.source_id LIKE 'alternate:%'
  AND NOT EXISTS(SELECT 1 FROM spool_follow_up_alternates x WHERE x.project=fa.project AND x.member=substr(fa.source_id,11) AND substr(fa.source_id,1,10)='alternate:')) THEN 1
 ELSE 0 END`;

const stages = {
 deployments: `EXISTS(SELECT 1 FROM deployment_runs r WHERE historical=0 AND deadline<=?1 AND ${lastStep} IN ('started','progress','timed_out')
  AND NOT EXISTS(SELECT 1 FROM deployment_notices n WHERE n.project=r.project AND n.deployment=r.id AND n.state<>'pending'))`,
 recoverMail: `EXISTS(SELECT 1 FROM alert_mail_jobs WHERE state='sending' AND claim_until<=?2)`,
 snoozes: `EXISTS(SELECT 1 FROM alert_snoozes WHERE historical=0 AND resumed_at IS NULL AND until<=?1) OR
  EXISTS(SELECT 1 FROM spool_team_snoozes WHERE historical=0 AND resumed_at IS NULL AND until<=?1)`,
 providerEvents: `EXISTS(SELECT 1 FROM alert_provider_pending p CROSS JOIN rer_mail_event_receipts r WHERE r.provider='sendgrid' AND r.tenant_id='spool'
  AND r.event_namespace=p.event_namespace AND r.event_id=p.event_id)`,
 importedRules: `EXISTS(SELECT 1 FROM alert_metric_states m JOIN alert_rules r ON r.id=m.rule_id AND r.revision=m.revision
  JOIN alert_rule_configs c ON c.rule_id=r.id AND c.revision=r.revision
  WHERE r.enabled=0 AND r.revision=1 AND m.reason IN (?7,?8) AND r.created<=?1 AND (m.updated<=?1-3600000
   OR EXISTS(SELECT 1 FROM events e WHERE e.project=r.project AND e.received>=m.updated-120000)
   OR EXISTS(SELECT 1 FROM sentry_transactions t WHERE t.project=r.project AND t.received>=m.updated-120000)
   OR EXISTS(SELECT 1 FROM health_sessions h WHERE h.project=r.project AND h.started>=m.updated-120000)
   OR EXISTS(SELECT 1 FROM health_aggregates g WHERE g.project=r.project AND g.started>=m.updated-120000)))`,
 spikes: `EXISTS(SELECT 1 FROM alert_rules r JOIN alert_cursors c ON c.rule_id=r.id AND c.revision=r.revision WHERE r.enabled=1 AND c.next_start+r.window_ms<=?1)`,
 transactions: `EXISTS(SELECT 1 FROM sentry_transactions WHERE received<?4)`,
 metrics: `EXISTS(SELECT 1 FROM alert_rules r JOIN alert_rule_configs cfg ON cfg.rule_id=r.id LEFT JOIN alert_metric_states m ON m.rule_id=r.id
  WHERE r.enabled=1 AND EXISTS(SELECT 1 FROM json_each(r.kinds) WHERE value='metric')
  AND (m.rule_id IS NULL OR m.revision<>r.revision OR m.window_end<=?3-CASE WHEN r.window_ms<=600000 THEN 60000 ELSE 300000 END))`,
 holdsConfigured: `EXISTS(${heldProjects})`,
 hold: `EXISTS(SELECT 1 FROM alert_intents i WHERE i.project IN (${heldProjects}) AND (i.state<>'snoozed' AND ${holdable}
  OR i.state IN ('pending','blocked','queued') AND i.code IS NOT 'retention_removed'
   AND EXISTS(SELECT 1 FROM alert_suppressed x WHERE x.delivery_id=i.id AND x.project=i.project AND x.released_at IS NULL)))`,
 expand: `EXISTS(SELECT 1 FROM alert_intents WHERE expanded=0 AND state IN ('pending','blocked'))`,
 webhooks: `EXISTS(SELECT 1 FROM integration_deliveries WHERE state='sending' AND claim_until<=?2) OR
  EXISTS(SELECT 1 FROM integration_deliveries d JOIN alert_intents i ON i.id=d.id AND d.namespace='spool.'||i.project
  WHERE i.state<>'snoozed' AND d.state='queued' AND d.next_at<=?2 AND d.attempts<d.max_attempts)`,
 mail: `EXISTS(SELECT 1 FROM alert_mail_jobs j JOIN alert_intents i ON i.id=j.id WHERE i.state<>'snoozed' AND j.state='queued' AND j.next_at<=?2)`,
 history: `EXISTS(SELECT 1 FROM alert_history_dirty)`,
 replay: `EXISTS(SELECT 1 FROM agent_door_calls WHERE expires_at<=?1)`,
 browserArchives: `?6 AND EXISTS(SELECT 1 FROM rer_portability_jobs WHERE kind='browser-export' AND json_extract(metadata,'$.until')<=?1)`,
 suppression: `EXISTS(SELECT 1 FROM issue_suppressions JOIN issues i ON i.project=issue_suppressions.project AND i.id=issue_suppressions.issue
  WHERE issue_suppressions.state='active' AND issue_suppressions.historical=0 AND i.state='suppressed' AND issue_suppressions.mode<>'forever'
  AND ${suppressionEligible('?1')})`,
 followUp,
 scheduledMail: `EXISTS(SELECT 1 FROM alert_scheduled_mail WHERE historical=0 AND (state='queued' OR state='running' AND updated+60000<=?1)) OR
  EXISTS(SELECT 1 FROM spool_team_mail WHERE historical=0 AND (state='queued' OR state='running' AND updated+60000<=?1))`,
 sendNotices: `EXISTS(SELECT 1 FROM follow_up_notices WHERE state='running' AND claim_until<=?1) OR
  EXISTS(SELECT 1 FROM follow_up_notices n WHERE n.state='queued' AND n.next_at<=?1 AND n.attempts<4
  AND (EXISTS(SELECT 1 FROM follow_up_settings c WHERE c.project=n.project AND c.destination=n.destination AND c.channel=n.channel AND NOT EXISTS(SELECT 1 FROM spool_follow_up_alternates m WHERE m.project=c.project))
   OR EXISTS(SELECT 1 FROM spool_follow_up_alternates m WHERE m.project=n.project AND n.destination='member:'||m.member AND n.channel='mail'))
  AND EXISTS(SELECT 1 FROM follow_up_attention a WHERE a.id=n.attention AND a.historical=0 AND a.state NOT IN ('completed','canceled')))`,
 erasure: `EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase<>'complete')`,
 retention: `EXISTS(SELECT 1 FROM projects p LEFT JOIN retention_policies policy ON policy.project=p.id LEFT JOIN retention_runs r ON r.project=p.id
  WHERE COALESCE(policy.held,0)=0 AND (r.last_day IS NULL OR r.last_day<>?5) AND COALESCE(r.lease_until,0)<=?1)
  AND EXISTS(SELECT 1 FROM oa_operators WHERE role='owner' AND status='active')
  AND NOT EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase<>'complete')`,
 close: `${gate('follow_up_close')} AND (
  EXISTS(SELECT 1 FROM follow_up_attention WHERE source='alert' AND state<>'completed'
   AND (source_id LIKE 'held:%' OR source_id LIKE 'snooze:%'))
  OR EXISTS(SELECT 1 FROM follow_up_attention WHERE historical=0 AND state NOT IN ('completed','canceled','uncertain')))`,
 notices: `${gate('follow_up_notices')} AND (
  EXISTS(SELECT 1 FROM follow_up_settings WHERE destination IS NOT NULL)
  OR EXISTS(SELECT 1 FROM spool_follow_up_alternates))`,
 digests: `?6 AND (EXISTS(SELECT 1 FROM alert_digest_settings WHERE daily=1 OR weekly=1 OR personal_daily=1 OR personal_weekly=1)
  OR EXISTS(SELECT 1 FROM spool_team_digest_settings WHERE daily=1 OR weekly=1))`,
};

const selection = Object.entries(stages).map(([name, sql]) => `(${sql}) AS ${name}`).join(',');
const probe = `UPDATE alert_scheduler SET last_run=?2 WHERE id=1 RETURNING last_project,last_spike_rule,${selection}`;

type Stage = keyof typeof stages;
export type ScheduledDue = Record<Stage, number> & { last_project: string; last_spike_rule: string };
const noScheduler = {
 ...Object.fromEntries(Object.keys(stages).map(name => [name, 1])), last_project: '', last_spike_rule: '',
} as ScheduledDue;

export async function scheduledDue(db: D1Database, scheduledTime: number): Promise<ScheduledDue> {
 if (!Number.isSafeInteger(scheduledTime) || scheduledTime < 0) throw new Error('Invalid schedule time');
 const minute = Math.floor(scheduledTime / 60000) * 60000;
 return await db.prepare(probe).bind(scheduledTime, Math.max(Date.now(), scheduledTime), minute, minute - 30 * 86400000,
  Math.floor(scheduledTime / 86400000), Number(minute % 900000 === 0), waitingForUser, waitingForSession)
  .first<ScheduledDue>() ?? noScheduler;
}

// Earlier stages can create or close follow-up work even when the first probe found none.
export async function scheduledFollowUp(db: D1Database, time: number) {
 return (await db.prepare(`SELECT ${stages.followUp} AS followUp, ${stages.close} AS close, ${stages.notices} AS notices`)
  .bind(time).first<Pick<ScheduledDue, 'followUp' | 'close' | 'notices'>>())!;
}
