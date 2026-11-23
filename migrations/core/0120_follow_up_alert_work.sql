-- This worklist holds only alert sources that have yet to create attention.
-- Acknowledged work leaves the due index in the same transaction as its audit fact.
CREATE TABLE IF NOT EXISTS follow_up_alert_work (
 project TEXT NOT NULL REFERENCES projects(id),source_id TEXT NOT NULL,
 issue TEXT,ready INTEGER NOT NULL,ready_at INTEGER NOT NULL,due INTEGER NOT NULL,
 state TEXT NOT NULL,reason TEXT NOT NULL,
 PRIMARY KEY(project,source_id)
);
CREATE INDEX IF NOT EXISTS follow_up_alert_work_due ON follow_up_alert_work(ready_at,project,source_id) WHERE ready=1;
CREATE INDEX IF NOT EXISTS follow_up_alert_work_issue ON follow_up_alert_work(issue,project) WHERE issue IS NOT NULL;

INSERT INTO follow_up_alert_work(project,source_id,issue,ready,ready_at,due,state,reason)
 SELECT h.project,h.id,CASE WHEN h.state='accepted' THEN i.id END,
  CASE WHEN h.state='accepted' THEN COALESCE(i.state='open',0) ELSE 1 END,
  CASE WHEN h.state='accepted' THEN h.created+86400000
   WHEN h.state IN ('blocked','rejected','uncertain') THEN 0 ELSE h.created+300000 END,
  CASE WHEN h.state='accepted' THEN h.created+86400000 ELSE h.created+300000 END,
  CASE WHEN h.state='uncertain' THEN 'uncertain' WHEN h.state='blocked' THEN 'blocked'
   WHEN h.state='rejected' THEN 'failed' ELSE 'overdue' END,
  CASE WHEN h.state='accepted' THEN 'unacknowledged'
   WHEN h.state IN ('pending','queued','sending','retrying') THEN 'send_overdue'
   ELSE COALESCE(h.code,'delivery_failed') END
 FROM alert_history h JOIN alerts a ON a.id=h.alert_id
 LEFT JOIN issues i ON i.id=a.issue AND i.project=h.project
 WHERE h.historical=0 AND h.state IN ('accepted','blocked','rejected','uncertain','pending','queued','sending','retrying')
 AND NOT EXISTS(SELECT 1 FROM follow_up_attention x WHERE x.project=h.project AND x.source='alert' AND x.source_id=h.id)
 ON CONFLICT(project,source_id) DO NOTHING;

INSERT INTO follow_up_alert_work(project,source_id,issue,ready,ready_at,due,state,reason)
 SELECT a.project,'feed:'||a.id,i.id,i.state='open',a.created+86400000,a.created+86400000,'overdue','unacknowledged_feed'
 FROM follow_up_feed_custody f JOIN alerts a ON a.id=f.alert AND a.project=f.project
 JOIN issues i ON i.id=a.issue AND i.project=a.project
 WHERE NOT EXISTS(SELECT 1 FROM alert_history h WHERE h.alert_id=a.id)
 AND NOT EXISTS(SELECT 1 FROM follow_up_attention x WHERE x.project=a.project AND x.source='alert' AND x.source_id='feed:'||a.id)
 ON CONFLICT(project,source_id) DO NOTHING;

INSERT INTO follow_up_alert_work(project,source_id,issue,ready,ready_at,due,state,reason)
 SELECT o.project,'loss:'||o.window||':'||o.reason,NULL,1,0,o.window,'overdue','capture_loss_'||o.reason
 FROM outcomes o WHERE o.count>0 AND o.reason NOT IN ('accepted','duplicate','feedback_accepted','feedback_duplicate','feedback_withdrawn',
  'session_stored','check_in_routed','transaction_stored','transaction_duplicate',
  'sentry_release_invalid_release_name','sentry_release_automatic_release_pattern')
 AND NOT EXISTS(SELECT 1 FROM follow_up_attention x WHERE x.project=o.project AND x.source='alert' AND x.source_id='loss:'||o.window||':'||o.reason)
 ON CONFLICT(project,source_id) DO NOTHING;

CREATE TRIGGER IF NOT EXISTS follow_up_alert_work_attention AFTER INSERT ON follow_up_attention WHEN NEW.source='alert'
BEGIN
 DELETE FROM follow_up_alert_work WHERE project=NEW.project AND source_id=NEW.source_id;
END;

