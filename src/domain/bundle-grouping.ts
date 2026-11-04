import { grouping, hash, normalize, type Envelope } from './privacy';
import { diagnose } from './artifacts';
import { javascriptIdentity, routeAdmission, storedRoute, isJavascriptIdentity, type GroupingRoute, type RouteBasis } from './grouping/javascript';
import { bundleFile } from './grouping-path';
export { bundleFile } from './grouping-path';
export type { GroupingRoute } from './grouping/javascript';

const bundleSuffix = /(^|\/)([^/]+?)(?:[.-]([a-fA-F0-9]{8,64})|-([A-Za-z0-9_-]{8}))(\.(?:m?js|cjs))$/;
export function bundleBasis(event: Envelope): string {
 const info=grouping(event);
 if(event.sentry||('defaultBasis' in info&&info.basis!==info.defaultBasis))return info.basis;
 return basisWithFile(event,bundleFile(event.frames[0]!.file));
}
function basisWithFile(event: Envelope,file: string): string {
 const top=event.frames[0]!;
 return grouping(event.language ? event : {...event,grouping:undefined,frames:[{...top,file}]}).basis;
}
// Read the original hash-only routes without rewriting their admission evidence.
function recordedBundleBasis(event: Envelope): string {
 return basisWithFile(event,event.frames[0]!.file.replace(bundleSuffix,'$1$2-[hash]$5'));
}
export const bundleTables = { grouping_routes: ['project','fingerprint','issue','basis'] };
export const bundleDefaults = (data:any) => ({grouping_routes:[],...data});

export async function captureGrouping(db:D1Database,project:string,event:Envelope,diagnostic?:any[]) {
 const raw=grouping(event);
 if(event.language||event.sentry||('defaultBasis' in raw&&raw.basis!==raw.defaultBasis))return {...raw,fingerprint:await hash(raw.basis),routes:[]};
 const identity=javascriptIdentity(event,diagnostic??await diagnose(db,project,event));
 const primary=identity.source??identity.bundle;
 if(!primary)return {...raw,fingerprint:await hash(raw.basis),routes:[]};
 const keys=[primary,...identity.bundle&&identity.bundle!==primary?[identity.bundle]:[]];
 const found=await db.prepare(`SELECT * FROM grouping_routes WHERE project=? AND
  (fingerprint IN (SELECT value FROM json_each(?)) OR EXISTS
   (SELECT 1 FROM json_each(grouping_routes.basis,'$.identities') WHERE value IN (SELECT value FROM json_each(?))))`).bind(project,JSON.stringify(await Promise.all(keys.map(hash))),JSON.stringify(keys)).all<GroupingRoute>();
 const aliases=(route:GroupingRoute)=>storedRoute(route)?.identities??[];
 const compatible=(route:GroupingRoute)=>!identity.source||aliases(route).filter(key=>JSON.parse(key)[0]==='js-source-v2').every(key=>key===identity.source);
 let anchor=found.results.find(route=>aliases(route).includes(primary))??found.results.find(compatible);
 if(!anchor){
  // Upgrade from retained original membership, including corrected occurrences.
  const candidates=await db.prepare(`SELECT e.payload,e.diagnostic,g.basis,i.id,i.fingerprint,r.basis route_basis,r.fingerprint route_fingerprint FROM events e
   LEFT JOIN event_grouping g ON g.project=e.project AND g.event=e.id AND g.occurrence=e.occurrence
   JOIN issues i ON i.id=COALESCE(g.original_issue,e.issue)
   LEFT JOIN grouping_routes r ON r.project=e.project AND r.issue=i.id
   WHERE e.project=? AND e.historical=0 AND i.algorithm='js-frame-v1' AND json_extract(e.payload,'$.type')=?
   ORDER BY i.first_seen,i.id,e.received,e.id LIMIT 10000`).bind(project,event.type).all<any>();
  for(const row of candidates.results){
   const prior=normalize(JSON.parse(row.payload)),info=grouping(prior);
   if(prior.sentry||prior.language||'defaultBasis' in info&&info.basis!==info.defaultBasis)continue;
   const previous=javascriptIdentity(prior,JSON.parse(row.diagnostic));
   if(identity.source&&previous.source?identity.source!==previous.source:raw.basis!==info.basis&&(!identity.bundle||identity.bundle!==previous.bundle))continue;
   const route=row.route_basis?{project,issue:row.id,fingerprint:row.route_fingerprint,basis:row.route_basis}:undefined;
   if(route&&!compatible(route))continue;
   const basis=row.basis??(route?routeAdmission(route):info.basis);
   if(await hash(basis)!==row.fingerprint||await hash(project+':'+row.fingerprint)!==row.id)continue;
   anchor=route??{project,fingerprint:await hash(primary),issue:row.id,basis:JSON.stringify({version:2,key:primary,identities:[],admission:basis} satisfies RouteBasis)};break;
  }
 }
 const basis=anchor?routeAdmission(anchor):primary,fingerprint=await hash(basis),issue=await hash(project+':'+fingerprint);
 // One durable route per issue carries its generated and original identities.
 // Keep its key and original admission unchanged when adding mapped identity.
 const previous=anchor&&storedRoute(anchor),key=previous?.key??(anchor?recordedKey(anchor.basis):primary);
 const identities=[...new Set([...(previous?.identities??[]),primary,...identity.bundle&&!(previous?.identities??[]).some(key=>JSON.parse(key)[0]==='js-bundle-v2')&&!found.results.some(route=>route.issue!==issue&&aliases(route).includes(identity.bundle!))?[identity.bundle]:[]])];
 const route:GroupingRoute={project,fingerprint:anchor?.fingerprint??await hash(primary),issue,basis:JSON.stringify({version:2,key,identities,admission:basis} satisfies RouteBasis),...anchor?{previousBasis:anchor.basis}:{}};
 return {algorithm:raw.algorithm,basis,fingerprint,routes:[route]};
}
function recordedKey(basis:string):string {
 const value=JSON.parse(basis);
 return JSON.stringify([value[0],value[1].replace(bundleSuffix,'$1$2-[hash]$5'),value[2],value[3]]);
}

