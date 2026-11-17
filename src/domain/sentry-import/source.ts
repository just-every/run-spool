import { sha256 } from '../../modules/import-kit/src/provenance/identity.ts';
import type { Json, ParsedRecord } from '../../modules/import-kit/src/types.ts';
export const importFormat = 'spool-sentry-org-export';
export const mappingVersion = 'spool-sentry-org-v2';
export function sourceText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || /[\u0000-\u001f]/.test(value)) throw new Error(`Invalid ${field}`);
  return value;
}
function fields(value: any, allowed: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key=>!allowed.includes(key))) throw new Error('Unsupported bundle shape');
}
export function parseSentryOrganization(value: Json): ParsedRecord[] {
    const bundle = value as any;
    fields(bundle,['format','version','organization','window','collections','omissions','capture']);
    if (bundle.format !== importFormat || bundle.version !== 1) throw new Error('Unsupported organization bundle format');
    fields(bundle.organization,['id','slug','region']); fields(bundle.window,['start','end']);
    const organization = sourceText(bundle.organization.slug,'organization'); sourceText(bundle.organization.id,'organization id');
    if (!['us','de','self-hosted'].includes(bundle.organization.region)) throw new Error('Invalid region');
    const start=Date.parse(bundle.window.start),end=Date.parse(bundle.window.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start>end) throw new Error('Invalid export window');
    if (!Array.isArray(bundle.collections) || !bundle.collections.length || bundle.collections.length>100 || !Array.isArray(bundle.omissions) || bundle.omissions.some((s:any)=>typeof s!=='string' || s.length>500)) throw new Error('Invalid collections or omissions');
    if(bundle.capture!==undefined)validateCapture(bundle);
    const records: ParsedRecord[]=[{kind:'manifest',sourceId:organization,payload:{organization:bundle.organization,window:bundle.window,omissions:bundle.omissions,...bundle.capture?{capture:bundle.capture}:{}},pointer:''}];
    const collectionKeys=new Set<string>();
    for (const [collectionIndex,collection] of bundle.collections.entries()) {
      fields(collection,['kind','project','team','pages']);
      const kind=sourceText(collection.kind,'collection kind');
      const project=collection.project===null ? null : sourceText(collection.project,'collection project');
      if (['issues','events','keys','ownership'].includes(kind) && !project || ['projects','releases','members','teams','team-members'].includes(kind) && project!==null) throw new Error('Collection scope mismatch');
      const team=kind==='team-members'?sourceText(collection.team,'team slug'):null;
      if(kind!=='team-members'&&collection.team!==undefined)throw new Error('Unexpected team scope');
      const key=JSON.stringify([kind,project,team]); if(collectionKeys.has(key))throw new Error('Duplicate collection');collectionKeys.add(key);
      if(!Array.isArray(collection.pages)||!collection.pages.length||collection.pages.length>100)throw new Error('Invalid pages');
      let expected: string|null=null; const cursors=new Set<string|null>();
      for (const [pageIndex,page] of collection.pages.entries()) {
        fields(page,['cursor','nextCursor','response']);
        if(cursors.has(page.cursor))throw new Error('Repeated page cursor');cursors.add(page.cursor);
        if(page.cursor!==expected || (page.nextCursor!==null && (typeof page.nextCursor!=='string'||!page.nextCursor||page.nextCursor===page.cursor)) || !Array.isArray(page.response))throw new Error('Broken page chain');
        if(pageIndex<collection.pages.length-1 && page.nextCursor===null || pageIndex===collection.pages.length-1 && page.nextCursor!==null)throw new Error('Incomplete page chain');
        expected=page.nextCursor;
        for (const [rowIndex,row] of page.response.entries()) {
          if(!row || typeof row!=='object'||Array.isArray(row))throw new Error('Invalid API record');
          const id=sourceText(kind==='ownership'?project:kind==='events' ? row.eventID : kind==='releases' ? row.version : row.id,'source id');
          records.push({kind,sourceId:JSON.stringify(team?[organization,project,team,id]:[organization,project,id]),payload:{organization,project,...team?{team}:{},data:row},pointer:`/collections/${collectionIndex}/pages/${pageIndex}/response/${rowIndex}`});
        }
      }
    }
    if(!collectionKeys.has(JSON.stringify(['projects',null,null])) || !collectionKeys.has(JSON.stringify(['releases',null,null])))throw new Error('Projects and releases collections required');
    const exportedProjects=records.filter(r=>r.kind==='projects').map(r=>(r.payload as any).data.slug);
    for(const record of records)if(['members','teams','team-members'].includes(record.kind))(record.payload as any).projects=exportedProjects;
    const rank:Record<string,number>={manifest:0,projects:1,releases:2,issues:3,events:4};
    return records.sort((a,b)=>(rank[a.kind]??5)-(rank[b.kind]??5));
}

