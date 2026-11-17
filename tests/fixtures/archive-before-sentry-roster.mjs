// A prior release has neither review custody nor the widened provenance kind.
export function beforeSentryRoster(manifest){
 const name='0110_sentry_roster_proposals.sql';
 if(manifest.migrations)manifest.migrations=manifest.migrations.filter(m=>m!==name);
 if(manifest.migrationLedger)manifest.migrationLedger={...manifest.migrationLedger,entries:manifest.migrationLedger.entries.filter(m=>m.name!==name)};
 manifest.tables=manifest.tables.filter(t=>t.name!=='spool_import_proposals').map(t=>t.name==='sentry_import_targets'?{...t,sql:t.sql.replace(",'import-proposal'",'').replace('CREATE TABLE "sentry_import_targets"','CREATE TABLE sentry_import_targets')}:t);
 if(manifest.schemaObjects)manifest.schemaObjects=manifest.schemaObjects.filter(o=>o.table!=='spool_import_proposals');
}
