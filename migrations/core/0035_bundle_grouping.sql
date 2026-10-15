-- Stable bundle identity points at an immutable native grouping anchor.
CREATE TABLE grouping_routes(project TEXT NOT NULL REFERENCES projects(id),fingerprint TEXT NOT NULL,issue TEXT NOT NULL REFERENCES issues(id),basis TEXT NOT NULL,PRIMARY KEY(project,fingerprint),UNIQUE(project,issue));
CREATE TRIGGER portability_grouping_routes_insert BEFORE INSERT ON grouping_routes WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_grouping_routes_update BEFORE UPDATE ON grouping_routes WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_grouping_routes_delete BEFORE DELETE ON grouping_routes WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
