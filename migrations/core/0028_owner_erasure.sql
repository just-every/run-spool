-- Native successor intent; no new identity or secret model. Excluded from archives.
CREATE TABLE spool_owner_successor (
 owner_id TEXT PRIMARY KEY, successor_id TEXT NOT NULL, session_id TEXT NOT NULL,
 owner_version INTEGER NOT NULL, capture_hash TEXT, rate_keys TEXT NOT NULL DEFAULT '[]',
 successor_version INTEGER, successor_session TEXT
);
-- A Base erasure batch owns rer_erasure_guard only within its atomic batch and
-- clears it at the end. Freeze competing writes while the resumable operation
-- is open; the erasure's own guarded batch can redact/delete. This also prevents
-- a request admitted before handoff from minting a replacement credential.
CREATE TRIGGER spool_owner_erasure_projects_insert BEFORE INSERT ON projects
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_projects_update BEFORE UPDATE ON projects
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_issues_insert BEFORE INSERT ON issues
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_issues_update BEFORE UPDATE ON issues
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_events_insert BEFORE INSERT ON events
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_events_update BEFORE UPDATE ON events
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_artifacts_insert BEFORE INSERT ON artifacts
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_artifacts_update BEFORE UPDATE ON artifacts
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_repairs_insert BEFORE INSERT ON repairs
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_repairs_update BEFORE UPDATE ON repairs
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_repair_checks_insert BEFORE INSERT ON repair_checks
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_repair_checks_update BEFORE UPDATE ON repair_checks
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alerts_insert BEFORE INSERT ON alerts
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alerts_update BEFORE UPDATE ON alerts
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alert_rules_insert BEFORE INSERT ON alert_rules
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alert_rules_update BEFORE UPDATE ON alert_rules
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_rer_mail_development_outbox_insert BEFORE INSERT ON rer_mail_development_outbox
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_rer_mail_development_outbox_update BEFORE UPDATE ON rer_mail_development_outbox
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_releases_insert BEFORE INSERT ON releases
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_releases_update BEFORE UPDATE ON releases
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_audit_insert BEFORE INSERT ON audit
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_audit_update BEFORE UPDATE ON audit
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alert_intents_insert BEFORE INSERT ON alert_intents
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alert_intents_update BEFORE UPDATE ON alert_intents
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alert_mail_jobs_insert BEFORE INSERT ON alert_mail_jobs
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alert_mail_jobs_update BEFORE UPDATE ON alert_mail_jobs
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alert_mail_attempts_insert BEFORE INSERT ON alert_mail_attempts
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alert_mail_attempts_update BEFORE UPDATE ON alert_mail_attempts
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alert_history_insert BEFORE INSERT ON alert_history
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_alert_history_update BEFORE UPDATE ON alert_history
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_credentials_insert BEFORE INSERT ON credentials
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_credentials_update BEFORE UPDATE ON credentials
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_operators_insert BEFORE INSERT ON oa_operators
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_operators_update BEFORE UPDATE ON oa_operators
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_tokens_insert BEFORE INSERT ON oa_tokens
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_tokens_update BEFORE UPDATE ON oa_tokens
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_sessions_insert BEFORE INSERT ON oa_sessions
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_sessions_update BEFORE UPDATE ON oa_sessions
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_external_identities_insert BEFORE INSERT ON oa_external_identities
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_external_identities_update BEFORE UPDATE ON oa_external_identities
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_credentials_insert BEFORE INSERT ON oa_credentials
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_credentials_update BEFORE UPDATE ON oa_credentials
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_step_up_challenges_insert BEFORE INSERT ON oa_step_up_challenges
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_step_up_challenges_update BEFORE UPDATE ON oa_step_up_challenges
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_setup_links_insert BEFORE INSERT ON oa_setup_links
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_setup_links_update BEFORE UPDATE ON oa_setup_links
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_domain_rules_insert BEFORE INSERT ON oa_domain_rules
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_domain_rules_update BEFORE UPDATE ON oa_domain_rules
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_auth_audit_insert BEFORE INSERT ON oa_auth_audit
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_auth_audit_update BEFORE UPDATE ON oa_auth_audit
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_provider_sessions_insert BEFORE INSERT ON oa_provider_sessions
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_provider_sessions_update BEFORE UPDATE ON oa_provider_sessions
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_provider_session_pins_insert BEFORE INSERT ON oa_provider_session_pins
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_provider_session_pins_update BEFORE UPDATE ON oa_provider_session_pins
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_oidc_transactions_insert BEFORE INSERT ON oa_oidc_transactions
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_oidc_transactions_update BEFORE UPDATE ON oa_oidc_transactions
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_bootstrap_insert BEFORE INSERT ON oa_bootstrap
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oa_bootstrap_update BEFORE UPDATE ON oa_bootstrap
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oc_idp_grants_insert BEFORE INSERT ON oc_idp_grants
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oc_idp_grants_update BEFORE UPDATE ON oc_idp_grants
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_rer_dependency_pending_insert BEFORE INSERT ON rer_dependency_pending
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_rer_dependency_pending_update BEFORE UPDATE ON rer_dependency_pending
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_spool_owner_successor_insert BEFORE INSERT ON spool_owner_successor
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_spool_owner_successor_update BEFORE UPDATE ON spool_owner_successor
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
