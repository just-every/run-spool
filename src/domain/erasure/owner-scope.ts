import { reportingTables } from '../dashboards/archive';
import { memberTables, teamAlertTables } from '../members/archive';
import { ownerCaptureColumns, sqlQuote } from './owner-capture';

export const importCustodyRoots=['ik_jobs','ik_originals','ik_d1_streams','ik_d1_stream_revisions','ik_d1_staging','ik_d1_native_staging','ik_d1_stream_origins','ik_door_uploads','ik_door_plans'];
const covered = new Set([...Object.keys(reportingTables),'spool_personal_rule_settings','spool_personal_digest_settings','spool_personal_unsubscribe','spool_personal_mail','spool_issue_follows','spool_notification_preferences','issue_recurrence_boundaries','issue_suppressions','issue_comments','issue_subscriptions','recurrence_policies','issue_priorities','issue_activity',...Object.keys(memberTables),...Object.keys(teamAlertTables),'spool_follow_up_alternates','spool_service_credentials','source_map_builds','source_map_build_files','artifact_storage_settings','retention_runs','review_stamps','review_views','retention_policies','identity_policies','event_identities','project_identity_keys','health_sessions','health_aggregates','slack_destinations','slack_delivery_meta','alert_provider_events','rer_mail_event_receipts','rer_mail_event_states','alert_scheduled_mail','alert_digest_settings','alert_snoozes','alert_suppressed','alert_destination_tests','grouping_proposals','audit_actor_links','spool_audit_events','deployment_actors','oa_operators','oa_owner_signins','oa_tokens','oa_sessions','oa_external_identities','oa_credentials','oa_invitation_cancellations','oa_step_up_challenges','oa_provider_sessions','oa_provider_session_pins','oa_setup_links','oa_dev_credentials','oa_auth_audit','oa_bootstrap','oc_owner_claims','oc_idp_grants','rer_dependency_pending','spool_owner_successor','rer_erasure_operations','rer_erasure_scope','credentials',...Object.keys(ownerCaptureColumns)]);
export async function unsupportedOwnerSurface(db: D1Database, needles: string[]) {
 const id=needles[0];
 // Textual identity collisions outside the declared relational subject are not
 // permission to redact another operator's records.
 const unrelated=[
  ['oa_operators','id<>?'],
  ['spool_members','operator_id IS NOT ?'],
  ['oa_external_identities','operator_id<>?'],
  ['oa_tokens','operator_id<>? AND issuer_id IS NOT ?'],
  ['oa_auth_audit','actor_id<>?'],
  ['oc_owner_claims','operator_id<>?'],
 ];
 for(const [table,where] of unrelated) {
  const info=(await db.prepare(`PRAGMA table_info(${sqlQuote(table)})`).all<any>()).results;
  const text=info.filter(column=>/TEXT/i.test(column.type)).map(column=>`r.${sqlQuote(column.name)}`);
  const matches=text.map(column=>`instr(${column},n.value)>0`).join(' OR ');
  if(await db.prepare(`SELECT 1 FROM ${sqlQuote(table)} r WHERE (${where}) AND EXISTS(SELECT 1 FROM json_each(?) n WHERE ${matches}) LIMIT 1`).bind(...Array.from({length:(where.match(/\?/g)??[]).length},()=>id),JSON.stringify(needles)).first())return 'ambiguous_identity_attribution';
 }
 const tables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all<any>()).results;
 for(const {name} of tables) {
  if(covered.has(name) || name.startsWith('rer_portability_') || name.startsWith('_'))continue;
  // Original bytes may be chunked/binary, and immutable ledgers retain importer
  // pointers. Current import-kit cannot selectively retire this shared custody.
  if(name.startsWith('ik_')) {
   if(importCustodyRoots.includes(name) && await db.prepare(`SELECT 1 FROM ${sqlQuote(name)} LIMIT 1`).first())return 'shared_import_custody';
   continue;
  }
  const info=(await db.prepare(`PRAGMA table_info(${sqlQuote(name)})`).all<any>()).results;
  const columns=info.filter(column=>/TEXT|BLOB/i.test(column.type)).map(column=>column.name);
  for(const column of columns) {
   // json_each also has value/id/type columns; bind every inspected cell to
   // the stored row so a same-named column cannot resolve to the needle itself.
   const value=`CAST(r.${sqlQuote(column)} AS TEXT)`;
   const found=await db.prepare(`SELECT 1 FROM ${sqlQuote(name)} r WHERE EXISTS(SELECT 1 FROM json_each(?) n WHERE instr(${value},n.value)>0 OR EXISTS(SELECT 1 FROM json_tree(CASE WHEN json_valid(${value}) THEN ${value} ELSE 'null' END) j WHERE typeof(j.atom)='text' AND instr(j.atom,n.value)>0)) LIMIT 1`).bind(JSON.stringify(needles)).first();
   if(found)return 'identifier_in_unsupported_surface';
  }
 }
 return null;
}
