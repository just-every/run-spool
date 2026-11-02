-- Agent door custody from Base rer-v0.2.96 (8b925fa5ffaa577df9f2e4ebab6ede8af5155baa).
ALTER TABLE agent_door_agents ADD COLUMN tombstone TEXT;
-- Installation-private replay custody, never included in an archive or export.
-- The call's fixed replay horizon bounds the alias; deletion is atomic below.
CREATE TABLE IF NOT EXISTS agent_door_replay_aliases (
  agent TEXT NOT NULL, alias TEXT NOT NULL, call_id TEXT NOT NULL, tombstone TEXT NOT NULL,
  PRIMARY KEY(agent,alias)
);

CREATE TRIGGER IF NOT EXISTS agent_door_delete_replay_aliases AFTER DELETE ON agent_door_calls
BEGIN
  DELETE FROM agent_door_replay_aliases WHERE agent=OLD.agent AND call_id=OLD.decision_id;
END;
CREATE INDEX IF NOT EXISTS agent_door_replay_aliases_call ON agent_door_replay_aliases(agent,call_id);

-- Fixed Base replay window; no installation or seed override.
ALTER TABLE agent_door_calls ADD COLUMN expires_at INTEGER;
-- Older completed claims have no completion timestamp: use their recorded start,
-- never migration/erasure time, so upgrading cannot extend their retention.
UPDATE agent_door_calls SET expires_at=created_at + 30*24*60*60*1000
WHERE state NOT IN ('running','pending') AND expires_at IS NULL;
CREATE INDEX agent_door_calls_expiry ON agent_door_calls(expires_at);

CREATE TRIGGER IF NOT EXISTS agent_door_delete_replay_aliases AFTER DELETE ON agent_door_calls
BEGIN
  DELETE FROM agent_door_replay_aliases WHERE agent=OLD.agent AND call_id=OLD.decision_id;
END;
CREATE INDEX IF NOT EXISTS agent_door_replay_aliases_call ON agent_door_replay_aliases(agent,call_id);

CREATE TABLE IF NOT EXISTS agent_door_relay (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT, decision_id TEXT NOT NULL, business TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_door_relay_business ON agent_door_relay(business,sequence);
CREATE INDEX IF NOT EXISTS agent_door_relay_decision ON agent_door_relay(decision_id,sequence);
-- Plain INSERT then DELETE, never INSERT OR REPLACE: an outer UPSERT's conflict policy overrides a trigger's.
CREATE TRIGGER IF NOT EXISTS agent_door_relay_audit_insert AFTER INSERT ON agent_door_audit
WHEN json_extract(NEW.row,'$.door')='mcp' AND json_extract(NEW.row,'$.consent') IS NOT NULL
 AND (SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1) IS NOT NULL
BEGIN
  INSERT INTO agent_door_relay(decision_id,business) VALUES(NEW.id,
    COALESCE((SELECT business FROM agent_door_relay WHERE decision_id=NEW.id ORDER BY sequence DESC LIMIT 1),
             (SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1)));
  DELETE FROM agent_door_relay WHERE decision_id=NEW.id AND sequence<(SELECT MAX(sequence) FROM agent_door_relay WHERE decision_id=NEW.id);
END;
-- Membership survives erasure, which drops door and consent from the row.
CREATE TRIGGER IF NOT EXISTS agent_door_relay_audit_update AFTER UPDATE ON agent_door_audit
WHEN EXISTS(SELECT 1 FROM agent_door_relay WHERE decision_id=NEW.id)
  OR (json_extract(NEW.row,'$.door')='mcp' AND json_extract(NEW.row,'$.consent') IS NOT NULL
      AND (SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1) IS NOT NULL)
BEGIN
  INSERT INTO agent_door_relay(decision_id,business) VALUES(NEW.id,
    COALESCE((SELECT business FROM agent_door_relay WHERE decision_id=NEW.id ORDER BY sequence DESC LIMIT 1),
             (SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1)));
  DELETE FROM agent_door_relay WHERE decision_id=NEW.id AND sequence<(SELECT MAX(sequence) FROM agent_door_relay WHERE decision_id=NEW.id);
END;
CREATE TRIGGER IF NOT EXISTS agent_door_relay_approval AFTER UPDATE OF state ON agent_door_approvals
WHEN EXISTS(SELECT 1 FROM agent_door_relay WHERE decision_id=json_extract(NEW.saved,'$.decision_id'))
BEGIN
  INSERT INTO agent_door_relay(decision_id,business)
    SELECT decision_id,business FROM agent_door_relay WHERE decision_id=json_extract(NEW.saved,'$.decision_id') ORDER BY sequence DESC LIMIT 1;
  DELETE FROM agent_door_relay WHERE decision_id=json_extract(NEW.saved,'$.decision_id')
    AND sequence<(SELECT MAX(sequence) FROM agent_door_relay WHERE decision_id=json_extract(NEW.saved,'$.decision_id'));
END;
CREATE TRIGGER IF NOT EXISTS agent_door_relay_review AFTER UPDATE OF state ON agent_door_reviews
WHEN EXISTS(SELECT 1 FROM agent_door_relay WHERE decision_id=json_extract(NEW.saved,'$.decision_id'))
BEGIN
  INSERT INTO agent_door_relay(decision_id,business)
    SELECT decision_id,business FROM agent_door_relay WHERE decision_id=json_extract(NEW.saved,'$.decision_id') ORDER BY sequence DESC LIMIT 1;
  DELETE FROM agent_door_relay WHERE decision_id=json_extract(NEW.saved,'$.decision_id')
    AND sequence<(SELECT MAX(sequence) FROM agent_door_relay WHERE decision_id=json_extract(NEW.saved,'$.decision_id'));
END;
-- 0040 only, once: pre-existing Business-token rows, attributed to the current envelope's Business (platform P11 drops pre-join history).
INSERT INTO agent_door_relay(decision_id,business)
  SELECT id,(SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1) FROM agent_door_audit
  WHERE json_extract(row,'$.door')='mcp' AND json_extract(row,'$.consent') IS NOT NULL
    AND (SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1) IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM agent_door_relay r WHERE r.decision_id=agent_door_audit.id)
  ORDER BY sequence;

