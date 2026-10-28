-- Native attribution is separate from the shared policy audit and never grants authority.
CREATE TABLE spool_agent_activity (
 id TEXT PRIMARY KEY, project TEXT NOT NULL, uri TEXT NOT NULL, tool TEXT NOT NULL,
 agent TEXT NOT NULL, agent_name TEXT NOT NULL, sponsor TEXT NOT NULL,
 sponsor_name TEXT NOT NULL, approvers TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE INDEX spool_agent_activity_resource ON spool_agent_activity(project,uri,created);
