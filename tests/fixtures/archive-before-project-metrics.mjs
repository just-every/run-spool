import {readFile} from 'node:fs/promises';
import {beforeSentryRoster} from './archive-before-sentry-roster.mjs';
// Earlier fixtures describe the actual native inventory before metric alerts.
export async function beforeProjectMetrics(manifest){
 const {migrations}=JSON.parse(await readFile(new URL('../../management/integration/deployment-spec.json',import.meta.url),'utf8'));
 const later=({name})=>Number.parseInt(name,10)>=117;
 const alertWorkObjects=new Set(migrations.filter(later)
  .flatMap(({sql})=>[...sql.matchAll(/^CREATE (?:INDEX|TABLE|VIEW|TRIGGER) IF NOT EXISTS (\w+)/gm)].map(match=>match[1])));
 // Triggers a later migration dropped and created again keep the text of the last earlier migration that wrote them.
 const statement=(sql,name)=>new RegExp(`^CREATE TRIGGER (?:IF NOT EXISTS )?${name}\\b[\\s\\S]*?(?:;\\s+|\\n\\s*)END;`,'m').exec(sql)?.[0].replace('IF NOT EXISTS ','').replace(/;$/,'');
 const replaced=Object.fromEntries(migrations.filter(later).flatMap(({sql})=>[...sql.matchAll(/^DROP TRIGGER IF EXISTS (\w+);\s*CREATE TRIGGER \1\b/gm)].map(match=>match[1]))
  .map(name=>[name,migrations.filter(migration=>!later(migration)).map(({sql})=>statement(sql,name)).filter(Boolean).at(-1)]).filter(([,sql])=>sql));

 beforeSentryRoster(manifest);
 // The fixture predates all migrations from 0106 through the setup and key changes.
 const added=name=>Number(name.split('_',1)[0])>=106;
 if(manifest.migrations)manifest.migrations=manifest.migrations.filter(name=>!added(name));
 if(manifest.migrationLedger)manifest.migrationLedger={...manifest.migrationLedger,entries:manifest.migrationLedger.entries.filter(entry=>!added(entry.name))};
 manifest.tables=manifest.tables.filter(table=>table.name!=='sentry_transactions').map(table=>table.name==='alerts'?{
  ...table,sql:table.sql.replace('issue TEXT REFERENCES issues(id)','issue TEXT NOT NULL REFERENCES issues(id)').replace(", CHECK((kind='metric' AND issue IS NULL) OR (kind<>'metric' AND issue IS NOT NULL))",''),
  columns:table.columns.map(column=>column.name==='issue'?{...column,notnull:1}:column)
 }:table);
 if(manifest.excludedTables)manifest.excludedTables=manifest.excludedTables.filter(table=>!alertWorkObjects.has(table));
 if(manifest.schemaObjects)manifest.schemaObjects=manifest.schemaObjects.filter(object=>!alertWorkObjects.has(object.name)&&object.name!=='event_stamp_grouping'&&!['sentry_transactions','alert_metric_states','alert_metric_events','alert_target_destinations','alert_intent_recipients'].includes(object.table))
  .map(object=>replaced[object.name]?{...object,sql:replaced[object.name]}:object);
}
