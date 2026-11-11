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

// Exact trigger text from migration 0099, before 0103 rewrote the relay membership triggers.
const previousRelayAuditInsert = `CREATE TRIGGER agent_door_relay_audit_insert AFTER INSERT ON agent_door_audit
WHEN json_extract(NEW.row,'$.door')='mcp' AND json_extract(NEW.row,'$.consent') IS NOT NULL
 AND (SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1) IS NOT NULL
BEGIN
  INSERT INTO agent_door_relay(decision_id,business) VALUES(NEW.id,
    COALESCE((SELECT business FROM agent_door_relay WHERE decision_id=NEW.id ORDER BY sequence DESC LIMIT 1),
             (SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1)));
  DELETE FROM agent_door_relay WHERE decision_id=NEW.id AND sequence<(SELECT MAX(sequence) FROM agent_door_relay WHERE decision_id=NEW.id);
END`;
const previousRelayAuditUpdate = `CREATE TRIGGER agent_door_relay_audit_update AFTER UPDATE ON agent_door_audit
WHEN EXISTS(SELECT 1 FROM agent_door_relay WHERE decision_id=NEW.id)
  OR (json_extract(NEW.row,'$.door')='mcp' AND json_extract(NEW.row,'$.consent') IS NOT NULL
      AND (SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1) IS NOT NULL)
BEGIN
  INSERT INTO agent_door_relay(decision_id,business) VALUES(NEW.id,
    COALESCE((SELECT business FROM agent_door_relay WHERE decision_id=NEW.id ORDER BY sequence DESC LIMIT 1),
             (SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1)));
  DELETE FROM agent_door_relay WHERE decision_id=NEW.id AND sequence<(SELECT MAX(sequence) FROM agent_door_relay WHERE decision_id=NEW.id);
END`;
/** Reconstruct the object inventory an archive recorded before 0103 (relay privacy). Only the two relay audit triggers changed. */
export function previousRelayPrivacyObjects(objects: any[], manifest: any) {
 if (manifest.migrations?.includes('0103_agent_door_relay_privacy.sql')) return objects;
 // A current-format archive records no ledger: its own relay trigger text says which side of 0103 it was exported on.
 if (!Array.isArray(manifest.migrations)) {
  const recorded = manifest.schemaObjects?.find((object: any) => object.name === 'agent_door_relay_audit_insert');
  if (recorded && recorded.sql !== previousRelayAuditInsert) return objects;
 }
 return objects.map(object => object.name === 'agent_door_relay_audit_insert' ? { ...object, sql: previousRelayAuditInsert }
  : object.name === 'agent_door_relay_audit_update' ? { ...object, sql: previousRelayAuditUpdate } : object);
}
