-- Scheduled runs and routine polls read stored summaries, never whole histories.
-- Every table here is derived from archived rows: archives exclude it and a
-- restore rebuilds it from the restored rows.

-- Retained-row caps read one counter row instead of counting the project.
CREATE TABLE IF NOT EXISTS spool_capacity_counts (
 project TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL,
 PRIMARY KEY(project,kind)
);
INSERT INTO spool_capacity_counts(project,kind,n) SELECT project,'events',COUNT(*) FROM events GROUP BY project
 ON CONFLICT(project,kind) DO UPDATE SET n=excluded.n;
INSERT INTO spool_capacity_counts(project,kind,n) SELECT project,'transactions',COUNT(*) FROM sentry_transactions GROUP BY project
 ON CONFLICT(project,kind) DO UPDATE SET n=excluded.n;
INSERT INTO spool_capacity_counts(project,kind,n) SELECT project,'sessions',COUNT(*) FROM health_sessions GROUP BY project
 ON CONFLICT(project,kind) DO UPDATE SET n=excluded.n;
INSERT INTO spool_capacity_counts(project,kind,n) SELECT project,'aggregates',COUNT(*) FROM health_aggregates GROUP BY project
 ON CONFLICT(project,kind) DO UPDATE SET n=excluded.n;
INSERT INTO spool_capacity_counts(project,kind,n) SELECT project,'exposures',COUNT(*) FROM exposures GROUP BY project
 ON CONFLICT(project,kind) DO UPDATE SET n=excluded.n;
CREATE TRIGGER IF NOT EXISTS spool_capacity_events_insert AFTER INSERT ON events
BEGIN
 INSERT INTO spool_capacity_counts(project,kind,n) VALUES(NEW.project,'events',1) ON CONFLICT(project,kind) DO UPDATE SET n=n+1;
END;
CREATE TRIGGER IF NOT EXISTS spool_capacity_events_delete AFTER DELETE ON events
BEGIN
 UPDATE spool_capacity_counts SET n=n-1 WHERE project=OLD.project AND kind='events';
END;
CREATE TRIGGER IF NOT EXISTS spool_capacity_events_move AFTER UPDATE OF project ON events WHEN OLD.project IS NOT NEW.project
BEGIN
 UPDATE spool_capacity_counts SET n=n-1 WHERE project=OLD.project AND kind='events';
 INSERT INTO spool_capacity_counts(project,kind,n) VALUES(NEW.project,'events',1) ON CONFLICT(project,kind) DO UPDATE SET n=n+1;
END;
CREATE TRIGGER IF NOT EXISTS spool_capacity_transactions_insert AFTER INSERT ON sentry_transactions
BEGIN
 INSERT INTO spool_capacity_counts(project,kind,n) VALUES(NEW.project,'transactions',1) ON CONFLICT(project,kind) DO UPDATE SET n=n+1;
END;
CREATE TRIGGER IF NOT EXISTS spool_capacity_transactions_delete AFTER DELETE ON sentry_transactions
BEGIN
 UPDATE spool_capacity_counts SET n=n-1 WHERE project=OLD.project AND kind='transactions';
END;
CREATE TRIGGER IF NOT EXISTS spool_capacity_transactions_move AFTER UPDATE OF project ON sentry_transactions WHEN OLD.project IS NOT NEW.project
BEGIN
 UPDATE spool_capacity_counts SET n=n-1 WHERE project=OLD.project AND kind='transactions';
 INSERT INTO spool_capacity_counts(project,kind,n) VALUES(NEW.project,'transactions',1) ON CONFLICT(project,kind) DO UPDATE SET n=n+1;
END;
CREATE TRIGGER IF NOT EXISTS spool_capacity_sessions_insert AFTER INSERT ON health_sessions
BEGIN
 INSERT INTO spool_capacity_counts(project,kind,n) VALUES(NEW.project,'sessions',1) ON CONFLICT(project,kind) DO UPDATE SET n=n+1;
END;
CREATE TRIGGER IF NOT EXISTS spool_capacity_sessions_delete AFTER DELETE ON health_sessions
BEGIN
 UPDATE spool_capacity_counts SET n=n-1 WHERE project=OLD.project AND kind='sessions';
