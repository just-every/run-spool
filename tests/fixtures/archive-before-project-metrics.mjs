// Earlier fixtures describe the actual native inventory before metric alerts.
export function beforeProjectMetrics(manifest){
 const added=['0106_project_metric_alerts.sql','0107_sentry_transactions.sql','0108_alert_notify_targets.sql'];
 if(manifest.migrations)manifest.migrations=manifest.migrations.filter(name=>!added.includes(name));
 if(manifest.migrationLedger)manifest.migrationLedger=manifest.migrationLedger.filter(entry=>!added.includes(entry.name));
 manifest.tables=manifest.tables.filter(table=>table.name!=='sentry_transactions').map(table=>table.name==='alerts'?{
  ...table,sql:table.sql.replace('issue TEXT REFERENCES issues(id)','issue TEXT NOT NULL REFERENCES issues(id)').replace(", CHECK((kind='metric' AND issue IS NULL) OR (kind<>'metric' AND issue IS NOT NULL))",''),
  columns:table.columns.map(column=>column.name==='issue'?{...column,notnull:1}:column)
 }:table);
 if(manifest.schemaObjects)manifest.schemaObjects=manifest.schemaObjects.filter(object=>!['sentry_transactions','alert_metric_states','alert_metric_events','alert_target_destinations','alert_intent_recipients'].includes(object.table));
}
