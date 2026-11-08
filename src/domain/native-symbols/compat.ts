// Exact prior behavior for archives created before the Android symbol table.
// A foreign object still fails the complete inventory comparison in portability.
const previousArtifactCapacity = `CREATE TRIGGER artifact_storage_capacity BEFORE INSERT ON artifacts
WHEN NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
AND (SELECT artifact_storage_cap FROM artifact_storage_settings WHERE project=NEW.project) IS NOT NULL
AND COALESCE((SELECT SUM(length(CAST(payload AS BLOB))) FROM artifacts WHERE project=NEW.project),0)+length(CAST(NEW.payload AS BLOB))>(SELECT artifact_storage_cap FROM artifact_storage_settings WHERE project=NEW.project)
BEGIN SELECT RAISE(ABORT,'artifact_storage_cap'); END`;
export function previousNativeSymbolObjects(objects: any[], manifest: any) {
 if (manifest.migrations?.includes('0100_native_symbols.sql') || manifest.tables?.some((table: any) => table.name === 'native_symbols')) return objects;
 return objects.filter(object => object.name !== 'native_symbol_storage_capacity').map(object => object.name === 'artifact_storage_capacity' ? { ...object, sql: previousArtifactCapacity } : object);
}
