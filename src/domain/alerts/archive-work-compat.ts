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
};
export const alertWorkMigrations = Object.keys(objectsByMigration);

export function beforeAlertWorkObjects<T extends {name:string}>(objects:T[], manifest:{migrations?:string[];schemaObjects?:T[]}) {
 const missing=new Set(Object.entries(objectsByMigration).flatMap(([migration,names])=>{
  const applied=Array.isArray(manifest.migrations)?manifest.migrations.includes(migration):
   manifest.schemaObjects?.some(object=>names.includes(object.name));
  return applied?[]:names;
 }));
 return objects.filter(object=>!missing.has(object.name));
}