CREATE TRIGGER IF NOT EXISTS follow_up_alert_work_issue_state AFTER UPDATE OF state ON issues WHEN (OLD.state='open') IS NOT (NEW.state='open')
BEGIN
 UPDATE follow_up_alert_work SET ready=NEW.state='open' WHERE issue=NEW.id AND project=NEW.project;
END;

CREATE TRIGGER IF NOT EXISTS follow_up_alert_work_issue_delete AFTER DELETE ON issues
BEGIN
 DELETE FROM follow_up_alert_work WHERE issue=OLD.id AND project=OLD.project;
END;

CREATE TRIGGER IF NOT EXISTS follow_up_alert_work_history_insert AFTER INSERT ON alert_history
BEGIN
 DELETE FROM follow_up_alert_work WHERE project=NEW.project AND source_id='feed:'||NEW.alert_id;
 INSERT INTO follow_up_alert_work(project,source_id,issue,ready,ready_at,due,state,reason)
 SELECT h.project,h.id,CASE WHEN h.state='accepted' THEN i.id END,
  CASE WHEN h.state='accepted' THEN COALESCE(i.state='open',0) ELSE 1 END,
  CASE WHEN h.state='accepted' THEN h.created+86400000
   WHEN h.state IN ('blocked','rejected','uncertain') THEN 0 ELSE h.created+300000 END,
  CASE WHEN h.state='accepted' THEN h.created+86400000 ELSE h.created+300000 END,
  CASE WHEN h.state='uncertain' THEN 'uncertain' WHEN h.state='blocked' THEN 'blocked'
   WHEN h.state='rejected' THEN 'failed' ELSE 'overdue' END,
  CASE WHEN h.state='accepted' THEN 'unacknowledged'
   WHEN h.state IN ('pending','queued','sending','retrying') THEN 'send_overdue'
   ELSE COALESCE(h.code,'delivery_failed') END
 FROM alert_history h JOIN alerts a ON a.id=h.alert_id
 LEFT JOIN issues i ON i.id=a.issue AND i.project=h.project
 WHERE h.historical=0 AND h.state IN ('accepted','blocked','rejected','uncertain','pending','queued','sending','retrying')
 AND NOT EXISTS(SELECT 1 FROM follow_up_attention x WHERE x.project=h.project AND x.source='alert' AND x.source_id=h.id)
 AND h.id=NEW.id
 ON CONFLICT(project,source_id) DO NOTHING;
END;

CREATE TRIGGER IF NOT EXISTS follow_up_alert_work_history_update AFTER UPDATE OF state,code ON alert_history
 WHEN (OLD.state,OLD.code) IS NOT (NEW.state,NEW.code)
 AND NOT EXISTS(SELECT 1 FROM follow_up_attention x WHERE x.project=NEW.project AND x.source='alert' AND x.source_id=NEW.id)
BEGIN
 DELETE FROM follow_up_alert_work WHERE project=NEW.project AND source_id=NEW.id;
 INSERT INTO follow_up_alert_work(project,source_id,issue,ready,ready_at,due,state,reason)
 SELECT h.project,h.id,CASE WHEN h.state='accepted' THEN i.id END,
  CASE WHEN h.state='accepted' THEN COALESCE(i.state='open',0) ELSE 1 END,
  CASE WHEN h.state='accepted' THEN h.created+86400000
   WHEN h.state IN ('blocked','rejected','uncertain') THEN 0 ELSE h.created+300000 END,
  CASE WHEN h.state='accepted' THEN h.created+86400000 ELSE h.created+300000 END,
  CASE WHEN h.state='uncertain' THEN 'uncertain' WHEN h.state='blocked' THEN 'blocked'
   WHEN h.state='rejected' THEN 'failed' ELSE 'overdue' END,
  CASE WHEN h.state='accepted' THEN 'unacknowledged'
   WHEN h.state IN ('pending','queued','sending','retrying') THEN 'send_overdue'
   ELSE COALESCE(h.code,'delivery_failed') END
 FROM alert_history h JOIN alerts a ON a.id=h.alert_id
 LEFT JOIN issues i ON i.id=a.issue AND i.project=h.project
 WHERE h.historical=0 AND h.state IN ('accepted','blocked','rejected','uncertain','pending','queued','sending','retrying')
 AND NOT EXISTS(SELECT 1 FROM follow_up_attention x WHERE x.project=h.project AND x.source='alert' AND x.source_id=h.id)
 AND h.id=NEW.id
 ON CONFLICT(project,source_id) DO NOTHING;
END;

CREATE TRIGGER IF NOT EXISTS follow_up_alert_work_history_delete AFTER DELETE ON alert_history
BEGIN
 DELETE FROM follow_up_alert_work WHERE project=OLD.project AND source_id=OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS follow_up_alert_work_feed_insert AFTER INSERT ON follow_up_feed_custody
