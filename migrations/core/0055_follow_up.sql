-- Operational custody never restores as runnable work. Safe audit chronology
-- travels separately, without these private project/source attribution links.
CREATE TABLE follow_up_settings (
 project TEXT PRIMARY KEY REFERENCES projects(id), destination TEXT, channel TEXT,
 revision INTEGER NOT NULL DEFAULT 1, updated INTEGER NOT NULL,
 CHECK((destination IS NULL AND channel IS NULL) OR (destination IS NOT NULL AND channel IN ('mail','webhook')))
);
-- Membership distinguishes locally admitted feed alerts from restored history,
-- including alerts with no configured delivery rule.
CREATE TABLE follow_up_feed_custody (
 alert TEXT PRIMARY KEY REFERENCES alerts(id),project TEXT NOT NULL REFERENCES projects(id)
);
INSERT INTO follow_up_feed_custody SELECT a.id,a.project FROM alerts a
 WHERE EXISTS(SELECT 1 FROM events e WHERE e.project=a.project AND e.issue=a.issue AND e.historical=0);
CREATE TRIGGER follow_up_local_feed AFTER INSERT ON alerts
 WHEN NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
 BEGIN INSERT INTO follow_up_feed_custody VALUES(NEW.id,NEW.project); END;
CREATE TABLE follow_up_attention (
 id TEXT PRIMARY KEY, project TEXT NOT NULL REFERENCES projects(id),
 source TEXT NOT NULL CHECK(source IN ('alert','deployment','fix')), source_id TEXT NOT NULL,
 owner TEXT NOT NULL DEFAULT 'installation_owner', due INTEGER NOT NULL,
 state TEXT NOT NULL, reason TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
 created INTEGER NOT NULL, updated INTEGER NOT NULL, historical INTEGER NOT NULL DEFAULT 0,
 UNIQUE(project,source,source_id)
);
CREATE TABLE follow_up_notices (
 id TEXT PRIMARY KEY, attention TEXT NOT NULL REFERENCES follow_up_attention(id),
 project TEXT NOT NULL REFERENCES projects(id), destination TEXT NOT NULL, channel TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0,
 next_at INTEGER NOT NULL, claim TEXT, claim_until INTEGER, code TEXT,
 destination_hash TEXT, body TEXT NOT NULL,
 UNIQUE(attention,destination,channel)
);
CREATE TABLE follow_up_attempts (
 id TEXT PRIMARY KEY, notice TEXT NOT NULL REFERENCES follow_up_notices(id),
 project TEXT NOT NULL REFERENCES projects(id), number INTEGER NOT NULL,
 started INTEGER NOT NULL, finished INTEGER, state TEXT, code TEXT,
 UNIQUE(notice,number)
);
CREATE TABLE follow_up_fix_steps (
 id TEXT PRIMARY KEY, workflow TEXT NOT NULL REFERENCES fix_workflows(id),
 project TEXT NOT NULL REFERENCES projects(id), step TEXT NOT NULL, method TEXT NOT NULL,
 state TEXT NOT NULL, started INTEGER NOT NULL, finished INTEGER,
 due INTEGER NOT NULL, evidence TEXT, target TEXT NOT NULL
);
CREATE INDEX follow_up_due ON follow_up_attention(project,state,due,id);
CREATE INDEX follow_up_notice_due ON follow_up_notices(state,next_at,id);
CREATE INDEX follow_up_fix_due ON follow_up_fix_steps(state,due,workflow);
CREATE TABLE follow_up_deployment_attempts (
 id TEXT PRIMARY KEY,project TEXT NOT NULL REFERENCES projects(id),deployment TEXT NOT NULL,
 number INTEGER NOT NULL,started INTEGER NOT NULL,finished INTEGER,state TEXT,code TEXT,
 UNIQUE(project,deployment,number)
);
-- Even a request which beats the scheduled scanner cannot silently discard an
-- expired legacy lease and repeat an effect whose receipt was interrupted.
CREATE TRIGGER follow_up_expired_fix_lease BEFORE DELETE ON fix_leases
 WHEN OLD.until<=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
 AND NOT EXISTS(SELECT 1 FROM follow_up_fix_steps WHERE workflow=OLD.workflow AND state IN ('running','uncertain'))
 BEGIN
 INSERT INTO follow_up_fix_steps(id,workflow,project,step,method,state,started,due,target)
 VALUES(lower(hex(randomblob(16))),OLD.workflow,OLD.project,'expired_lease','-','uncertain',OLD.until,OLD.until,'-');
 END;
