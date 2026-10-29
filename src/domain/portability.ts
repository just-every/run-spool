import {ensureIssuePriorities} from './issue-priority/model';
import {ensureRecurrenceBoundaries} from './recurrence/model';
import {suppressionExportRow} from './suppression/archive';
import {discussionExportRow} from './discussion/archive';
import {lifecycleTables} from './lifecycle/archive';
import { memberTables, teamAlertTables, memberExportRow } from './members/archive';
import {reviewTables} from './review/model';
import {retentionTables} from './retention-policy';
import {identityTables} from './identities/archive';
import {sessionTables} from './sessions/archive';
import { suspectTables } from './suspects/archive';
import { loaderTables } from './loader/archive';
import { proposalTables, proposalExportRow } from './proposals/archive';
import {followUpExcludedTables} from './follow-up/types';
import { safeAuditExcludedTables, auditPayload, SAFE_AUDIT_PAYLOAD } from './audit/archive';
import { deploymentTables,deploymentExportRow } from './deployments/archive';
import { releaseTables } from './releases/archive';
import { groupingTables } from './grouping/archive';
import {inboundFilterTables} from './filters/archive';
import { feedbackTables } from './feedback/archive';
import { bundleTables } from './bundle-grouping';
import { operatorTables } from './operators/archive';
import { createPortability, readArchive, makePart, canonicalJson, sha256, PortabilityError } from '../modules/portability/index.mjs';
import { catalogue, policy } from '../modules/portability/catalogue.mjs';
import { platformTable, restorableManifest } from '../modules/portability/bookkeeping.mjs';
import { ArchiveVerifier } from '../modules/portability/format.mjs';
import { alertArchiveTables, alertExcludedTables, alertExportRow, validateAlertArchive } from './alerts/archive';
import { validateArchive, validateArchiveRows, tables } from './archive';
import { repairArchiveTables, validateRepairArchive } from './repairs/archive';
import { emptyExecutionTables, executionArchiveTables, executionExcludedTables, validateExecutionArchive } from './execution-archive';
import { erasureArchiveTables, erasureExcludedTables, validateErasureArchive } from './erasure/archive';
import { fenceLegacyOccurrences } from './occurrences';
import { scrubExportRow } from './stored-text';
import { isPreviousSchema, readPreviousArchive, normalizePreviousArchive, retireArchiveSetupToken } from './archive-compat';
import { linkArchiveTables, linkMigrations, emptyLinkTables } from './link-archive';
import { shortIdTables } from './short-ids/archive';
import { commitTables } from './commits/archive';
import { sentryCliTables, sentryCliExcludedTables } from './sentry-cli/archive';
import { ensureShortIds } from './short-ids/assign';

function stagedValidation(later: string[] = []) {
 return async ({ db, read, manifest }: { db: D1Database; read: (table: string) => Promise<any[]>; manifest: any }) => {
  const rows=Object.fromEntries(await Promise.all([...Object.keys(tables),...alertArchiveTables,...repairArchiveTables,...erasureArchiveTables,...executionArchiveTables].map(async table => [table, await read(table)])));
  const data=await validateArchiveRows(validateAlertArchive(validateRepairArchive(validateErasureArchive(validateExecutionArchive(rows)))),false,rows.alert_rules);
  await fenceLegacyOccurrences(db, manifest, data, later);
  return true;
 };
}

