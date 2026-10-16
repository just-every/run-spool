-- Private delivery configuration: excluded from archives, erased with its project.
CREATE TABLE alert_destinations (
 id TEXT PRIMARY KEY,
 project TEXT NOT NULL REFERENCES projects(id),
 label TEXT NOT NULL,
 recipient TEXT NOT NULL,
 created INTEGER NOT NULL,
 tested_at INTEGER
);
CREATE INDEX alert_destinations_project ON alert_destinations(project);
CREATE TRIGGER alert_destinations_budget BEFORE INSERT ON alert_destinations
 WHEN (SELECT COUNT(*) FROM alert_destinations WHERE project=NEW.project)>=20
 BEGIN SELECT RAISE(ABORT,'At most 20 email destinations per project'); END;
CREATE TRIGGER portability_alert_destinations_insert BEFORE INSERT ON alert_destinations WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_destinations_update BEFORE UPDATE ON alert_destinations WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_destinations_delete BEFORE DELETE ON alert_destinations WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
