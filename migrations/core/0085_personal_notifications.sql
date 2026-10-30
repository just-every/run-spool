-- Durable personal delivery contains no recipient address or message payload.
CREATE TABLE spool_personal_mail (
 id TEXT PRIMARY KEY,project TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 source TEXT NOT NULL,type TEXT NOT NULL,issue TEXT,operator_id TEXT,recipient_label TEXT NOT NULL,
 member_version INTEGER NOT NULL,operator_version INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued',code TEXT,created INTEGER NOT NULL,updated INTEGER NOT NULL,
 historical INTEGER NOT NULL DEFAULT 0 CHECK(historical IN(0,1)),
 UNIQUE(project,source,type,recipient_label)
);
CREATE INDEX spool_personal_mail_due ON spool_personal_mail(historical,state,created,id);
CREATE TABLE spool_personal_unsubscribe (
 token_hash TEXT PRIMARY KEY,delivery TEXT NOT NULL REFERENCES spool_personal_mail(id) ON DELETE CASCADE,
 project TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,operator_id TEXT NOT NULL,type TEXT NOT NULL,
 member_version INTEGER NOT NULL,operator_version INTEGER NOT NULL,created INTEGER NOT NULL
);
-- Separate current reasons leave the existing discussion archive format intact.
CREATE TABLE spool_issue_follows (
 project TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,issue TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 operator_id TEXT,actor_label TEXT NOT NULL,reason TEXT NOT NULL CHECK(reason IN('assignment','team','bookmark')),updated INTEGER NOT NULL,
 historical INTEGER NOT NULL DEFAULT 0 CHECK(historical IN(0,1)),
 PRIMARY KEY(project,issue,actor_label,reason),CHECK(historical=1 OR operator_id IS NOT NULL)
);
CREATE TRIGGER spool_personal_activity AFTER INSERT ON issue_activity WHEN NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) AND EXISTS(SELECT 1 FROM audit_context WHERE action<>'archive.restore') BEGIN
INSERT INTO spool_personal_mail(id,project,source,type,issue,operator_id,recipient_label,member_version,operator_version,created,updated)
 SELECT lower(hex(randomblob(16))),p.project,NEW.id,'resolution',NEW.issue,p.operator_id,p.actor_label,m.version,o.version,NEW.created,NEW.created
 FROM spool_notification_preferences p JOIN oa_operators o ON o.id=p.operator_id AND o.status='active'
 JOIN spool_members m ON m.operator_id=o.id AND m.state='active'
 JOIN spool_project_teams t ON t.project=p.project AND t.organization=m.organization
 WHERE p.project=NEW.project AND p.historical=0 AND json_extract(p.email,'$.resolution')=1
 AND (o.role='owner' OR m.role='admin' OR m.role IN('member','read-only') AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=p.project))
 AND p.actor_label IS NOT NEW.actor_label AND (NEW.kind='state' AND json_extract(NEW.detail,'$.state')='resolved') AND (NOT EXISTS(SELECT 1 FROM issue_subscriptions x WHERE x.project=p.project AND x.issue=NEW.issue AND x.operator_id=p.operator_id AND x.reason='manual' AND x.state='unsubscribed') AND
 (EXISTS(SELECT 1 FROM issue_subscriptions x WHERE x.project=p.project AND x.issue=NEW.issue AND x.operator_id=p.operator_id AND x.state='subscribed') OR
 EXISTS(SELECT 1 FROM spool_issue_follows x WHERE x.project=p.project AND x.issue=NEW.issue AND x.operator_id=p.operator_id AND x.historical=0))) ON CONFLICT(project,source,type,recipient_label) DO NOTHING;