-- Native capture and effects cannot enter a subject being erased.
CREATE TRIGGER spool_agent_erasure_projects_insert BEFORE INSERT ON projects
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.id)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_projects_update BEFORE UPDATE ON projects
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.id)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_events_insert BEFORE INSERT ON events
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_events_update BEFORE UPDATE ON events
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_artifacts_insert BEFORE INSERT ON artifacts
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_artifacts_update BEFORE UPDATE ON artifacts
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_feedback_insert BEFORE INSERT ON feedback
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_feedback_update BEFORE UPDATE ON feedback
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_issues_insert BEFORE INSERT ON issues
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_issues_update BEFORE UPDATE ON issues
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_grouping_proposals_insert BEFORE INSERT ON grouping_proposals
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_grouping_proposals_update BEFORE UPDATE ON grouping_proposals
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_grouping_corrections_insert BEFORE INSERT ON grouping_corrections
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_grouping_corrections_update BEFORE UPDATE ON grouping_corrections
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_repairs_insert BEFORE INSERT ON repairs
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_repairs_update BEFORE UPDATE ON repairs
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_repair_checks_insert BEFORE INSERT ON repair_checks
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_repair_checks_update BEFORE UPDATE ON repair_checks
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_reproducers_insert BEFORE INSERT ON reproducers
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_reproducers_update BEFORE UPDATE ON reproducers
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_reproducer_runs_insert BEFORE INSERT ON reproducer_runs
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_reproducer_runs_update BEFORE UPDATE ON reproducer_runs
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_fix_workflows_insert BEFORE INSERT ON fix_workflows
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_fix_workflows_update BEFORE UPDATE ON fix_workflows
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_spool_agent_custody_insert BEFORE INSERT ON spool_agent_custody
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_spool_agent_custody_update BEFORE UPDATE ON spool_agent_custody
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_spool_agent_operations_insert BEFORE INSERT ON spool_agent_operations
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_spool_agent_operations_update BEFORE UPDATE ON spool_agent_operations
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_spool_native_audit_actors_insert BEFORE INSERT ON spool_native_audit_actors
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_spool_native_audit_actors_update BEFORE UPDATE ON spool_native_audit_actors
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_spool_native_approvals_insert BEFORE INSERT ON spool_native_approvals
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_spool_native_approvals_update BEFORE UPDATE ON spool_native_approvals
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND (entity='installation-owner' OR (entity='project' AND json_extract(subject,'$.id')=NEW.project)))
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;

-- Pairing and its attribution share the existing native owner-erasure fence.
CREATE TRIGGER spool_agent_erasure_bs_settings_insert BEFORE INSERT ON bs_settings
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND entity='installation-owner')
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_bs_settings_update BEFORE UPDATE ON bs_settings
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND entity='installation-owner')
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_bs_team_insert BEFORE INSERT ON bs_team
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND entity='installation-owner')
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_bs_team_update BEFORE UPDATE ON bs_team
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND entity='installation-owner')
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_bs_overrides_insert BEFORE INSERT ON bs_overrides
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND entity='installation-owner')
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_bs_overrides_update BEFORE UPDATE ON bs_overrides
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND entity='installation-owner')
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_bs_audit_insert BEFORE INSERT ON bs_audit
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND entity='installation-owner')
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;
CREATE TRIGGER spool_agent_erasure_bs_audit_update BEFORE UPDATE ON bs_audit
WHEN NOT EXISTS(SELECT 1 FROM rer_erasure_guard) AND EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND entity='installation-owner')
BEGIN SELECT RAISE(ABORT,'subject_erasure_in_progress'); END;

-- Bind first-send agent attribution without changing the native queued payload.
ALTER TABLE alert_mail_jobs ADD COLUMN agent_attribution TEXT;
