CREATE TABLE spool_personal_digest_settings (
 project TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,actor_label TEXT NOT NULL,operator_id TEXT,
 timezone TEXT NOT NULL DEFAULT 'UTC',hour INTEGER NOT NULL DEFAULT 9 CHECK(hour BETWEEN 0 AND 23),
 daily INTEGER NOT NULL DEFAULT 0 CHECK(daily IN(0,1)),weekly INTEGER NOT NULL DEFAULT 0 CHECK(weekly IN(0,1)),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),created INTEGER NOT NULL,updated INTEGER NOT NULL,
 historical INTEGER NOT NULL DEFAULT 0 CHECK(historical IN(0,1)),
 PRIMARY KEY(project,actor_label),CHECK(historical=1 OR operator_id IS NOT NULL)
);
CREATE UNIQUE INDEX spool_personal_digest_person ON spool_personal_digest_settings(project,operator_id) WHERE historical=0;
ALTER TABLE spool_personal_mail ADD COLUMN period_start INTEGER;
ALTER TABLE spool_personal_mail ADD COLUMN period_end INTEGER;
ALTER TABLE spool_personal_mail ADD COLUMN timezone TEXT;
-- Retention can remove the destination issue while delivery history survives.
-- Withdraw queued work rather than retaining a broken private link.
CREATE TRIGGER spool_personal_issue_removed AFTER DELETE ON issues BEGIN
 UPDATE spool_personal_mail SET state='canceled',code='issue_removed' WHERE project=OLD.project AND issue=OLD.id AND state IN('queued','running');
 UPDATE spool_personal_mail SET issue=NULL WHERE project=OLD.project AND issue=OLD.id;
END;
