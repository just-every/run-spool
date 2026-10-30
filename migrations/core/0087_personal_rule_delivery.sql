CREATE TABLE spool_personal_rule_settings (
 project TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,rule_id TEXT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
 mandatory INTEGER NOT NULL DEFAULT 0 CHECK(mandatory IN(0,1)),revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 updated INTEGER NOT NULL,historical INTEGER NOT NULL DEFAULT 0 CHECK(historical IN(0,1)),PRIMARY KEY(project,rule_id)
);
ALTER TABLE spool_personal_mail ADD COLUMN rule_delivery TEXT;
ALTER TABLE alert_mail_jobs ADD COLUMN personal_operator TEXT;
ALTER TABLE alert_mail_jobs ADD COLUMN personal_member_version INTEGER;
ALTER TABLE alert_mail_jobs ADD COLUMN personal_operator_version INTEGER;
DROP TRIGGER spool_personal_alert;
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
 SELECT lower(hex(randomblob(16))),NEW.project,NEW.id,'issue_alert',NEW.issue,o.id,
 COALESCE(p.actor_label,(SELECT label FROM audit_actor_links WHERE owner_id=o.id AND kind IN('owner','member') AND project IS NULL LIMIT 1),'audit:'||lower(hex(randomblob(16)))),m.version,o.version,NEW.created,NEW.created
 FROM spool_members m JOIN oa_operators o ON o.id=m.operator_id AND o.status='active'
 JOIN spool_project_teams t ON t.project=NEW.project AND t.organization=m.organization
 LEFT JOIN spool_notification_preferences p ON p.project=NEW.project AND p.operator_id=o.id AND p.historical=0
 WHERE m.state='active' AND (o.role='owner' OR m.role='admin' OR m.role IN('member','read-only') AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=NEW.project))
 AND (json_extract(p.email,'$.issue_alert')=1 OR EXISTS(SELECT 1 FROM spool_personal_rule_settings x JOIN alert_rules r ON r.id=x.rule_id AND r.project=x.project AND r.enabled=1,json_each(r.kinds) k WHERE x.project=NEW.project AND x.mandatory=1 AND x.historical=0 AND k.value=NEW.kind))
 ON CONFLICT(project,source,type,recipient_label) DO NOTHING;
END;
