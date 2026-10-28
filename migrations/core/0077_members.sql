-- Product membership uses native operator-auth identities and sessions.
CREATE TABLE spool_organizations (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE TABLE spool_members (
 id TEXT PRIMARY KEY, organization TEXT NOT NULL REFERENCES spool_organizations(id),
 operator_id TEXT UNIQUE, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','billing','member','read-only')),
 state TEXT NOT NULL CHECK(state IN ('active','removed','inert')),
 version INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL
);
CREATE TABLE spool_project_teams (
 project TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
 organization TEXT NOT NULL REFERENCES spool_organizations(id), team TEXT NOT NULL
);
CREATE TABLE spool_project_grants (
 member TEXT NOT NULL REFERENCES spool_members(id) ON DELETE CASCADE,
 project TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('maintainer','member','read-only')),
 created INTEGER NOT NULL, PRIMARY KEY(member,project)
);
CREATE TABLE spool_member_invites (
 id TEXT PRIMARY KEY, member TEXT NOT NULL REFERENCES spool_members(id) ON DELETE CASCADE,
 created INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('invited','accepted','cancelled','inert'))
);
CREATE TABLE spool_service_accounts (
 id TEXT PRIMARY KEY, organization TEXT NOT NULL REFERENCES spool_organizations(id),
 name TEXT NOT NULL, sponsor TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('active','removed','inert')),
 version INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL
);
CREATE TABLE spool_service_scopes (
 service TEXT NOT NULL REFERENCES spool_service_accounts(id) ON DELETE CASCADE,
 project TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('agent','deploy','ingest')),
 PRIMARY KEY(service,project,kind)
);
-- Live credential bindings never travel in an archive.
CREATE TABLE spool_service_credentials (
 hash TEXT PRIMARY KEY REFERENCES credentials(hash) ON DELETE CASCADE,
 service TEXT NOT NULL REFERENCES spool_service_accounts(id) ON DELETE CASCADE,
 version INTEGER NOT NULL
);
CREATE TRIGGER spool_member_accept AFTER UPDATE OF status ON oa_operators WHEN NEW.status='active' AND OLD.status='invited' BEGIN
 UPDATE spool_member_invites SET state='accepted' WHERE state='invited' AND member IN (SELECT id FROM spool_members WHERE operator_id=NEW.id AND state='active');
END;
-- Credentials minted after an owner erasure obey the same live project
-- authority as earlier credentials. Revocation remains unconditional.
DROP TRIGGER spool_erased_owner_credential_insert;
CREATE TRIGGER spool_erased_owner_credential_insert BEFORE INSERT ON credentials
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner')
 AND NOT EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=NEW.minted_by AND o.version=NEW.minted_version AND o.status='active'
  AND (o.role='owner' OR EXISTS(SELECT 1 FROM spool_members m WHERE m.operator_id=o.id AND m.state='active'
   AND (m.role='admin' OR (m.role='member' AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=NEW.project AND g.role IN ('maintainer','member')))))))
BEGIN SELECT RAISE(ABORT,'credential_authority_changed'); END;