export type FieldDisposition = {path:string; disposition:'mapped'|'transformed'|'unmapped'|'rejected'|'redacted'; bytes:number; reason:string};
const escaped=(key:string)=>key.replace(/~/g,'~0').replace(/\//g,'~1');
/** Every scalar and empty container at an exact JSON pointer, including every array index. No values leave this function. */
export function sourceLeaves(value:any, path='', depth=0):{path:string;bytes:number;redacted?:boolean}[] {
 if(depth>64)throw new Error('Sentry source depth limit');
 if(value&&typeof value==='object'&&Object.keys(value).length)return Object.entries(value).flatMap(([key,child])=>sourceLeaves(child,`${path}/${escaped(key)}`,depth+1));
 return [{path,bytes:new TextEncoder().encode(JSON.stringify(value)).length,...value==='[removed]'?{redacted:true}:{}}];
}
/** The existing API mapper's actual projection; unsupported fields never inherit a parent's mapped status. */
export function sentryFieldAccounting(kind:string,data:any,rejection?:string):FieldDisposition[] {
 if(rejection)return sourceLeaves(data).map(({path,bytes,redacted})=>({path,bytes,disposition:redacted?'redacted':'rejected',reason:redacted?'Credential removed before upload; only an exporter marker remains.':'Record rejected; no native effects.'}));
 const retained=new Set<string>(),changed=new Set<string>();
 const keep=(...paths:string[])=>paths.forEach(path=>retained.add('/'+path));
 const transform=(...paths:string[])=>paths.forEach(path=>changed.add('/'+path));
 if(kind==='projects'){keep('id','slug');transform('name','dateCreated')}
 if(kind==='releases'){
  keep('version');transform('dateCreated');
  if(Array.isArray(data.projects))data.projects.forEach((_:any,i:number)=>keep(`projects/${i}/slug`));
 }
 if(kind==='issues'){keep('id');transform('title','status','firstSeen','lastSeen')}
 if(kind==='projects'&&Array.isArray(data.teams))data.teams.forEach((_:any,i:number)=>transform(`teams/${i}/id`,`teams/${i}/slug`));
 if(kind==='members'){keep('id','user/id');transform('email','name','orgRole','pending','expired','dateCreated')}
 if(kind==='teams'){
  keep('id','slug','name');transform('dateCreated');
  if(Array.isArray(data.projects))data.projects.forEach((_:any,i:number)=>transform(`projects/${i}/slug`));
 }
 if(kind==='team-members')transform('id','teamRole');
 if(kind==='ownership'){
  // Exact source history is private, disabled review data. Source activation
  // flags are retained as history and never become executable native settings.
  for(const leaf of sourceLeaves(data))retained.add(leaf.path);
  transform('dateCreated','lastUpdated','isActive','autoAssignment','codeownersAutoSync');
  for(const path of changed)retained.delete(path);
 }

 if(kind==='events'){
  transform('eventID','groupID','dist','environment');
  transform(typeof data.release==='object'?'release/version':'release');
  transform(data.dateCreated!==undefined?'dateCreated':'dateReceived');
  if(!data.environment&&Array.isArray(data.tags))data.tags.forEach((tag:any,i:number)=>{if(tag?.key==='environment')transform(`tags/${i}/key`,`tags/${i}/value`)});
  const entries=data.entries;
  if(Array.isArray(entries)){
   const e=entries.findIndex((e:any)=>e?.type==='exception'),b=entries.findIndex((e:any)=>e?.type==='breadcrumbs');
   const values=entries[e]?.data?.values;
   if(Array.isArray(values)&&values.length){
    const i=values.length-1,p=`entries/${e}/data/values/${i}`,ex=values[i],stack=ex.rawStacktrace?'rawStacktrace':'stacktrace';
    transform(`entries/${e}/type`,`${p}/type`,`${p}/value`);
    const frames=ex[stack]?.frames;
    if(Array.isArray(frames))frames.forEach((frame:any,j:number)=>{
     // Shared sanitizer retains first/last 500 rich frames; the diagnostic view is separately capped at 30.
     if(frames.length>1000&&j>=500&&j<frames.length-500)return;
     for(const key of ['filename','absPath','lineNo','colNo','function'])if(frame?.[key]!==undefined)transform(`${p}/${stack}/frames/${j}/${key}`);
    });
   }
   const crumbs=entries[b]?.data?.values;
   if(Array.isArray(crumbs)){
    transform(`entries/${b}/type`);
    crumbs.forEach((crumb:any,i:number)=>{for(const key of ['type','category','level','timestamp','message','data'])if(crumb?.[key]!==undefined)for(const leaf of sourceLeaves(crumb[key]))transform(`entries/${b}/data/values/${i}/${key}${leaf.path}`)});
   }
  }
 }
 return sourceLeaves(data).map(({path,bytes,redacted})=>{
  const disposition=redacted?'redacted':retained.has(path)?'mapped':changed.has(path)?'transformed':'unmapped';
  let reason=redacted?'Credential removed before upload; only an exporter marker remains.':rejection?'Record rejected; no native effects.':disposition==='mapped'?'Retained as native identity or source provenance.':disposition==='transformed'?'Converted, scrubbed or bounded by the native historical projection.':'Not represented in native history; private source only.';
  if(disposition==='unmapped'&&!['projects','releases','issues','events','members','teams','team-members','ownership'].includes(kind))reason='Unsupported source collection; no native target or authority is created.';
  if(['members','teams','team-members','ownership'].includes(kind)&&['mapped','transformed'].includes(disposition))reason='Retained or converted for pending, disabled review only; no invitation, trust, access or live ownership is created.';
  if(disposition==='unmapped'&&kind==='events'&&path.includes('/vars/'))reason='Frame locals are not forwarded by the historical API adapter.';
  return {path,bytes,disposition,reason};
 });
}

function validateCapture(bundle:any) {
 const capture=bundle.capture;
 fields(capture,['schema','inventory','redactions']);
 if(capture.schema!=='sentry-web-api-0-capture-v1'||!Array.isArray(capture.inventory)||capture.inventory.length>2000||!Array.isArray(capture.redactions)||capture.redactions.length>10000)throw new Error('Invalid capture inventory');
 const seen=new Set<string>();
 for(const row of capture.inventory){
  fields(row,['kind','family','project','page','cursor','nextCursor','records','sourceBytes','sourceSha256','sanitizedBytes','sanitizedSha256']);
  const collection=bundle.collections.find((c:any)=>c.kind===row.kind&&c.project===row.project);
  const key=JSON.stringify([row.kind,row.project,row.page]);
  if(!collection||seen.has(key)||!Number.isSafeInteger(row.page)||row.page<0)throw new Error('Invalid capture inventory');seen.add(key);
  const page=collection.pages[row.kind==='events'?0:row.page];
  const data=row.kind==='events'?page?.response[row.page]:row.kind==='ownership'?page?.response[0]:page?.response;
  if(data===undefined)throw new Error('Invalid capture inventory');
  if(row.kind!=='events'&&(row.cursor!==page.cursor||row.nextCursor!==page.nextCursor))throw new Error('Capture cursor mismatch');
  const body=JSON.stringify(data);
  if(row.records!==(Array.isArray(data)?data.length:1)||row.sanitizedBytes!==new TextEncoder().encode(body).length||row.sanitizedSha256!==sha256(body)||!Number.isSafeInteger(row.sourceBytes)||row.sourceBytes<0||!/^[a-f0-9]{64}$/.test(row.sourceSha256))throw new Error('Capture response mismatch');
 }
 for(const collection of bundle.collections){
  const pages=collection.kind==='events'?collection.pages[0].response.length:collection.pages.length;
  for(let page=0;page<pages;page++)if(!seen.has(JSON.stringify([collection.kind,collection.project,page])))throw new Error('Incomplete capture inventory');
 }
 for(const row of capture.redactions){
  fields(row,['path','disposition','reason']);
  if(typeof row.path!=='string'||row.path.length>1000||!row.path.startsWith('/collections/')||/[\u0000-\u001f]/.test(row.path)||row.disposition!=='redacted'||row.reason!=='Credential removed before upload; original value is not retained.')throw new Error('Invalid redaction inventory');
 }
}
