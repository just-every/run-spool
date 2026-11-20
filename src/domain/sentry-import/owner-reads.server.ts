import { sentryFieldAccounting, sourceLeaves } from './source.ts';
import { rollbarComparison } from '../rollbar-import/comparison.ts';
import type { DoorRequest, DoorSnapshot } from '../../modules/import-kit/src/door/types.ts';
import type { PersistedImport } from '../../modules/import-kit/src/types.ts';
import { DoorError } from '../../modules/import-kit/src/door/protocol.ts';
import { authorized, erasedSince, loadSnapshot, planRow } from '../../modules/import-kit/src/door/store.ts';
import { readD1PersistedImport } from '../../modules/import-kit/src/d1/index.ts';
import { attachmentHash, canonicalJson, sha256 } from '../../modules/import-kit/src/provenance/identity.ts';
import { bugsnagReport } from '../bugsnag-import/report';
import { recordLabel, snapshotOrganization } from './read-labels';
import { importedRuleId, importedRuleStates } from './alert-approval';
import { localImportDestination, missingImportDestination } from '../alerts/import-state';
import { destinationKey, sentryRuleKinds, type AlertProposal } from './alert-rules';
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
 const comparison=snapshot?rollbarComparison(snapshot,live):undefined;
 const sentry=snapshot?await sentryAccounting(db,snapshot,live,job):undefined;
 const details = {...(sentry?{sentry}:{}),...(comparison?{comparison}:{}),...snapshot?{bugsnag:bugsnagReport(snapshot)}:{},organization, organizationReasonCode:organization === null ? (snapshot ? 'organization_unavailable' : 'snapshot_withdrawn') : null,
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

/** Value-free loss ledger, derived from the immutable plan rather than a caller's claimed totals. */
async function sentryAccounting(db:DoorRequest['options']['database'], snapshot:DoorSnapshot, live:PersistedImport, job:{id:string;state:string}|null) {
 const manifest=snapshot.plan.entries.find(entry=>entry.source.kind==='manifest');
 const meta=manifest?.source.payload as any;
 if(!meta?.organization?.slug||meta.vendor)return undefined;
 const records=snapshot.plan.source.records,entries=snapshot.plan.entries;
 const collections=[...new Set(records.filter(r=>r.kind!=='manifest').map(r=>r.kind))].map(kind=>{
  const source=records.filter(r=>r.kind===kind),unique=entries.filter(e=>e.source.kind===kind);
  return {kind,records:source.length,unique:unique.length,duplicates:source.length-unique.length,
   payloadBytes:source.reduce((n,r)=>n+new TextEncoder().encode(JSON.stringify((r.payload as any).data)).length,0),
   mapped:unique.filter(e=>e.effects.length).length,rejected:unique.filter(e=>e.rejection).length};
 });
 const alertEntries=entries.filter(entry=>sentryRuleKinds.includes(entry.source.kind));
 const proposals=alertEntries.flatMap(entry=>entry.effects.flatMap(effect=>{
  const native=(effect.value as any).native;
  return effect.targetKind==='import-proposal'&&native.kind==='alert'
   ? [{sourceId:entry.source.sourceId,id:native.id as string,project:native.project as string,data:JSON.parse(native.payload) as AlertProposal}] : [];
 }));
 const namesSeen=new Set(proposals.map(proposal=>proposal.id));
 const owned=new Set(live.provenance.filter(p=>p.jobId===job?.id&&!p.reversed&&p.targetKind==='import-proposal').map(p=>p.targetId));
 const applied=new Set(live.rows.filter(row=>row.targetKind==='import-proposal'&&namesSeen.has(row.targetId)).map(row=>row.targetId));
 const nativeRules=await importedRuleStates(db,[...applied]);
 const losses=proposals.flatMap(proposal=>proposal.data.omissions);
 const linkedMonitors=new Set(proposals.flatMap(proposal=>proposal.data.monitorLocation?[proposal.data.monitorLocation]:[]));
 const accounting=(entry:typeof entries[number])=>{
  const fields=sentryFieldAccounting(entry.source.kind,(entry.source.payload as any).data,entry.rejection);
  if(!sentryRuleKinds.includes(entry.source.kind)||entry.rejection)return fields;
  const location=entry.source.location.pointer??'';
  const projected=proposals.find(proposal=>proposal.data.location===location || proposal.data.monitorLocation===location)?.data;
  const represented=projected?.settings;
  const settingFields: Record<string,RegExp> = {
   rules:/^\/(environment|frequency|actionMatch|filterMatch)$|^\/(conditions|filters)\/\d+\/(id|interval|value|key|match|level)$/,
   metric_alerts:/^\/(aggregate|dataset|eventTypes|environment|query|timeWindow|thresholdType|resolveThreshold)(\/|$)|^\/triggers\/\d+\/(label|alertThreshold)$/,
   workflows:/^\/detectorIds\/\d+$|^\/triggers\/conditions\/\d+\/(type|comparison|conditionResult)$/,
   detectors:/^\/dataSources\/0\/queryObj\/snubaQuery\/(aggregate|dataset|eventTypes|environment|query|timeWindow)(\/|$)|^\/conditionGroup\/conditions\/0\/(type|comparison|conditionResult)(\/|$)/,
  };
  return fields.map(field=>{
   if(field.disposition==='redacted')return field;
   const path=location+field.path, blocker=losses.find(item=>path===item.path||path.startsWith(item.path+'/'));
   if(blocker)return {...field,reason:blocker.reason};
   if(projected&&/^\/(id|name|owner|ownerActor|dateCreated|dateModified|lastTriggered|lastTriggeredAt|lastIncident)(\/|$)/.test(field.path))return {...field,disposition:'mapped' as const,reason:'Retained in the private source definition and linked by the rule proposal.'};
   if(represented&&settingFields[entry.source.kind].test(field.path))return {...field,disposition:'transformed' as const,reason:'Converted to the proposed native rule settings.'};
   if(projected?.destinations.some(destination=>path.startsWith(destination.path+'/')&&/\/(type|id|targetType|targetIdentifier|target_type|target_identifier|fallthroughType|fallthrough_type)$/.test(path)))return {...field,disposition:'transformed' as const,reason:'Linked to a destination for approval review.'};
   return field;
  });
 };
 const fields=entries.filter(e=>e.source.kind!=='manifest').flatMap(entry=>{
  return accounting(entry).map(field=>({kind:entry.source.kind,sourceId:entry.source.sourceId,location:entry.source.location.pointer??null,...field}));
 });
 const arrays=entries.filter(e=>e.source.kind!=='manifest').flatMap(entry=>{
  const result:{kind:string;sourceId:string;path:string;elements:number;omitted:number[]}[]=[];
  const local=new Map(accounting(entry).map(f=>[f.path,f.disposition]));
  const walk=(value:any,path='')=>{
   if(Array.isArray(value))result.push({kind:entry.source.kind,sourceId:entry.source.sourceId,path,elements:value.length,
    omitted:value.flatMap((child:any,i:number)=>sourceLeaves(child,`${path}/${i}`).every(leaf=>['unmapped','rejected'].includes(local.get(leaf.path)??''))?[i]:[])});
   if(value&&typeof value==='object')for(const [key,child] of Object.entries(value))walk(child,`${path}/${key.replace(/~/g,'~0').replace(/\//g,'~1')}`);
  };walk((entry.source.payload as any).data);return result;
 });
 const targetIds=new Set(snapshot.records.flatMap(record=>record.targets.map(target=>canonicalJson([target.kind,target.id]))));
 const native=live.rows.filter(row=>targetIds.has(canonicalJson([row.targetKind,row.targetId])));
 const loaders=entries.filter(e=>e.source.kind==='keys').map(entry=>{
  const p=entry.source.payload as any,d=p.data;
  return {sourceId:entry.source.sourceId,project:p.project,sourceKeyId:d.id,settings:{isActive:d.isActive??null,rateLimit:d.rateLimit??null,browserSdkVersion:d.browserSdkVersion??null,dynamicSdkLoaderOptions:d.dynamicSdkLoaderOptions??null},replacementScriptTag:null,
   reason:'No key was minted. Create a Spool ingest key and approve its loader settings before replacing the source script.'};
 });
 const fieldGroups=new Map<string,typeof fields>();
 for(const field of fields){const key=canonicalJson([field.kind,field.sourceId]);const group=fieldGroups.get(key)??[];group.push(field);fieldGroups.set(key,group)}
 const byteLedger=entries.filter(e=>e.source.kind!=='manifest').map(entry=>{
  const source=records.filter(r=>r.kind===entry.source.kind&&r.sourceId===entry.source.sourceId);
  const sourceBytes=source.reduce((n,r)=>n+new TextEncoder().encode(JSON.stringify((r.payload as any).data)).length,0);
  const targets=snapshot.records.find(r=>r.kind===entry.source.kind&&r.sourceId===entry.source.sourceId)?.targets??[];
  const present=native.filter(row=>targets.some(target=>target.kind===row.targetKind&&target.id===row.targetId));
  const nativeBytes=present.reduce((n,row)=>n+new TextEncoder().encode(canonicalJson(row.value)).length,0);
  const own=fieldGroups.get(canonicalJson([entry.source.kind,entry.source.sourceId]))??[];
  return {kind:entry.source.kind,sourceId:entry.source.sourceId,sourceBytes,nativeBytes,difference:sourceBytes-nativeBytes,
   duplicates:source.length-1,unmappedFields:own.filter(f=>f.disposition==='unmapped').length,transformedFields:own.filter(f=>f.disposition==='transformed').length,
   targets:present.map(row=>({kind:row.targetKind,id:row.targetId})),
   reason:entry.rejection?'Rejected record has no native bytes.':!targets.length?'Unsupported record has no native bytes.':'Native projection includes converted fields, derived identities and source provenance; omitted fields and repeated source rows are counted separately.'};
 });
 const items=proposals.map(proposal=>{
  const {data}=proposal,rule=nativeRules.get(importedRuleId(proposal.id));
  const destinationKinds=[...new Set(data.destinations.map(destination=>destination.kind))];
  const needs=rule?.destination===missingImportDestination?'Needs a destination: '+destinationKinds.join(', '):null;
  const uniqueDestinations=new Set(data.destinations.map(destinationKey));
  const unrepresented=uniqueDestinations.size>1?[...data.omissions,{path:data.location,reason:'Multiple destinations require a native choice'}]:data.omissions;
  const reversed=job?.state==='undone'||job?.state==='rolled_back';
  const state=reversed?'withdrawn':rule?rule.waiting?'waiting':rule.enabled?'active':'disabled'
   :job?.state==='completed'&&applied.has(proposal.id)&&owned.has(proposal.id)?'pending':'proposed';
  return {id:proposal.id,name:data.name,project:proposal.project,location:data.location,state,
   ruleId:reversed?null:rule?.id??null,status:reversed?'Import undone':rule?.waiting??needs??(state==='pending'?'Waiting for your approval':state==='proposed'?'Proposed':rule?.enabled?'Rule created and active':'Rule created disabled'),
   settings:data.settings,destinations:data.destinations.map(d=>({kind:d.kind,path:d.path})),scope:data.monitorLocation??null,
   omissions:unrepresented,local:rule?.destination===localImportDestination};
 });
 const missing=alertEntries.filter(entry=>!proposals.some(proposal=>proposal.sourceId===entry.source.sourceId)
   && !(entry.source.kind==='detectors'&&linkedMonitors.has(entry.source.location.pointer??'')));
 for(const entry of missing){
  const location=entry.source.location.pointer??'';
  items.push({id:entry.identity,name:recordLabel(entry.source,snapshot).label??'Alert rule',project:'',location,state:entry.rejection?'rejected':'unsupported',ruleId:null,
   status:entry.rejection?'Rule refused':'Rule definition not carried over',settings:null,destinations:[],scope:null,local:false,
   omissions:[{path:location,reason:entry.rejection?'Invalid rule definition':'This import contains the original rule definition'}]});
 }
 const pending=items.filter(item=>item.state==='pending').length, created=items.filter(item=>item.ruleId).length;
 const rules={sourceDefinitions:alertEntries.length,notImported:missing.length,pending,created,items};
 return {collections,fields,arrays,loaders,byteLedger,rules,capture:meta.capture??null,
  sourcePayloadBytes:collections.reduce((n,c)=>n+c.payloadBytes,0),
  nativeBytes:native.reduce((n,row)=>n+new TextEncoder().encode(canonicalJson(row.value)).length,0),
  byteReason:'Source payload bytes include duplicates and unsupported fields. Native bytes count present target values and provenance; scrubbing, projection, deduplication and derived identities change their encoding. These totals are not expected to match.'};
}
