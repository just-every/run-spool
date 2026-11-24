// Operational alert work is excluded from archives. Earlier native archives
// retain the exact index and trigger inventory for their applied migrations.
const objectsByMigration = {
 '0117_alert_work_indexes.sql': [
  'alert_history_alert_project','alerts_project_issue_kind_created','events_project_received',
  'alert_intents_unexpanded','alert_mail_jobs_active','alert_mail_jobs_due',
  'alert_mail_jobs_recovery','integration_deliveries_active','integration_resolutions_delivery',
  'alert_snoozes_due','alert_suppressed_active','alert_suppressed_snooze',
  'alert_suppressed_active_snooze','rer_erasure_operations_open','alert_scheduled_mail_follow_up',
  'spool_team_mail_follow_up','follow_up_attention_alert_open','follow_up_attention_live',
  'follow_up_attention_local_queued','follow_up_attention_fix','follow_up_attention_alternate',
  'follow_up_attention_notice','alert_scheduled_mail_active','spool_team_mail_active','follow_up_fix_workflow_state',
  'fix_leases_until','alert_history_dirty_project','alert_history_projection',
  'alert_history_dirty_intent','alert_history_dirty_mail_insert','alert_history_dirty_mail_update',
  'alert_history_dirty_delivery_insert','alert_history_dirty_delivery_update','alert_history_dirty_attempt',
  'alert_history_dirty_resolution','alert_history_dirty_released',
 ],
 '0118_issue_read_indexes.sql': [
  'issue_short_ids_assigned_number','issue_short_ids_issue_number','alerts_issue_attention',
  'events_project_issue_release','events_project_environment_received',
 ],
 '0119_metric_expiry_index.sql': [
  'sentry_transactions_expiry',
 ],
 '0120_follow_up_alert_work.sql': [
  'follow_up_alert_work_due','follow_up_alert_work_issue','follow_up_alert_work_attention',
  'follow_up_alert_work_issue_state','follow_up_alert_work_issue_delete','follow_up_alert_work_history_insert',
  'follow_up_alert_work_history_update','follow_up_alert_work_history_delete','follow_up_alert_work_feed_insert',
  'follow_up_alert_work_feed_delete','follow_up_alert_work_loss_insert','follow_up_alert_work_loss_update',
  'follow_up_alert_work_loss_delete','follow_up_alert_work_restore',
  'follow_up_legacy_loss_due','follow_up_legacy_loss','follow_up_legacy_loss_cancel_notices',
  'follow_up_legacy_loss_notice_update',
 ],
 '0121_bounded_reads.sql': [
  'spool_capacity_events_insert','spool_capacity_events_delete','spool_capacity_events_move',
  'spool_capacity_transactions_insert','spool_capacity_transactions_delete','spool_capacity_transactions_move',
  'spool_capacity_sessions_insert','spool_capacity_sessions_delete','spool_capacity_sessions_move',
  'spool_capacity_aggregates_insert','spool_capacity_aggregates_delete','spool_capacity_aggregates_move',
  'spool_capacity_exposures_insert','spool_capacity_exposures_delete','spool_capacity_exposures_move',
  'issue_client_drops_insert','issue_client_drops_delete','issue_client_drops_update',
  'issue_client_drops_issue_delete','spool_issue_list_issues_insert','spool_issue_list_issues_update',
  'spool_issue_list_issues_delete','spool_issue_list_events_insert','spool_issue_list_events_update',
  'spool_issue_list_events_delete','spool_issue_list_alerts_insert','spool_issue_list_alerts_update',
  'spool_issue_list_alerts_delete','spool_issue_list_issue_priorities_insert',
  'spool_issue_list_issue_priorities_update','spool_issue_list_issue_priorities_delete',
  'spool_issue_list_issue_short_ids_insert','spool_issue_list_issue_short_ids_update',
  'spool_issue_list_issue_short_ids_delete','spool_issue_list_issue_resolutions_insert',
  'spool_issue_list_issue_resolutions_update','spool_issue_list_issue_resolutions_delete',
  'spool_issue_list_releases_insert','spool_issue_list_releases_update','spool_issue_list_releases_delete',
  'spool_issue_list_release_order_keys_insert','spool_issue_list_release_order_keys_update',
  'spool_issue_list_release_order_keys_delete','spool_issue_list_release_metadata_insert',
  'spool_issue_list_release_metadata_update','spool_issue_list_release_metadata_delete',
  'spool_issue_list_release_policies_insert','spool_issue_list_release_policies_update',
  'spool_issue_list_release_policies_delete','spool_gate_close_follow_up_attention_insert',
  'spool_gate_close_follow_up_attention_update','spool_gate_close_issues_state',
  'spool_gate_close_issue_suppressions_insert','spool_gate_close_alerts_insert','spool_gate_close_alerts_issue',
  'spool_gate_close_alert_history_insert','spool_gate_close_alert_history_state',
  'spool_gate_close_deployment_steps_insert','spool_gate_close_deployment_steps_state',
  'spool_gate_close_alert_suppressed_released','spool_gate_close_alert_suppressed_delete',
  'spool_gate_notices_follow_up_attention_insert','spool_gate_notices_follow_up_attention_update',
  'spool_gate_notices_follow_up_settings_insert','spool_gate_notices_follow_up_settings_update',
  'spool_gate_notices_spool_follow_up_alternates_insert','spool_gate_notices_spool_follow_up_alternates_update',
  'spool_gate_notices_spool_follow_up_alternates_delete','alert_provider_pending_receipt',
  'alert_provider_pending_receipt_delete','spool_bounded_reads_restore',
 ],
};
// 0121 also replaced these capacity triggers, which counted the whole project on every insert.
const replacedByMigration: Record<string, Record<string, string>> = {
 '0121_bounded_reads.sql': {
  event_capacity: "CREATE TRIGGER event_capacity BEFORE INSERT ON events WHEN (SELECT COUNT(*) FROM events WHERE project=NEW.project)>=10000 BEGIN SELECT RAISE(ABORT,'retained_event_budget'); END",
  exposure_capacity: "CREATE TRIGGER exposure_capacity BEFORE INSERT ON exposures WHEN (SELECT COUNT(*) FROM exposures WHERE project=NEW.project)>=20000 BEGIN SELECT RAISE(ABORT,'exposure_budget'); END",
  health_aggregate_capacity: "CREATE TRIGGER health_aggregate_capacity BEFORE INSERT ON health_aggregates WHEN NOT EXISTS(SELECT 1 FROM health_aggregates WHERE project=NEW.project AND release=NEW.release AND environment=NEW.environment AND started=NEW.started AND status=NEW.status) AND (SELECT COUNT(*) FROM health_aggregates WHERE project=NEW.project)>=10000 BEGIN SELECT RAISE(ABORT,'session_capacity'); END",
  health_session_capacity: "CREATE TRIGGER health_session_capacity BEFORE INSERT ON health_sessions WHEN NOT EXISTS(SELECT 1 FROM health_sessions WHERE project=NEW.project AND sid=NEW.sid) AND (SELECT COUNT(*) FROM health_sessions WHERE project=NEW.project)>=50000 BEGIN SELECT RAISE(ABORT,'session_capacity'); END",
  sentry_transaction_capacity: `CREATE TRIGGER sentry_transaction_capacity BEFORE INSERT ON sentry_transactions
 WHEN NOT EXISTS(SELECT 1 FROM sentry_transactions WHERE project=NEW.project AND id=NEW.id)
 BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM sentry_transactions WHERE project=NEW.project)>=50000 THEN RAISE(ABORT,'transaction_capacity') END;
 SELECT CASE WHEN (SELECT COUNT(*) FROM sentry_transactions WHERE project=NEW.project AND received>=CAST(NEW.received/60000 AS INTEGER)*60000)>=600 THEN RAISE(ABORT,'transaction_rate_limited') END;
 END`,
 },
};
export const alertWorkMigrations = Object.keys(objectsByMigration);
// Derived summaries 0121 keeps from archived rows; a restore rebuilds them.
export const boundedReadTables = ['spool_capacity_counts','issue_client_drops','spool_read_versions','spool_work_gates','alert_provider_pending'];

export function beforeAlertWorkObjects<T extends {name:string;sql?:string}>(objects:T[], manifest:{migrations?:string[];schemaObjects?:T[]}) {
 const unapplied=Object.keys(objectsByMigration).filter(migration=>!(Array.isArray(manifest.migrations)?manifest.migrations.includes(migration):
  manifest.schemaObjects?.some(object=>objectsByMigration[migration as keyof typeof objectsByMigration].includes(object.name))));
 const missing=new Set(unapplied.flatMap(migration=>objectsByMigration[migration as keyof typeof objectsByMigration]));
 const previous:Record<string,string>=Object.assign({},...unapplied.map(migration=>replacedByMigration[migration]??{}));
 return objects.filter(object=>!missing.has(object.name)).map(object=>Object.hasOwn(previous,object.name)?{...object,sql:previous[object.name]}:object);
}
