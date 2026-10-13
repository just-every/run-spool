ALTER TABLE alerts ADD COLUMN payload TEXT;
-- Old retained rows cannot establish the highest release previously observed.
-- Use the project's known ceiling conservatively; new issues start at zero.
ALTER TABLE issues ADD COLUMN latest_release_seq INTEGER DEFAULT 0 CHECK(latest_release_seq IS NULL OR latest_release_seq>=0);
UPDATE issues SET latest_release_seq=COALESCE((SELECT MAX(seq) FROM releases WHERE project=issues.project),0);
UPDATE issues SET resolved_seq=MAX(COALESCE(resolved_seq,0),latest_release_seq) WHERE state='resolved';
CREATE TRIGGER issue_release_watermark AFTER INSERT ON events BEGIN
 UPDATE issues SET
  latest_release_seq=MAX(COALESCE(latest_release_seq,(SELECT MAX(seq) FROM releases WHERE project=NEW.project),0),NEW.release_seq),
  resolved_seq= CASE WHEN state='resolved' AND latest_release_seq IS NULL THEN MAX(COALESCE(resolved_seq,0),COALESCE((SELECT MAX(seq) FROM releases WHERE project=NEW.project),0)) ELSE resolved_seq END
 WHERE id=NEW.issue AND project=NEW.project;
END;
CREATE TABLE alert_rules (
 id TEXT PRIMARY KEY, project TEXT NOT NULL REFERENCES projects(id), revision INTEGER NOT NULL,
 name TEXT NOT NULL, enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), channel TEXT NOT NULL CHECK(channel IN ('mail','webhook')),
 destination TEXT NOT NULL, kinds TEXT NOT NULL, window_ms INTEGER NOT NULL, threshold INTEGER NOT NULL,
 created INTEGER NOT NULL, updated INTEGER NOT NULL
);
CREATE TRIGGER alert_rule_capacity BEFORE INSERT ON alert_rules WHEN (SELECT COUNT(*) FROM alert_rules WHERE project=NEW.project)>=20 BEGIN SELECT RAISE(ABORT,'alert_rule_budget'); END;
CREATE TABLE alert_scheduler (id INTEGER PRIMARY KEY CHECK(id=1), last_project TEXT NOT NULL, last_spike_rule TEXT NOT NULL DEFAULT '');
INSERT INTO alert_scheduler(id,last_project) VALUES(1,'');
CREATE TABLE alert_expansion_cursors (project TEXT PRIMARY KEY REFERENCES projects(id), last_intent TEXT NOT NULL);
CREATE TABLE alert_cursors (rule_id TEXT PRIMARY KEY REFERENCES alert_rules(id), project TEXT NOT NULL REFERENCES projects(id), revision INTEGER NOT NULL, next_start INTEGER NOT NULL);
CREATE TABLE alert_intents (
 id TEXT PRIMARY KEY, project TEXT NOT NULL REFERENCES projects(id), alert_id TEXT NOT NULL REFERENCES alerts(id),
 rule_id TEXT NOT NULL REFERENCES alert_rules(id), rule_revision INTEGER NOT NULL, channel TEXT NOT NULL,
 destination TEXT NOT NULL, body TEXT NOT NULL, event TEXT NOT NULL, created INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending', code TEXT, expanded INTEGER NOT NULL DEFAULT 0,
 UNIQUE(alert_id,rule_id,rule_revision,channel)
);
CREATE INDEX alert_intents_pending ON alert_intents(project,expanded,state,created);
CREATE TABLE alert_mail_jobs (
 id TEXT PRIMARY KEY REFERENCES alert_intents(id), project TEXT NOT NULL, message TEXT NOT NULL, destination_hash TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL,
 max_attempts INTEGER NOT NULL DEFAULT 4 CHECK(max_attempts BETWEEN 1 AND 10), retry_delays TEXT NOT NULL DEFAULT '[1000,5000,30000]',
 claim TEXT, claim_until INTEGER, receipt TEXT, code TEXT
);
CREATE TABLE alert_mail_attempts (
 id TEXT PRIMARY KEY, delivery_id TEXT NOT NULL REFERENCES alert_mail_jobs(id), number INTEGER NOT NULL,
 started INTEGER NOT NULL, finished INTEGER, state TEXT, code TEXT, UNIQUE(delivery_id,number)
);
-- Exportable safe history has no addresses, raw provider response, credentials or active claims.
CREATE TABLE alert_history (
 id TEXT PRIMARY KEY, project TEXT NOT NULL REFERENCES projects(id), alert_id TEXT NOT NULL REFERENCES alerts(id),
 rule_id TEXT NOT NULL REFERENCES alert_rules(id), rule_revision INTEGER NOT NULL, channel TEXT NOT NULL,
 destination TEXT NOT NULL, state TEXT NOT NULL, code TEXT, attempts INTEGER NOT NULL DEFAULT 0,
 created INTEGER NOT NULL, updated INTEGER NOT NULL, historical INTEGER NOT NULL DEFAULT 0
);
CREATE TRIGGER portability_alert_rules_insert BEFORE INSERT ON alert_rules WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_rules_update BEFORE UPDATE ON alert_rules WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_rules_delete BEFORE DELETE ON alert_rules WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_history_insert BEFORE INSERT ON alert_history WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_history_update BEFORE UPDATE ON alert_history WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_history_delete BEFORE DELETE ON alert_history WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_cursors_insert BEFORE INSERT ON alert_cursors WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_cursors_update BEFORE UPDATE ON alert_cursors WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_cursors_delete BEFORE DELETE ON alert_cursors WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_intents_insert BEFORE INSERT ON alert_intents WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_intents_update BEFORE UPDATE ON alert_intents WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_intents_delete BEFORE DELETE ON alert_intents WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_mail_jobs_insert BEFORE INSERT ON alert_mail_jobs WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_mail_jobs_update BEFORE UPDATE ON alert_mail_jobs WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_mail_jobs_delete BEFORE DELETE ON alert_mail_jobs WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_mail_attempts_insert BEFORE INSERT ON alert_mail_attempts WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_mail_attempts_update BEFORE UPDATE ON alert_mail_attempts WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_mail_attempts_delete BEFORE DELETE ON alert_mail_attempts WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_expansion_cursors_insert BEFORE INSERT ON alert_expansion_cursors WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_expansion_cursors_update BEFORE UPDATE ON alert_expansion_cursors WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_expansion_cursors_delete BEFORE DELETE ON alert_expansion_cursors WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
