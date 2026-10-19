import { grouping, hash, normalize, type Envelope } from './privacy';

const bundleSuffix = /(^|\/)([^/]+?)(?:[.-]([a-fA-F0-9]{8,64})|-([A-Za-z0-9_-]{8}))(\.(?:m?js|cjs))$/;

import { bundleFile } from './grouping-path';
export { bundleFile } from './grouping-path';

export function bundleBasis(event: Envelope): string {
 const info=grouping(event);
 if(event.sentry||('defaultBasis' in info&&info.basis!==info.defaultBasis))return info.basis;
 return basisWithFile(event,bundleFile(event.frames[0]!.file));
}
function basisWithFile(event: Envelope,file: string): string {
 const top=event.frames[0]!;
 return grouping(event.language ? event : {...event,grouping:undefined,frames:[{...top,file}]}).basis;
}
// Read persisted admissions under the original rule, including its mistaken
// lowercase suffixes. Their recorded route and issue hashes still have to
// agree. This never selects the destination of a new capture.
function recordedBundleBasis(event: Envelope): string {
 return basisWithFile(event,event.frames[0]!.file.replace(bundleSuffix,'$1$2-[hash]$5'));
}
export type GroupingRoute = {project:string; fingerprint:string; issue:string; basis:string};
export const bundleTables = { grouping_routes: ['project','fingerprint','issue','basis'] };
export const bundleDefaults = (data:any) => ({grouping_routes:[],...data});

export async function captureGrouping(db:D1Database,project:string,event:Envelope) {
 const raw=grouping(event);
 if(event.sentry||('defaultBasis' in raw&&raw.basis!==raw.defaultBasis))return {...raw,fingerprint:await hash(raw.basis),route:null};
 const normalized=bundleBasis(event);
 if(normalized===raw.basis)return {...raw,fingerprint:await hash(raw.basis),route:null};
 const key=await hash(normalized);
 let route=await db.prepare('SELECT * FROM grouping_routes WHERE project=? AND fingerprint=?').bind(project,key).first<GroupingRoute>();
 if(!route){
  // Upgrade only from retained native admission evidence. Corrections do not
  // change future routing; their original membership supplies the anchor.
  const candidates=await db.prepare(`SELECT e.payload,g.basis,i.id,i.fingerprint FROM events e
   LEFT JOIN event_grouping g ON g.project=e.project AND g.event=e.id AND g.occurrence=e.occurrence
   JOIN issues i ON i.id=COALESCE(g.original_issue,e.issue)
   WHERE e.project=? AND e.historical=0 AND i.algorithm='js-frame-v1'
    AND json_extract(e.payload,'$.type')=? AND json_extract(e.payload,'$.frames[0].function')=? AND json_extract(e.payload,'$.frames[0].line')=?
   ORDER BY i.first_seen,i.id,e.received,e.id LIMIT 10000`).bind(project,event.type,event.frames[0]!.function,event.frames[0]!.line).all<any>();
  for(const row of candidates.results){
   const prior=JSON.parse(row.payload),basis=row.basis??grouping(prior).basis;
   if(bundleBasis(prior)!==normalized||await hash(basis)!==row.fingerprint||await hash(project+':'+row.fingerprint)!==row.id)continue;
   route={project,fingerprint:key,issue:row.id,basis};break;
  }
  // New issues use the normalized identity, so simultaneous first captures
  // from different builds choose the same destination before either commits.
  route??={project,fingerprint:key,issue:await hash(project+':'+key),basis:normalized};
 }
 return {algorithm:raw.algorithm,basis:route.basis,fingerprint:await hash(route.basis),route};
}

/** Recover the original admission basis without changing old v1 evidence. */
export async function admissionBasis(event:Envelope,issue:{id:string;fingerprint:string},routes:GroupingRoute[]) {
 const info=grouping(event),raw=info.basis;
 if(event.sentry||('defaultBasis' in info&&raw!==info.defaultBasis))return raw;
 if(await hash(raw)===issue.fingerprint)return raw;
 const key=await hash(recordedBundleBasis(event));
 return routes.find(route=>route.issue===issue.id&&route.fingerprint===key)?.basis??raw;
}

export async function validateBundleRoutes(data:any) {
 const seen=new Set<string>(),destinations=new Set<string>();
 for(const route of data.grouping_routes as GroupingRoute[]){
  const issue=data.issues.find((row:any)=>row.id===route.issue&&row.project===route.project),basis=JSON.parse(route.basis);
  if(!Array.isArray(basis)||basis.length!==4)throw new Error('Archive bundle grouping basis');
  const event=normalize({version:1,eventId:'validation',release:'validation',build:'validation',environment:'validation',type:basis[0],message:'',frames:[{file:basis[1],function:basis[2],line:basis[3],column:0}]});
  const fingerprint=await hash(route.basis),key=route.project+':'+route.fingerprint;
  if(grouping(event).basis!==route.basis||issue?.algorithm!=='js-frame-v1'||issue.fingerprint!==fingerprint||await hash(route.project+':'+fingerprint)!==route.issue||await hash(recordedBundleBasis(event))!==route.fingerprint||seen.has(key)||destinations.has(route.issue))throw new Error('Archive bundle grouping integrity');
  seen.add(key);destinations.add(route.issue);
 }
}
