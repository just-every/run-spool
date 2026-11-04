CREATE TABLE IF NOT EXISTS agent_door_revoked_consents (
  digest TEXT PRIMARY KEY,
  revoked_at INTEGER NOT NULL
);
