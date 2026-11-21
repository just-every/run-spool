-- Source review only. No FK or trigger can mint a person, token or grant.
CREATE TABLE spool_import_proposals (
 id TEXT PRIMARY KEY,
 project TEXT NOT NULL REFERENCES projects(id),
 kind TEXT NOT NULL CHECK(kind IN ('member','team','ownership')),
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 state TEXT NOT NULL CHECK(state IN ('pending','inviting','invited')) DEFAULT 'pending',
 version INTEGER NOT NULL CHECK(version>0),
 created INTEGER NOT NULL
);
CREATE INDEX spool_import_proposals_project ON spool_import_proposals(project,kind);
-- Expand the existing provenance discriminator without changing earlier rows.
CREATE TABLE sentry_import_targets_roster(kind TEXT NOT NULL CHECK(kind IN ('project','release','issue','event','import-proposal')),id TEXT NOT NULL,revision TEXT NOT NULL,source TEXT NOT NULL,PRIMARY KEY(kind,id));
INSERT INTO sentry_import_targets_roster SELECT * FROM sentry_import_targets;
DROP TABLE sentry_import_targets;
ALTER TABLE sentry_import_targets_roster RENAME TO sentry_import_targets;
CREATE TRIGGER portability_sentry_import_targets_insert BEFORE INSERT ON sentry_import_targets WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_sentry_import_targets_update BEFORE UPDATE ON sentry_import_targets WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_sentry_import_targets_delete BEFORE DELETE ON sentry_import_targets WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_spool_import_proposals_insert BEFORE INSERT ON spool_import_proposals WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_spool_import_proposals_update BEFORE UPDATE ON spool_import_proposals WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_spool_import_proposals_delete BEFORE DELETE ON spool_import_proposals WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