export const portabilityPolicy = {
 product: 'runeditrun/errors-workbench', excludeTables: ['agent_door_%','bs_%','spool_agent_operations','spool_agent_custody','spool_native_approvals','spool_erasure_agents','spool_native_audit_actors','spool_follow_up_alternates','spool_service_credentials','retention_runs','credentials', 'sessions', 'login_budget', 'browser_origin_guards','spool_authority_guards','operator_guards',...safeAuditExcludedTables,...followUpExcludedTables,'deployment_actors','release_order_keys','checkin_routes','checkin_links','ik_%', ...alertExcludedTables, ...erasureExcludedTables, ...executionExcludedTables, ...sentryCliExcludedTables],
 exportRow: (table: string, row: any) => scrubExportRow(table, suppressionExportRow(table, discussionExportRow(table, memberExportRow(table, proposalExportRow(table, deploymentExportRow(table, alertExportRow(table, row))))))),
 requiredConfiguration: ['OWNER_EMAIL', 'SESSION_SECRET', 'AUTH_ORIGIN', 'AUTH_LOCAL', 'MAIL_PROVIDER', 'MAIL_FROM', 'ALERT_DESTINATIONS', 'ALERT_DESTINATION_HASH_KEY', 'ALERT_PUBLIC_ORIGIN', 'INTEGRATION_EGRESS'],
 validateStaged: stagedValidation(),
};
// Current archives carry the safe audit chronology as a payload. Previous
// formats have none; restoring one uses the payload-free policy, and the
// restore commit gives its journal rows legacy facts instead.
export async function portability(db: D1Database, safeAudit = true) {
 const policy = safeAudit ? { ...portabilityPolicy, extraPayloads: { [SAFE_AUDIT_PAYLOAD]: auditPayload(db) } } : portabilityPolicy;
 const service = await createPortability({ db, policy });
 return { ...service, db, imports: { ...service.imports,
  async finalize(id: string, options?: any) {
   // Include an explicitly supplied later journal in the legacy-key fence too.
   // Base still validates that journal and enforces its normal epoch/key fence.
   const checked = options?.laterJournal ? await createPortability({ db, policy: { ...policy, validateStaged: stagedValidation(options.laterJournal.journal) } }) : service;
   return checked.imports.finalize(id, options);
  },
 } };
}
export async function archiveStream(service: any): Promise<ReadableStream<Uint8Array>> {
 const id = await service.exports.create();
 try {
  while ((await service.exports.advance(id, { maxParts: 16 })).phase === 'building') {}
  const reader = (await service.exports.download(id)).getReader();
  let ended = false;
  const cleanup = async () => { if (!ended) { ended = true; await reader.cancel(); await service.exports.abort(id); } };
  return new ReadableStream({
   async pull(controller) { try { const next = await reader.read(); if (next.done) { await cleanup(); controller.close(); } else controller.enqueue(next.value); } catch (error) { await cleanup(); controller.error(error); } },
   cancel: cleanup,
  });
 } catch (error) { await service.exports.abort(id); throw error; }
}
// Archives from before later additive tables (the identity link's two in
// 0020, erasure receipts in 0018, and before that the two repair tables in 0016) carry exactly today's inventory
// minus those tables. Their verified rows restore unchanged into today's
// schema; the later tables start empty.
// Each set names the additive migrations that created it; an archive that
// records its applied migrations gains exactly those, nothing else.
const operatorNames=Object.keys(operatorTables);
const operatorMigration='0031_operator_corrections.sql';
const executionMigration='0032_execution.sql';
// 0033 adds only the excluded fix_leases table: an archive with today's tables
// that records migrations without it gains just that name.
const leaseMigration='0033_fix_leases.sql';
const mappingTables = ['deployment_path_mappings'];
const mappingMigration = '0034_source_paths.sql';
const bundleNames=Object.keys(bundleTables),bundleMigration='0035_bundle_grouping.sql';
const laterTables = [
 { tables: mappingTables, migrations: [leaseMigration,mappingMigration] },
 { tables: [...executionArchiveTables,...mappingTables], migrations: [executionMigration, leaseMigration,mappingMigration] },
 ...[
  {tables:operatorNames,migrations:[operatorMigration]},
  { tables: [...operatorNames,...linkArchiveTables], migrations: [operatorMigration,...linkMigrations] },
  { tables: [...operatorNames,...erasureArchiveTables, ...linkArchiveTables], migrations: [operatorMigration,'0018_erasure.sql', ...linkMigrations] },
  { tables: [...operatorNames,...erasureArchiveTables, ...repairArchiveTables, ...linkArchiveTables], migrations: [operatorMigration,'0016_repairs.sql', '0018_erasure.sql', ...linkMigrations] },
 ].map(later => ({ tables: [...later.tables, ...executionArchiveTables,...mappingTables], migrations: [...later.migrations, executionMigration, leaseMigration,mappingMigration] })),
].map(later=>({tables:[...later.tables,...bundleNames],migrations:[...later.migrations,bundleMigration]}));
laterTables.unshift({tables:bundleNames,migrations:[bundleMigration]});
// Page-managed recipients are private configuration, not archive content.
for(const later of laterTables)later.migrations.push('0037_alert_destinations.sql');
laterTables.unshift({tables:[],migrations:['0037_alert_destinations.sql']});
for(const later of laterTables){later.tables.push(...Object.keys(inboundFilterTables));later.migrations.push('0038_investigation_indexes.sql','0039_inbound_filters.sql')}
laterTables.unshift({tables:Object.keys(inboundFilterTables),migrations:['0038_investigation_indexes.sql','0039_inbound_filters.sql']});
for(const later of laterTables){later.tables.push(...Object.keys(feedbackTables));later.migrations.push('0040_feedback.sql')}
laterTables.unshift({tables:Object.keys(feedbackTables),migrations:['0040_feedback.sql']});
for(const later of laterTables){later.tables.push(...Object.keys(groupingTables));later.migrations.push('0041_business_import_door.sql','0042_grouping_rules.sql')}
laterTables.unshift({tables:Object.keys(groupingTables),migrations:['0041_business_import_door.sql','0042_grouping_rules.sql']});
for(const later of laterTables){later.tables.push(...Object.keys(releaseTables));later.migrations.push('0043_sentry_releases.sql')}
laterTables.unshift({tables:Object.keys(releaseTables),migrations:['0043_sentry_releases.sql']});
// 0044-0048 add only import-kit and door tables, which archives exclude.
const importDoorMigrations=['0044_import_preparation_steps.sql','0045_import_custody_replace.sql','0046_import_erasure_progress.sql','0047_import_door_apply_failures.sql','0048_import_door_scopes.sql'];
for(const later of laterTables)later.migrations.push(...importDoorMigrations);
laterTables.unshift({tables:[],migrations:importDoorMigrations});
for(const later of laterTables){later.tables.push(...Object.keys(deploymentTables));later.migrations.push('0049_deployment_history.sql','0050_release_order_keys.sql')}
laterTables.unshift({tables:Object.keys(deploymentTables),migrations:['0049_deployment_history.sql','0050_release_order_keys.sql']});
for(const later of laterTables)later.migrations.push('0051_safe_audit.sql');
laterTables.unshift({tables:[],migrations:['0051_safe_audit.sql']});
// Derived release ordering is rebuilt after restore and excluded from archives.
for(const later of laterTables)later.migrations.push('0052_release_order_cache.sql');
laterTables.unshift({tables:[],migrations:['0052_release_order_cache.sql']});
// 0053 adds only excluded audit context, staging and legacy-action tables.
for(const later of laterTables)later.migrations.push('0053_audit_transactions.sql');
laterTables.unshift({tables:[],migrations:['0053_audit_transactions.sql']});
for(const later of laterTables)later.migrations.push('0054_release_resolution_dist.sql');
laterTables.unshift({tables:[],migrations:['0054_release_resolution_dist.sql']});
for(const later of laterTables)later.migrations.push('0055_follow_up.sql');
laterTables.unshift({tables:[],migrations:['0055_follow_up.sql']});
// 0056 adds only the door's archive tables, which archives exclude (ik_%).
for(const later of laterTables)later.migrations.push('0056_import_door_archives.sql');
laterTables.unshift({tables:[],migrations:['0056_import_door_archives.sql']});
for(const later of laterTables){later.tables.push(...Object.keys(proposalTables));later.migrations.push('0057_grouping_proposals.sql')}
laterTables.unshift({tables:Object.keys(proposalTables),migrations:['0057_grouping_proposals.sql']});
const deliveryTables=['alert_provider_events','alert_digest_settings','alert_snoozes','alert_suppressed','alert_scheduled_mail'];
for(const later of laterTables){later.tables.push(...deliveryTables);later.migrations.push('0058_alert_delivery.sql')}
laterTables.unshift({tables:deliveryTables,migrations:['0058_alert_delivery.sql']});
const citationTables=[...Object.keys(shortIdTables),...Object.keys(commitTables)];
for(const later of laterTables){later.tables.push(...citationTables);later.migrations.push('0059_short_ids_commit_citations.sql')}
laterTables.unshift({tables:citationTables,migrations:['0059_short_ids_commit_citations.sql']});
const cliTables=Object.keys(sentryCliTables);
for(const later of laterTables){later.tables.push(...cliTables);later.migrations.push('0060_sentry_cli.sql')}
laterTables.unshift({tables:cliTables,migrations:['0060_sentry_cli.sql']});
for(const later of laterTables){later.tables.push(...Object.keys(loaderTables));later.migrations.push('0061_loader_settings.sql')}
laterTables.unshift({tables:Object.keys(loaderTables),migrations:['0061_loader_settings.sql']});
for(const later of laterTables){later.tables.push('artifact_storage_settings');later.migrations.push('0067_artifact_storage.sql')}
laterTables.unshift({tables:['artifact_storage_settings'],migrations:['0067_artifact_storage.sql']});
for(const later of laterTables){later.tables.push('source_map_builds','source_map_build_files');later.migrations.push('0068_artifact_build_sets.sql')}
laterTables.unshift({tables:['source_map_builds','source_map_build_files'],migrations:['0068_artifact_build_sets.sql']});
// 0069 adds only check-in connections and links; both are excluded, so an archive never carries a heartbeat capability URL.
for(const later of laterTables)later.migrations.push('0069_checkin_routes.sql');
laterTables.unshift({tables:[],migrations:['0069_checkin_routes.sql']});
for(const later of laterTables){later.tables.push(...Object.keys(suspectTables));later.migrations.push('0070_suspect_decisions.sql')}
laterTables.unshift({tables:Object.keys(suspectTables),migrations:['0070_suspect_decisions.sql']});
for(const later of laterTables){later.tables.push('slack_delivery_meta');later.migrations.push('0071_slack_destinations.sql')}
laterTables.unshift({tables:['slack_delivery_meta'],migrations:['0071_slack_destinations.sql']});
for(const later of laterTables){later.tables.push(...Object.keys(sessionTables));later.migrations.push('0072_release_sessions.sql')}
laterTables.unshift({tables:Object.keys(sessionTables),migrations:['0072_release_sessions.sql']});
for(const later of laterTables){later.tables.push(...Object.keys(identityTables));later.migrations.push('0073_identity_policy.sql')}
laterTables.unshift({tables:Object.keys(identityTables),migrations:['0073_identity_policy.sql']});
for(const later of laterTables){later.tables.push(...Object.keys(retentionTables));later.migrations.push('0074_retention_policy.sql')}
laterTables.unshift({tables:Object.keys(retentionTables),migrations:['0074_retention_policy.sql']});
for(const later of laterTables)later.migrations.push('0075_retention_schedule.sql');
laterTables.unshift({tables:[],migrations:['0075_retention_schedule.sql']});
for(const later of laterTables){later.tables.push(...Object.keys(reviewTables));later.migrations.push('0076_review_inbox.sql')}
laterTables.unshift({tables:Object.keys(reviewTables),migrations:['0076_review_inbox.sql']});
const membershipTables=Object.keys(memberTables);
for(const later of laterTables){later.tables.push(...membershipTables);later.migrations.push('0077_members.sql')}
laterTables.unshift({tables:membershipTables,migrations:['0077_members.sql']});
for(const later of laterTables){later.tables.push(...Object.keys(teamAlertTables));later.migrations.push('0078_team_alerts.sql','0079_team_mail_scope.sql')}
laterTables.unshift({tables:Object.keys(teamAlertTables),migrations:['0078_team_alerts.sql','0079_team_mail_scope.sql']});
for(const later of laterTables){later.tables.push(...Object.keys(lifecycleTables));later.migrations.push('0083_collaborative_lifecycle.sql')}
laterTables.unshift({tables:Object.keys(lifecycleTables),migrations:['0083_collaborative_lifecycle.sql']});
const agentMigrations=['0081_agent_door.sql','0082_business_settings.sql','0090_business_people.sql','0084_native_agent_attribution.sql','0085_agent_runner_custody.sql','0086_native_agent_repository_consent.sql','0087_repository_proof_reference.sql','0088_agent_erasure_custody.sql','0089_native_action_actor_links.sql'];
for(const later of laterTables)later.migrations.push(...agentMigrations);
laterTables.unshift({tables:[],migrations:agentMigrations});
// Match the exact archive inventory from before native attribution was added.
// Current archives retain and validate their declared attribution columns.
function beforeAgentAttribution(table:any,manifest:any){
 if(manifest.migrations?.includes('0084_native_agent_attribution.sql'))return table;
 const field=table.name==='repairs'?'recorded_by':table.name==='grouping_proposals'?'prepared_by':null;
 if(!field)return table;
 const declaration=field==='recorded_by'?", recorded_by TEXT NOT NULL DEFAULT 'owner'":', prepared_by TEXT';
 return {...table,sql:table.sql.replace(declaration,''),columns:table.columns.filter((column:any)=>column.name!==field)};
}
async function earlierManifest(db: D1Database, manifest: any) {
 const current = await catalogue(db, policy(portabilityPolicy));
 if (manifest?.kind !== 'manifest') return null;
 const product = await restorableManifest(manifest);
 // Every set that adds no archived table matches the same schema; an archive that records its migrations takes the
 // one holding every such migration it lacks (0.5.1 archives lack 0054, 0055 and 0056), never only the newest.
 const tableless = [...new Set(laterTables.filter(later => !later.tables.length).flatMap(later => later.migrations))];
 for (const later of laterTables) {
  // A set that adds no archived table matches today's schema, so it applies only to an archive missing its migrations.
  if (!later.tables.length && !(Array.isArray(manifest.migrations) && later.migrations.some(name => !manifest.migrations.includes(name)) && tableless.every(name => manifest.migrations.includes(name) || later.migrations.includes(name)))) continue;
  const earlier = current.tables.filter((table: any) => !later.tables.includes(table.name)).map((table:any)=>beforeAgentAttribution(table,manifest)).map((table:any)=>table.name==='issue_resolutions'&&!manifest.migrations?.includes('0054_release_resolution_dist.sql')?{...table,sql:table.sql.replace('CREATE TABLE \"issue_resolutions\"','CREATE TABLE issue_resolutions').replace("('plain','current','next','named')","('plain','current')")}:table);
  if (product.schema !== await sha256(canonicalJson(earlier.map(({ name, sql }: any) => ({ name, sql }))))) continue;
  if (!Array.isArray(product.tables) || canonicalJson(product.tables.map(({ count, ...table }: any) => table)) !== canonicalJson(earlier)) throw new PortabilityError('legacy_column_inventory');
  const migrations = Array.isArray(manifest.migrations) ? { migrations: [...manifest.migrations, ...later.migrations.filter(name => !manifest.migrations.includes(name))] } : {};
  // Parts still carry the original bookkeeping rows. Keep their descriptors so
  // Base can validate and skip them while restoring only the current product.
  const tables = [...manifest.tables.filter((table: any) => platformTable(table.name)), ...current.tables.map((table: any) => ({ ...table, count: product.tables.find((old: any) => old.name === table.name)?.count ?? 0 }))].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  return { ...manifest, ...migrations, schema: await sha256(canonicalJson(tables.map(({ name, sql }: any) => ({ name, sql })))), tables };
 }
 return null;
}
async function importRecords(service: any, source: ReadableStream<Uint8Array>, db?: D1Database, laterJournal?: LaterJournal) {
 let id, closing, binding: any, complete = false, rewritten = false;
 const attributionDefaults=new Map<string,Record<string,unknown>>();
 const archivedAttributionColumns=new Map<string,string[]>();
 try {
  for await (const record of readArchive(source)) {
   if (record.kind === 'manifest') {
    const earlier=db ? await earlierManifest(db,record) : null;
    const manifest = retireArchiveSetupToken(earlier ?? record, portabilityPolicy.requiredConfiguration);
    if(earlier)for(const [table,field,value] of [['repairs','recorded_by','owner'],['grouping_proposals','prepared_by',null]] as const){
     const archived=record.tables.find((entry:any)=>entry.name===table);
     if(archived&&!archived.columns.some((column:any)=>column.name===field)){attributionDefaults.set(table,{[field]:value});archivedAttributionColumns.set(table,archived.columns.map((column:any)=>column.name).sort());}
    }
    rewritten = manifest !== record; binding = new ArchiveVerifier(manifest); id = await service.imports.create(manifest);
   }
   else if (record.kind === 'part') {
    // readArchive verifies the original bytes; bind translated parts to the
    // recognized current inventory using only this migration's exact defaults.
    const part=attributionDefaults.size?await makePart(record.index,record.items.map((item:any)=>{
     if(item.kind!=='row'||!attributionDefaults.has(item.table))return item;
     if(canonicalJson(Object.keys(item.row).sort())!==canonicalJson(archivedAttributionColumns.get(item.table)))throw new PortabilityError('legacy_column_inventory');
     return {...item,row:{...item.row,...attributionDefaults.get(item.table)}};
    })):record;
    binding.add(part); await service.imports.uploadPart(id, part.index, part);
   }
   else closing = record;
  }
  if (!closing) throw new Error('Archive closing record missing');
  // A migrated schema or retired setup token changes the content and archive hashes;
  // readArchive has already verified the original archive's closing hashes
  // above, and finalize binds the staged parts to the manifest actually created.
  await service.imports.finalize(id, { archiveHash: binding.digest(), ...(rewritten ? {} : { contentHash: closing.contentHash }), ...(laterJournal ? { laterJournal } : {}) }); complete = true;
 } finally { if (id && !complete) await service.imports.abort(id); }
}
async function templateManifest(service:any){
 let manifest:any;for await(const record of readArchive(await archiveStream(service)))if(record.kind==='manifest')manifest=record;
 return manifest;
}
async function legacyRecords(input: any, value: unknown) {
 const service=await portability(input.db,false),legacy=await validateArchive(value);
 const data:Record<string,any[]>={...legacy,...Object.fromEntries(deliveryTables.map(table=>[table,[]])),alerts:legacy.alerts.map((row:any)=>({...row,payload:null})),alert_rules:[],alert_history:[],repairs:[],repair_checks:[],rer_erasure_operations:[],...emptyLinkTables(),...emptyExecutionTables()};
 const template=await templateManifest(service);
 return restoreRows(service,data,{...template,sourceIdentity:crypto.randomUUID(),epoch:0,journal:[],exportedAt:new Date().toISOString()});
}
async function restoreRows(service:any,data:Record<string,any[]>,input:any){
 const manifest={...input,tables:input.tables.map((table:any)=>({...table,count:data[table.name].length}))};
 const parts: any[] = []; let items: any[] = [], size = 0;
 for (const table of manifest.tables) for (const [index, row] of data[table.name].entries()) {
  const item = { kind: 'row', table: table.name, index, row, ...(table.rowidAlias ? { rowid: index + 1 } : {}) };
  const bytes = new TextEncoder().encode(JSON.stringify(item)).length;
  if (items.length && (size + bytes > 1024 * 1024 || items.length >= 500)) { parts.push(await makePart(parts.length, items)); items = []; size = 0; }
  items.push(item); size += bytes;
 }
 if (items.length) parts.push(await makePart(parts.length, items));
 manifest.partCount = parts.length;
 let id, complete = false;
 const binding = new ArchiveVerifier(manifest); for (const part of parts) binding.add(part);
 try { id = await service.imports.create(manifest); for (const part of parts) await service.imports.uploadPart(id, part.index, part); await service.imports.finalize(id, { archiveHash: binding.digest() }); complete = true; }
 finally { if (id && !complete) await service.imports.abort(id); }
}
export type LaterJournal = { sourceIdentity: string; epoch: number; journal: string[] };
/** A later archive of the same installation: its verified manifest's erasure journal also fences this restore. */
export async function laterJournalOf(source: ReadableStream<Uint8Array>): Promise<LaterJournal> {
 let later: LaterJournal | undefined;
 for await (const record of readArchive(source)) if (record.kind === 'manifest') later = { sourceIdentity: record.sourceIdentity, epoch: record.epoch, journal: record.journal };
 if (!later) throw new PortabilityError('later_journal');
 return later;
}
export async function restoreStream(service: any, source: ReadableStream<Uint8Array>, laterJournal?: LaterJournal) {
 await restoreArchive(service, source, laterJournal);
 // An archive made before short IDs restores its issues without them: they are numbered
 // now, in first-seen order, as migration 0059 numbered the source. Current archives keep theirs.
 await ensureShortIds(service.db);
 await ensureIssuePriorities(service.db);
 await ensureRecurrenceBoundaries(service.db);
}
/** The archive restore alone, as releases before short IDs ran it. */
export async function restoreArchive(service: any, source: ReadableStream<Uint8Array>, laterJournal?: LaterJournal) {
 const [probe, input] = source.tee();
 const reader = probe.getReader(); let prefix = '', done = false;
 try {
  while (!prefix.includes('\n') && !done && prefix.length <= 16 * 1024 * 1024) {
   const chunk = await reader.read(); done = chunk.done; if (chunk.value) prefix += new TextDecoder().decode(chunk.value, { stream: !done });
  }
 } finally { void reader.cancel(); }
 let first; try { first = JSON.parse(prefix.split('\n')[0]); } catch { /* Pretty legacy JSON is decoded below. */ }
 // Only a current or later-additive archive carries the journal identity a later archive can extend.
 if(laterJournal&&(first?.kind!=='manifest'||isPreviousSchema(first.schema)))throw new PortabilityError('later_journal');
 if(first?.kind==='manifest'&&isPreviousSchema(first.schema)){
  const previous=await readPreviousArchive(input),legacy=await portability(service.db,false);
  const normalized=await normalizePreviousArchive(previous,await templateManifest(legacy));
  return restoreRows(legacy,normalized.data,normalized.manifest);
 }
 if (first?.kind === 'manifest') {
  const carried = Array.isArray(first.payloads) && first.payloads.some((payload: any) => payload?.name === SAFE_AUDIT_PAYLOAD);
  return importRecords(carried ? service : await portability(service.db, false), input, await earlierManifest(service.db, first) ? service.db : undefined, laterJournal);
 }
 const legacyReader = input.getReader(); let count = 0, text = ''; const decoder = new TextDecoder();
 try {
  for (;;) { const next = await legacyReader.read(); if (next.done) break; count += next.value.length; if (count > 16 * 1024 * 1024) throw new Error('Legacy archive exceeds 16 MiB'); text += decoder.decode(next.value, { stream: true }); }
  text += decoder.decode(); return await legacyRecords(service, JSON.parse(text));
 } finally { await legacyReader.cancel(); }
}
