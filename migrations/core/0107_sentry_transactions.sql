-- Minimal, scrubbed performance observations. No users, spans, tags or request data.
CREATE TABLE sentry_transactions(project TEXT NOT NULL REFERENCES projects(id),id TEXT NOT NULL,environment TEXT NOT NULL,release TEXT NOT NULL,name TEXT NOT NULL,op TEXT,duration_ms REAL NOT NULL CHECK(duration_ms>=0),started INTEGER NOT NULL,received INTEGER NOT NULL,digest TEXT NOT NULL,PRIMARY KEY(project,id));
CREATE INDEX sentry_transactions_window ON sentry_transactions(project,received,duration_ms);
CREATE TRIGGER sentry_transaction_capacity BEFORE INSERT ON sentry_transactions
 WHEN NOT EXISTS(SELECT 1 FROM sentry_transactions WHERE project=NEW.project AND id=NEW.id)
 BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM sentry_transactions WHERE project=NEW.project)>=50000 THEN RAISE(ABORT,'transaction_capacity') END;
 SELECT CASE WHEN (SELECT COUNT(*) FROM sentry_transactions WHERE project=NEW.project AND received>=CAST(NEW.received/60000 AS INTEGER)*60000)>=600 THEN RAISE(ABORT,'transaction_rate_limited') END;
 END;
CREATE TRIGGER portability_sentry_transactions_insert BEFORE INSERT ON sentry_transactions WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_sentry_transactions_update BEFORE UPDATE ON sentry_transactions WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_sentry_transactions_delete BEFORE DELETE ON sentry_transactions WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_sentry_transactions_insert BEFORE INSERT ON sentry_transactions WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard) BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_sentry_transactions_update BEFORE UPDATE ON sentry_transactions WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard) BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
