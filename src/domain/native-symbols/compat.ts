// Exact prior behavior for archives created before the Android symbol table.
// A foreign object still fails the complete inventory comparison in portability.
const previousArtifactCapacity = `CREATE TRIGGER artifact_storage_capacity BEFORE INSERT ON artifacts
WHEN NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
AND (SELECT artifact_storage_cap FROM artifact_storage_settings WHERE project=NEW.project) IS NOT NULL
AND COALESCE((SELECT SUM(length(CAST(payload AS BLOB))) FROM artifacts WHERE project=NEW.project),0)+length(CAST(NEW.payload AS BLOB))>(SELECT artifact_storage_cap FROM artifact_storage_settings WHERE project=NEW.project)
BEGIN SELECT RAISE(ABORT,'artifact_storage_cap'); END`;
// Exact trigger text from migration 0100, before native debug files joined the project artifact cap.
const nativeSymbolCapacity = (self: string, table: string) => `CREATE TRIGGER ${self} BEFORE INSERT ON ${table}
WHEN NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
AND (SELECT artifact_storage_cap FROM artifact_storage_settings WHERE project=NEW.project) IS NOT NULL
AND COALESCE((SELECT SUM(length(CAST(payload AS BLOB))) FROM artifacts WHERE project=NEW.project),0)
 + COALESCE((SELECT SUM(length(CAST(payload AS BLOB))) FROM native_symbols WHERE project=NEW.project),0)
 + length(CAST(NEW.payload AS BLOB))>(SELECT artifact_storage_cap FROM artifact_storage_settings WHERE project=NEW.project)
BEGIN SELECT RAISE(ABORT,'artifact_storage_cap'); END`;
const hasMigration = (manifest: any, migration: string, table: string) => manifest.migrations?.includes(migration) || manifest.tables?.some((entry: any) => entry.name === table);
/** Reconstruct the object inventory an archive recorded before 0100 (native symbols) or 0101 (native debug files). */
export function previousNativeSymbolObjects(objects: any[], manifest: any) {
 if (hasMigration(manifest, '0101_native_debug_files.sql', 'native_debug_files')) return objects;
 objects = objects.filter(object => object.name !== 'native_debug_file_storage_capacity');
 if (!hasMigration(manifest, '0100_native_symbols.sql', 'native_symbols')) return objects.filter(object => object.name !== 'native_symbol_storage_capacity').map(object => object.name === 'artifact_storage_capacity' ? { ...object, sql: previousArtifactCapacity } : object);
 return objects.map(object => object.name === 'artifact_storage_capacity' ? { ...object, sql: nativeSymbolCapacity('artifact_storage_capacity', 'artifacts') }
  : object.name === 'native_symbol_storage_capacity' ? { ...object, sql: nativeSymbolCapacity('native_symbol_storage_capacity', 'native_symbols') } : object);
}
