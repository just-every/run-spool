import type { SourceBundle, SourceRecord, ImportMapping } from '../../modules/import-kit/src/types';
import { organizationMapping } from '../sentry-import/mapping';
import { bugsnagEvent, releaseIdentity } from './event';
import { mappingVersion } from './source';
const states:Record<string,string>={open:'unresolved',fixed:'resolved',ignored:'ignored',snoozed:'ignored'};
/** Translate vendor fields into the shared inert native graph, retaining original source rows. */
export function bugsnagMapping(bundle:SourceBundle,operationKey:string):ImportMapping {
 const translated=new Map<string,SourceRecord>();
 for(const record of bundle.records){
  const p=record.payload as any,d=p.data;let kind=record.kind,data=d;
  if(kind==='projects')data={id:d.id,slug:d.id,name:d.name,dateCreated:d.created_at};
  if(kind==='releases')data={version:releaseIdentity(d.app_version,d.release_stage,d.app_version_code??d.app_bundle_version),dateCreated:d.release_time,projects:[{slug:p.project}]};
  if(kind==='errors'){kind='issues';data={id:d.id,title:`${d.error_class}: ${d.message}`,status:states[d.status]??d.status,firstSeen:d.first_seen,lastSeen:d.last_seen};}
  if(kind==='events')data={...d,eventID:bugsnagEventId(record),groupID:d.error_id,__organization:p.organization,__project:p.project};
  translated.set(JSON.stringify([record.kind,record.sourceId]),{...record,kind,payload:kind==='manifest'?record.payload:{...p,data}});
 }
 const native=organizationMapping({...bundle,records:[...translated.values()]},operationKey,'bugsnag',data=>bugsnagEvent(data,data.__organization,data.__project));
 return {version:mappingVersion,map(record){
  const converted=translated.get(JSON.stringify([record.kind,record.sourceId]))!;
  const result=native.map(converted),d=(record.payload as any).data;
  if(d){
   const represented:Record<string,string[]>={projects:['id','name','created_at'],errors:['id','error_class','message','status','first_seen','last_seen'],events:['id','error_id','exceptions','threads','app','received_at','breadcrumbs','severity'],releases:['id','app_version','app_version_code','app_bundle_version','release_stage','release_time']};
   result.unmapped=Object.keys(d).filter(key=>!(represented[record.kind]??[]).includes(key)).map(field=>({field,reason:'Retained in private Bugsnag source custody only; not activated in Spool.'}));
   if(record.kind==='events')result.unmapped.push({field:'exceptions',reason:'Exported stack locations and native addresses are retained as evidence; private metadata and source text are excluded. Exported symbolication is not fresh native symbol decoding.'});
   for(const effect of result.effects){const value=effect.value as any;if(record.kind==='events')value.source.id=d.id;}
  }
  return result;
 }};
}
function bugsnagEventId(record:SourceRecord){const p=record.payload as any;const event=bugsnagEvent(p.data,p.organization,p.project);return event.event.eventId;}
