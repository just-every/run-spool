-- Project metrics have no synthetic issue. Preserve the populated feed and every
-- current trigger while rebuilding its nullable issue reference, in the same transaction.
INSERT INTO rer_portability_guard SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) THEN 1 ELSE 0 END;
DELETE FROM rer_portability_guard WHERE rowid=last_insert_rowid();
PRAGMA defer_foreign_keys=ON;
CREATE TABLE spool_alerts_backup AS SELECT * FROM alerts;
DELETE FROM alerts;
DROP TRIGGER portability_alerts_insert;
DROP TRIGGER portability_alerts_update;
DROP TRIGGER portability_alerts_delete;
DROP TRIGGER spool_owner_erasure_alerts_insert;
DROP TRIGGER spool_owner_erasure_alerts_update;
DROP TRIGGER release_dist_restore;
DROP TRIGGER follow_up_local_feed;
DROP TRIGGER issue_priority_escalation;
DROP TABLE alerts;
CREATE TABLE alerts(id TEXT PRIMARY KEY,project TEXT NOT NULL REFERENCES projects(id),issue TEXT REFERENCES issues(id),kind TEXT NOT NULL,created INTEGER NOT NULL, payload TEXT, CHECK((kind='metric' AND issue IS NULL) OR (kind<>'metric' AND issue IS NOT NULL)));
INSERT INTO alerts SELECT * FROM spool_alerts_backup;
DROP TABLE spool_alerts_backup;
CREATE TRIGGER portability_alerts_insert BEFORE INSERT ON alerts WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alerts_update BEFORE UPDATE ON alerts WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alerts_delete BEFORE DELETE ON alerts WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alerts_insert BEFORE INSERT ON alerts
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alerts_update BEFORE UPDATE ON alerts
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER release_dist_restore AFTER UPDATE OF import_job ON rer_portability_state WHEN OLD.import_job IS NOT NULL AND NEW.import_job IS NULL AND OLD.applying=1 BEGIN
 UPDATE events SET build='[sentry:no-dist]',payload=json_set(payload,'$.build','[sentry:no-dist]') WHERE build='sentry-no-dist' AND json_type(payload,'$.sentry')='object' AND json_extract(payload,'$.sentry.dist') IS NULL;
 INSERT INTO release_builds(project,release,build,registered) SELECT DISTINCT e.project,e.release,e.build,0 FROM events e JOIN releases r ON r.project=e.project AND r.name=e.release WHERE e.build='[sentry:no-dist]' ON CONFLICT DO NOTHING;
 UPDATE releases SET build='[sentry:no-dist]' WHERE build='sentry-no-dist' AND EXISTS(SELECT 1 FROM events e WHERE e.project=releases.project AND e.release=releases.name AND e.build='[sentry:no-dist]') AND NOT EXISTS(SELECT 1 FROM events e WHERE e.project=releases.project AND e.release=releases.name AND e.build='sentry-no-dist') AND NOT EXISTS(SELECT 1 FROM artifacts a WHERE a.project=releases.project AND a.release=releases.name AND a.build='sentry-no-dist') AND NOT EXISTS(SELECT 1 FROM deployment_path_mappings m WHERE m.project=releases.project AND m.release=releases.name AND m.build='sentry-no-dist');
 DELETE FROM release_builds WHERE build='sentry-no-dist' AND registered=0 AND NOT EXISTS(SELECT 1 FROM events e WHERE e.project=release_builds.project AND e.release=release_builds.release AND e.build=release_builds.build) AND NOT EXISTS(SELECT 1 FROM releases r WHERE r.project=release_builds.project AND r.name=release_builds.release AND r.build=release_builds.build) AND NOT EXISTS(SELECT 1 FROM artifacts a WHERE a.project=release_builds.project AND a.release=release_builds.release AND a.build=release_builds.build) AND NOT EXISTS(SELECT 1 FROM alerts a WHERE a.project=release_builds.project AND json_extract(a.payload,'$.release.name')=release_builds.release AND json_extract(a.payload,'$.release.build')=release_builds.build);
END;
CREATE TRIGGER follow_up_local_feed AFTER INSERT ON alerts
 WHEN NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
 BEGIN INSERT INTO follow_up_feed_custody VALUES(NEW.id,NEW.project); END;
CREATE TRIGGER issue_priority_escalation AFTER INSERT ON alerts WHEN NEW.kind IN ('regression','spike')
AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
BEGIN
 UPDATE issues SET revision=revision+1 WHERE id=NEW.issue AND project=NEW.project AND EXISTS(SELECT 1 FROM issue_priorities p WHERE p.issue=NEW.issue AND p.automatic<3 AND p.manual IS NULL);
 UPDATE issue_priorities SET automatic=3 WHERE project=NEW.project AND issue=NEW.issue;
END;
CREATE TABLE alert_metric_states(rule_id TEXT PRIMARY KEY REFERENCES alert_rules(id),project TEXT NOT NULL REFERENCES projects(id),revision INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('ok','warning','critical')),value REAL,reason TEXT NOT NULL,window_end INTEGER NOT NULL,since INTEGER NOT NULL,updated INTEGER NOT NULL);
CREATE INDEX alert_metric_states_project ON alert_metric_states(project,window_end);
CREATE TABLE alert_metric_events(id TEXT PRIMARY KEY,project TEXT NOT NULL REFERENCES projects(id),rule_id TEXT NOT NULL REFERENCES alert_rules(id),revision INTEGER NOT NULL,from_status TEXT NOT NULL,to_status TEXT NOT NULL,label TEXT NOT NULL,value REAL,threshold REAL,window_start INTEGER NOT NULL,window_end INTEGER NOT NULL,at INTEGER NOT NULL);
CREATE INDEX alert_metric_events_project ON alert_metric_events(project,at);
CREATE TRIGGER portability_alert_metric_states_insert BEFORE INSERT ON alert_metric_states WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_metric_states_update BEFORE UPDATE ON alert_metric_states WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_metric_states_delete BEFORE DELETE ON alert_metric_states WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alert_metric_states_insert BEFORE INSERT ON alert_metric_states WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard) BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alert_metric_states_update BEFORE UPDATE ON alert_metric_states WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard) BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER portability_alert_metric_events_insert BEFORE INSERT ON alert_metric_events WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_metric_events_update BEFORE UPDATE ON alert_metric_events WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_metric_events_delete BEFORE DELETE ON alert_metric_events WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alert_metric_events_insert BEFORE INSERT ON alert_metric_events WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard) BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alert_metric_events_update BEFORE UPDATE ON alert_metric_events WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard) BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
