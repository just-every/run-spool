import type { DoorRequest, DoorSnapshot } from '../../modules/import-kit/src/door/types.ts';
import type { PersistedImport, SourceRecord } from '../../modules/import-kit/src/types.ts';
import { DoorError } from '../../modules/import-kit/src/door/protocol.ts';
import { authorized, erasedSince, loadSnapshot, planRow } from '../../modules/import-kit/src/door/store.ts';
import { readD1PersistedImport } from '../../modules/import-kit/src/d1/index.ts';
import { attachmentHash, canonicalJson, sha256 } from '../../modules/import-kit/src/provenance/identity.ts';
import { recordLabel, snapshotOrganization } from './read-labels';
import { importReadReasons, rejectionReasonCode, unknownJobTimes } from './read-reasons';

/** Publication fence for these additive reads: the same current owner and
 * destination erasure epoch as the door, without a journal or native write. */
export async function finishOwnerRead(request: DoorRequest) {
 if (await erasedSince(request)) throw new DoorError('erased_during_request', 410);
 await authorized(request);
}
export function readOwnerInventory(request: DoorRequest) {
 return readD1PersistedImport({destination:request.options.destination, namespace:request.access.namespace,
  mappingVersion:request.options.mapping.version,
  storage:{database:request.options.database, targets:request.options.targets},
  authorization:{principalId:request.options.ownerPrincipalId, predicate:() => request.authority}});
}

type Blocker = {reasonCode:'native_edit_conflict'|'import_superseded'; kind:string; label:string|null; labelReasonCode:string|null};
function blocker(reasonCode:Blocker['reasonCode'], kind:string, sourceIdentity:string, snapshot:DoorSnapshot|null):Blocker {
 const source = snapshot?.plan.entries.find(e => e.identity === sourceIdentity)?.source;
 return {reasonCode, kind, ...(source && snapshot ? recordLabel(source,snapshot) : {label:null,labelReasonCode:snapshot ? 'record_label_unavailable' : 'snapshot_withdrawn'})};
}

/** Exact native comparisons match strict undo. This is a read of what blocks
 * undo now; undo itself still rechecks its own original guards on every step. */
async function undoAvailability(request:DoorRequest, job:{id:string;state:string}|null, snapshot:DoorSnapshot|null, inventory:PersistedImport) {
 const blockers:Blocker[] = [];
 if (!job || ['undone','rolled_back'].includes(job.state)) return {available:false,blockers};
 const historical = await request.options.database.prepare('SELECT target_kind,source_identity FROM ik_d1_history WHERE job_id=? ORDER BY ordinal,effect_ordinal').bind(job.id).all<{target_kind:string;source_identity:string}>();
 for (const row of historical.results) {
  const entry = snapshot?.plan.entries.find(e => e.identity === row.source_identity);
  blockers.push(blocker('import_superseded',entry?.source.kind ?? row.target_kind,row.source_identity,snapshot));
 }
 const native = new Map(inventory.rows.map(row => [canonicalJson([row.targetKind,row.targetId]),row]));
 for (const p of inventory.provenance.filter(p => p.jobId === job.id && !p.reversed)) {
  const current = native.get(canonicalJson([p.targetKind,p.targetId]));
  if (!current || current.revision !== p.appliedRevision || sha256(canonicalJson(current.value)) !== p.valueHash || attachmentHash(current.attachment) !== p.attachmentHash) {
   blockers.push(blocker('native_edit_conflict',p.sourceKind,p.sourceIdentity,snapshot));
  }
 }
 return {available:blockers.length === 0,blockers};
}

/** Read the immutable reviewed snapshot with Base's custody checks; never
 * reconstruct erased labels or counts from a different copy of the export. */
export async function readOwnerPlan(request:DoorRequest, planId:string, inventory?:PersistedImport) {
 await authorized(request);
 const row = await planRow(request,planId), db = request.options.database;
 let snapshot:DoorSnapshot|null;
 try { snapshot = await loadSnapshot(request,row); }
 catch (error) {
  if (!(error instanceof DoorError && error.code === 'snapshot_withdrawn')) throw error;
  snapshot = null;
 }
 const job = row.job_id ? await db.prepare('SELECT id,state,total,checkpoint FROM ik_jobs WHERE id=?').bind(row.job_id).first<{id:string;state:string;total:number;checkpoint:number}>() : null;
 const live = inventory ?? (job ? await readOwnerInventory(request) : {rows:[],provenance:[]});
 const representedProjects = new Set(snapshot?.records.flatMap(r => r.targets.filter(t => t.kind === 'project').map(t => t.id)) ?? []);
 const projectIds = snapshot ? live.rows.filter(r => r.targetKind === 'project' && representedProjects.has(r.targetId)).map(r => r.targetId).sort() : null;
 const organization = snapshot ? snapshotOrganization(snapshot) : null;
 const rejected = snapshot?.plan.entries.filter(e => e.rejection).map(entry => ({kind:entry.source.kind,sourceId:entry.source.sourceId,
  reason:entry.rejection!, reasonCode:rejectionReasonCode(entry.rejection!), ...recordLabel(entry.source,snapshot!)})) ?? null;
 const details = {organization, organizationReasonCode:organization === null ? (snapshot ? 'organization_unavailable' : 'snapshot_withdrawn') : null,
  projectIds, projectIdsReasonCode:snapshot ? null : 'snapshot_withdrawn',
  counts:snapshot?.plan.counts ?? null, countsReasonCode:snapshot ? null : 'snapshot_withdrawn',
  rejected, rejectedReasonCode:snapshot ? null : 'snapshot_withdrawn',
  undo:await undoAvailability(request,job,snapshot,live),
  ...unknownJobTimes()};
 await finishOwnerRead(request);
 return details;
}

/** Enrich only owner-facing responses. Business grants retain their existing
 * transport. No mapping, fingerprint, job or journal is changed here. */
export async function ownerReadResponse(request:DoorRequest, response:Response, action:string) {
 if (!response.ok || !['plan','status','reconcile','apply','undo'].includes(action)) return response;
 const body = await response.json() as Record<string,any>;
 if (body.job) body.job = {...body.job,...unknownJobTimes()};
 if (['plan','status','reconcile'].includes(action) && typeof body.planId === 'string') {
  const details = await readOwnerPlan(request,body.planId);
  // Preserve every original field, including reconcile's native by-kind counts.
  const {counts,rejected,...facts} = details;
  Object.assign(body,facts,{recordCounts:counts,recordCountsReasonCode:details.countsReasonCode});
  if (action === 'plan' && rejected) body.rejected = rejected;
 }
 body.reasonLabels = importReadReasons;
 await finishOwnerRead(request);
 return Response.json(body,{status:response.status,headers:response.headers});
}
