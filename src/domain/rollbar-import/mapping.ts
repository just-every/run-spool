import type { ImportMapping, MappingResult, ParsedRecord, SourceRecord } from '../../modules/import-kit/src/types.ts';
import { canonicalJson, sha256 } from '../../modules/import-kit/src/provenance/identity.ts';
import { identity, scrub } from '../privacy.ts';
import { absentDist } from '../releases/build.ts';
import { sourceText } from '../sentry-import/source.ts';
import { eventId, fingerprint, issueId, mappingVersion, projectId, sourceId, timestamp } from './identity.ts';
import { occurrenceEvent } from './event.ts';
const state=(value:any)=>({active:'open',resolved:'resolved',muted:'suppressed',archived:'suppressed',1:'open',2:'resolved',3:'suppressed'} as Record<string,string>)[value];
const nativeSource=(project:string,id:string)=>({vendor:'rollbar',organization:'rollbar',project,id});
const effects=(kind:string,id:string,native:any,source:any):MappingResult=>({effects:[{targetKind:kind,targetId:id,value:{native,source}}]});
export function rollbarMapping(records: ParsedRecord[], operationKey: string): ImportMapping {
 const project=(records[0].payload as any).project,id=projectId(project);
 const items=new Map(records.filter(row=>row.kind==='items').map(row=>[row.sourceId,(row.payload as any).data]));
 const errors=new Map<string,string>(),events=new Map<string,ReturnType<typeof occurrenceEvent>>(),counts=new Map<string,number>();
 const releases=new Map<string,{created:number;seq:number}>();
 for(const [key,item] of items) {
  try {
   if (!state(item.status)) throw new Error('Unsupported Rollbar item status');
   if (item.group_status===2) throw new Error('Rollbar aggregate item occurrence membership unavailable; export constituent items separately');
   sourceText(item.title,'Rollbar item title');
   if (timestamp(item.first_occurrence_timestamp)>timestamp(item.last_occurrence_timestamp)) throw new Error('Reversed Rollbar item times');
  } catch(error) {errors.set('item:'+key,(error as Error).message);}
 }
 for(const row of records.filter(row=>row.kind==='occurrences')) {
  const data=(row.payload as any).data;
  try {
   const item=sourceId(data.item_id);
   if(!items.has(item) || errors.has('item:'+item)) throw new Error('Occurrence item missing or rejected');
   const decoded=occurrenceEvent(project,data); events.set(row.sourceId,decoded);
   const release=decoded.event.release,old=releases.get(release);
   if(release)releases.set(release,{created:Math.min(old?.created??decoded.received,decoded.received),seq:0});
   counts.set(item,(counts.get(item)??0)+1);
  } catch(error) {errors.set('occurrence:'+row.sourceId,(error as Error).message);}
 }
 // Native release order is historical only. Deploy states and environments stay
 // in source history, never executed CI jobs or successful-release authority.
 for(const row of records.filter(row=>row.kind==='deploys')) {
  const data=(row.payload as any).data;
  try {
   const revision=identity(data.revision,'release'),created=timestamp(data.start_time);
   const old=releases.get(revision); releases.set(revision,{created:Math.min(old?.created??created,created),seq:0});
  } catch(error) {errors.set('deploy:'+row.sourceId,(error as Error).message);}
 }
 [...releases].sort((a,b)=>a[1].created-b[1].created||a[0].localeCompare(b[0])).forEach(([,release],index)=>release.seq=index+1);
 // One record owns each release, even when many deploys share a revision.
 const owners=new Map<string,string>();
 for(const row of records.filter(row=>row.kind==='deploys')) if(!errors.has('deploy:'+row.sourceId)) {const revision=(row.payload as any).data.revision;if(!owners.has(revision))owners.set(revision,'deploys:'+row.sourceId);}
 for(const [key,{event}] of events) if(event.release && !owners.has(event.release)) owners.set(event.release,'occurrences:'+key);
 const releaseEffect=(release:string)=>{const meta=releases.get(release)!;return effects('release',JSON.stringify([id,release]),{project:id,name:release,seq:meta.seq,build:absentDist,created:meta.created},nativeSource(project,release)).effects;};
 return {version:mappingVersion,map(record:SourceRecord):MappingResult {
  const data=(record.payload as any).data;
  const retained={reason:'Exact source retained privately; not activated in Spool. Source assignments, comments, tracker links, fingerprints and notification settings require explicit native review.'};
  try {
   if(record.kind==='manifest') return {effects:[],unmapped:[{reason:'Export time and named unavailable data retained in the private import journal.'}]};
   if(record.kind==='projects') return effects('project',id,{id,name:scrub(sourceText(data.name,'Rollbar project name')),created:timestamp(data.date_created)},nativeSource(project,project));
   if(record.kind==='items') {
    if(errors.has('item:'+record.sourceId)) throw new Error(errors.get('item:'+record.sourceId));
    const ceiling=releases.size;
    return {...effects('issue',issueId(project,record.sourceId),{id:issueId(project,record.sourceId),project:id,fingerprint:fingerprint(project,record.sourceId),algorithm:'rollbar-import-v1',title:scrub(data.title),state:state(data.status),revision:1,count:counts.get(record.sourceId)??0,first_seen:timestamp(data.first_occurrence_timestamp),last_seen:timestamp(data.last_occurrence_timestamp),resolved_seq:state(data.status)==='resolved'?ceiling:null,latest_release_seq:ceiling},nativeSource(project,record.sourceId)),unmapped:[retained,{field:'total_occurrences',reason:'Native count is retained imported occurrence count. Rollbar total_occurrences is since last resolution and is not a full-history denominator.'}]};
   }
   if(record.kind==='deploys') {
    if(errors.has('deploy:'+record.sourceId)) throw new Error(errors.get('deploy:'+record.sourceId));
    return {effects:owners.get(data.revision)==='deploys:'+record.sourceId?releaseEffect(data.revision):[],unmapped:[{field:'deploy',reason:'Revision and historical ordering imported. Environment, status, actor and deploy timestamps retained as read-only source; no deploy or notification is executed.'}]};
   }
   if(record.kind==='occurrences') {
    if(errors.has('occurrence:'+record.sourceId)) throw new Error(errors.get('occurrence:'+record.sourceId));
    const {event,received}=events.get(record.sourceId)!,payload=JSON.stringify(event),digest=sha256(canonicalJson(event));
    const diagnostic=JSON.stringify(event.frames.map(generated=>({generated,status:'imported_raw_stack',source:'rollbar-api-export'})));
    const seed=sha256(JSON.stringify([operationKey,record.sourceId]));
    const occurrence=`${seed.slice(0,8)}-${seed.slice(8,12)}-4${seed.slice(13,16)}-8${seed.slice(17,20)}-${seed.slice(20,32)}`;
    const result=effects('event',JSON.stringify([id,event.eventId]),{id:event.eventId,project:id,issue:issueId(project,sourceId(data.item_id)),release:event.release,release_seq:event.release?releases.get(event.release)!.seq:0,build:event.build,environment:event.environment,payload,digest,diagnostic,received,occurrence,historical:1},nativeSource(project,record.sourceId));
    if(owners.get(event.release)==='occurrences:'+record.sourceId)result.effects.push(...releaseEffect(event.release));
    result.unmapped=[{field:'data',reason:'Trace exception chain and located frames, environment, code version and message telemetry are scrubbed into native evidence. Custom, person, request, locals and source text remain private source only. Missing columns, unlocated frames and frames beyond the native view remain in retained source; reupload maps for fresh verification.'}];
    return result;
   }
   return {effects:[],unmapped:[retained]};
  } catch(error) {return {effects:[],rejection:(error as Error).message};}
 }};
}