END;
CREATE TRIGGER IF NOT EXISTS spool_capacity_sessions_move AFTER UPDATE OF project ON health_sessions WHEN OLD.project IS NOT NEW.project
BEGIN
 UPDATE spool_capacity_counts SET n=n-1 WHERE project=OLD.project AND kind='sessions';
 INSERT INTO spool_capacity_counts(project,kind,n) VALUES(NEW.project,'sessions',1) ON CONFLICT(project,kind) DO UPDATE SET n=n+1;
END;
CREATE TRIGGER IF NOT EXISTS spool_capacity_aggregates_insert AFTER INSERT ON health_aggregates
BEGIN
 INSERT INTO spool_capacity_counts(project,kind,n) VALUES(NEW.project,'aggregates',1) ON CONFLICT(project,kind) DO UPDATE SET n=n+1;
END;
CREATE TRIGGER IF NOT EXISTS spool_capacity_aggregates_delete AFTER DELETE ON health_aggregates
BEGIN
 UPDATE spool_capacity_counts SET n=n-1 WHERE project=OLD.project AND kind='aggregates';
END;
CREATE TRIGGER IF NOT EXISTS spool_capacity_aggregates_move AFTER UPDATE OF project ON health_aggregates WHEN OLD.project IS NOT NEW.project
BEGIN
 UPDATE spool_capacity_counts SET n=n-1 WHERE project=OLD.project AND kind='aggregates';
 INSERT INTO spool_capacity_counts(project,kind,n) VALUES(NEW.project,'aggregates',1) ON CONFLICT(project,kind) DO UPDATE SET n=n+1;
END;
CREATE TRIGGER IF NOT EXISTS spool_capacity_exposures_insert AFTER INSERT ON exposures
BEGIN
 INSERT INTO spool_capacity_counts(project,kind,n) VALUES(NEW.project,'exposures',1) ON CONFLICT(project,kind) DO UPDATE SET n=n+1;
END;
CREATE TRIGGER IF NOT EXISTS spool_capacity_exposures_delete AFTER DELETE ON exposures
BEGIN
 UPDATE spool_capacity_counts SET n=n-1 WHERE project=OLD.project AND kind='exposures';
END;
CREATE TRIGGER IF NOT EXISTS spool_capacity_exposures_move AFTER UPDATE OF project ON exposures WHEN OLD.project IS NOT NEW.project
BEGIN
 UPDATE spool_capacity_counts SET n=n-1 WHERE project=OLD.project AND kind='exposures';
 INSERT INTO spool_capacity_counts(project,kind,n) VALUES(NEW.project,'exposures',1) ON CONFLICT(project,kind) DO UPDATE SET n=n+1;
END;
DROP TRIGGER IF EXISTS event_capacity;
CREATE TRIGGER event_capacity BEFORE INSERT ON events WHEN COALESCE((SELECT n FROM spool_capacity_counts WHERE project=NEW.project AND kind='events'),0)>=10000 BEGIN SELECT RAISE(ABORT,'retained_event_budget'); END;
DROP TRIGGER IF EXISTS sentry_transaction_capacity;
CREATE TRIGGER sentry_transaction_capacity BEFORE INSERT ON sentry_transactions
 WHEN NOT EXISTS(SELECT 1 FROM sentry_transactions WHERE project=NEW.project AND id=NEW.id)
 BEGIN
 SELECT CASE WHEN COALESCE((SELECT n FROM spool_capacity_counts WHERE project=NEW.project AND kind='transactions'),0)>=50000 THEN RAISE(ABORT,'transaction_capacity') END;
 SELECT CASE WHEN (SELECT COUNT(*) FROM sentry_transactions WHERE project=NEW.project AND received>=CAST(NEW.received/60000 AS INTEGER)*60000)>=600 THEN RAISE(ABORT,'transaction_rate_limited') END;
 END;
