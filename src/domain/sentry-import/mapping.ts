import { sha256, canonicalJson } from '../../modules/import-kit/src/provenance/identity.ts';
import type { ImportMapping, MappingResult, SourceBundle, SourceRecord } from '../../modules/import-kit/src/types.ts';
import { identity, scrub } from '../privacy.ts';
import { absentDist } from '../sentry/convert.ts';
import { apiEvent } from './event.ts';
import { mappingVersion, sourceText } from './source.ts';
export const nativeProject=(organization:string,slug:string)=>`sentry-${sha256(JSON.stringify([organization,slug])).slice(0,32)}`;
const nativeIssue=(organization:string,slug:string,id:string)=>sha256(JSON.stringify(['sentry',organization,slug,id]));
const time=(value:any)=>{const n=Date.parse(value);if(!Number.isSafeInteger(n)||n<0)throw new Error('Source timestamp required');return n};
const effects=(targetKind:string,targetId:string,native:any,source:any):MappingResult=>({effects:[{targetKind,targetId,value:{native,source}}]});
const omitted=(data:any,allowed:string[])=>Object.keys(data).filter(key=>!allowed.includes(key)).map(field=>({field,reason:'Not represented in Spool; exact source remains in the private import journal.'}));
/** Pure mapping: no credentials, lifecycle execution, alerts or SDK admission. */
export function organizationMapping(bundle:SourceBundle,operationKey:string):ImportMapping {
  sourceText(operationKey,'import operation key');
  const occurrence=(id:string)=>{const hex=sha256(JSON.stringify([operationKey,id]));return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`};
  const projects=new Map<string,any>(),releases=new Map<string,any>(),issues=new Map<string,any>(),decodedEvents=new Map<string,ReturnType<typeof apiEvent>>();
  const projectErrors=new Map<string,string>(),issueErrors=new Map<string,string>(),releaseErrors=new Map<string,string>();
  const eventErrors=new Map<string,string>(),counts=new Map<string,number>(),distSets=new Map<string,Set<string>>();
  for(const record of bundle.records){const p=record.payload as any;if(record.kind==='projects'){const slug=sourceText(p.data.slug,'project slug');if(projects.has(slug)&&canonicalJson(projects.get(slug))!==canonicalJson(p.data))throw new Error('Conflicting project slug');projects.set(slug,p.data)}if(record.kind==='issues')issues.set(JSON.stringify([p.project,p.data.id]),p.data)}
  for(const [slug,data] of projects){try{sourceText(data.name,'project name');time(data.dateCreated)}catch(error){projectErrors.set(slug,(error as Error).message)}}
  for(const [key,data] of issues){try{const [slug]=JSON.parse(key);if(!projects.has(slug)||projectErrors.has(slug))throw new Error('Issue project is missing or rejected');sourceText(data.id,'issue id');sourceText(data.title,'issue title');if(!['unresolved','resolved','ignored'].includes(data.status))throw new Error('Unsupported source issue state');if(time(data.firstSeen)>time(data.lastSeen))throw new Error('Issue timestamps are reversed')}catch(error){issueErrors.set(key,(error as Error).message)}}
  for(const record of bundle.records.filter(r=>r.kind==='events')){
    const p=record.payload as any;
    try {
      if(!projects.has(p.project)||projectErrors.has(p.project))throw new Error('Event project is missing or rejected');
      const issueId=sourceText(p.data.groupID,'event groupID');
      if(!issues.has(JSON.stringify([p.project,issueId]))||issueErrors.has(JSON.stringify([p.project,issueId])))throw new Error('Event issue is missing or rejected');
      const decoded=apiEvent(p.data);decodedEvents.set(record.sourceId,decoded);
      const key=JSON.stringify([p.project,decoded.event.release]);
      if(!distSets.has(key))distSets.set(key,new Set());distSets.get(key)!.add(decoded.event.build);
    }catch(error){eventErrors.set(record.sourceId,(error as Error).message)}
  }
  // Native release identity has one build. Ambiguous exported distributions are rejected explicitly.
  for(const record of bundle.records.filter(r=>r.kind==='releases')){
    const p=record.payload as any;
    try{
      identity(p.data.version,'release');time(p.data.dateCreated);
      if(!Array.isArray(p.data.projects)||!p.data.projects.length)throw new Error('Release project membership required');
      for(const project of p.data.projects){const slug=sourceText(project?.slug,'release project');if(!projects.has(slug)||projectErrors.has(slug))throw new Error('Release project is missing or rejected');if((distSets.get(JSON.stringify([slug,p.data.version]))?.size??0)>1)throw new Error('Multiple distributions for one release are outside the native release contract')}
      for(const project of p.data.projects)releases.set(JSON.stringify([project.slug,p.data.version]),p.data);
    }catch(error){releaseErrors.set(record.sourceId,(error as Error).message)}
  }
  const acceptedEvents=new Map<string,ReturnType<typeof apiEvent>>();
  const seenEvents=new Set<string>();
  for(const record of bundle.records.filter(r=>r.kind==='events')){
    const p=record.payload as any,decoded=decodedEvents.get(record.sourceId);if(!decoded)continue;
    const key=JSON.stringify([p.project,decoded.event.release]);
    if(!releases.has(key)){eventErrors.set(record.sourceId,'Event release missing from export');continue}
    if((distSets.get(key)?.size??0)>1){eventErrors.set(record.sourceId,'Multiple distributions for one release are outside the native release contract');continue}
    acceptedEvents.set(record.sourceId,decoded);
    if(!seenEvents.has(record.sourceId)){seenEvents.add(record.sourceId);const group=JSON.stringify([p.project,p.data.groupID]);counts.set(group,(counts.get(group)??0)+1)}
  }
  const seqs=new Map<string,number>();
  for(const slug of projects.keys()){
    const names=[...releases.entries()].filter(([key])=>JSON.parse(key)[0]===slug).sort((a,b)=>time(a[1].dateCreated)-time(b[1].dateCreated)||a[0].localeCompare(b[0]));
    names.forEach(([key],index)=>seqs.set(key,index+1));
  }
  return {version:mappingVersion,map(record:SourceRecord):MappingResult{
    const p=record.payload as any,data=p.data;
    if(record.kind==='manifest')return {effects:[],unmapped:[{reason:'Export window, declared omissions and organization metadata are retained for review; no account or credentials are created.'}]};
    try {
      const org=p.organization;
      const parentError=record.kind==='projects'?projectErrors.get(data.slug):record.kind==='releases'?releaseErrors.get(record.sourceId):record.kind==='issues'?issueErrors.get(JSON.stringify([p.project,data.id])):undefined;
      if(parentError)throw new Error(parentError);
      if(record.kind==='projects'){
        const slug=sourceText(data.slug,'project slug'),id=nativeProject(org,slug);
        const result=effects('project',id,{id,name:scrub(sourceText(data.name,'project name')),created:time(data.dateCreated)},{organization:org,project:slug,id:data.id});
        result.unmapped=omitted(data,['id','slug','name','dateCreated']);return result;
      }
      if(record.kind==='releases'){
        if(!Array.isArray(data.projects)||!data.projects.length)throw new Error('Release project membership required');
        const name=identity(data.version,'release');const result:MappingResult={effects:[],unmapped:omitted(data,['version','dateCreated','projects'])};
        const seen=new Set<string>();
        for(const linked of data.projects){const slug=sourceText(linked.slug,'release project');if(seen.has(slug))continue;seen.add(slug);if(!projects.has(slug))throw new Error('Release project missing');const key=JSON.stringify([slug,name]);if((distSets.get(key)?.size??0)>1)throw new Error('Multiple distributions for one release are outside the native release contract');const build=[...distSets.get(key)??[]][0]??absentDist;const project=nativeProject(org,slug);
          result.effects.push(...effects('release',JSON.stringify([project,name]),{project,name,seq:seqs.get(key)!,build,created:time(data.dateCreated)},{organization:org,project:slug,id:name}).effects)}
        return result;
      }
      if(!['issues','events'].includes(record.kind))return {effects:[],unmapped:[{reason:'Unsupported collection retained in the private source journal, without native effects.'}]};
      if(!projects.has(p.project))throw new Error('Source project missing');
      const project=nativeProject(org,p.project);
      if(record.kind==='issues'){
        const sourceId=sourceText(data.id,'issue id'),id=nativeIssue(org,p.project,sourceId),fingerprint=sha256(JSON.stringify(['sentry-import',org,p.project,sourceId]));
        const states:Record<string,string>={unresolved:'open',resolved:'resolved',ignored:'suppressed'};const state=states[data.status];if(!state)throw new Error('Unsupported source issue state');
        const ceiling=Math.max(0,...[...seqs].filter(([key])=>JSON.parse(key)[0]===p.project).map(([,seq])=>seq));
        const result=effects('issue',id,{id,project,fingerprint,algorithm:'sentry-import-v1',title:scrub(sourceText(data.title,'issue title')),state,revision:1,count:counts.get(JSON.stringify([p.project,sourceId]))??0,first_seen:time(data.firstSeen),last_seen:time(data.lastSeen),resolved_seq:state==='resolved'?ceiling:null,latest_release_seq:ceiling},{organization:org,project:p.project,id:sourceId});
        result.unmapped=omitted(data,['id','title','status','firstSeen','lastSeen']);return result;
      }
      if(record.kind==='events'){
        const decoded=acceptedEvents.get(record.sourceId);if(!decoded)throw new Error(eventErrors.get(record.sourceId)??'Event unavailable');
        const {event,received,raw}=decoded,issue=nativeIssue(org,p.project,data.groupID),payload=JSON.stringify(event);
        const diagnostic=JSON.stringify(event.frames.map(generated=>({generated,status:raw?'imported_raw_stack':'imported_symbolicated_stack',source:'sentry-api-export'})));
        const result=effects('event',JSON.stringify([project,event.eventId]),{id:event.eventId,project,issue,release:event.release,release_seq:seqs.get(JSON.stringify([p.project,event.release]))!,build:event.build,environment:event.environment,payload,digest:sha256(canonicalJson(event)),diagnostic,received,occurrence:occurrence(record.sourceId),historical:1},{organization:org,project:p.project,id:data.eventID});
        result.unmapped=[...omitted(data,['eventID','groupID','release','dist','environment','dateCreated','dateReceived','entries']),{field:'entries',reason:'Only exception locations and breadcrumb labels are scrubbed into evidence. User, request, contexts, extra data and original source text stay out of native events.'},...(!raw?[{field:'stacktrace',reason:'Only symbolicated locations were exported; generated positions and a fresh source-map verification are unavailable.'}]:[])];return result;
      }
      return {effects:[],unmapped:[{reason:'Unsupported collection retained in the private source journal, without native effects.'}]};
    }catch(error){return {effects:[],rejection:(error as Error).message}}
  }};
}
