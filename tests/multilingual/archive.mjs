import {makePart,canonicalJson,sha256} from '../../src/modules/portability/index.mjs';
import {ContentVerifier,ArchiveVerifier} from '../../src/modules/portability/format.mjs';
import {schemaIdentityOf} from '../../src/modules/portability/schema-identity.mjs';
// Re-sign deliberate archive mutations so semantic validation, not checksums,
// has to refuse corrupt mapping custody. Only test fixture bytes are changed.
export async function mappingArchive(text,edit=()=>{},previous=false,editSchema){
 const records=text.trim().split('\n').map(JSON.parse),manifest=records[0];
 const rows=Object.fromEntries(manifest.tables.map(t=>[t.name,[]]));
 for(const part of records.filter(r=>r.kind==='part'))for(const item of part.items)if(item.kind==='row')rows[item.table].push(item.row);
 edit(rows);
 // Rebuilt from rows alone: no safe-audit payload.
 manifest.payloads=[];
 if(previous){
  // The pre-mapping archive also predates bundle grouping, inbound policies,
  // loader settings and TEAM-001 membership/notification custody (0077–0079).
  manifest.tables=manifest.tables.filter(t=>!['issue_recurrence_boundaries','issue_priorities','issue_activity','issue_comments','issue_subscriptions','recurrence_policies','issue_suppressions','spool_organizations','spool_members','spool_project_teams','spool_project_grants','spool_member_invites','spool_service_accounts','spool_service_scopes','spool_team_digest_settings','spool_team_snoozes','spool_team_mail','review_stamps','review_views','retention_policies','identity_policies','event_identities','project_identity_keys','health_sessions','health_aggregates','slack_delivery_meta','suspect_decisions','source_map_builds','source_map_build_files','artifact_storage_settings','loader_settings','alert_provider_events','alert_digest_settings','alert_snoozes','alert_suppressed','alert_scheduled_mail','grouping_proposals','deployment_path_mappings','grouping_routes','inbound_filter_policies','feedback','grouping_policies','release_policies','release_metadata','release_builds','issue_resolutions','deployment_runs','deployment_steps','deployment_notices','short_id_prefixes','issue_short_ids','issue_short_id_moves','commits','release_commits','commit_links','repository_link_log','commit_sharing','sentry_releases','sentry_deploys'].includes(t.name));
  if(manifest.migrations)manifest.migrations=manifest.migrations.filter(name=>!['0083_collaborative_lifecycle.sql','0077_members.sql','0078_team_alerts.sql','0079_team_mail_scope.sql','0068_artifact_build_sets.sql','0067_artifact_storage.sql','0034_source_paths.sql','0035_bundle_grouping.sql','0038_investigation_indexes.sql','0039_inbound_filters.sql','0040_feedback.sql','0041_business_import_door.sql','0042_grouping_rules.sql','0043_sentry_releases.sql','0044_import_preparation_steps.sql','0045_import_custody_replace.sql','0046_import_erasure_progress.sql','0047_import_door_apply_failures.sql','0048_import_door_scopes.sql','0049_deployment_history.sql','0050_release_order_keys.sql','0051_safe_audit.sql','0052_release_order_cache.sql','0053_audit_transactions.sql','0056_import_door_archives.sql','0057_grouping_proposals.sql','0058_alert_delivery.sql','0059_short_ids_commit_citations.sql','0061_loader_settings.sql','0069_checkin_routes.sql','0070_suspect_decisions.sql','0071_slack_destinations.sql','0072_release_sessions.sql','0073_identity_policy.sql','0074_retention_policy.sql','0075_retention_schedule.sql','0076_review_inbox.sql'].includes(name));
  manifest.schema=await sha256(canonicalJson(manifest.tables.map(({name,sql})=>({name,sql}))));
 }
 if(editSchema){editSchema(manifest);manifest.schema=await schemaIdentityOf(manifest.tables,manifest.schemaObjects);}
 const items=[];for(const table of manifest.tables){table.count=rows[table.name].length;for(const [index,row] of rows[table.name].entries())items.push({kind:'row',table:table.name,index,row,...(table.rowidAlias?{rowid:index+1}:{})});}
 const parts=[];for(let i=0;i<items.length;i+=200)parts.push(await makePart(parts.length,items.slice(i,i+200)));manifest.partCount=parts.length;
 const content=new ContentVerifier(manifest),binding=new ArchiveVerifier(manifest);for(const part of parts){binding.add(part);for(const item of part.items)content.add(item);}
 return [manifest,...parts,{kind:'closing',partCount:parts.length,contentHash:content.digest(),archiveHash:binding.digest()}].map(row=>JSON.stringify(row)).join('\n')+'\n';
}
