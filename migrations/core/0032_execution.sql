-- Reproducers, fix-branch workflows and measured exposure. Additive only.
-- A reproducer records its exact input, environment and source modules; its
-- runs execute only in the isolated runner sandbox (scripts/reproduce), and
-- Spool computes each run's outcome from the observed behaviour, never from a
-- claim. Run tokens are single-use, expire, and stay out of archives.
CREATE TABLE reproducers(
 id TEXT PRIMARY KEY,
 project TEXT NOT NULL REFERENCES projects(id),
 issue TEXT NOT NULL REFERENCES issues(id),
 event TEXT NOT NULL,
 defect_class TEXT NOT NULL,
 support TEXT NOT NULL CHECK(support IN ('supported','unsupported')),
 reason TEXT,
 spec TEXT NOT NULL,
 created INTEGER NOT NULL,
 CHECK((support='supported' AND reason IS NULL) OR (support='unsupported' AND reason IS NOT NULL))
);
CREATE INDEX reproducers_issue ON reproducers(project,issue,created);
CREATE TABLE reproducer_runs(
 id TEXT PRIMARY KEY,
 reproducer TEXT NOT NULL REFERENCES reproducers(id),
 project TEXT NOT NULL REFERENCES projects(id),
 release TEXT NOT NULL,
 build TEXT NOT NULL,
 modules TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('queued','claimed','finished')),
 outcome TEXT CHECK(outcome IN ('failed','not_reproduced','reproduced')),
 observation TEXT,
 checks TEXT,
 tools TEXT,
 created INTEGER NOT NULL,
 expires INTEGER NOT NULL,
 claimed INTEGER,
 finished INTEGER,
 CHECK((state='finished')=(outcome IS NOT NULL AND observation IS NOT NULL AND checks IS NOT NULL AND finished IS NOT NULL))
);
CREATE INDEX reproducer_runs_reproducer ON reproducer_runs(reproducer,created);
CREATE TABLE reproducer_run_tokens(run TEXT PRIMARY KEY REFERENCES reproducer_runs(id) ON DELETE CASCADE,project TEXT NOT NULL REFERENCES projects(id),hash TEXT NOT NULL UNIQUE,expires INTEGER NOT NULL);
-- Fix-branch workflows. Proposed, approved, merged and deployed are separate
-- columns with their own sources; merged comes only from a provider receipt and
-- deployed only from a deployment manifest naming the merge commit.
CREATE TABLE fix_workflows(
 id TEXT PRIMARY KEY,
 project TEXT NOT NULL REFERENCES projects(id),
 issue TEXT NOT NULL REFERENCES issues(id),
 reproducer TEXT NOT NULL REFERENCES reproducers(id),
 run TEXT NOT NULL REFERENCES reproducer_runs(id),
 flow TEXT NOT NULL,
 grant_spec TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>=1),
 proposed INTEGER NOT NULL,
 approved INTEGER,
 expires INTEGER,
 pull_number INTEGER,
 pull_url TEXT,
 head_sha TEXT,
 merged INTEGER,
 merge_sha TEXT,
 updated INTEGER NOT NULL,
 CHECK((approved IS NULL AND expires IS NULL) OR (approved IS NOT NULL AND expires>approved)),
 CHECK((merged IS NULL AND merge_sha IS NULL) OR (merged IS NOT NULL AND merge_sha IS NOT NULL AND pull_number IS NOT NULL))
);
CREATE INDEX fix_workflows_issue ON fix_workflows(project,issue,proposed);
CREATE TABLE fix_receipts(
 id TEXT PRIMARY KEY,
 workflow TEXT NOT NULL REFERENCES fix_workflows(id),
 project TEXT NOT NULL REFERENCES projects(id),
 step TEXT NOT NULL,
 method TEXT NOT NULL,
 target TEXT NOT NULL,
 outcome TEXT NOT NULL CHECK(outcome IN ('succeeded','failed','refused')),
 status INTEGER,
 detail TEXT NOT NULL,
 at INTEGER NOT NULL
);
CREATE INDEX fix_receipts_workflow ON fix_receipts(workflow,at);
-- One row per client, release, environment and flow ('' is the session itself).
CREATE TABLE exposures(
 project TEXT NOT NULL REFERENCES projects(id),
 release TEXT NOT NULL,
 environment TEXT NOT NULL,
 flow TEXT NOT NULL,
 client TEXT NOT NULL,
 capture INTEGER NOT NULL CHECK(capture IN (0,1)),
 reports INTEGER NOT NULL CHECK(reports>=1),
 first INTEGER NOT NULL,
 last INTEGER NOT NULL,
 PRIMARY KEY(project,release,environment,flow,client),
 FOREIGN KEY(project,release) REFERENCES releases(project,name)
);
CREATE INDEX exposures_flow ON exposures(project,flow,last);
CREATE TRIGGER reproducer_capacity BEFORE INSERT ON reproducers WHEN (SELECT COUNT(*) FROM reproducers WHERE project=NEW.project AND issue=NEW.issue)>=20 BEGIN SELECT RAISE(ABORT,'reproducer_budget'); END;
CREATE TRIGGER reproducer_run_capacity BEFORE INSERT ON reproducer_runs WHEN (SELECT COUNT(*) FROM reproducer_runs WHERE reproducer=NEW.reproducer)>=20 BEGIN SELECT RAISE(ABORT,'reproducer_run_budget'); END;
CREATE TRIGGER fix_workflow_capacity BEFORE INSERT ON fix_workflows WHEN (SELECT COUNT(*) FROM fix_workflows WHERE project=NEW.project AND issue=NEW.issue)>=10 BEGIN SELECT RAISE(ABORT,'fix_workflow_budget'); END;
CREATE TRIGGER fix_receipt_capacity BEFORE INSERT ON fix_receipts WHEN (SELECT COUNT(*) FROM fix_receipts WHERE workflow=NEW.workflow)>=200 BEGIN SELECT RAISE(ABORT,'fix_receipt_budget'); END;
CREATE TRIGGER exposure_capacity BEFORE INSERT ON exposures WHEN (SELECT COUNT(*) FROM exposures WHERE project=NEW.project)>=20000 BEGIN SELECT RAISE(ABORT,'exposure_budget'); END;
CREATE TRIGGER portability_reproducers_insert BEFORE INSERT ON reproducers WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_reproducers_update BEFORE UPDATE ON reproducers WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_reproducers_delete BEFORE DELETE ON reproducers WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_reproducer_runs_insert BEFORE INSERT ON reproducer_runs WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_reproducer_runs_update BEFORE UPDATE ON reproducer_runs WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_reproducer_runs_delete BEFORE DELETE ON reproducer_runs WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_fix_workflows_insert BEFORE INSERT ON fix_workflows WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_fix_workflows_update BEFORE UPDATE ON fix_workflows WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_fix_workflows_delete BEFORE DELETE ON fix_workflows WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_fix_receipts_insert BEFORE INSERT ON fix_receipts WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_fix_receipts_update BEFORE UPDATE ON fix_receipts WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_fix_receipts_delete BEFORE DELETE ON fix_receipts WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_exposures_insert BEFORE INSERT ON exposures WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_exposures_update BEFORE UPDATE ON exposures WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_exposures_delete BEFORE DELETE ON exposures WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
