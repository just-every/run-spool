-- Additive: existing evidence and delivery jobs remain intact.
CREATE TABLE alert_destination_tests (
 project TEXT NOT NULL REFERENCES projects(id), destination TEXT NOT NULL,
 fingerprint TEXT NOT NULL, id TEXT NOT NULL, state TEXT NOT NULL,
 detail TEXT NOT NULL, tested_at INTEGER NOT NULL, reviewed_at INTEGER,
 PRIMARY KEY(project,destination)
);
-- Additive migration. Never drop existing delivery receipts or state.
CREATE TABLE IF NOT EXISTS rer_mail_event_receipts (
  provider TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  event_namespace TEXT NOT NULL,
  event_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  event_json TEXT NOT NULL,
  commit_token TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  conflict INTEGER NOT NULL DEFAULT 0 CONSTRAINT rer_mail_event_identity_conflict CHECK (conflict = 0),
  PRIMARY KEY (provider, tenant_id, event_namespace, event_id)
);
CREATE TABLE IF NOT EXISTS rer_mail_event_states (
  provider TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  event_namespace TEXT NOT NULL,
  provider_message_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  terminal INTEGER NOT NULL CHECK (terminal IN (0, 1)),
  PRIMARY KEY (provider, tenant_id, event_namespace, provider_message_id, recipient)
);

-- Value-free projection of authenticated events; raw recipient receipts stay private.
CREATE TABLE alert_provider_events (
 event_id TEXT PRIMARY KEY, project TEXT NOT NULL REFERENCES projects(id),
 delivery_id TEXT NOT NULL, type TEXT NOT NULL, state TEXT,
 occurred_at INTEGER NOT NULL, provenance TEXT NOT NULL
);
CREATE INDEX alert_provider_delivery ON alert_provider_events(project,delivery_id,occurred_at,event_id);
CREATE TABLE alert_digest_settings (
 project TEXT PRIMARY KEY REFERENCES projects(id), timezone TEXT NOT NULL DEFAULT 'UTC',
 destination TEXT, daily INTEGER NOT NULL DEFAULT 0, weekly INTEGER NOT NULL DEFAULT 0,
 personal_daily INTEGER NOT NULL DEFAULT 0, personal_weekly INTEGER NOT NULL DEFAULT 0,
 hour INTEGER NOT NULL DEFAULT 9, quiet_start INTEGER, quiet_end INTEGER,
 created INTEGER NOT NULL, updated INTEGER NOT NULL
);
CREATE TABLE alert_snoozes (
 id TEXT PRIMARY KEY, project TEXT NOT NULL REFERENCES projects(id),
 scope TEXT NOT NULL CHECK(scope IN ('issue','rule','project')), target TEXT NOT NULL,
 until INTEGER NOT NULL, created INTEGER NOT NULL, resumed_at INTEGER,
 historical INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE alert_suppressed (
 delivery_id TEXT PRIMARY KEY, project TEXT NOT NULL REFERENCES projects(id),
 snooze_id TEXT, reason TEXT NOT NULL, created INTEGER NOT NULL, released_at INTEGER
);
CREATE TABLE alert_scheduled_mail (
 id TEXT PRIMARY KEY, project TEXT NOT NULL REFERENCES projects(id),
 kind TEXT NOT NULL, scope TEXT NOT NULL, period TEXT NOT NULL,
 body TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'queued', code TEXT,
 created INTEGER NOT NULL, updated INTEGER NOT NULL, historical INTEGER NOT NULL DEFAULT 0,
 UNIQUE(project,kind,scope,period)
);
