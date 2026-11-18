-- Extend the proposal discriminator while carrying forward every roster row.
CREATE TABLE spool_import_proposals_with_alerts (
 id TEXT PRIMARY KEY,
 project TEXT NOT NULL REFERENCES projects(id),
 kind TEXT NOT NULL CHECK(kind IN ('member','team','ownership','alert')),
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 state TEXT NOT NULL CHECK(state IN ('pending','inviting','invited')) DEFAULT 'pending',
 version INTEGER NOT NULL CHECK(version>0),
 created INTEGER NOT NULL
);
INSERT INTO spool_import_proposals_with_alerts SELECT * FROM spool_import_proposals;
DROP TABLE spool_import_proposals;
ALTER TABLE spool_import_proposals_with_alerts RENAME TO spool_import_proposals;
CREATE INDEX spool_import_proposals_project ON spool_import_proposals(project,kind);
CREATE TRIGGER portability_spool_import_proposals_insert BEFORE INSERT ON spool_import_proposals WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_spool_import_proposals_update BEFORE UPDATE ON spool_import_proposals WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_spool_import_proposals_delete BEFORE DELETE ON spool_import_proposals WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