-- Widen the actor category without rewriting one historical fact. The journal
-- remains append-only and keeps every sequence, id, alias and timestamp.
DROP TRIGGER audit_context_commit;
DROP TRIGGER audit_restore_commit;
DROP TRIGGER spool_audit_no_update;
DROP TRIGGER spool_audit_no_delete;
ALTER TABLE spool_audit_events RENAME TO spool_audit_before_team;
CREATE TABLE spool_audit_events (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL UNIQUE,
 created INTEGER NOT NULL CHECK(created>=0),
 source TEXT NOT NULL CHECK(source IN ('request','transaction','service','legacy')),
 actor_kind TEXT NOT NULL CHECK(actor_kind IN ('owner','member','agent','deploy','ingest','service','anonymous','unknown')),
 actor_label TEXT NOT NULL CHECK(length(actor_label)=38 AND substr(actor_label,1,6)='audit:'),
 action TEXT NOT NULL,
 subject_kind TEXT NOT NULL,
 subject_label TEXT NOT NULL CHECK(length(subject_label)=38 AND substr(subject_label,1,6)='audit:'),
 project_label TEXT CHECK(project_label IS NULL OR (length(project_label)=38 AND substr(project_label,1,6)='audit:')),
 outcome TEXT NOT NULL CHECK(outcome IN ('succeeded','accepted','suppressed','denied','conflict','invalid','failed','uncertain','started')),
 status INTEGER CHECK(status IS NULL OR (status>=100 AND status<=599))
);
INSERT INTO spool_audit_events SELECT * FROM spool_audit_before_team;
DROP TABLE spool_audit_before_team;
CREATE INDEX spool_audit_events_project ON spool_audit_events(project_label,sequence);
CREATE TRIGGER spool_audit_no_update BEFORE UPDATE ON spool_audit_events BEGIN SELECT RAISE(ABORT,'audit_immutable'); END;
CREATE TRIGGER spool_audit_no_delete BEFORE DELETE ON spool_audit_events BEGIN SELECT RAISE(ABORT,'audit_immutable'); END;
CREATE TRIGGER audit_context_commit AFTER UPDATE OF committed ON audit_context WHEN OLD.committed=0 AND NEW.committed=1 BEGIN
 INSERT INTO spool_audit_events(id,created,source,actor_kind,actor_label,action,subject_kind,subject_label,project_label,outcome,status)
 VALUES(lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(6))),
  NEW.created,'transaction',NEW.actor_kind,NEW.actor_label,NEW.action,NEW.subject_kind,NEW.subject_label,NEW.project_label,'succeeded',NULL);
END;
CREATE TRIGGER audit_restore_commit AFTER UPDATE OF import_job ON rer_portability_state WHEN OLD.import_job IS NOT NULL AND NEW.import_job IS NULL BEGIN
 INSERT OR IGNORE INTO spool_audit_events(id,created,source,actor_kind,actor_label,action,subject_kind,subject_label,project_label,outcome,status)
  SELECT json_extract(fact,'$.id'),json_extract(fact,'$.created'),json_extract(fact,'$.source'),json_extract(fact,'$.actor_kind'),json_extract(fact,'$.actor_label'),
   json_extract(fact,'$.action'),json_extract(fact,'$.subject_kind'),json_extract(fact,'$.subject_label'),json_extract(fact,'$.project_label'),json_extract(fact,'$.outcome'),json_extract(fact,'$.status')
  FROM audit_restore_staging WHERE OLD.applying=1 AND import_id=OLD.import_job AND ord>0 ORDER BY ord;
 -- Previous archive formats carry no safe history: their restored journal rows get legacy facts.
 INSERT INTO audit_legacy_labels SELECT project,'audit:'||lower(hex(randomblob(16))) FROM (SELECT DISTINCT project FROM audit WHERE project IS NOT NULL)
  WHERE OLD.applying=1 AND NOT EXISTS(SELECT 1 FROM audit_restore_staging WHERE import_id=OLD.import_job);
 INSERT INTO spool_audit_events(id,created,source,actor_kind,actor_label,action,subject_kind,subject_label,project_label,outcome,status)
  SELECT lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(6))),
   a.created,'legacy','unknown','audit:'||lower(hex(randomblob(16))),COALESCE(m.action,'private.action'),COALESCE(m.subject_kind,'unknown'),'audit:'||lower(hex(randomblob(16))),
   (SELECT label FROM audit_legacy_labels l WHERE l.project=a.project),'succeeded',NULL
  FROM audit a LEFT JOIN audit_legacy_actions m ON m.kind=a.kind
  WHERE OLD.applying=1 AND NOT EXISTS(SELECT 1 FROM audit_restore_staging WHERE import_id=OLD.import_job) ORDER BY a.created,a.id;
 DELETE FROM audit_legacy_labels;
 -- The restore itself: the owner's transaction fact, or the local CLI's service fact.
 UPDATE audit_context SET committed=1 WHERE OLD.applying=1;
 INSERT INTO spool_audit_events(id,created,source,actor_kind,actor_label,action,subject_kind,subject_label,project_label,outcome,status)
  SELECT lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(6))),
   CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),'service','service',label,'archive.restore','installation','audit:'||lower(hex(randomblob(16))),NULL,'succeeded',NULL
  FROM audit_actor_links WHERE OLD.applying=1 AND NOT EXISTS(SELECT 1 FROM audit_context) AND kind='service' AND lookup_hash='d832ceb4065065973b7c2718944b0047cd6672ae8d3279b42c0771af1cfa367a';
 DELETE FROM audit_restore_staging WHERE import_id=OLD.import_job;
END;
