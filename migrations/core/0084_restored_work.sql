-- Destination-only custody: archived facts survive, their authority does not.
CREATE TABLE restored_work (
 project TEXT NOT NULL REFERENCES projects(id),
 kind TEXT NOT NULL CHECK(kind IN ('repair','run','fix')),
 record TEXT NOT NULL,
 PRIMARY KEY(project,kind,record)
);
-- Base commits the rows and clears import_job in one D1 batch. Aborted imports
-- never mark work. This also covers CLI and legacy archive restores.
CREATE TRIGGER restored_work_commit AFTER UPDATE OF import_job ON rer_portability_state
 WHEN OLD.import_job IS NOT NULL AND NEW.import_job IS NULL AND OLD.applying=1 BEGIN
 INSERT OR IGNORE INTO restored_work SELECT project,'repair',id FROM repairs;
 INSERT OR IGNORE INTO restored_work SELECT project,'run',id FROM reproducer_runs;
 INSERT OR IGNORE INTO restored_work SELECT project,'fix',id FROM fix_workflows;
END;
