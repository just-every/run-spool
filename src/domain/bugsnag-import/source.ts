import type { Json, ParsedRecord } from '../../modules/import-kit/src/types';
import { sourceText } from '../sentry-import/source';
export const mappingVersion = 'spool-bugsnag-org-v1';
const object = (v:any) => { if(!v || typeof v!=='object' || Array.isArray(v))throw new Error('Invalid Bugsnag object');return v; };
/** The wrapper records complete API page chains; response rows retain API v2 fields. */
export function parseBugsnagOrganization(value:Json):ParsedRecord[] {
 const b=object(value);
 if(b.format!=='spool-bugsnag-org-export'||b.version!==1)throw new Error('Unsupported Bugsnag bundle');
 const org=sourceText(object(b.organization).id,'organization');sourceText(b.organization.name,'organization name');
 const start=Date.parse(object(b.window).start),end=Date.parse(b.window.end);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>end)throw new Error('Invalid export window');
 if(!Array.isArray(b.collections)||!b.collections.length||b.collections.length>100||!Array.isArray(b.omissions)||b.omissions.some((s:any)=>typeof s!=='string'||s.length>500))throw new Error('Invalid Bugsnag collections');
 const records:ParsedRecord[]=[{kind:'manifest',sourceId:org,payload:{organization:b.organization,window:b.window,omissions:b.omissions,vendor:'bugsnag'},pointer:''}];
 const scopes=new Set<string>();
 for(const [ci,c] of b.collections.entries()){
  object(c);const kind=sourceText(c.kind,'collection kind'),project=c.project===null?null:sourceText(c.project,'project');
  if(kind==='projects'&&project!==null||['errors','events','releases','stability'].includes(kind)&&!project)throw new Error('Bugsnag collection scope mismatch');
  const scope=JSON.stringify([kind,project]);if(scopes.has(scope))throw new Error('Duplicate Bugsnag collection');scopes.add(scope);
  if(!Array.isArray(c.pages)||!c.pages.length||c.pages.length>100)throw new Error('Invalid Bugsnag pages');
  let expected:string|null=null;const cursors=new Set<string|null>();
  for(const [pi,page] of c.pages.entries()){
   object(page);if(page.cursor!==expected||cursors.has(page.cursor)||page.nextCursor!==null&&(typeof page.nextCursor!=='string'||!page.nextCursor||page.nextCursor===page.cursor))throw new Error('Broken Bugsnag page chain');
   cursors.add(page.cursor);expected=page.nextCursor;
   if((pi===c.pages.length-1)!==(page.nextCursor===null))throw new Error('Incomplete Bugsnag page chain');
   // The documented stability_trend endpoint returns one object, not an
   // array and not a paginated resource. Preserve it without inventing an id.
   const stability=kind==='stability';
   if(stability&&(c.pages.length!==1||page.cursor!==null||page.nextCursor!==null))throw new Error('Stability response is not paginated');
   const response=stability&&!Array.isArray(page.response)?[object(page.response)]:page.response;
   if(!Array.isArray(response))throw new Error('Bugsnag response array required');
   for(const [ri,data] of response.entries()){
    object(data);
    if(stability&&(!Array.isArray(data.timeline_points)||data.project_id!==project||typeof data.release_stage_name!=='string'))throw new Error('Invalid Bugsnag stability response');
    const id=sourceText(stability?data.project_id:data.id,'source id');
    if(project&&data.project_id!==undefined&&data.project_id!==project)throw new Error('Bugsnag project mismatch');
    if(kind==='projects'&&data.organization_id!==undefined&&data.organization_id!==org)throw new Error('Bugsnag organization mismatch');
    records.push({kind,sourceId:JSON.stringify([org,project,id]),payload:{organization:org,project,data,vendor:'bugsnag'},pointer:`/collections/${ci}/pages/${pi}/response${stability&&!Array.isArray(page.response)?'':'/'+ri}`});
   }
  }
 }
 if(!scopes.has(JSON.stringify(['projects',null])))throw new Error('Bugsnag projects required');
 const projects=records.filter(r=>r.kind==='projects').map(r=>(r.payload as any).data.id);
 for(const project of projects)for(const kind of ['errors','events','releases'])if(!scopes.has(JSON.stringify([kind,project])))throw new Error('Bugsnag project inventory incomplete');
 const rank:Record<string,number>={manifest:0,projects:1,releases:2,errors:3,events:4};
 return records.sort((a,b)=>(rank[a.kind]??5)-(rank[b.kind]??5));
}
