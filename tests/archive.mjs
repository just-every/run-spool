import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { ContentVerifier, ArchiveVerifier } from '../src/modules/portability/format.mjs';
import { readArchive } from '../src/modules/portability/index.mjs';
import { createHash } from 'node:crypto';
import { canonical } from '../src/domain/privacy.ts';
import { base32, prefixBase } from '../src/domain/short-ids/format.ts';
// TEAM-004 stores (migration 0059); an older archive has none of them.
const citationTables=['scrubbing_policies','scrubbing_changes','alert_rule_configs','review_stamps','review_views','retention_policies','identity_policies','event_identities','project_identity_keys','health_sessions','health_aggregates','slack_delivery_meta','suspect_decisions','source_map_builds','source_map_build_files','artifact_storage_settings','loader_settings','short_id_prefixes','issue_short_ids','issue_short_id_moves','commits','release_commits','commit_links','repository_link_log','commit_sharing','sentry_releases','sentry_deploys'];
// Current transport and every occurrence identity stay intact for roundtrips.
export async function archiveProjection(response) {
 const text=await response.text(),records=[];
 for await(const record of readArchive(new Response(text).body))records.push(record);
 const manifest=records[0],data=Object.fromEntries(manifest.tables.map(table=>[table.name,[]]));
 for(const part of records.filter(record=>record.kind==='part'))for(const item of part.items)if(item.kind==='row')data[item.table].push(item.row);
 return {data,manifest,text};
}
// Deliberate native compatibility fixture, never the current roundtrip format.
export function nativeArchive(data,version=2) {
 const rows=structuredClone(data);
 for(const table of ['alert_provider_events','alert_digest_settings','alert_snoozes','alert_suppressed','alert_scheduled_mail','grouping_proposals','grouping_routes','grouping_corrections','event_grouping','issue_assignments','suppression_policies','event_suppressions','deployment_path_mappings','deployment_manifests',...citationTables])delete rows[table];
 for(const name of ['release_policies','release_metadata','release_builds','issue_resolutions','deployment_runs','deployment_steps','deployment_notices'])delete rows[name];delete rows.grouping_policies;delete rows.feedback;delete rows.inbound_filter_policies;delete rows.sentry_project_aliases;delete rows.sentry_import_targets;delete rows.alert_rules;delete rows.alert_history;delete rows.repairs;delete rows.repair_checks;delete rows.rer_erasure_operations;delete rows.rer_dependency_installation;delete rows.rer_dependency_link;for(const table of ['reproducers','reproducer_runs','fix_workflows','fix_receipts','exposures'])delete rows[table];
 rows.events=rows.events.map(({occurrence,historical,...row})=>{if(historical)throw new Error('Historical imports require current Base JSONL');return row});
 rows.artifacts=rows.artifacts.map(({occurrence,...row})=>row);
 rows.issues=rows.issues.map(({latest_release_seq,...row})=>row);
 rows.alerts=rows.alerts.filter(row=>row.kind!=='spike').map(({payload,...row})=>row);
 rows.audit=rows.audit.filter(row=>!['issues_reviewed','retention_policy_changed','retention_hold_changed','identity_policy_changed','suspect_judged','release_policy_changed','grouping_rules_changed','feedback_withdrawn','inbound_filters_changed','grouping_applied','grouping_undone','issue_assigned','suppression_changed','deployment_registered'].includes(row.kind)&&!row.kind.startsWith('alert_')&&!row.kind.startsWith('repair_')&&!row.kind.startsWith('reproducer_')&&!row.kind.startsWith('fix_'));
 if(version===1)delete rows.browser_origins;
 const value={version,migration:version===1?'0001_errors':'0003_browser_origins',data:rows};
 return {...value,checksum:createHash('sha256').update(canonical(value)).digest('hex')};
}
export function assertLegacyUpgrade(actual,previous) {
 const expected=structuredClone(previous);
 for(const table of ['alert_provider_events','alert_digest_settings','alert_snoozes','alert_suppressed','alert_scheduled_mail','grouping_proposals','grouping_routes','grouping_corrections','event_grouping','issue_assignments','suppression_policies','event_suppressions','deployment_path_mappings','deployment_manifests'])expected[table]=[];
 for(const name of ['release_policies','release_metadata','release_builds','issue_resolutions','deployment_runs','deployment_steps','deployment_notices'])expected[name]=[];expected.grouping_policies=[];expected.feedback=[];expected.inbound_filter_policies=[];expected.browser_origins??=[];
 for(const table of ['events','artifacts'])expected[table]=expected[table].map(row=>({...row,occurrence:'legacy'}));
 expected.events=expected.events.map(row=>({...row,historical:0}));
 expected.issues=expected.issues.map(row=>{const ceiling=Math.max(0,...expected.releases.filter(release=>release.project===row.project).map(release=>release.seq));return {...row,latest_release_seq:ceiling,resolved_seq:row.state==='resolved'?Math.max(row.resolved_seq??0,ceiling):row.resolved_seq}});
 expected.alerts=expected.alerts.map(row=>({...row,payload:null}));expected.alert_rules=[];expected.alert_history=[];expected.repairs=[];expected.repair_checks=[];expected.rer_erasure_operations=[];expected.sentry_import_targets=[];expected.rer_dependency_installation=[];expected.rer_dependency_link=[];for(const table of ['reproducers','reproducer_runs','fix_workflows','fix_receipts','exposures'])expected[table]=[];
 expected.sentry_project_aliases=expected.projects.map((project,index)=>({id:index+1,project:project.id}));
 // Upgrade (migration 0059) and restore number old projects and issues alike: prefixes in creation order, issues in first-seen order.
 for(const table of citationTables)expected[table]=[];const bases=new Map(),byTime=(a,b,time)=>a[time]-b[time]||(a.id<b.id?-1:a.id>b.id?1:0);
 for(const project of [...expected.projects].sort((a,b)=>byTime(a,b,'created'))){const base=prefixBase(project.id),n=(bases.get(base)??0)+1,prefix=n===1?base:`${base}_${n}`,issues=expected.issues.filter(issue=>issue.project===project.id).sort((a,b)=>byTime(a,b,'first_seen'));bases.set(base,n);
  expected.short_id_prefixes.push({prefix,project:project.id,next:issues.length+1,created:project.created});issues.forEach((issue,index)=>expected.issue_short_ids.push({short_id:`${prefix}-${base32(index+1)}`,project:project.id,issue:issue.id,assigned:issue.id,number:index+1,created:issue.first_seen}));}
 const sorted=data=>Object.fromEntries(Object.entries(data).map(([table,rows])=>[table,rows.map(row=>canonical(row)).sort()]));
 assert.ok(isDeepStrictEqual(sorted(actual),sorted(expected)),'every original field and row survives; migrated event/map identities are legacy');
}

// Change fixture metadata with valid checksums so restore policy, not integrity, decides.
export async function archiveConfiguration(text, configuration) {
 const records=[];for await(const record of readArchive(new Response(text).body))records.push(record);
 const manifest={...records[0],requiredConfiguration:configuration};
 const parts=records.filter(record=>record.kind==='part');
 const content=new ContentVerifier(manifest),binding=new ArchiveVerifier(manifest);
 for(const part of parts){binding.add(part);for(const item of part.items)content.add(item)}
 return [manifest,...parts,{kind:'closing',partCount:parts.length,contentHash:content.digest(),archiveHash:binding.digest()}].map(record=>JSON.stringify(record)).join('\n')+'\n';
}
