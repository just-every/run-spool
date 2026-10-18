-- import-kit importDoorScopesMigration (rer 0.2.61): binds each logical door namespace
-- to its product destination.
CREATE TABLE IF NOT EXISTS ik_door_scopes (
    installation_id TEXT NOT NULL, namespace TEXT NOT NULL, destination TEXT NOT NULL,
    PRIMARY KEY(installation_id,namespace));
