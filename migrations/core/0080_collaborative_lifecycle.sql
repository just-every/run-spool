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
CREATE TRIGGER issue_priority_open AFTER INSERT ON issues BEGIN
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
 CASE WHEN OLD.state='resolved' AND NEW.state='open' AND COALESCE((SELECT actor_kind FROM audit_context),'service') IN ('ingest','service') THEN 'regression' ELSE 'state' END,
 COALESCE((SELECT actor_kind FROM audit_context),'service'),COALESCE((SELECT actor_label FROM audit_context),'audit:'||lower(hex(randomblob(16)))),json_object('from',OLD.state,'state',NEW.state),CAST((julianday('now')-2440587.5)*86400000 AS INTEGER);
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
