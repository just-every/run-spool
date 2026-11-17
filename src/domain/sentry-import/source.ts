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
    fields(bundle,['format','version','organization','window','collections','omissions']);
    if (bundle.format !== importFormat || bundle.version !== 1) throw new Error('Unsupported organization bundle format');
    fields(bundle.organization,['id','slug','region']); fields(bundle.window,['start','end']);
    const organization = sourceText(bundle.organization.slug,'organization'); sourceText(bundle.organization.id,'organization id');
    if (!['us','de','self-hosted'].includes(bundle.organization.region)) throw new Error('Invalid region');
    const start=Date.parse(bundle.window.start),end=Date.parse(bundle.window.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start>end) throw new Error('Invalid export window');
    if (!Array.isArray(bundle.collections) || !bundle.collections.length || bundle.collections.length>100 || !Array.isArray(bundle.omissions) || bundle.omissions.some((s:any)=>typeof s!=='string' || s.length>500)) throw new Error('Invalid collections or omissions');
    const records: ParsedRecord[]=[{kind:'manifest',sourceId:organization,payload:{organization:bundle.organization,window:bundle.window,omissions:bundle.omissions},pointer:''}];
    const collectionKeys=new Set<string>();
    for (const [collectionIndex,collection] of bundle.collections.entries()) {
      fields(collection,['kind','project','team','pages']);
      const kind=sourceText(collection.kind,'collection kind');
      const project=collection.project===null ? null : sourceText(collection.project,'collection project');
      if (['issues','events','ownership'].includes(kind) && !project || ['projects','releases','members','teams','team-members'].includes(kind) && project!==null) throw new Error('Collection scope mismatch');
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