/** Recover original admissions from their durable route, even after retention. */
export async function admissionBasis(event:Envelope,issue:{id:string;fingerprint:string},routes:GroupingRoute[]) {
 const info=grouping(event),raw=info.basis;
 if(event.sentry||('defaultBasis' in info&&raw!==info.defaultBasis))return raw;
 if(await hash(raw)===issue.fingerprint)return raw;
 const key=await hash(recordedBundleBasis(event));
 const route=routes.find(route=>route.issue===issue.id&&(storedRoute(route)!==undefined||route.fingerprint===key));
 return route?routeAdmission(route):raw;
}
function validAdmission(basis:string):boolean {
 const value=JSON.parse(basis);
 if(isJavascriptIdentity(value))return true;
 if(!Array.isArray(value)||value.length!==4)return false;
 const event=normalize({version:1,eventId:'validation',release:'validation',build:'validation',environment:'validation',type:value[0],message:'',frames:[{file:value[1],function:value[2],line:value[3],column:0}]});
 return grouping(event).basis===basis;
}
export async function validateBundleRoutes(data:any) {
 const seen=new Set<string>(),destinations=new Set<string>();
 for(const route of data.grouping_routes as GroupingRoute[]){
  const issue=data.issues.find((row:any)=>row.id===route.issue&&row.project===route.project),value=storedRoute(route),admission=routeAdmission(route);
  if(value){
   if(Object.keys(value).sort().join()!=='admission,identities,key,version'||typeof value.key!=='string'||typeof value.admission!=='string'||!Array.isArray(value.identities)||!value.identities.length||value.identities.some(key=>typeof key!=='string'||!isJavascriptIdentity(JSON.parse(key)))||new Set(value.identities).size!==value.identities.length||!validAdmission(value.key)||await hash(value.key)!==route.fingerprint)throw new Error('Archive JavaScript grouping route');
  }else if(recordedKey(admission)!==admission&&await hash(recordedKey(admission))!==route.fingerprint)throw new Error('Archive bundle grouping basis');
  const fingerprint=await hash(admission),key=route.project+':'+route.fingerprint;
  if(!validAdmission(admission)||!value&&await hash(recordedKey(admission))!==route.fingerprint||issue?.algorithm!=='js-frame-v1'||issue.fingerprint!==fingerprint||await hash(route.project+':'+fingerprint)!==route.issue||seen.has(key)||destinations.has(route.issue))throw new Error('Archive bundle grouping integrity');
  seen.add(key);destinations.add(route.issue);
 }
}