DROP TRIGGER IF EXISTS health_session_capacity;
CREATE TRIGGER health_session_capacity BEFORE INSERT ON health_sessions WHEN NOT EXISTS(SELECT 1 FROM health_sessions WHERE project=NEW.project AND sid=NEW.sid) AND COALESCE((SELECT n FROM spool_capacity_counts WHERE project=NEW.project AND kind='sessions'),0)>=50000 BEGIN SELECT RAISE(ABORT,'session_capacity'); END;
DROP TRIGGER IF EXISTS health_aggregate_capacity;
CREATE TRIGGER health_aggregate_capacity BEFORE INSERT ON health_aggregates WHEN NOT EXISTS(SELECT 1 FROM health_aggregates WHERE project=NEW.project AND release=NEW.release AND environment=NEW.environment AND started=NEW.started AND status=NEW.status) AND COALESCE((SELECT n FROM spool_capacity_counts WHERE project=NEW.project AND kind='aggregates'),0)>=10000 BEGIN SELECT RAISE(ABORT,'session_capacity'); END;
DROP TRIGGER IF EXISTS exposure_capacity;
CREATE TRIGGER exposure_capacity BEFORE INSERT ON exposures WHEN COALESCE((SELECT n FROM spool_capacity_counts WHERE project=NEW.project AND kind='exposures'),0)>=20000 BEGIN SELECT RAISE(ABORT,'exposure_budget'); END;

-- The SDK's per-issue discard tally, kept as events arrive, move and expire.
CREATE TABLE IF NOT EXISTS issue_client_drops (
 project TEXT NOT NULL, issue TEXT NOT NULL, dropped INTEGER NOT NULL,
 PRIMARY KEY(project,issue)
);
INSERT INTO issue_client_drops(project,issue,dropped)
 SELECT project,issue,SUM(iif(json_valid(payload),json_extract(payload,'$.dropped'),NULL)) FROM events
 WHERE iif(json_valid(payload),json_extract(payload,'$.dropped'),NULL) IS NOT NULL GROUP BY project,issue
 ON CONFLICT(project,issue) DO UPDATE SET dropped=excluded.dropped;
CREATE TRIGGER IF NOT EXISTS issue_client_drops_insert AFTER INSERT ON events WHEN iif(json_valid(NEW.payload),json_extract(NEW.payload,'$.dropped'),NULL) IS NOT NULL
BEGIN
 INSERT INTO issue_client_drops(project,issue,dropped) VALUES(NEW.project,NEW.issue,iif(json_valid(NEW.payload),json_extract(NEW.payload,'$.dropped'),NULL))
  ON CONFLICT(project,issue) DO UPDATE SET dropped=dropped+excluded.dropped;
END;
CREATE TRIGGER IF NOT EXISTS issue_client_drops_delete AFTER DELETE ON events WHEN iif(json_valid(OLD.payload),json_extract(OLD.payload,'$.dropped'),NULL) IS NOT NULL
BEGIN
 UPDATE issue_client_drops SET dropped=dropped-iif(json_valid(OLD.payload),json_extract(OLD.payload,'$.dropped'),NULL) WHERE project=OLD.project AND issue=OLD.issue;
END;
CREATE TRIGGER IF NOT EXISTS issue_client_drops_update AFTER UPDATE OF project,issue,payload ON events
 WHEN iif(json_valid(OLD.payload),json_extract(OLD.payload,'$.dropped'),NULL) IS NOT NULL OR iif(json_valid(NEW.payload),json_extract(NEW.payload,'$.dropped'),NULL) IS NOT NULL
BEGIN
 UPDATE issue_client_drops SET dropped=dropped-COALESCE(iif(json_valid(OLD.payload),json_extract(OLD.payload,'$.dropped'),NULL),0) WHERE project=OLD.project AND issue=OLD.issue;
 INSERT INTO issue_client_drops(project,issue,dropped) VALUES(NEW.project,NEW.issue,COALESCE(iif(json_valid(NEW.payload),json_extract(NEW.payload,'$.dropped'),NULL),0))
  ON CONFLICT(project,issue) DO UPDATE SET dropped=dropped+excluded.dropped;
END;
CREATE TRIGGER IF NOT EXISTS issue_client_drops_issue_delete AFTER DELETE ON issues
BEGIN
 DELETE FROM issue_client_drops WHERE project=OLD.project AND issue=OLD.id;
END;

