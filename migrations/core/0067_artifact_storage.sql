-- Replace the lifetime count with an optional owner-set stored-byte cap.
CREATE TABLE artifact_storage_settings(project TEXT PRIMARY KEY REFERENCES projects(id),artifact_storage_cap INTEGER CHECK(artifact_storage_cap IS NULL OR artifact_storage_cap>=0),revision INTEGER NOT NULL CHECK(revision>0),updated INTEGER NOT NULL);
DROP TRIGGER artifact_capacity;
CREATE TRIGGER artifact_storage_capacity BEFORE INSERT ON artifacts
WHEN NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
AND (SELECT artifact_storage_cap FROM artifact_storage_settings WHERE project=NEW.project) IS NOT NULL
AND COALESCE((SELECT SUM(length(CAST(payload AS BLOB))) FROM artifacts WHERE project=NEW.project),0)+length(CAST(NEW.payload AS BLOB))>(SELECT artifact_storage_cap FROM artifact_storage_settings WHERE project=NEW.project)
BEGIN SELECT RAISE(ABORT,'artifact_storage_cap'); END;
