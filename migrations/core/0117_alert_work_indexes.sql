CREATE INDEX IF NOT EXISTS alert_history_alert_project ON alert_history(alert_id,project);
CREATE INDEX IF NOT EXISTS alerts_project_issue_kind_created ON alerts(project,issue,kind,created);
CREATE INDEX IF NOT EXISTS events_project_received ON events(project,received);
CREATE INDEX IF NOT EXISTS alert_intents_unexpanded ON alert_intents(project,id)
 WHERE expanded=0 AND state IN ('pending','blocked');
CREATE INDEX IF NOT EXISTS alert_mail_jobs_active ON alert_mail_jobs(project) WHERE state IN ('queued','sending');
CREATE INDEX IF NOT EXISTS alert_mail_jobs_due ON alert_mail_jobs(next_at,id,project) WHERE state='queued';
CREATE INDEX IF NOT EXISTS alert_mail_jobs_recovery ON alert_mail_jobs(claim_until,claim,project) WHERE state='sending';
CREATE INDEX IF NOT EXISTS integration_deliveries_active ON integration_deliveries(state,namespace,next_at)
 WHERE state IN ('queued','sending');
CREATE INDEX IF NOT EXISTS integration_resolutions_delivery ON integration_resolutions(namespace,delivery_id,at DESC);
CREATE INDEX IF NOT EXISTS alert_snoozes_due ON alert_snoozes(until,project) WHERE historical=0 AND resumed_at IS NULL;
CREATE INDEX IF NOT EXISTS alert_suppressed_active ON alert_suppressed(project,delivery_id,snooze_id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS alert_suppressed_snooze ON alert_suppressed(snooze_id,released_at);
CREATE INDEX IF NOT EXISTS alert_suppressed_active_snooze ON alert_suppressed(snooze_id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS rer_erasure_operations_open ON rer_erasure_operations(requested_at)
 WHERE phase<>'complete';
CREATE INDEX IF NOT EXISTS alert_scheduled_mail_follow_up ON alert_scheduled_mail(project,id)
 WHERE historical=0 AND state IN ('blocked','rejected','uncertain');
CREATE INDEX IF NOT EXISTS spool_team_mail_follow_up ON spool_team_mail(organization,team,id)
 WHERE historical=0 AND state IN ('blocked','rejected','uncertain');
CREATE INDEX IF NOT EXISTS follow_up_attention_alert_open ON follow_up_attention(project,source_id)
 WHERE source='alert' AND state<>'completed';
CREATE INDEX IF NOT EXISTS follow_up_attention_live ON follow_up_attention(project,state,source,source_id)
 WHERE historical=0 AND state NOT IN ('completed','canceled','uncertain');
CREATE INDEX IF NOT EXISTS follow_up_attention_local_queued ON follow_up_attention(source,source_id,project)
 WHERE historical=0 AND state='queued';
CREATE INDEX IF NOT EXISTS follow_up_attention_fix ON follow_up_attention(source_id)
 WHERE source='fix' AND historical=0 AND state<>'uncertain';
CREATE INDEX IF NOT EXISTS follow_up_attention_alternate ON follow_up_attention(project,source_id)
 WHERE source='alert' AND state='blocked' AND source_id LIKE 'alternate:%';
CREATE INDEX IF NOT EXISTS follow_up_attention_notice ON follow_up_attention(project,source_id)
 WHERE historical=0 AND state NOT IN ('completed','canceled');
CREATE INDEX IF NOT EXISTS alert_scheduled_mail_active ON alert_scheduled_mail(created,id)
 WHERE historical=0 AND state IN ('queued','running');
CREATE INDEX IF NOT EXISTS spool_team_mail_active ON spool_team_mail(created,id)
 WHERE historical=0 AND state IN ('queued','running');
CREATE INDEX IF NOT EXISTS follow_up_fix_workflow_state ON follow_up_fix_steps(workflow,state);
CREATE INDEX IF NOT EXISTS fix_leases_until ON fix_leases(until,project,workflow);

-- The source transaction records the affected delivery, including a claim
-- whose Worker exits before it can publish its history.
CREATE TABLE IF NOT EXISTS alert_history_dirty (
 id TEXT PRIMARY KEY REFERENCES alert_history(id) ON DELETE CASCADE,
 project TEXT NOT NULL REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS alert_history_dirty_project ON alert_history_dirty(project);

CREATE VIEW IF NOT EXISTS alert_history_projection AS
 SELECT h.id,h.project,
  CASE WHEN x.released_at IS NULL AND x.delivery_id IS NOT NULL AND i.state='snoozed' THEN 'snoozed'
   WHEN d.state='queued' AND d.attempts>0 THEN 'retrying'
   WHEN d.state='rejected' AND json_extract(last.outcome,'$.code')='preflight_failed' THEN 'blocked'
   ELSE COALESCE(d.state,CASE WHEN j.state='queued' AND j.attempts>0 THEN 'retrying' ELSE j.state END,i.state,h.state)
  END state,
  COALESCE(d.attempts,j.attempts,h.attempts) attempts,
  CASE WHEN h.channel='webhook' AND (h.code LIKE 'http_%_signature_sent' OR h.code LIKE 'slack_%') THEN h.code
   ELSE COALESCE((SELECT json_extract(r.outcome,'$.code') FROM integration_resolutions r
     WHERE r.namespace='spool.'||h.project AND r.delivery_id=h.id ORDER BY r.at DESC LIMIT 1),
    json_extract(last.outcome,'$.code'),j.code,i.code)
  END code
 FROM alert_history h
 LEFT JOIN alert_suppressed x ON x.delivery_id=h.id
 LEFT JOIN alert_intents i ON i.id=h.id
 LEFT JOIN alert_mail_jobs j ON j.id=h.id
 LEFT JOIN integration_deliveries d ON d.namespace='spool.'||h.project AND d.id=h.id
 LEFT JOIN integration_attempts last ON last.namespace='spool.'||h.project AND last.id=(
  SELECT id FROM integration_attempts WHERE namespace='spool.'||h.project AND delivery_id=h.id ORDER BY number DESC LIMIT 1)
 WHERE h.historical=0 AND h.code IS NOT 'retention_removed';

INSERT INTO alert_history_dirty(id,project)
 SELECT p.id,p.project FROM alert_history_projection p JOIN alert_history h ON h.id=p.id
 WHERE (h.state,h.attempts,h.code) IS NOT (p.state,p.attempts,p.code)
 ON CONFLICT(id) DO NOTHING;

CREATE TRIGGER IF NOT EXISTS alert_history_dirty_intent AFTER UPDATE OF state,code ON alert_intents
 WHEN (OLD.state,OLD.code) IS NOT (NEW.state,NEW.code)
 BEGIN
  INSERT INTO alert_history_dirty SELECT id,project FROM alert_history
   WHERE id=NEW.id AND project=NEW.project AND historical=0 AND code IS NOT 'retention_removed' ON CONFLICT(id) DO NOTHING;
 END;
CREATE TRIGGER IF NOT EXISTS alert_history_dirty_mail_insert AFTER INSERT ON alert_mail_jobs
 BEGIN
  INSERT INTO alert_history_dirty SELECT id,project FROM alert_history
   WHERE id=NEW.id AND project=NEW.project AND historical=0 AND code IS NOT 'retention_removed' ON CONFLICT(id) DO NOTHING;
 END;
CREATE TRIGGER IF NOT EXISTS alert_history_dirty_mail_update AFTER UPDATE OF state,attempts,code ON alert_mail_jobs
 WHEN (OLD.state,OLD.attempts,OLD.code) IS NOT (NEW.state,NEW.attempts,NEW.code)
 BEGIN
  INSERT INTO alert_history_dirty SELECT id,project FROM alert_history
   WHERE id=NEW.id AND project=NEW.project AND historical=0 AND code IS NOT 'retention_removed' ON CONFLICT(id) DO NOTHING;
 END;
CREATE TRIGGER IF NOT EXISTS alert_history_dirty_delivery_insert AFTER INSERT ON integration_deliveries
 BEGIN
  INSERT INTO alert_history_dirty SELECT id,project FROM alert_history
   WHERE id=NEW.id AND 'spool.'||project=NEW.namespace AND historical=0 AND code IS NOT 'retention_removed' ON CONFLICT(id) DO NOTHING;
 END;
CREATE TRIGGER IF NOT EXISTS alert_history_dirty_delivery_update AFTER UPDATE OF state,attempts ON integration_deliveries
 WHEN (OLD.state,OLD.attempts) IS NOT (NEW.state,NEW.attempts)
 BEGIN
  INSERT INTO alert_history_dirty SELECT id,project FROM alert_history
   WHERE id=NEW.id AND 'spool.'||project=NEW.namespace AND historical=0 AND code IS NOT 'retention_removed' ON CONFLICT(id) DO NOTHING;
 END;
CREATE TRIGGER IF NOT EXISTS alert_history_dirty_attempt AFTER UPDATE OF outcome ON integration_attempts
 WHEN OLD.outcome IS NOT NEW.outcome
 BEGIN
  INSERT INTO alert_history_dirty SELECT id,project FROM alert_history
   WHERE id=NEW.delivery_id AND 'spool.'||project=NEW.namespace AND historical=0 AND code IS NOT 'retention_removed' ON CONFLICT(id) DO NOTHING;
 END;
CREATE TRIGGER IF NOT EXISTS alert_history_dirty_resolution AFTER INSERT ON integration_resolutions
 BEGIN
  INSERT INTO alert_history_dirty SELECT id,project FROM alert_history
   WHERE id=NEW.delivery_id AND 'spool.'||project=NEW.namespace AND historical=0 AND code IS NOT 'retention_removed' ON CONFLICT(id) DO NOTHING;
 END;
CREATE TRIGGER IF NOT EXISTS alert_history_dirty_released AFTER UPDATE OF released_at ON alert_suppressed
 WHEN OLD.released_at IS NOT NEW.released_at
 BEGIN
  INSERT INTO alert_history_dirty SELECT id,project FROM alert_history
   WHERE id=NEW.delivery_id AND project=NEW.project AND historical=0 AND code IS NOT 'retention_removed' ON CONFLICT(id) DO NOTHING;
 END;
