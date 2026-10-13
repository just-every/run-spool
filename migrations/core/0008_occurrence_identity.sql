-- Retry keys can be reused after retention; erasure identities cannot.
-- Preserve pre-transition rows as legacy occurrences so their original
-- natural-key erasure journal remains authoritative during archive validation.
INSERT INTO rer_portability_guard SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) THEN 1 ELSE 0 END;
CREATE TABLE spool_events_next(id TEXT NOT NULL,project TEXT NOT NULL REFERENCES projects(id),issue TEXT NOT NULL REFERENCES issues(id),release TEXT NOT NULL,release_seq INTEGER NOT NULL,build TEXT NOT NULL,environment TEXT NOT NULL,payload TEXT NOT NULL,digest TEXT NOT NULL,diagnostic TEXT NOT NULL,received INTEGER NOT NULL,occurrence TEXT NOT NULL,PRIMARY KEY(project,id,occurrence),UNIQUE(project,id));
INSERT INTO spool_events_next SELECT events.*,'legacy' FROM events;
DROP TABLE events;
ALTER TABLE spool_events_next RENAME TO events;
CREATE INDEX events_issue ON events(issue,received);
CREATE TRIGGER event_capacity BEFORE INSERT ON events WHEN (SELECT COUNT(*) FROM events WHERE project=NEW.project)>=10000 BEGIN SELECT RAISE(ABORT,'retained_event_budget'); END;
CREATE TRIGGER minute_capacity BEFORE INSERT ON events WHEN (SELECT COUNT(*) FROM events WHERE project=NEW.project AND received>=CAST(NEW.received/60000 AS INTEGER)*60000)>=120 BEGIN SELECT RAISE(ABORT,'minute_budget'); END;
CREATE TRIGGER portability_events_insert BEFORE INSERT ON events WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_events_update BEFORE UPDATE ON events WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_events_delete BEFORE DELETE ON events WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;

CREATE TABLE spool_artifacts_next(project TEXT NOT NULL REFERENCES projects(id),release TEXT NOT NULL,build TEXT NOT NULL,debug TEXT NOT NULL,payload TEXT NOT NULL,digest TEXT NOT NULL,created INTEGER NOT NULL,occurrence TEXT NOT NULL,PRIMARY KEY(project,release,build,debug,occurrence),UNIQUE(project,release,build,debug));
INSERT INTO spool_artifacts_next SELECT artifacts.*,'legacy' FROM artifacts;
DROP TABLE artifacts;
ALTER TABLE spool_artifacts_next RENAME TO artifacts;
CREATE TRIGGER artifact_capacity BEFORE INSERT ON artifacts WHEN (SELECT COUNT(*) FROM artifacts WHERE project=NEW.project)>=20 BEGIN SELECT RAISE(ABORT,'artifact_budget'); END;
CREATE TRIGGER portability_artifacts_insert BEFORE INSERT ON artifacts WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_artifacts_update BEFORE UPDATE ON artifacts WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_artifacts_delete BEFORE DELETE ON artifacts WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
DELETE FROM rer_portability_guard;
