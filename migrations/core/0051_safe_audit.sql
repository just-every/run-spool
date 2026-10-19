-- Permanent facts have no native identity, credential, path, name or payload.
-- Private bindings are deliberately separate and must be excluded from archives.
CREATE TABLE audit_actor_links (
 kind TEXT NOT NULL,
 lookup_hash TEXT NOT NULL,
 label TEXT NOT NULL UNIQUE,
 owner_hash TEXT,
 project_hash TEXT,
 owner_id TEXT,
 project TEXT,
 created INTEGER NOT NULL,
 PRIMARY KEY(kind,lookup_hash)
);
CREATE INDEX audit_actor_links_owner ON audit_actor_links(owner_hash);
CREATE INDEX audit_actor_links_project ON audit_actor_links(project_hash);
CREATE TABLE spool_audit_events (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL UNIQUE,
 created INTEGER NOT NULL CHECK(created>=0),
 source TEXT NOT NULL CHECK(source IN ('request','transaction','service','legacy')),
 actor_kind TEXT NOT NULL CHECK(actor_kind IN ('owner','agent','deploy','ingest','service','anonymous','unknown')),
 actor_label TEXT NOT NULL CHECK(length(actor_label)=38 AND substr(actor_label,1,6)='audit:'),
 action TEXT NOT NULL,
 subject_kind TEXT NOT NULL,
 subject_label TEXT NOT NULL CHECK(length(subject_label)=38 AND substr(subject_label,1,6)='audit:'),
 project_label TEXT CHECK(project_label IS NULL OR (length(project_label)=38 AND substr(project_label,1,6)='audit:')),
 outcome TEXT NOT NULL CHECK(outcome IN ('succeeded','accepted','suppressed','denied','conflict','invalid','failed','uncertain','started')),
 status INTEGER CHECK(status IS NULL OR (status>=100 AND status<=599))
);
CREATE INDEX spool_audit_events_project ON spool_audit_events(project_label,sequence);
CREATE TRIGGER spool_audit_no_update BEFORE UPDATE ON spool_audit_events BEGIN SELECT RAISE(ABORT,'audit_immutable'); END;
CREATE TRIGGER spool_audit_no_delete BEFORE DELETE ON spool_audit_events BEGIN SELECT RAISE(ABORT,'audit_immutable'); END;
