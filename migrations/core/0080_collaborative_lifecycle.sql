CREATE TABLE issue_priorities (
 project TEXT NOT NULL REFERENCES projects(id), issue TEXT PRIMARY KEY REFERENCES issues(id),
 automatic INTEGER NOT NULL CHECK(automatic BETWEEN 1 AND 3),
 manual TEXT CHECK(manual IN ('high','medium','low'))
);
CREATE TABLE issue_activity (
 id TEXT PRIMARY KEY, project TEXT NOT NULL REFERENCES projects(id), issue TEXT NOT NULL REFERENCES issues(id),
 kind TEXT NOT NULL, actor_kind TEXT NOT NULL, actor_label TEXT NOT NULL,
 detail TEXT NOT NULL CHECK(json_valid(detail)), created INTEGER NOT NULL
);
CREATE INDEX issue_activity_order ON issue_activity(project,issue,created,id);
INSERT INTO issue_priorities SELECT i.project,i.id,COALESCE((SELECT MAX(CASE COALESCE(json_extract(e.payload,'$.sentry.level'),'error') WHEN 'fatal' THEN 3 WHEN 'error' THEN 3 WHEN 'warning' THEN 2 ELSE 1 END) FROM events e WHERE e.project=i.project AND e.issue=i.id),3),NULL FROM issues i;
CREATE TRIGGER issue_priority_open AFTER INSERT ON issues
WHEN NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN
 INSERT INTO issue_priorities VALUES(NEW.project,NEW.id,1,NULL);
END;
CREATE TRIGGER issue_priority_event AFTER INSERT ON events
WHEN NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
BEGIN
 UPDATE issue_priorities SET automatic=MAX(automatic,CASE COALESCE(json_extract(NEW.payload,'$.sentry.level'),'error') WHEN 'fatal' THEN 3 WHEN 'error' THEN 3 WHEN 'warning' THEN 2 ELSE 1 END) WHERE project=NEW.project AND issue=NEW.issue;
END;
CREATE TRIGGER issue_priority_regression AFTER UPDATE OF state ON issues WHEN OLD.state='resolved' AND NEW.state='open' BEGIN
 UPDATE issue_priorities SET automatic=3 WHERE project=NEW.project AND issue=NEW.id;
END;
CREATE TRIGGER issue_activity_state AFTER UPDATE OF state ON issues
WHEN OLD.state<>NEW.state AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
BEGIN
 INSERT INTO issue_activity SELECT lower(hex(randomblob(16))),NEW.project,NEW.id,
 CASE WHEN OLD.state='resolved' AND NEW.state='open' AND COALESCE((SELECT action FROM audit_context),'') IN ('capture.native','capture.sentry','capture.otlp') THEN 'regression' ELSE 'state' END,
 CASE WHEN EXISTS(SELECT 1 FROM audit_context WHERE action IN ('capture.native','capture.sentry','capture.otlp')) THEN 'ingest' ELSE COALESCE((SELECT actor_kind FROM audit_context),'service') END,COALESCE((SELECT actor_label FROM audit_context),'audit:'||lower(hex(randomblob(16)))),json_object('from',OLD.state,'state',NEW.state),CAST((julianday('now')-2440587.5)*86400000 AS INTEGER);
