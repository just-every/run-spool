import type { DoorSnapshot } from '../../modules/import-kit/src/door/types.ts';
import type { PersistedImport } from '../../modules/import-kit/src/types.ts';
import { scrub } from '../privacy.ts';
import { file } from '../frame-path.ts';
import { eventId, issueId, projectId } from './identity.ts';
const text=(value:unknown)=>typeof value==='string'?scrub(value):null;
const scalar=(value:unknown)=>typeof value==='number'||typeof value==='string'?text(String(value)):null;
/** Owner-only comparisons of preserved source facts with CURRENT native rows. */
export function rollbarComparison(snapshot: DoorSnapshot, inventory: PersistedImport) {
 const source=snapshot.plan.source.records,manifest=source.find(row=>row.kind==='manifest')?.payload as any;
 if(manifest?.vendor!=='rollbar')return undefined;
 const project=manifest.project,id=projectId(project);
 const rows=inventory.rows.filter(row=>{const meta=(row.value as any).source;return meta?.vendor==='rollbar'&&meta.project===project;});
 const native=(kind:string,key:string)=>(rows.find(row=>row.targetKind===kind&&row.targetId===key)?.value as any)?.native??null;
 const records=[...new Map(source.map(row=>[JSON.stringify([row.kind,row.sourceId]),row])).values()];
 const items=records.filter(row=>row.kind==='items').map(row=>{
  const data=(row.payload as any).data,current=native('issue',issueId(project,row.sourceId));
  return {sourceId:row.sourceId,title:text(data.title),status:data.status,nativeState:current?.state??null,
   firstOccurrence:data.first_occurrence_timestamp,lastOccurrence:data.last_occurrence_timestamp,
   sourceOccurrencesSinceResolution:data.total_occurrences??null,retainedOccurrences:records.filter(r=>r.kind==='occurrences'&&String((r.payload as any).data.item_id)===row.sourceId).length,nativeOccurrences:current?.count??null,
   assignment:{user:scalar(data.assigned_user_id),team:scalar(data.assigned_team_id),disposition:'retained_only'},
   fingerprint:text(data.hash),trackerLinks:data.integrations_data==null?'unavailable':'retained_only',
   lastResolved:data.last_resolved_timestamp??null,lastActivated:data.last_activated_timestamp??null};
 });
 const stacks=records.filter(row=>row.kind==='occurrences').map(row=>{
  const data=(row.payload as any).data,current=native('event',JSON.stringify([id,eventId(project,row.sourceId)])),event=current?JSON.parse(current.payload):null;
  const chain=data.data.body?.trace_chain??(data.data.body?.trace?[data.data.body.trace]:[]);
  return {sourceId:row.sourceId,itemId:String(data.item_id),environment:text(data.data.environment),codeVersion:text(data.data.code_version),
   sourceFrames:chain.flatMap((trace:any)=>(trace.frames??[]).map((frame:any)=>({file:typeof frame.filename==='string'?file(frame.filename):null,line:frame.lineno??null,column:frame.colno??null,function:text(frame.method)}))),
   nativeFrames:event?.frames??null,nativeEnvironment:event?.environment??null,nativeRelease:event?.release??null,historical:current?.historical===1};
 });
 const deploys=records.filter(row=>row.kind==='deploys').map(row=>{
  const data=(row.payload as any).data,current=native('release',JSON.stringify([id,data.revision]));
  return {sourceId:row.sourceId,revision:text(data.revision),environment:text(data.environment),status:text(data.status),start:data.start_time,finish:data.finish_time??null,
   nativeRelease:current?{name:current.name,created:current.created,build:current.build}:null,disposition:'historical_only'};
 });
 const rules=records.filter(row=>row.kind==='notification_rules').map(row=>{
  const payload=row.payload as any;
  return {channel:payload.channel,disposition:'retained_disabled',rules:Array.isArray(payload.data)?payload.data.map((rule:any)=>({id:scalar(rule.id),status:text(rule.status),action:text(rule.action),trigger:text(rule.trigger),filterCount:Array.isArray(rule.filters)?rule.filters.length:null})):null};
 });
 const history=records.filter(row=>row.kind==='item_events').map(row=>{
  const payload=row.payload as any;
  return {itemId:payload.item,events:Array.isArray(payload.data.events)?payload.data.events.map((event:any)=>({id:scalar(event.id),type:text(event.type),timestamp:event.timestamp??null,text:text(event.text??event.comment)})):null,disposition:'retained_only'};
 });
 const sourceCounts=Object.fromEntries([...new Set(records.map(row=>row.kind))].map(kind=>[kind,records.filter(row=>row.kind===kind).length]));
 return {vendor:'rollbar',project,sourceCounts,nativeCounts:Object.fromEntries(['project','issue','event','release'].map(kind=>[kind,rows.filter(row=>row.targetKind===kind).length])),
  items,stacks,deploys,rules,history,ruleCount:rules.reduce((n,row)=>n+(row.rules?.length??0),0),historyEventCount:history.reduce((n,row)=>n+(row.events?.length??0),0),unavailable:manifest.unavailable.map((entry:any)=>({kind:text(entry.kind),reason:text(entry.reason),...(entry.item!==undefined?{item:scalar(entry.item)}:{}),...(entry.channel!==undefined?{channel:text(entry.channel)}:{})})),
  policy:'Source rules, assignments and history are inert; recreate native rules and destinations explicitly. Retained source never grants credentials or executes work.'};
}