INSERT INTO spool_personal_mail(id,project,source,type,issue,operator_id,recipient_label,member_version,operator_version,created,updated)
 SELECT lower(hex(randomblob(16))),p.project,NEW.id,'comment',NEW.issue,p.operator_id,p.actor_label,m.version,o.version,NEW.created,NEW.created
 FROM spool_notification_preferences p JOIN oa_operators o ON o.id=p.operator_id AND o.status='active'
 JOIN spool_members m ON m.operator_id=o.id AND m.state='active'
 JOIN spool_project_teams t ON t.project=p.project AND t.organization=m.organization
 WHERE p.project=NEW.project AND p.historical=0 AND json_extract(p.email,'$.comment')=1
 AND (o.role='owner' OR m.role='admin' OR m.role IN('member','read-only') AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=p.project))
 AND p.actor_label IS NOT NEW.actor_label AND (NEW.kind='comment_added') AND (NOT EXISTS(SELECT 1 FROM issue_subscriptions x WHERE x.project=p.project AND x.issue=NEW.issue AND x.operator_id=p.operator_id AND x.reason='manual' AND x.state='unsubscribed') AND
 (EXISTS(SELECT 1 FROM issue_subscriptions x WHERE x.project=p.project AND x.issue=NEW.issue AND x.operator_id=p.operator_id AND x.state='subscribed') OR
 EXISTS(SELECT 1 FROM spool_issue_follows x WHERE x.project=p.project AND x.issue=NEW.issue AND x.operator_id=p.operator_id AND x.historical=0))) ON CONFLICT(project,source,type,recipient_label) DO NOTHING;
INSERT INTO spool_personal_mail(id,project,source,type,issue,operator_id,recipient_label,member_version,operator_version,created,updated)
 SELECT lower(hex(randomblob(16))),p.project,NEW.id,'assignment',NEW.issue,p.operator_id,p.actor_label,m.version,o.version,NEW.created,NEW.created
 FROM spool_notification_preferences p JOIN oa_operators o ON o.id=p.operator_id AND o.status='active'
 JOIN spool_members m ON m.operator_id=o.id AND m.state='active'
 JOIN spool_project_teams t ON t.project=p.project AND t.organization=m.organization
 WHERE p.project=NEW.project AND p.historical=0 AND json_extract(p.email,'$.assignment')=1
 AND (o.role='owner' OR m.role='admin' OR m.role IN('member','read-only') AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=p.project))
 AND p.actor_label IS NOT NEW.actor_label AND (NEW.kind='assignment') AND (NOT EXISTS(SELECT 1 FROM issue_subscriptions x WHERE x.project=p.project AND x.issue=NEW.issue AND x.operator_id=p.operator_id AND x.reason='manual' AND x.state='unsubscribed') AND
 (EXISTS(SELECT 1 FROM issue_subscriptions x WHERE x.project=p.project AND x.issue=NEW.issue AND x.operator_id=p.operator_id AND x.state='subscribed') OR
 EXISTS(SELECT 1 FROM spool_issue_follows x WHERE x.project=p.project AND x.issue=NEW.issue AND x.operator_id=p.operator_id AND x.historical=0))) ON CONFLICT(project,source,type,recipient_label) DO NOTHING;
INSERT INTO spool_personal_mail(id,project,source,type,issue,operator_id,recipient_label,member_version,operator_version,created,updated)
 SELECT lower(hex(randomblob(16))),p.project,NEW.id,'mention',NEW.issue,p.operator_id,p.actor_label,m.version,o.version,NEW.created,NEW.created
 FROM spool_notification_preferences p JOIN oa_operators o ON o.id=p.operator_id AND o.status='active'
 JOIN spool_members m ON m.operator_id=o.id AND m.state='active'
 JOIN spool_project_teams t ON t.project=p.project AND t.organization=m.organization
 WHERE p.project=NEW.project AND p.historical=0 AND json_extract(p.email,'$.mention')=1
 AND (o.role='owner' OR m.role='admin' OR m.role IN('member','read-only') AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=p.project))
 AND p.actor_label IS NOT NEW.actor_label AND (NEW.kind='comment_added') AND (EXISTS(SELECT 1 FROM issue_comments c,json_each(c.mentions) a WHERE c.id=json_extract(NEW.detail,'$.comment') AND c.project=p.project AND a.value=p.actor_label) AND NOT EXISTS(SELECT 1 FROM issue_subscriptions x WHERE x.project=p.project AND x.issue=NEW.issue AND x.operator_id=p.operator_id AND x.reason='manual' AND x.state='unsubscribed') AND
 (EXISTS(SELECT 1 FROM issue_subscriptions x WHERE x.project=p.project AND x.issue=NEW.issue AND x.operator_id=p.operator_id AND x.state='subscribed') OR
 EXISTS(SELECT 1 FROM spool_issue_follows x WHERE x.project=p.project AND x.issue=NEW.issue AND x.operator_id=p.operator_id AND x.historical=0))) ON CONFLICT(project,source,type,recipient_label) DO NOTHING;