END;
CREATE TABLE issue_comments (
 id TEXT PRIMARY KEY,project TEXT NOT NULL REFERENCES projects(id),issue TEXT NOT NULL REFERENCES issues(id),
 operator_id TEXT NOT NULL,actor_kind TEXT NOT NULL,actor_label TEXT NOT NULL,
 body TEXT NOT NULL CHECK(length(body)<=4000),mentions TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(mentions)),
 version INTEGER NOT NULL DEFAULT 1,created INTEGER NOT NULL,updated INTEGER NOT NULL
);
CREATE INDEX issue_comments_order ON issue_comments(project,issue,created,id);
CREATE TRIGGER issue_comments_capacity BEFORE INSERT ON issue_comments
WHEN (SELECT count(*) FROM issue_comments WHERE project=NEW.project AND issue=NEW.issue)>=200
BEGIN SELECT RAISE(ABORT,'issue_comment_limit'); END;
CREATE TABLE issue_subscriptions (
 project TEXT NOT NULL REFERENCES projects(id),issue TEXT NOT NULL REFERENCES issues(id),operator_id TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(reason IN ('comment','mention','manual')),
 state TEXT NOT NULL CHECK(state IN ('subscribed','unsubscribed','inert')),updated INTEGER NOT NULL,
 PRIMARY KEY(project,issue,operator_id,reason)
);
CREATE TABLE recurrence_policies (
 project TEXT PRIMARY KEY REFERENCES projects(id),revision INTEGER NOT NULL CHECK(revision>=1),
 reopen_same_release INTEGER NOT NULL DEFAULT 0 CHECK(reopen_same_release IN(0,1)),updated INTEGER NOT NULL
);
CREATE TRIGGER issue_activity_resolution AFTER UPDATE OF mode,boundary_seq ON issue_resolutions
WHEN EXISTS(SELECT 1 FROM issues WHERE id=NEW.issue AND state='resolved') AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
BEGIN
 INSERT INTO issue_activity SELECT lower(hex(randomblob(16))),NEW.project,NEW.issue,'resolution',
 COALESCE((SELECT actor_kind FROM audit_context),'service'),COALESCE((SELECT actor_label FROM audit_context),'audit:'||lower(hex(randomblob(16)))),
 json_object('mode',NEW.mode,'release',(SELECT name FROM releases WHERE project=NEW.project AND seq=NEW.boundary_seq)),NEW.updated;
END;
CREATE TRIGGER issue_activity_same_release AFTER UPDATE OF count ON issues
WHEN OLD.state='resolved' AND NEW.count>OLD.count AND EXISTS(SELECT 1 FROM audit_context WHERE action IN ('capture.native','capture.sentry','capture.otlp')) AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
BEGIN
 INSERT INTO issue_activity SELECT lower(hex(randomblob(16))),NEW.project,NEW.id,'resolved_release_recurrence',
 'ingest',COALESCE((SELECT actor_label FROM audit_context),'audit:'||lower(hex(randomblob(16)))),
 json_object('release',e.release,'count',1),e.received
 FROM events e JOIN issue_resolutions r ON r.project=NEW.project AND r.issue=NEW.id
 WHERE e.rowid=(SELECT rowid FROM events WHERE project=NEW.project AND issue=NEW.id ORDER BY rowid DESC LIMIT 1)
 AND (r.mode='current' OR r.mode='named' AND EXISTS(SELECT 1 FROM issue_recurrence_boundaries snapshot WHERE snapshot.project=NEW.project AND snapshot.issue=NEW.id AND snapshot.boundary_seq=r.boundary_seq AND snapshot.seen_at_resolution=1)) AND e.release<>'' AND e.release_seq=COALESCE(r.boundary_seq,OLD.resolved_seq)
 AND NOT EXISTS(SELECT 1 FROM event_suppressions x WHERE x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence);
END;
UPDATE issue_priorities SET automatic=3 WHERE issue IN (SELECT issue FROM alerts WHERE kind IN ('regression','spike'));
CREATE TRIGGER issue_priority_escalation AFTER INSERT ON alerts WHEN NEW.kind IN ('regression','spike')
AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
BEGIN
 UPDATE issues SET revision=revision+1 WHERE id=NEW.issue AND project=NEW.project AND EXISTS(SELECT 1 FROM issue_priorities p WHERE p.issue=NEW.issue AND p.automatic<3 AND p.manual IS NULL);
 UPDATE issue_priorities SET automatic=3 WHERE project=NEW.project AND issue=NEW.issue;
END;