-- A change token for the issue list: every table the list reads replaces it, so
-- an unchanged list answers its poll from one row.
CREATE TABLE IF NOT EXISTS spool_read_versions (
 name TEXT PRIMARY KEY, token TEXT NOT NULL
);
INSERT INTO spool_read_versions(name,token) VALUES('issues',lower(hex(randomblob(8))))
 ON CONFLICT(name) DO UPDATE SET token=excluded.token;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_issues_insert AFTER INSERT ON issues BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_issues_update AFTER UPDATE ON issues BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_issues_delete AFTER DELETE ON issues BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_events_insert AFTER INSERT ON events BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_events_update AFTER UPDATE OF project,issue,release,payload ON events BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_events_delete AFTER DELETE ON events BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_alerts_insert AFTER INSERT ON alerts BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_alerts_update AFTER UPDATE ON alerts BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_alerts_delete AFTER DELETE ON alerts BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_issue_priorities_insert AFTER INSERT ON issue_priorities BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_issue_priorities_update AFTER UPDATE ON issue_priorities BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_issue_priorities_delete AFTER DELETE ON issue_priorities BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_issue_short_ids_insert AFTER INSERT ON issue_short_ids BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_issue_short_ids_update AFTER UPDATE ON issue_short_ids BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_issue_short_ids_delete AFTER DELETE ON issue_short_ids BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_issue_resolutions_insert AFTER INSERT ON issue_resolutions BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_issue_resolutions_update AFTER UPDATE ON issue_resolutions BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_issue_resolutions_delete AFTER DELETE ON issue_resolutions BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_releases_insert AFTER INSERT ON releases BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_releases_update AFTER UPDATE ON releases BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_releases_delete AFTER DELETE ON releases BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_release_order_keys_insert AFTER INSERT ON release_order_keys BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_release_order_keys_update AFTER UPDATE ON release_order_keys BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_release_order_keys_delete AFTER DELETE ON release_order_keys BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_release_metadata_insert AFTER INSERT ON release_metadata BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_release_metadata_update AFTER UPDATE ON release_metadata BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_release_metadata_delete AFTER DELETE ON release_metadata BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_release_policies_insert AFTER INSERT ON release_policies BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_release_policies_update AFTER UPDATE ON release_policies BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;
CREATE TRIGGER IF NOT EXISTS spool_issue_list_release_policies_delete AFTER DELETE ON release_policies BEGIN UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues'; END;

-- Follow-up sweeps over open attention run when one of their inputs changed,
-- and at least hourly; queued notices likewise follow attention and routing.
CREATE TABLE IF NOT EXISTS spool_work_gates (
 name TEXT PRIMARY KEY, pending INTEGER NOT NULL, done INTEGER NOT NULL, run_at INTEGER NOT NULL
);
INSERT INTO spool_work_gates(name,pending,done,run_at) VALUES('follow_up_close',1,0,0),('follow_up_notices',1,0,0)
 ON CONFLICT(name) DO UPDATE SET pending=pending+1;
CREATE TRIGGER IF NOT EXISTS spool_gate_close_follow_up_attention_insert AFTER INSERT ON follow_up_attention BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_close'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_close_follow_up_attention_update AFTER UPDATE OF state,historical,reason,source,source_id ON follow_up_attention WHEN NEW.state<>'completed' BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_close'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_close_issues_state AFTER UPDATE OF state ON issues WHEN (OLD.state='open') IS NOT (NEW.state='open') BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_close'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_close_issue_suppressions_insert AFTER INSERT ON issue_suppressions BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_close'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_close_alerts_insert AFTER INSERT ON alerts WHEN NEW.issue IS NOT NULL BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_close'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_close_alerts_issue AFTER UPDATE OF issue ON alerts WHEN OLD.issue IS NOT NEW.issue BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_close'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_close_alert_history_insert AFTER INSERT ON alert_history BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_close'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_close_alert_history_state AFTER UPDATE OF state,alert_id ON alert_history WHEN (OLD.state,OLD.alert_id) IS NOT (NEW.state,NEW.alert_id) BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_close'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_close_deployment_steps_insert AFTER INSERT ON deployment_steps BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_close'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_close_deployment_steps_state AFTER UPDATE OF state ON deployment_steps WHEN OLD.state IS NOT NEW.state BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_close'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_close_alert_suppressed_released AFTER UPDATE OF released_at ON alert_suppressed WHEN OLD.released_at IS NOT NEW.released_at BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_close'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_close_alert_suppressed_delete AFTER DELETE ON alert_suppressed BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_close'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_notices_follow_up_attention_insert AFTER INSERT ON follow_up_attention BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_notices'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_notices_follow_up_attention_update AFTER UPDATE OF state,historical,source_id,project ON follow_up_attention WHEN NEW.historical=0 AND NEW.state NOT IN ('completed','canceled') BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_notices'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_notices_follow_up_settings_insert AFTER INSERT ON follow_up_settings BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_notices'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_notices_follow_up_settings_update AFTER UPDATE ON follow_up_settings BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_notices'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_notices_spool_follow_up_alternates_insert AFTER INSERT ON spool_follow_up_alternates BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_notices'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_notices_spool_follow_up_alternates_update AFTER UPDATE ON spool_follow_up_alternates BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_notices'; END;
CREATE TRIGGER IF NOT EXISTS spool_gate_notices_spool_follow_up_alternates_delete AFTER DELETE ON spool_follow_up_alternates BEGIN UPDATE spool_work_gates SET pending=pending+1 WHERE name='follow_up_notices'; END;

