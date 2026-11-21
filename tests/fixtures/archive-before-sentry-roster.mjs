import {previousKeyMetadataObjects} from '../../src/domain/key-metadata-compat.ts';

// A prior release has neither review custody nor the widened provenance kind.
export function beforeSentryRoster(manifest){
 const rosterEra=name=>Number(name.split('_',1)[0])>=110;
 if(manifest.migrations)manifest.migrations=manifest.migrations.filter(m=>!rosterEra(m));
 if(manifest.migrationLedger)manifest.migrationLedger={...manifest.migrationLedger,entries:manifest.migrationLedger.entries.filter(m=>!rosterEra(m.name))};
 manifest.tables=manifest.tables.filter(t=>t.name!=='spool_import_proposals').map(t=>t.name==='sentry_import_targets'?{...t,sql:t.sql.replace(",'import-proposal'",'').replace('CREATE TABLE "sentry_import_targets"','CREATE TABLE sentry_import_targets')}:t);
 if(manifest.schemaObjects)manifest.schemaObjects=previousKeyMetadataObjects(manifest.schemaObjects,manifest).filter(o=>o.table!=='spool_import_proposals'&&o.name!=='spool_member_identity');
}
