CREATE TABLE native_symbols(
 project TEXT NOT NULL REFERENCES projects(id),
 release TEXT NOT NULL,
 build TEXT NOT NULL,
 format TEXT NOT NULL CHECK(format='proguard'),
 payload TEXT NOT NULL,
 digest TEXT NOT NULL,
 created INTEGER NOT NULL,
 PRIMARY KEY(project,release,build,format)
);
CREATE TRIGGER native_symbol_storage_capacity BEFORE INSERT ON native_symbols
WHEN NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
AND (SELECT artifact_storage_cap FROM artifact_storage_settings WHERE project=NEW.project) IS NOT NULL
AND COALESCE((SELECT SUM(length(CAST(payload AS BLOB))) FROM artifacts WHERE project=NEW.project),0)
 + COALESCE((SELECT SUM(length(CAST(payload AS BLOB))) FROM native_symbols WHERE project=NEW.project),0)
 + length(CAST(NEW.payload AS BLOB))>(SELECT artifact_storage_cap FROM artifact_storage_settings WHERE project=NEW.project)
BEGIN SELECT RAISE(ABORT,'artifact_storage_cap'); END;
DROP TRIGGER artifact_storage_capacity;
CREATE TRIGGER artifact_storage_capacity BEFORE INSERT ON artifacts
WHEN NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
AND (SELECT artifact_storage_cap FROM artifact_storage_settings WHERE project=NEW.project) IS NOT NULL
AND COALESCE((SELECT SUM(length(CAST(payload AS BLOB))) FROM artifacts WHERE project=NEW.project),0)
 + COALESCE((SELECT SUM(length(CAST(payload AS BLOB))) FROM native_symbols WHERE project=NEW.project),0)
 + length(CAST(NEW.payload AS BLOB))>(SELECT artifact_storage_cap FROM artifact_storage_settings WHERE project=NEW.project)
BEGIN SELECT RAISE(ABORT,'artifact_storage_cap'); END;
