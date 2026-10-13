-- Preserve existing grants; only the kind domain grows. No grant is created by migration.
CREATE TABLE spool_credentials_next(hash TEXT PRIMARY KEY,project TEXT NOT NULL REFERENCES projects(id),kind TEXT NOT NULL CHECK(kind IN ('ingest','agent','deploy')),created INTEGER NOT NULL,revoked INTEGER);
INSERT INTO spool_credentials_next SELECT * FROM credentials;
DROP TABLE credentials;
ALTER TABLE spool_credentials_next RENAME TO credentials;
CREATE TRIGGER portability_credentials_insert BEFORE INSERT ON credentials WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_credentials_update BEFORE UPDATE ON credentials WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_credentials_delete BEFORE DELETE ON credentials WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TABLE sentry_project_aliases(id INTEGER PRIMARY KEY AUTOINCREMENT,project TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE);
INSERT INTO sentry_project_aliases(project) SELECT id FROM projects ORDER BY created,id;
CREATE TRIGGER sentry_project_alias AFTER INSERT ON projects BEGIN INSERT INTO sentry_project_aliases(project) VALUES(NEW.id); END;
CREATE TABLE spool_authority_guards(ok INTEGER NOT NULL CHECK(ok=1));
ALTER TABLE events ADD COLUMN historical INTEGER NOT NULL DEFAULT 0 CHECK(historical IN (0,1));
DROP TRIGGER minute_capacity;
CREATE TRIGGER minute_capacity BEFORE INSERT ON events WHEN NEW.historical=0 AND (SELECT COUNT(*) FROM events WHERE project=NEW.project AND historical=0 AND received>=CAST(NEW.received/60000 AS INTEGER)*60000)>=120 BEGIN SELECT RAISE(ABORT,'minute_budget'); END;
CREATE TABLE sentry_import_targets(kind TEXT NOT NULL CHECK(kind IN ('project','release','issue','event')),id TEXT NOT NULL,revision TEXT NOT NULL,source TEXT NOT NULL,PRIMARY KEY(kind,id));
CREATE TRIGGER portability_sentry_import_targets_insert BEFORE INSERT ON sentry_import_targets WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_sentry_import_targets_update BEFORE UPDATE ON sentry_import_targets WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_sentry_import_targets_delete BEFORE DELETE ON sentry_import_targets WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
