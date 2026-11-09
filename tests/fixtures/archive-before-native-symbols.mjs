import {readFile} from 'node:fs/promises';

// Earlier archive fixtures must contain the table and behavior inventory that
// existed before native symbols. Keep the original trigger from its migration.
export async function beforeNativeSymbols(manifest){
 manifest.tables=manifest.tables.filter(table=>table.name!=='native_symbols');
 if(manifest.migrations)manifest.migrations=manifest.migrations.filter(name=>name!=='0100_native_symbols.sql');
 if(manifest.schemaObjects){
  const migration=await readFile(new URL('../../migrations/core/0067_artifact_storage.sql',import.meta.url),'utf8');
  const sql=migration.slice(migration.indexOf('CREATE TRIGGER artifact_storage_capacity')).trim().replace(/;$/,'');
  manifest.schemaObjects=manifest.schemaObjects.filter(object=>object.name!=='native_symbol_storage_capacity').map(object=>object.name==='artifact_storage_capacity'?{...object,sql}:object);
 }
}