-- Signed SendGrid receipts wait here until projected, so a minute run reads only new ones.
CREATE TABLE IF NOT EXISTS alert_provider_pending (
 event_namespace TEXT NOT NULL, event_id TEXT NOT NULL,
 PRIMARY KEY(event_namespace,event_id)
);
INSERT INTO alert_provider_pending(event_namespace,event_id)
 SELECT r.event_namespace,r.event_id FROM rer_mail_event_receipts r
 WHERE r.provider='sendgrid' AND r.tenant_id='spool' AND NOT EXISTS(SELECT 1 FROM alert_provider_events e WHERE e.event_id=r.event_id)
 ON CONFLICT(event_namespace,event_id) DO NOTHING;
CREATE TRIGGER IF NOT EXISTS alert_provider_pending_receipt AFTER INSERT ON rer_mail_event_receipts
 WHEN NEW.provider='sendgrid' AND NEW.tenant_id='spool'
BEGIN
 INSERT INTO alert_provider_pending(event_namespace,event_id) VALUES(NEW.event_namespace,NEW.event_id) ON CONFLICT(event_namespace,event_id) DO NOTHING;
END;
CREATE TRIGGER IF NOT EXISTS alert_provider_pending_receipt_delete AFTER DELETE ON rer_mail_event_receipts
 WHEN OLD.provider='sendgrid' AND OLD.tenant_id='spool'
BEGIN
 DELETE FROM alert_provider_pending WHERE event_namespace=OLD.event_namespace AND event_id=OLD.event_id;
END;

-- A restore copies archived rows with their triggers paused: rebuild what they keep.
CREATE TRIGGER IF NOT EXISTS spool_bounded_reads_restore AFTER UPDATE OF import_job ON rer_portability_state WHEN OLD.import_job IS NOT NULL AND NEW.import_job IS NULL AND OLD.applying=1
BEGIN
 DELETE FROM spool_capacity_counts;
 INSERT INTO spool_capacity_counts(project,kind,n) SELECT project,'events',COUNT(*) FROM events GROUP BY project;
 INSERT INTO spool_capacity_counts(project,kind,n) SELECT project,'transactions',COUNT(*) FROM sentry_transactions GROUP BY project;
 INSERT INTO spool_capacity_counts(project,kind,n) SELECT project,'sessions',COUNT(*) FROM health_sessions GROUP BY project;
 INSERT INTO spool_capacity_counts(project,kind,n) SELECT project,'aggregates',COUNT(*) FROM health_aggregates GROUP BY project;
 INSERT INTO spool_capacity_counts(project,kind,n) SELECT project,'exposures',COUNT(*) FROM exposures GROUP BY project;
 DELETE FROM issue_client_drops;
 INSERT INTO issue_client_drops(project,issue,dropped)
  SELECT project,issue,SUM(iif(json_valid(payload),json_extract(payload,'$.dropped'),NULL)) FROM events
  WHERE iif(json_valid(payload),json_extract(payload,'$.dropped'),NULL) IS NOT NULL GROUP BY project,issue;
 UPDATE spool_read_versions SET token=lower(hex(randomblob(8))) WHERE name='issues';
 UPDATE spool_work_gates SET pending=pending+1;
END;
