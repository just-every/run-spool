import type { DoorSnapshot } from '../../modules/import-kit/src/door/types';
import { safeImportLabel } from '../sentry-import/read-labels';
import { nativeFrames, nativeStackReason } from './native';
const count=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0?Number(value):null;
/** Events whose native frames only a Mach-O or ELF debug file could name; Spool cannot read those files yet. */
function nativeStacks(events:ReturnType<typeof nativeFrames>[]){
 const native=events.filter(e=>e.frames>0);
 if(!native.length)return {};
 return {nativeStacks:{events:native.length,frames:native.reduce((n,e)=>n+e.frames,0),machoUuids:[...new Set(native.flatMap(e=>[...e.machoUuids]))].sort(),buildIds:[...new Set(native.flatMap(e=>[...e.buildIds]))].sort(),symbolication:'unsupported',reason:nativeStackReason}};
}
/** Source aggregates never enter live session or exposure tables. */
export function bugsnagReport(snapshot:DoorSnapshot) {
 const records=[...new Map(snapshot.plan.source.records.map(r=>[JSON.stringify([r.kind,r.sourceId]),r])).values()];
 const manifest=records.find(r=>r.kind==='manifest');
 if((manifest?.payload as any)?.vendor!=='bugsnag')return undefined;
 const projects=records.filter(r=>r.kind==='projects').map(record=>{
  const p=(record.payload as any).data,rows=records.filter(r=>(r.payload as any).project===p.id);
  return {sourceId:p.id,name:safeImportLabel(p.name),sampledErrors:rows.filter(r=>r.kind==='errors').length,sampledEvents:rows.filter(r=>r.kind==='events').length,
   ...nativeStacks(rows.filter(r=>r.kind==='events').map(r=>nativeFrames((r.payload as any).data))),
   stability:rows.filter(r=>r.kind==='stability').map(record=>{
    const d=(record.payload as any).data;
    return {stage:safeImportLabel(d.release_stage_name),timeline:d.timeline_points.map((point:any)=>{
     const total=count(point?.total_sessions_count),unhandled=count(point?.unhandled_sessions_count);
     return {start:safeImportLabel(point?.bucket_start),end:safeImportLabel(point?.bucket_end),totalSessions:total,unhandledSessions:unhandled,crashFreeRate:null,
      denominatorStatus:total!==null&&total>0&&unhandled!==null&&unhandled<=total?'source_aggregate_only':'historical_sessions_unavailable'};
    })};
   }),
   releases:rows.filter(r=>r.kind==='releases').map(record=>{
    const d=(record.payload as any).data,total=count(d.total_sessions_count),unhandled=count(d.unhandled_sessions_count);
    const available=total!==null&&total>0&&unhandled!==null&&unhandled<=total;
    return {sourceId:d.id,appVersion:safeImportLabel(d.app_version),stage:safeImportLabel(d.release_stage?.name??d.release_stage),
     totalSessions:total,unhandledSessions:unhandled,crashFreeRate:null,
     denominatorStatus:available?'source_aggregate_only':'historical_sessions_unavailable',
     reason:available?'Source release aggregate, not reconstructed live sessions. No crash-free rate is inferred from sampled events.':'Historical session denominator is missing, zero or inconsistent. Crash-free rate is unavailable.'};
   })};
 });
 return {vendor:'bugsnag',window:(manifest!.payload as any).window,projects,
  losses:snapshot.plan.entries.flatMap(entry=>entry.unmapped.map(row=>({kind:entry.source.kind,sourceId:entry.source.sourceId,field:row.field??null,reason:row.reason}))),
  omissions:(manifest!.payload as any).omissions,
  semantics:'Imported events are sampled history. Event counts and source session aggregates are reconciled separately; neither creates live sessions or outbound work.'};
}
