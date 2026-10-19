-- Every committed change records one attributed safe fact in its own transaction.
-- A writer opens one context row inside its batch (actor, action, subject and
-- project aliases, all already safe) and closes it before the batch ends. A
-- change commits its fact by marking the context committed: either by writing
-- the operational journal (`audit`), which requires a context, or explicitly.
-- An aborted batch rolls back the change, the context and the fact together.
CREATE TABLE audit_context (
 slot INTEGER PRIMARY KEY CHECK(slot=1),
 actor_kind TEXT NOT NULL,
 actor_label TEXT NOT NULL,
 action TEXT NOT NULL,
 subject_kind TEXT NOT NULL,
 subject_label TEXT NOT NULL,
 project_label TEXT,
 created INTEGER NOT NULL,
 committed INTEGER NOT NULL DEFAULT 0 CHECK(committed IN (0,1))
);
CREATE TRIGGER audit_context_commit AFTER UPDATE OF committed ON audit_context WHEN OLD.committed=0 AND NEW.committed=1 BEGIN
 INSERT INTO spool_audit_events(id,created,source,actor_kind,actor_label,action,subject_kind,subject_label,project_label,outcome,status)
 VALUES(lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(6))),
  NEW.created,'transaction',NEW.actor_kind,NEW.actor_label,NEW.action,NEW.subject_kind,NEW.subject_label,NEW.project_label,'succeeded',NULL);
END;
-- Restore drops and recreates this trigger around its own copy, so restored
-- journal rows never become new facts attributed to the restoring actor.
CREATE TRIGGER audit_journal_fact AFTER INSERT ON audit BEGIN
 SELECT RAISE(ABORT,'audit_context_required') WHERE NOT EXISTS(SELECT 1 FROM audit_context);
 UPDATE audit_context SET committed=1;
END;

-- Journal kinds written before attributed facts existed. Their permanent copy
-- keeps kind-derived action, time and outcome only: actor unknown, fresh
-- unlinkable labels, no detail value.
CREATE TABLE audit_legacy_actions (kind TEXT PRIMARY KEY, action TEXT NOT NULL, subject_kind TEXT NOT NULL);
INSERT INTO audit_legacy_actions VALUES
 ('project_created','project.create','project'),('key_created','credential.create','credential'),('key_revoked','credential.revoke','credential'),
 ('browser_origin_added','origin.change','project'),('browser_origin_removed','origin.change','project'),('triage','issue.triage','issue'),
 ('issue_assigned','issue.assign','issue'),('suppression_changed','suppression.change','policy'),('grouping_applied','grouping.apply','correction'),
 ('grouping_undone','grouping.undo','correction'),('grouping_rules_changed','grouping.policy','project'),('inbound_filters_changed','filter.change','project'),
 ('release_policy_changed','release.policy','project'),('release_registered','release.register','release'),('deployment_registered','deployment.start','release'),
 ('artifact_uploaded','artifact.upload','artifact'),('retention_gap','retention.preview_or_apply','project'),('alert_history_unavailable','retention.preview_or_apply','rule'),
 ('feedback_withdrawn','feedback.withdraw','feedback'),('alert_rule_created','alert.rule.create','rule'),('alert_rule_revised','alert.rule.change','rule'),
 ('alert_delivery_resolved','alert.delivery.resolve','delivery'),('repair_recorded','repair.create','repair'),('repair_check_recorded','repair.check','repair'),
 ('repair_fact','repair.fact','repair'),('reproducer_recorded','reproducer.create','reproducer'),('reproducer_run_queued','reproducer.queue','run'),
 ('reproducer_run_finished','reproducer.finish','run'),('fix_proposed','fix.propose','workflow'),('fix_approved','fix.approve','workflow'),
 ('fix_advanced','fix.advance','workflow'),('capture_history_started','capture.native','issue'),('capture_unsuppressed','capture.native','issue');
-- Per-project labels exist only while a copy runs; nothing links them back.
CREATE TABLE audit_legacy_labels (project TEXT PRIMARY KEY, label TEXT NOT NULL);
INSERT INTO audit_legacy_labels SELECT project,'audit:'||lower(hex(randomblob(16))) FROM (SELECT DISTINCT project FROM audit WHERE project IS NOT NULL);
INSERT INTO spool_audit_events(id,created,source,actor_kind,actor_label,action,subject_kind,subject_label,project_label,outcome,status)
 SELECT lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(6))),
  a.created,'legacy','unknown','audit:'||lower(hex(randomblob(16))),COALESCE(m.action,'private.action'),COALESCE(m.subject_kind,'unknown'),'audit:'||lower(hex(randomblob(16))),
  (SELECT label FROM audit_legacy_labels l WHERE l.project=a.project),'succeeded',NULL
 FROM audit a LEFT JOIN audit_legacy_actions m ON m.kind=a.kind ORDER BY a.created,a.id;
DELETE FROM audit_legacy_labels;

-- The permanent service alias of local CLI restores (lookup = authorityHash('service','portability-cli')).
INSERT OR IGNORE INTO audit_actor_links(kind,lookup_hash,label,owner_hash,project_hash,owner_id,project,created)
 VALUES('service','d832ceb4065065973b7c2718944b0047cd6672ae8d3279b42c0771af1cfa367a','audit:'||lower(hex(randomblob(16))),NULL,NULL,NULL,NULL,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER));

-- Archived safe history waits here, verified, until its restore commits. The
-- marker row (ord 0) records that the archive carried safe history at all.
CREATE TABLE audit_restore_staging (import_id TEXT NOT NULL, ord INTEGER NOT NULL CHECK(ord>=0), fact TEXT, PRIMARY KEY(import_id,ord));
-- Base clears import_job in the restore's final batch (applying=1) or on abort
-- (applying=0). Only the commit appends: original ids, times, sources, aliases
-- and outcomes after every existing fact, never replacing or re-attributing one.
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
