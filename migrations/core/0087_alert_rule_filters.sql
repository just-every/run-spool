-- Exact environment predicates are optional; absence preserves legacy rules.
CREATE TABLE alert_rule_filters (
 rule_id TEXT PRIMARY KEY REFERENCES alert_rules(id),
 project TEXT NOT NULL REFERENCES projects(id),
 environment TEXT NOT NULL CHECK(length(environment) BETWEEN 1 AND 100)
);
CREATE TRIGGER portability_alert_rule_filters_insert BEFORE INSERT ON alert_rule_filters WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_rule_filters_update BEFORE UPDATE ON alert_rule_filters WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_alert_rule_filters_delete BEFORE DELETE ON alert_rule_filters WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alert_rule_filters_insert BEFORE INSERT ON alert_rule_filters WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard) BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alert_rule_filters_update BEFORE UPDATE ON alert_rule_filters WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard) BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