CREATE TRIGGER issue_activity_old_release AFTER UPDATE OF count ON issues
WHEN OLD.state='resolved' AND NEW.count>OLD.count AND EXISTS(SELECT 1 FROM audit_context WHERE action IN ('capture.native','capture.sentry','capture.otlp')) AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
BEGIN
 INSERT INTO issue_activity SELECT lower(hex(randomblob(16))),NEW.project,NEW.id,'older_release_recurrence',
 'ingest',COALESCE((SELECT actor_label FROM audit_context),'audit:'||lower(hex(randomblob(16)))),json_object('release',incoming.release,'count',1),incoming.received
 FROM events incoming JOIN issues i ON i.id=NEW.id AND i.project=NEW.project
 WHERE incoming.rowid=(SELECT rowid FROM events WHERE project=NEW.project AND issue=NEW.id ORDER BY rowid DESC LIMIT 1)
 AND (incoming.release<>'' AND incoming.release_seq<>COALESCE((SELECT boundary_seq FROM issue_resolutions resolution WHERE resolution.project=i.project AND resolution.issue=i.id),i.resolved_seq) AND EXISTS(SELECT 1 FROM releases boundary_release WHERE boundary_release.project=i.project AND boundary_release.seq=COALESCE((SELECT boundary_seq FROM issue_resolutions resolution WHERE resolution.project=i.project AND resolution.issue=i.id),i.resolved_seq)) AND EXISTS(SELECT 1 FROM issue_resolutions resolution WHERE resolution.project=i.project AND resolution.issue=i.id AND resolution.mode IN ('current','next','named')) AND NOT (incoming.release<>'' AND CASE WHEN COALESCE((SELECT boundary_seq FROM issue_resolutions resolution WHERE resolution.project=i.project AND resolution.issue=i.id),i.resolved_seq) IS NULL OR COALESCE((SELECT boundary_seq FROM issue_resolutions resolution WHERE resolution.project=i.project AND resolution.issue=i.id),i.resolved_seq)=0 THEN 1
 WHEN json_extract(incoming.payload,'$.sentry') IS NULL OR COALESCE((SELECT json_extract(policy,'$.order') FROM release_policies WHERE project=i.project),'sentry')='registered' THEN incoming.release_seq>COALESCE((SELECT boundary_seq FROM issue_resolutions resolution WHERE resolution.project=i.project AND resolution.issue=i.id),i.resolved_seq)
 ELSE EXISTS(SELECT 1 FROM releases candidate_release JOIN releases boundary_release ON boundary_release.project=candidate_release.project AND boundary_release.seq=COALESCE((SELECT boundary_seq FROM issue_resolutions resolution WHERE resolution.project=i.project AND resolution.issue=i.id),i.resolved_seq) WHERE candidate_release.project=i.project AND candidate_release.name=incoming.release AND (CASE WHEN COALESCE((SELECT json_extract(policy,'$.order') FROM release_policies WHERE project=i.project),'sentry')='registered' THEN candidate_release.seq ELSE 0 END,CASE WHEN COALESCE((SELECT json_extract(policy,'$.order') FROM release_policies WHERE project=i.project),'sentry')='semver' AND (SELECT version_key FROM release_order_keys WHERE project=candidate_release.project AND release=candidate_release.name) IS NULL THEN 1 ELSE 0 END,(CASE WHEN COALESCE((SELECT json_extract(policy,'$.order') FROM release_policies WHERE project=i.project),'sentry')='semver' THEN COALESCE((SELECT version_key FROM release_order_keys WHERE project=candidate_release.project AND release=candidate_release.name),'') ELSE '' END) COLLATE BINARY,CASE WHEN COALESCE((SELECT json_extract(policy,'$.order') FROM release_policies WHERE project=i.project),'sentry')='registered' THEN 0 ELSE COALESCE((SELECT first_seen FROM release_metadata WHERE project=candidate_release.project AND release=candidate_release.name),candidate_release.created) END,candidate_release.name COLLATE BINARY)>(CASE WHEN COALESCE((SELECT json_extract(policy,'$.order') FROM release_policies WHERE project=i.project),'sentry')='registered' THEN boundary_release.seq ELSE 0 END,CASE WHEN COALESCE((SELECT json_extract(policy,'$.order') FROM release_policies WHERE project=i.project),'sentry')='semver' AND (SELECT version_key FROM release_order_keys WHERE project=boundary_release.project AND release=boundary_release.name) IS NULL THEN 1 ELSE 0 END,(CASE WHEN COALESCE((SELECT json_extract(policy,'$.order') FROM release_policies WHERE project=i.project),'sentry')='semver' THEN COALESCE((SELECT version_key FROM release_order_keys WHERE project=boundary_release.project AND release=boundary_release.name),'') ELSE '' END) COLLATE BINARY,CASE WHEN COALESCE((SELECT json_extract(policy,'$.order') FROM release_policies WHERE project=i.project),'sentry')='registered' THEN 0 ELSE COALESCE((SELECT first_seen FROM release_metadata WHERE project=boundary_release.project AND release=boundary_release.name),boundary_release.created) END,boundary_release.name COLLATE BINARY)) END))
 AND NOT EXISTS(SELECT 1 FROM event_suppressions x WHERE x.project=incoming.project AND x.event=incoming.id AND x.occurrence=incoming.occurrence);
