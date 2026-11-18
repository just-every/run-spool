import {previousKeyMetadataObjects} from '../../src/domain/key-metadata-compat.ts';
import {beforeSentryRoster} from './archive-before-sentry-roster.mjs';
// Earlier fixtures describe the actual native inventory before metric alerts.
export function beforeProjectMetrics(manifest){
 beforeSentryRoster(manifest);
 // The fixture predates all migrations from 0106 through the setup and key changes.
 const added=name=>Number(name.split('_',1)[0])>=106;
 if(manifest.migrations)manifest.migrations=manifest.migrations.filter(name=>!added(name));
 if(manifest.migrationLedger)manifest.migrationLedger={...manifest.migrationLedger,entries:manifest.migrationLedger.entries.filter(entry=>!added(entry.name))};
 manifest.tables=manifest.tables.filter(table=>table.name!=='sentry_transactions').map(table=>table.name==='alerts'?{
  ...table,sql:table.sql.replace('issue TEXT REFERENCES issues(id)','issue TEXT NOT NULL REFERENCES issues(id)').replace(", CHECK((kind='metric' AND issue IS NULL) OR (kind<>'metric' AND issue IS NOT NULL))",''),
  columns:table.columns.map(column=>column.name==='issue'?{...column,notnull:1}:column)
 }:table);
 if(manifest.schemaObjects)manifest.schemaObjects=previousKeyMetadataObjects(manifest.schemaObjects,manifest).filter(object=>!['sentry_transactions','alert_metric_states','alert_metric_events','alert_target_destinations','alert_intent_recipients'].includes(object.table)&&object.name!=='spool_member_identity');
}
