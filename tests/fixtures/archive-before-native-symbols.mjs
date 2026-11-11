import {readFile} from 'node:fs/promises';
import {beforeRelayPrivacy} from './archive-before-relay-privacy.mjs';

// Earlier archive fixtures must contain the table and behavior inventory that
// existed before native symbols (and so before relay privacy). Keep the original trigger from its migration.
export async function beforeNativeSymbols(manifest){
 await beforeRelayPrivacy(manifest);
 manifest.tables=manifest.tables.filter(table=>!['native_symbols','native_debug_files'].includes(table.name));
 if(manifest.migrations)manifest.migrations=manifest.migrations.filter(name=>!['0100_native_symbols.sql','0101_native_debug_files.sql'].includes(name));
 if(manifest.schemaObjects){
  const migration=await readFile(new URL('../../migrations/core/0067_artifact_storage.sql',import.meta.url),'utf8');
  const sql=migration.slice(migration.indexOf('CREATE TRIGGER artifact_storage_capacity')).trim().replace(/;$/,'');
  manifest.schemaObjects=manifest.schemaObjects.filter(object=>!['native_symbol_storage_capacity','native_debug_file_storage_capacity'].includes(object.name)).map(object=>object.name==='artifact_storage_capacity'?{...object,sql}:object);
 }
}

