CREATE TABLE spool_agent_rule_custody (
 rule TEXT PRIMARY KEY REFERENCES alert_rules(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL, principal TEXT NOT NULL
);
CREATE TABLE spool_agent_queue_outcomes (id TEXT PRIMARY KEY, answer TEXT NOT NULL, updated INTEGER NOT NULL);