BEGIN
 INSERT INTO follow_up_alert_work(project,source_id,issue,ready,ready_at,due,state,reason)
 SELECT a.project,'feed:'||a.id,i.id,i.state='open',a.created+86400000,a.created+86400000,'overdue','unacknowledged_feed'
 FROM follow_up_feed_custody f JOIN alerts a ON a.id=f.alert AND a.project=f.project
 JOIN issues i ON i.id=a.issue AND i.project=a.project
 WHERE NOT EXISTS(SELECT 1 FROM alert_history h WHERE h.alert_id=a.id)
 AND NOT EXISTS(SELECT 1 FROM follow_up_attention x WHERE x.project=a.project AND x.source='alert' AND x.source_id='feed:'||a.id)
 AND f.alert=NEW.alert
 ON CONFLICT(project,source_id) DO NOTHING;
END;

CREATE TRIGGER IF NOT EXISTS follow_up_alert_work_feed_delete AFTER DELETE ON follow_up_feed_custody
BEGIN
 DELETE FROM follow_up_alert_work WHERE project=OLD.project AND source_id='feed:'||OLD.alert;
END;

CREATE TRIGGER IF NOT EXISTS follow_up_alert_work_loss_insert AFTER INSERT ON outcomes WHEN NEW.count>0 AND NEW.reason NOT IN ('accepted','duplicate','feedback_accepted','feedback_duplicate','feedback_withdrawn',
  'session_stored','check_in_routed','transaction_stored','transaction_duplicate',
  'sentry_release_invalid_release_name','sentry_release_automatic_release_pattern')
BEGIN
 INSERT INTO follow_up_alert_work(project,source_id,issue,ready,ready_at,due,state,reason)
 SELECT o.project,'loss:'||o.window||':'||o.reason,NULL,1,0,o.window,'overdue','capture_loss_'||o.reason
 FROM outcomes o WHERE o.count>0 AND o.reason NOT IN ('accepted','duplicate','feedback_accepted','feedback_duplicate','feedback_withdrawn',
  'session_stored','check_in_routed','transaction_stored','transaction_duplicate',
  'sentry_release_invalid_release_name','sentry_release_automatic_release_pattern')
 AND NOT EXISTS(SELECT 1 FROM follow_up_attention x WHERE x.project=o.project AND x.source='alert' AND x.source_id='loss:'||o.window||':'||o.reason)
 AND (o.project,o.window,o.reason)=(NEW.project,NEW.window,NEW.reason)
 ON CONFLICT(project,source_id) DO NOTHING;
END;

CREATE TRIGGER IF NOT EXISTS follow_up_alert_work_loss_update AFTER UPDATE OF count ON outcomes WHEN (OLD.count>0) IS NOT (NEW.count>0) AND NEW.reason NOT IN ('accepted','duplicate','feedback_accepted','feedback_duplicate','feedback_withdrawn',
  'session_stored','check_in_routed','transaction_stored','transaction_duplicate',
  'sentry_release_invalid_release_name','sentry_release_automatic_release_pattern')
BEGIN
 DELETE FROM follow_up_alert_work WHERE project=NEW.project AND source_id='loss:'||NEW.window||':'||NEW.reason;
 INSERT INTO follow_up_alert_work(project,source_id,issue,ready,ready_at,due,state,reason)
 SELECT o.project,'loss:'||o.window||':'||o.reason,NULL,1,0,o.window,'overdue','capture_loss_'||o.reason
 FROM outcomes o WHERE o.count>0 AND o.reason NOT IN ('accepted','duplicate','feedback_accepted','feedback_duplicate','feedback_withdrawn',
  'session_stored','check_in_routed','transaction_stored','transaction_duplicate',
  'sentry_release_invalid_release_name','sentry_release_automatic_release_pattern')
 AND NOT EXISTS(SELECT 1 FROM follow_up_attention x WHERE x.project=o.project AND x.source='alert' AND x.source_id='loss:'||o.window||':'||o.reason)
 AND (o.project,o.window,o.reason)=(NEW.project,NEW.window,NEW.reason)
 ON CONFLICT(project,source_id) DO NOTHING;
END;

CREATE TRIGGER IF NOT EXISTS follow_up_alert_work_loss_delete AFTER DELETE ON outcomes WHEN OLD.count>0 AND OLD.reason NOT IN ('accepted','duplicate','feedback_accepted','feedback_duplicate','feedback_withdrawn',
  'session_stored','check_in_routed','transaction_stored','transaction_duplicate',
  'sentry_release_invalid_release_name','sentry_release_automatic_release_pattern')
