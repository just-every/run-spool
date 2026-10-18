CREATE TABLE grouping_policies (
 project TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL CHECK(revision>0),
 policy TEXT NOT NULL CHECK(json_valid(policy)),
 updated INTEGER NOT NULL
);
CREATE TRIGGER portability_grouping_policies_insert BEFORE INSERT ON grouping_policies WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_grouping_policies_update BEFORE UPDATE ON grouping_policies WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_grouping_policies_delete BEFORE DELETE ON grouping_policies WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
