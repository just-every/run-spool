import { defineErasure } from '../../modules/erasure/index.mjs';
import { erasureCompletionFact } from './audit-fact';

// BASE-DATA-003 project erasure. The selected project and every row that
// depends on it are deleted through Base erasure, so each deleted row also gets
// its portability tombstone. Only an imported project has Sentry-import
// targets, and its erasure commits in one import-kit batch, so targets and the
// native rows they name leave together inside the fence.
const fromProject = (table: string) => ({ table, from: 'projects', on: { project: 'id' } });
const integration = (table: string) => ({ table, from: 'projects', where: "namespace='spool.'||?", params: ['id'] });
// Surviving project audit rows are detached here and labelled with the
// operation's random label by `statements` once the project row is gone.
export const ERASED_AUDIT_PENDING = '{"erasure":"pending"}';

export const projectErasure = defineErasure({
 entity: 'project',
 root: { table: 'projects' },
 edges: [
  {table:'spool_follow_up_alternates',from:'projects',on:{project:'id'}},
  {table:'spool_team_mail',from:'projects',where:"EXISTS(SELECT 1 FROM json_each(spool_team_mail.projects) p WHERE p.value=?)",params:['id']},
  ...['spool_team_digest_settings','spool_team_snoozes','spool_team_mail'].map(table=>({table,from:'spool_project_teams',
   where:'organization=? AND team=? AND NOT EXISTS(SELECT 1 FROM spool_project_teams t WHERE t.organization=? AND t.team=? AND t.project<>?)',params:['organization','team','organization','team','project']})),
  {table:'spool_team_snoozes',from:'issues',where:"scope='issue' AND target=?",params:['id']},
  {table:'spool_team_snoozes',from:'alert_rules',where:"scope='rule' AND target=?",params:['id']},
  ...['spool_project_grants','spool_project_teams','spool_service_scopes'].map(fromProject),
  { table: 'spool_service_credentials', from: 'credentials', on: { hash: 'hash' } },
  ...['source_map_builds','source_map_build_files','artifact_storage_settings'].map(fromProject),
  // TEAM-004 short IDs and commit citations, including commit author and message.
  ...['alert_rule_configs','alert_rule_previews','alert_decisions','alert_reactivation_markers','retention_runs','review_stamps','review_views','retention_policies','identity_policies','event_identities','project_identity_keys','health_sessions','health_aggregates','slack_destinations','slack_delivery_meta','suspect_decisions','checkin_routes','checkin_links','loader_settings','short_id_prefixes','issue_short_ids','issue_short_id_moves','commits','release_commits','commit_links','repository_link_log','commit_sharing'].map(fromProject),
  // SRC-003: staged upload chunks, assembly receipts and the CLI's release and deploy records.
  ...['sentry_upload_chunks','sentry_assemblies','sentry_releases','sentry_deploys'].map(fromProject),
  ...['follow_up_settings','follow_up_feed_custody','follow_up_attention','follow_up_notices','follow_up_attempts','follow_up_fix_steps','follow_up_deployment_attempts','release_order_keys','audit_actor_links','deployment_steps','deployment_notices','deployment_runs','deployment_actors','release_policies','release_metadata','release_builds','issue_resolutions','grouping_policies','grouping_proposals', 'feedback', 'inbound_filter_policies', 'events', 'issues', 'releases', 'artifacts', 'outcomes', 'credentials', 'browser_origins', 'browser_origin_guards', 'sentry_project_aliases',
   'grouping_routes', 'grouping_corrections', 'event_grouping', 'issue_assignments', 'suppression_policies', 'event_suppressions', 'deployment_path_mappings', 'deployment_manifests', 'alerts', 'alert_provider_events','alert_digest_settings','alert_snoozes','alert_suppressed','alert_scheduled_mail','alert_destination_tests','alert_destinations', 'alert_rules', 'alert_cursors', 'alert_expansion_cursors', 'alert_history', 'alert_intents', 'alert_mail_jobs', 'repairs', 'repair_checks',
   'reproducers', 'reproducer_runs', 'reproducer_run_tokens', 'fix_workflows', 'fix_leases', 'fix_receipts', 'exposures'].map(fromProject),
  { table: 'alert_mail_attempts', from: 'alert_mail_jobs', on: { delivery_id: 'id' } },
  ...['rer_mail_event_receipts','rer_mail_event_states'].map(table=>({table,from:'projects',on:{event_namespace:'id'}})),
  // Development mail captured for this project's alert deliveries.
  { table: 'rer_mail_development_outbox', from: 'alert_mail_jobs', where: "CASE WHEN json_valid(message) THEN json_extract(message,'$.deliveryId') END=?", params: ['id'] },
  // The dev-minted mark of a deleted project credential.
  { table: 'oa_dev_credentials', from: 'credentials', where: "credential='credentials' AND id=?", params: ['hash'] },
  ...['integration_deliveries', 'integration_attempts', 'integration_resolutions', 'integration_replays', 'integration_tokens', 'integration_token_events', 'integration_token_usage'].map(integration),
  // One predicate per project, never one query per event: import targets name
  // the project directly, or by the project in their JSON key, or by issue.
  { table: 'sentry_import_targets', from: 'projects', where: "(kind='project' AND id=?) OR (CASE WHEN kind IN ('release','event') THEN json_extract(id,'$[0]') END=?) OR (kind='issue' AND id IN (SELECT id FROM issues WHERE project=?))", params: ['id', 'id', 'id'] },
 ],
 redact: [
  { table: 'audit', from: 'projects', on: { project: 'id' }, set: { project: null, detail: ERASED_AUDIT_PENDING }, reason: 'Project audit entries survive with their kind and time only, under a random label that cannot be joined back to the project.' },
  { table: 'alert_scheduler', from: 'projects', where: 'last_project=?', params: ['id'], set: { last_project: '' }, reason: 'The alert scheduler cursor keeps no project identifier.' },
  { table: 'alert_scheduler', from: 'alert_rules', where: 'last_spike_rule=?', params: ['id'], set: { last_spike_rule: '' }, reason: 'The spike scheduler cursor keeps no rule identifier.' },
 ],
 retain: [
  {table:'spool_audit_events',reason:'Safe chronology retains random actor and subject labels, action, time and outcome only; private attribution links are erased.'},
  { table: 'oa_operators', reason: 'The installation owner stays: project erasure preserves installation authority.' },
  { table: 'oa_bootstrap', reason: 'The one-owner claim ledger stays with the installation.' },
  { table: 'oc_owner_claims', reason: 'The managed owner-claim ledger stays with the installation.' },
  { table: 'rer_erasure_operations', reason: 'Erasure receipts keep counts and times only.' },
  { table: 'ik_door_settings', reason: 'Installation Business import opt-in stays with the owner.' },
  { table: 'ik_door_revoked_keys', reason: 'Revoked Business signing keys stay revoked.' },
  // As in Base's own retirement: one nonce row per Business request, so erasing them inside the
  // imported project's single import-kit batch would outgrow its 1,000-statement request.
  { table: 'ik_door_grants', reason: 'Used Business grant nonces stay so no grant can be replayed; they hold an action, key id, expiry and namespace name, never record content.' },
 ],
 // One erasure at a time, so pending audit entries always get their own label.
 hold: async ({ db }) => await db.prepare("SELECT 1 FROM rer_erasure_operations WHERE phase<>'complete' LIMIT 1").first() ? 'erasure_in_progress' : null,
 statements: async ({ db, label }) => [db.prepare('UPDATE audit SET detail=json_object(\'erasure\',?) WHERE project IS NULL AND detail=?').bind(label, ERASED_AUDIT_PENDING), await erasureCompletionFact(db)],
});

// Exceptions that are not tables: shown in the preview and the receipt.
export const erasureExceptions = [
 'Other projects stay: they lie outside the selected project.',
 'Portability tombstones stay as keyed hashes so older archives are refused on restore.',
 'Already downloaded archives, delivered mail, provider records, D1 Time Travel and backups, raw database imports and destination secrets (ALERT_DESTINATIONS) lie outside this installation and are not deleted.',
 'A brand-new installation given only an older archive cannot recognise this erasure; give it the newer archive as a later journal.',
];
