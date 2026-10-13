-- Owner-recorded repairs and their checks. Each fact (approved, merged, deployed
-- in a registered release, flow exercised) is independent and recorded by the
-- owner; Spool never opens a pull request, merges, releases or deploys, and never
-- fetches a recorded link. Additive only: no existing row changes.
CREATE TABLE repairs(
 id TEXT PRIMARY KEY,
 project TEXT NOT NULL REFERENCES projects(id),
 issue TEXT NOT NULL REFERENCES issues(id),
 snapshot_revision INTEGER NOT NULL CHECK(snapshot_revision>=0),
 snapshot_events TEXT NOT NULL,
 snapshot_release_seq INTEGER NOT NULL CHECK(snapshot_release_seq>=0),
 link TEXT NOT NULL CHECK(length(link)<=2048),
 note TEXT NOT NULL CHECK(length(note)<=1000),
 approved INTEGER,
 merged INTEGER,
 deployed_release TEXT,
 deployed_seq INTEGER,
 deployed INTEGER,
 exercised INTEGER,
 exercise_note TEXT CHECK(exercise_note IS NULL OR length(exercise_note)<=1000),
 revision INTEGER NOT NULL CHECK(revision>=1),
 created INTEGER NOT NULL,
 updated INTEGER NOT NULL,
 CHECK((deployed_release IS NULL AND deployed_seq IS NULL AND deployed IS NULL) OR (deployed_release IS NOT NULL AND deployed_seq>=1 AND deployed IS NOT NULL)),
 CHECK((exercised IS NULL AND exercise_note IS NULL) OR (exercised IS NOT NULL AND exercise_note IS NOT NULL AND deployed IS NOT NULL AND exercised>=deployed))
);
CREATE INDEX repairs_issue ON repairs(project,issue,created);
CREATE TABLE repair_checks(
 id TEXT PRIMARY KEY,
 repair TEXT NOT NULL REFERENCES repairs(id),
 project TEXT NOT NULL REFERENCES projects(id),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 outcome TEXT NOT NULL CHECK(outcome IN ('passed','failed','not_run')),
 note TEXT NOT NULL CHECK(length(note)<=300),
 recorded INTEGER NOT NULL
);
CREATE INDEX repair_checks_repair ON repair_checks(repair,recorded);
CREATE TRIGGER repair_capacity BEFORE INSERT ON repairs WHEN (SELECT COUNT(*) FROM repairs WHERE project=NEW.project AND issue=NEW.issue)>=20 BEGIN SELECT RAISE(ABORT,'repair_budget'); END;
CREATE TRIGGER repair_check_capacity BEFORE INSERT ON repair_checks WHEN (SELECT COUNT(*) FROM repair_checks WHERE repair=NEW.repair)>=10 BEGIN SELECT RAISE(ABORT,'repair_check_budget'); END;
CREATE TRIGGER portability_repairs_insert BEFORE INSERT ON repairs WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_repairs_update BEFORE UPDATE ON repairs WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_repairs_delete BEFORE DELETE ON repairs WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_repair_checks_insert BEFORE INSERT ON repair_checks WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_repair_checks_update BEFORE UPDATE ON repair_checks WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_repair_checks_delete BEFORE DELETE ON repair_checks WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
