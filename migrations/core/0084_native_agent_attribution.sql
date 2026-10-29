-- Native, inspectable agent attribution. No credential or person session is stored.
CREATE TABLE spool_agent_operations (
 id TEXT PRIMARY KEY, project TEXT, target TEXT NOT NULL, tool TEXT NOT NULL,
 actor TEXT NOT NULL, approvers TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE INDEX spool_agent_operations_target ON spool_agent_operations(project,target,created);
ALTER TABLE repairs ADD COLUMN recorded_by TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE grouping_proposals ADD COLUMN prepared_by TEXT;
