-- Additive custody: no payload copies, and occurrence keys prevent retention resurrection.
CREATE TABLE grouping_corrections(id TEXT PRIMARY KEY,project TEXT NOT NULL REFERENCES projects(id),kind TEXT NOT NULL CHECK(kind IN ('split','merge')),state TEXT NOT NULL CHECK(state IN ('preview','applied','undone')),plan TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL);
CREATE TABLE event_grouping(project TEXT NOT NULL REFERENCES projects(id),event TEXT NOT NULL,occurrence TEXT NOT NULL,original_issue TEXT NOT NULL REFERENCES issues(id),algorithm TEXT NOT NULL,basis TEXT NOT NULL,fingerprint TEXT NOT NULL,correction TEXT NOT NULL REFERENCES grouping_corrections(id),direction TEXT NOT NULL CHECK(direction IN ('apply','undo')),PRIMARY KEY(project,event,occurrence),FOREIGN KEY(project,event,occurrence) REFERENCES events(project,id,occurrence) ON DELETE CASCADE);
CREATE TABLE issue_assignments(project TEXT NOT NULL REFERENCES projects(id),issue TEXT PRIMARY KEY REFERENCES issues(id),label TEXT,updated INTEGER NOT NULL);
CREATE TABLE suppression_policies(id TEXT PRIMARY KEY,project TEXT NOT NULL REFERENCES projects(id),revision INTEGER NOT NULL,field TEXT NOT NULL CHECK(field IN ('fingerprint','release','message')),mode TEXT NOT NULL CHECK(mode IN ('exact','substring')),value TEXT NOT NULL,enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),created INTEGER NOT NULL,updated INTEGER NOT NULL);
CREATE TABLE event_suppressions(project TEXT NOT NULL REFERENCES projects(id),event TEXT NOT NULL,occurrence TEXT NOT NULL,reasons TEXT NOT NULL,PRIMARY KEY(project,event,occurrence),FOREIGN KEY(project,event,occurrence) REFERENCES events(project,id,occurrence) ON DELETE CASCADE);
CREATE TABLE deployment_manifests(project TEXT NOT NULL REFERENCES projects(id),release TEXT NOT NULL,environment TEXT NOT NULL,commit_sha TEXT NOT NULL,repository TEXT NOT NULL,deployed_at INTEGER NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(project,release,environment),FOREIGN KEY(project,release) REFERENCES releases(project,name));
CREATE TABLE operator_guards(ok INTEGER NOT NULL CHECK(ok=1));
-- Keep correction conflicts distinct from the owner's independent ok=1 guard.
CREATE TRIGGER operator_guard_conflict BEFORE INSERT ON operator_guards WHEN NEW.ok<>1 BEGIN SELECT RAISE(ABORT,'operator_revision_or_occurrence_conflict'); END;
-- A worker can have read a delivery before retention cancels it. Its late
-- insert must not recreate the erased private diagnostic in a local copy.
CREATE TRIGGER retention_integration_delivery BEFORE INSERT ON integration_deliveries
 WHEN EXISTS(SELECT 1 FROM alert_intents i WHERE NEW.namespace='spool.'||i.project AND NEW.id=i.id AND i.code='retention_removed')
 BEGIN SELECT RAISE(ABORT,'retention_removed'); END;
CREATE TRIGGER retention_integration_replay BEFORE INSERT ON integration_replays
 WHEN EXISTS(SELECT 1 FROM alert_intents i WHERE NEW.namespace='spool.'||i.project AND NEW.id=i.id AND i.code='retention_removed')
 BEGIN SELECT RAISE(ABORT,'retention_removed'); END;
CREATE TRIGGER retention_mail_job BEFORE INSERT ON alert_mail_jobs
 WHEN EXISTS(SELECT 1 FROM alert_intents i WHERE i.project=NEW.project AND i.id=NEW.id AND i.code='retention_removed')
 BEGIN SELECT RAISE(ABORT,'retention_removed'); END;
CREATE TRIGGER retention_development_mail BEFORE INSERT ON rer_mail_development_outbox
 WHEN json_valid(NEW.message) AND EXISTS(SELECT 1 FROM alert_intents i WHERE i.id=json_extract(NEW.message,'$.deliveryId') AND i.code='retention_removed')
 BEGIN SELECT RAISE(ABORT,'retention_removed'); END;
CREATE TRIGGER grouping_capacity BEFORE INSERT ON grouping_corrections WHEN (SELECT COUNT(*) FROM grouping_corrections WHERE project=NEW.project)>=50 BEGIN SELECT RAISE(ABORT,'correction_history_full'); END;
CREATE TRIGGER suppression_capacity BEFORE INSERT ON suppression_policies WHEN (SELECT COUNT(*) FROM suppression_policies WHERE project=NEW.project)>=20 BEGIN SELECT RAISE(ABORT,'suppression_policy_full'); END;
CREATE TRIGGER portability_grouping_corrections_insert BEFORE INSERT ON grouping_corrections WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_grouping_corrections_update BEFORE UPDATE ON grouping_corrections WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_grouping_corrections_delete BEFORE DELETE ON grouping_corrections WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_event_grouping_insert BEFORE INSERT ON event_grouping WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_event_grouping_update BEFORE UPDATE ON event_grouping WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_event_grouping_delete BEFORE DELETE ON event_grouping WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_issue_assignments_insert BEFORE INSERT ON issue_assignments WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_issue_assignments_update BEFORE UPDATE ON issue_assignments WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_issue_assignments_delete BEFORE DELETE ON issue_assignments WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_suppression_policies_insert BEFORE INSERT ON suppression_policies WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_suppression_policies_update BEFORE UPDATE ON suppression_policies WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_suppression_policies_delete BEFORE DELETE ON suppression_policies WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_event_suppressions_insert BEFORE INSERT ON event_suppressions WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_event_suppressions_update BEFORE UPDATE ON event_suppressions WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_event_suppressions_delete BEFORE DELETE ON event_suppressions WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_deployment_manifests_insert BEFORE INSERT ON deployment_manifests WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_deployment_manifests_update BEFORE UPDATE ON deployment_manifests WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_deployment_manifests_delete BEFORE DELETE ON deployment_manifests WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