END;
CREATE TRIGGER spool_personal_alert AFTER INSERT ON alerts WHEN NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) AND EXISTS(SELECT 1 FROM audit_context WHERE action<>'archive.restore') BEGIN
INSERT INTO spool_personal_mail(id,project,source,type,issue,operator_id,recipient_label,member_version,operator_version,created,updated)
 SELECT lower(hex(randomblob(16))),p.project,NEW.id,'regression',NEW.issue,p.operator_id,p.actor_label,m.version,o.version,NEW.created,NEW.created
 FROM spool_notification_preferences p JOIN oa_operators o ON o.id=p.operator_id AND o.status='active'
 JOIN spool_members m ON m.operator_id=o.id AND m.state='active'
 JOIN spool_project_teams t ON t.project=p.project AND t.organization=m.organization
 WHERE p.project=NEW.project AND p.historical=0 AND json_extract(p.email,'$.regression')=1
 AND (o.role='owner' OR m.role='admin' OR m.role IN('member','read-only') AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=p.project))
 AND p.actor_label IS NOT NULL AND (NEW.kind='regression') AND (NOT EXISTS(SELECT 1 FROM issue_subscriptions x WHERE x.project=p.project AND x.issue=NEW.issue AND x.operator_id=p.operator_id AND x.reason='manual' AND x.state='unsubscribed') AND
 (EXISTS(SELECT 1 FROM issue_subscriptions x WHERE x.project=p.project AND x.issue=NEW.issue AND x.operator_id=p.operator_id AND x.state='subscribed') OR
 EXISTS(SELECT 1 FROM spool_issue_follows x WHERE x.project=p.project AND x.issue=NEW.issue AND x.operator_id=p.operator_id AND x.historical=0))) ON CONFLICT(project,source,type,recipient_label) DO NOTHING;
INSERT INTO spool_personal_mail(id,project,source,type,issue,operator_id,recipient_label,member_version,operator_version,created,updated)
 SELECT lower(hex(randomblob(16))),p.project,NEW.id,'issue_alert',NEW.issue,p.operator_id,p.actor_label,m.version,o.version,NEW.created,NEW.created
 FROM spool_notification_preferences p JOIN oa_operators o ON o.id=p.operator_id AND o.status='active'
 JOIN spool_members m ON m.operator_id=o.id AND m.state='active'
 JOIN spool_project_teams t ON t.project=p.project AND t.organization=m.organization
 WHERE p.project=NEW.project AND p.historical=0 AND json_extract(p.email,'$.issue_alert')=1
 AND (o.role='owner' OR m.role='admin' OR m.role IN('member','read-only') AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=p.project))
 AND p.actor_label IS NOT NULL AND (1) AND (1) ON CONFLICT(project,source,type,recipient_label) DO NOTHING;
END;
CREATE TRIGGER spool_personal_deploy AFTER INSERT ON deployment_steps WHEN NEW.state='succeeded' AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) AND EXISTS(SELECT 1 FROM audit_context WHERE action<>'archive.restore') BEGIN
INSERT INTO spool_personal_mail(id,project,source,type,issue,operator_id,recipient_label,member_version,operator_version,created,updated)
 SELECT lower(hex(randomblob(16))),p.project,'deploy:'||NEW.deployment,'deploy',NULL,p.operator_id,p.actor_label,m.version,o.version,NEW.recorded,NEW.recorded
 FROM spool_notification_preferences p JOIN oa_operators o ON o.id=p.operator_id AND o.status='active'
 JOIN spool_members m ON m.operator_id=o.id AND m.state='active'
 JOIN spool_project_teams t ON t.project=p.project AND t.organization=m.organization
 WHERE p.project=NEW.project AND p.historical=0 AND json_extract(p.email,'$.deploy')=1
 AND (o.role='owner' OR m.role='admin' OR m.role IN('member','read-only') AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=p.project))
 AND p.actor_label IS NOT NULL AND (1) AND (EXISTS(SELECT 1 FROM deployment_runs d,json_each(d.included_commits) k JOIN commits c ON c.project=d.project AND c.sha=k.value
 WHERE d.project=p.project AND d.id=NEW.deployment AND d.historical=0 AND lower(c.author_email)=lower(m.email))) ON CONFLICT(project,source,type,recipient_label) DO NOTHING;
END;