BEGIN
 DELETE FROM follow_up_alert_work WHERE project=OLD.project AND source_id='loss:'||OLD.window||':'||OLD.reason;
END;

-- The archive publishes restored outcome rows with their normal triggers paused.
CREATE TRIGGER IF NOT EXISTS follow_up_alert_work_restore AFTER UPDATE OF import_job ON rer_portability_state WHEN OLD.import_job IS NOT NULL AND NEW.import_job IS NULL AND OLD.applying=1
BEGIN
 INSERT INTO follow_up_alert_work(project,source_id,issue,ready,ready_at,due,state,reason)
 SELECT o.project,'loss:'||o.window||':'||o.reason,NULL,1,0,o.window,'overdue','capture_loss_'||o.reason
 FROM outcomes o WHERE o.count>0 AND o.reason NOT IN ('accepted','duplicate','feedback_accepted','feedback_duplicate','feedback_withdrawn',
  'session_stored','check_in_routed','transaction_stored','transaction_duplicate',
  'sentry_release_invalid_release_name','sentry_release_automatic_release_pattern')
 AND NOT EXISTS(SELECT 1 FROM follow_up_attention x WHERE x.project=o.project AND x.source='alert' AND x.source_id='loss:'||o.window||':'||o.reason)
 ON CONFLICT(project,source_id) DO NOTHING;
END;


-- Successful receipts can still arrive from an older Worker during upgrade.
-- Index only mistaken attention rows so the scheduler never revisits repairs.
CREATE INDEX IF NOT EXISTS follow_up_legacy_loss_due ON follow_up_attention(id)
 WHERE source='alert' AND source_id LIKE 'loss:%' AND reason IN (
  'capture_loss_accepted','capture_loss_duplicate','capture_loss_feedback_accepted','capture_loss_feedback_duplicate',
  'capture_loss_feedback_withdrawn','capture_loss_session_stored','capture_loss_check_in_routed',
  'capture_loss_transaction_stored','capture_loss_transaction_duplicate','capture_loss_sentry_release_invalid_release_name',
  'capture_loss_sentry_release_automatic_release_pattern');
CREATE VIEW IF NOT EXISTS follow_up_legacy_loss AS
 SELECT id FROM follow_up_attention INDEXED BY follow_up_legacy_loss_due
 WHERE source='alert' AND source_id LIKE 'loss:%' AND reason IN (
  'capture_loss_accepted','capture_loss_duplicate','capture_loss_feedback_accepted','capture_loss_feedback_duplicate',
  'capture_loss_feedback_withdrawn','capture_loss_session_stored','capture_loss_check_in_routed',
  'capture_loss_transaction_stored','capture_loss_transaction_duplicate','capture_loss_sentry_release_invalid_release_name',
  'capture_loss_sentry_release_automatic_release_pattern');

CREATE TRIGGER IF NOT EXISTS follow_up_legacy_loss_cancel_notices AFTER UPDATE OF reason ON follow_up_attention
 WHEN NEW.state='canceled' AND NEW.reason='successful_capture_not_loss' AND OLD.reason IS NOT NEW.reason
 BEGIN
  UPDATE follow_up_notices SET state='canceled',code='successful_capture_not_loss'
   WHERE attention=NEW.id AND state IN ('queued','blocked');
 END;
-- A claim can finish after its attention has been repaired. Cancel any
-- subsequent retry at that write without scanning repaired attention again.
CREATE TRIGGER IF NOT EXISTS follow_up_legacy_loss_notice_update AFTER UPDATE OF state ON follow_up_notices
 WHEN NEW.state IN ('queued','blocked') AND EXISTS(
  SELECT 1 FROM follow_up_attention WHERE id=NEW.attention AND reason='successful_capture_not_loss' AND state='canceled')
 BEGIN
  UPDATE follow_up_notices SET state='canceled',code='successful_capture_not_loss' WHERE id=NEW.id;
 END;

UPDATE follow_up_attention SET state='canceled',reason='successful_capture_not_loss',
 updated=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),revision=revision+1
 WHERE id IN (SELECT id FROM follow_up_legacy_loss);
UPDATE follow_up_notices SET state='canceled',code='successful_capture_not_loss'
 WHERE state IN ('queued','blocked') AND attention IN (
  SELECT id FROM follow_up_attention WHERE reason='successful_capture_not_loss' AND state='canceled');
