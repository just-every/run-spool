import assert from 'node:assert/strict';
import {readArchive,makePart} from '../../src/modules/portability/index.mjs';
import {ContentVerifier,ArchiveVerifier} from '../../src/modules/portability/format.mjs';
import {canonicalJson,sha256} from '../../src/modules/portability/hash.mjs';
import {canonical} from '../../src/domain/privacy.ts';
// The declared pre-repair inventory also predates erasure receipts (0018),
// identity links (0020), operator custody (0031), execution (0032), and
// stable bundle grouping routes (0035) and inbound filter policies (0039).
const repairTables=['repair_checks','repairs','rer_erasure_operations','rer_dependency_installation','rer_dependency_link'];
const operatorTables=['grouping_proposals','grouping_corrections','event_grouping','issue_assignments','suppression_policies','event_suppressions','deployment_path_mappings','deployment_manifests'];
const executionTables=['reproducers','reproducer_runs','fix_workflows','fix_receipts','exposures'];
const deliveryTables=['alert_provider_events','alert_digest_settings','alert_snoozes','alert_suppressed','alert_scheduled_mail'];
// TEAM-004 short IDs and commit citations (0059) arrive after repairs too; restore numbers the older archive's issues afresh.
const citationTables=['short_id_prefixes','issue_short_ids','issue_short_id_moves','commits','release_commits','commit_links','repository_link_log','commit_sharing','sentry_releases','sentry_deploys'];
// TEAM-001 membership/notification custody and c16's artifact stores also postdate the pre-repair archive.
const laterCustodyTables=['spool_organizations','spool_members','spool_project_teams','spool_project_grants','spool_member_invites','spool_service_accounts','spool_service_scopes','spool_team_digest_settings','spool_team_snoozes','spool_team_mail','suspect_decisions','slack_delivery_meta','project_identity_keys','health_sessions','health_aggregates','identity_policies','event_identities','retention_policies','review_stamps','review_views'];
const loaderTables=['loader_settings','artifact_storage_settings','source_map_builds','source_map_build_files'];
const lifecycleTables=['issue_recurrence_boundaries','issue_priorities','issue_activity','issue_comments','issue_subscriptions','recurrence_policies','issue_suppressions'];
const laterTables=[...lifecycleTables,...laterCustodyTables,...loaderTables,...deliveryTables,...citationTables,...repairTables,...operatorTables,...executionTables,'grouping_routes','inbound_filter_policies','feedback','grouping_policies','release_policies','release_metadata','release_builds','issue_resolutions','deployment_runs','deployment_steps','deployment_notices'];
// The archive an installation without repair history exports: the same rows in
// the inventory before migration 0016, with Base's own schema and content hashes.
export async function preRepairArchive(text){
 const records=[];for await(const record of readArchive(new Response(text).body))records.push(record);
 const [manifest]=records,data=Object.fromEntries(manifest.tables.map(table=>[table.name,[]]));
 for(const part of records.filter(record=>record.kind==='part'))for(const item of part.items)if(item.kind==='row')data[item.table].push(item);
 data.audit=data.audit.filter(item=>!item.row.kind.startsWith('repair_')).map((item,index)=>({...item,index}));
 const tables=manifest.tables.filter(table=>!laterTables.includes(table.name)).map(table=>({...table,count:data[table.name].length}));
 const items=tables.flatMap(table=>data[table.name]),parts=[];
 for(let offset=0;offset<items.length;offset+=500)parts.push(await makePart(parts.length,items.slice(offset,offset+500)));
 // Archives from before 0016 predate the recorded migration list as well.
 const {migrations:_recorded,...previous}=manifest;
 // Rebuilt from rows alone, it carries no safe-audit payload, as a previous format.
 const earlier={...previous,payloads:[],tables,partCount:parts.length,schema:await sha256(canonicalJson(tables.map(({name,sql})=>({name,sql}))))};
 const verifier=new ContentVerifier(earlier),binding=new ArchiveVerifier(earlier);for(const item of items)verifier.add(item);for(const part of parts)binding.add(part);
 return [earlier,...parts,{kind:'closing',partCount:parts.length,contentHash:verifier.digest(),archiveHash:binding.digest()}].map(record=>canonicalJson(record)+'\n').join('');
}
const withoutRepairs=data=>Object.fromEntries(Object.entries(data).filter(([table])=>![...lifecycleTables,...laterCustodyTables,...repairTables,...citationTables,...loaderTables,'grouping_policies','release_policies','release_metadata','release_builds','issue_resolutions','deployment_runs','deployment_steps','deployment_notices'].includes(table)).map(([table,rows])=>[table,(table==='audit'?rows.filter(row=>!row.kind.startsWith('repair_')):rows).map(canonical).sort()]));
// Part 4: a pre-repair archive restores with empty repair tables; a populated
// archive restores repairs, checks and every verdict input intact.
export async function archiveProof(app,{issue,repair,cutoff}){
 const source=await app.archive();assert.ok(source.data.repairs.length&&source.data.repair_checks.length);
 const read=async()=>(await app.json(`/api/projects/a/repairs?issue=${issue}`)).repairs.find(row=>row.id===repair.id);
 const before=await read();
 await app.resetRestore(await preRepairArchive(source.text));
 let restored=await app.archive();assert.deepEqual(restored.data.repairs,[]);assert.deepEqual(restored.data.repair_checks,[]);
 for(const table of [...laterCustodyTables,...loaderTables,...deliveryTables,...operatorTables,...executionTables,'grouping_routes','inbound_filter_policies','feedback','grouping_policies','release_policies','release_metadata','release_builds','issue_resolutions','deployment_runs','deployment_steps','deployment_notices'])assert.deepEqual(restored.data[table],[],'pre-repair archive starts '+table+' empty');
 for(const table of lifecycleTables.filter(table=>table!=='issue_priorities'))assert.deepEqual(restored.data[table],[],'pre-repair archive has no collaborative history');
 assert.deepEqual(restored.data.issue_priorities.map(canonical).sort(),source.data.issue_priorities.map(canonical).sort(),'older native errors receive the same automatic priority');
 assert.deepEqual(withoutRepairs(restored.data),withoutRepairs(source.data),'pre-repair archive restores every other row');
 await app.resetRestore(source.text);restored=await app.archive();
 for(const table of Object.keys(source.data))assert.deepEqual(restored.data[table].map(canonical).sort(),source.data[table].map(canonical).sort(),'restored '+table);
 const after=await read(),stable=row=>({...row,observation:{...row.observation,evidence:{...row.observation.evidence,window:{start:row.observation.evidence.window.start}}}});
 assert.deepEqual(stable(after),stable(before),'restored repair, checks and computed verdict');
 // Retention keeps the repair and marks its snapshot events that are gone.
 await app.json('/api/projects/a/retention','POST',{cutoff,apply:true});
 const retained=await read();assert.equal(retained.id,repair.id);assert.deepEqual(retained.checks,before.checks);
 assert.ok(retained.snapshot.events.some(row=>row.state==='removed_by_retention'),'snapshot event removed by retention is marked');
 assert.equal(retained.snapshot.events.length,before.snapshot.events.length);assert.equal(retained.observation.verdict,'recurred');
 return {restoredTables:Object.keys(source.data).length,repairs:source.data.repairs.length,checks:source.data.repair_checks.length,snapshot:retained.snapshot.events};
}