END;
CREATE TABLE issue_suppressions (
 id TEXT PRIMARY KEY,project TEXT NOT NULL REFERENCES projects(id),issue TEXT NOT NULL REFERENCES issues(id),
 mode TEXT NOT NULL CHECK(mode IN('forever','until','count','users','escalating','snooze')),reason TEXT NOT NULL,
 deadline INTEGER,occurrence_target INTEGER,user_target INTEGER,window_ms INTEGER,forecast REAL,
 started INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN('active','expired','ended')),ended INTEGER,
 historical INTEGER NOT NULL DEFAULT 0 CHECK(historical IN(0,1)),observed_count INTEGER NOT NULL DEFAULT 0 CHECK(observed_count>=0)
);
CREATE UNIQUE INDEX issue_suppressions_active ON issue_suppressions(project,issue) WHERE state='active' AND historical=0;
CREATE TRIGGER issue_suppression_ended AFTER UPDATE OF state ON issues WHEN OLD.state='suppressed' AND NEW.state<>'suppressed'
BEGIN
 UPDATE issue_suppressions SET state='ended',ended=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
 WHERE project=NEW.project AND issue=NEW.id AND state='active' AND historical=0;
END;
CREATE TRIGGER issue_suppression_escalation AFTER UPDATE OF state ON issue_suppressions
WHEN OLD.state='active' AND NEW.state='expired' AND NEW.mode='escalating' AND NEW.historical=0
BEGIN
 UPDATE issue_priorities SET automatic=3 WHERE project=NEW.project AND issue=NEW.issue;
END;
CREATE TRIGGER issue_priority_regroup AFTER UPDATE OF issue ON events WHEN OLD.issue<>NEW.issue
AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
BEGIN
 UPDATE issue_priorities SET automatic=MAX(automatic,CASE COALESCE(json_extract(NEW.payload,'$.sentry.level'),'error') WHEN 'fatal' THEN 3 WHEN 'error' THEN 3 WHEN 'warning' THEN 2 ELSE 1 END) WHERE project=NEW.project AND issue=NEW.issue;
END;
-- Remember whether a named boundary was already observed when the user made
-- the decision. The first event in a future target is a regression; a repeat
-- in an already observed target follows the collaborative recurrence policy.
CREATE TABLE issue_recurrence_boundaries (
 project TEXT NOT NULL REFERENCES projects(id),issue TEXT PRIMARY KEY REFERENCES issues(id),
 boundary_seq INTEGER,seen_at_resolution INTEGER NOT NULL CHECK(seen_at_resolution IN (0,1))
);
CREATE TRIGGER issue_recurrence_boundary_update AFTER UPDATE OF mode,boundary_seq ON issue_resolutions
WHEN EXISTS(SELECT 1 FROM issues WHERE id=NEW.issue AND state='resolved')
AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
BEGIN
 INSERT INTO issue_recurrence_boundaries VALUES(NEW.project,NEW.issue,NEW.boundary_seq,EXISTS(SELECT 1 FROM events WHERE project=NEW.project AND issue=NEW.issue AND release_seq=NEW.boundary_seq))
 ON CONFLICT(issue) DO UPDATE SET boundary_seq=excluded.boundary_seq,seen_at_resolution=excluded.seen_at_resolution;
END;

CREATE TRIGGER issue_suppression_occurrence AFTER UPDATE OF count ON issues
WHEN NEW.count>OLD.count AND EXISTS(SELECT 1 FROM audit_context WHERE action IN ('capture.native','capture.sentry','capture.otlp'))
BEGIN
 UPDATE issue_suppressions SET observed_count=observed_count+NEW.count-OLD.count
 WHERE project=NEW.project AND issue=NEW.id AND historical=0 AND state='active';
END;
