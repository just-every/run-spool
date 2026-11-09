// Plain names for every table declared in src/domain/erasure/declaration.ts. The order is the order the preview and the receipt list them.
export const erasureLabels: Record<string, string> = {
  projects: 'Project', events: 'Occurrences', issues: 'Issues', releases: 'Releases', artifacts: 'Source maps', outcomes: 'Admission counters',
  credentials: 'Project keys', browser_origins: 'Browser origins', browser_origin_guards: 'Origin guards', sentry_project_aliases: 'Sentry DSN aliases',
  sentry_import_targets: 'Sentry import records', alerts: 'Alert feed entries', alert_rules: 'Alert rules', alert_cursors: 'Spike check positions',
  alert_expansion_cursors: 'Alert expansion positions', alert_history: 'Alert history', alert_intents: 'Planned alert deliveries', alert_mail_jobs: 'Mail jobs',
  alert_mail_attempts: 'Mail attempts', rer_mail_development_outbox: 'Development mail messages', oa_dev_credentials: 'Ingest keys',
  integration_deliveries: 'Webhook deliveries', integration_attempts: 'Webhook attempts', integration_resolutions: 'Webhook resolutions',
  integration_replays: 'Webhook replays', integration_tokens: 'Integration tokens', integration_token_events: 'Integration token events',
  integration_token_usage: 'Integration token usage', repairs: 'Repairs', repair_checks: 'Repair checks', reproducers: 'Reproducers', reproducer_runs: 'Reproducer runs', reproducer_run_tokens: 'Reproducer run tokens', fix_workflows: 'Fix workflows', fix_leases: 'Fix step claims', fix_receipts: 'Fix receipts', exposures: 'Exposure reports', audit: 'Audit entries', alert_scheduler: 'Scheduler position',
  alert_decisions: 'Alert decisions', alert_destination_tests: 'Alert destination tests', alert_destinations: 'Alert destinations', alert_digest_settings: 'Alert digest settings',
  alert_provider_events: 'Alert provider events', alert_reactivation_markers: 'Alert reactivation markers', alert_rule_configs: 'Alert rule settings', alert_rule_previews: 'Alert rule previews',
  alert_scheduled_mail: 'Scheduled alert mail', alert_snoozes: 'Alert snoozes', alert_suppressed: 'Suppressed alerts',
  key_rate_limits: 'Key rate limits', key_rate_usage: 'Key rate usage',
  artifact_storage_settings: 'Source map storage cap', audit_actor_links: 'Audit links', checkin_links: 'Check-in links', checkin_routes: 'Check-in routes',
  commit_links: 'Commit links', commit_sharing: 'Commit sharing setting', commits: 'Commits',
  deployment_actors: 'Deployment actors', deployment_manifests: 'Deployment manifests', deployment_notices: 'Deployment notices', deployment_path_mappings: 'Deployment path mappings', deployment_runs: 'Deployment runs', deployment_steps: 'Deployment steps',
  event_grouping: 'Occurrence grouping', event_identities: 'Occurrence identities', event_suppressions: 'Occurrence suppressions', feedback: 'User feedback',
  follow_up_attempts: 'Follow-up attempts', follow_up_attention: 'Follow-up attention items', follow_up_deployment_attempts: 'Follow-up deployment attempts', follow_up_feed_custody: 'Follow-up feed records',
  follow_up_fix_steps: 'Follow-up fix steps', follow_up_notice_meta: 'Follow-up notice details', follow_up_notices: 'Follow-up notices', follow_up_settings: 'Follow-up settings',
  grouping_corrections: 'Grouping corrections', grouping_policies: 'Grouping rules', grouping_proposals: 'Suggested grouping changes', grouping_routes: 'Grouping routes',
  health_aggregates: 'Release health totals', health_sessions: 'Release health sessions', identity_policies: 'Identity policies', inbound_filter_policies: 'Inbound filters',
  issue_activity: 'Issue activity', issue_assignments: 'Issue assignments', issue_comments: 'Issue comments', issue_priorities: 'Issue priorities', issue_recurrence_boundaries: 'Issue recurrence points',
  issue_resolutions: 'Issue resolutions', issue_short_id_moves: 'Issue short ID moves', issue_short_ids: 'Issue short ID assignments', issue_subscriptions: 'Issue subscriptions', issue_suppressions: 'Issue suppressions',
  loader_settings: 'Loader settings', project_identity_keys: 'Project identity keys', recurrence_policies: 'Recurrence policies',
  release_builds: 'Release builds', release_commits: 'Release commits', release_metadata: 'Release details', release_order_keys: 'Release ordering', release_policies: 'Release policies',
  repository_link_log: 'Repository link log', rer_mail_event_receipts: 'Mail event receipts', rer_mail_event_states: 'Mail event states', restored_work: 'Restored work records',
  retention_policies: 'Retention settings', retention_runs: 'Retention runs', review_stamps: 'Review stamps', review_views: 'Saved review views',
  scrubbing_changes: 'Scrubbing rule changes', scrubbing_policies: 'Scrubbing rules', scrubbing_previews: 'Scrubbing previews',
  sentry_assemblies: 'Sentry upload assemblies', sentry_debug_file_parts: 'Native debug file bytes', sentry_debug_files: 'Native debug files', sentry_deploys: 'Sentry deploy records', sentry_releases: 'Sentry release records', sentry_upload_chunks: 'Sentry upload chunks',
  short_id_prefixes: 'Issue short IDs', slack_delivery_meta: 'Slack delivery details', slack_destinations: 'Slack destinations',
  source_map_build_files: 'Source map build files', source_map_builds: 'Source map builds',
  spool_follow_up_alternates: 'Follow-up alternates', spool_notification_preferences: 'Notification preferences', spool_project_grants: 'Project access grants', spool_project_teams: 'Project teams',
  spool_reporting_items: 'Report items', spool_reporting_projects: 'Report projects', spool_reporting_shares: 'Report shares', spool_reporting_widgets: 'Report widgets',
  spool_service_credentials: 'Service keys', spool_service_scopes: 'Service key scopes', spool_team_digest_settings: 'Team digest settings', spool_team_mail: 'Team mail', spool_team_snoozes: 'Team snoozes',
  suppression_policies: 'Suppression rules', suspect_decisions: 'Suspect change decisions',
  ik_door_grants: 'Business grant records', ik_door_revoked_keys: 'Revoked Business keys', ik_door_settings: 'Business import setting',
  oa_bootstrap: 'Owner claim ledger', oa_operators: 'Installation owner', oc_owner_claims: 'Managed owner claims', rer_erasure_operations: 'Erasure receipts', spool_audit_events: 'Audit chronology',
};
const order = Object.keys(erasureLabels);
/** A table's plain name; one with no entry is humanised, never printed as a table name. */
export function erasureLabel(table: string) {
  if (erasureLabels[table]) return erasureLabels[table];
  const words = table.replace(/^(spool|oa|oc|ik|rer)_/, '').replaceAll('_', ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Other records';
}
export const erasureRank = (table: string) => order.includes(table) ? order.indexOf(table) : order.length;
export const erasureTotal = (counts: Record<string, number>) => Object.values(counts).reduce((sum, n) => sum + n, 0);
