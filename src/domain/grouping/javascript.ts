import type { Envelope } from '../privacy';
import { bundleFile } from '../grouping-path';

export type GroupingRoute = {project:string; fingerprint:string; issue:string; basis:string; previousBasis?:string};
export type RouteBasis = {version:2; key:string; identities:string[]; admission:string};

/** Original positions identify mapped failures. Without maps, content-hashed
 * bundles use their entry path and exception value, not minifier names/lines. */
export function javascriptIdentity(event:Envelope,diagnostic:any[]=[]):{bundle?:string;source?:string} {
 const frame=event.frames[0];
 if(event.language||event.sentry||!frame)return {};
 const normalized=bundleFile(frame.file),mapped=diagnostic[0];
 return {
  ...(normalized!==frame.file||normalized.includes('-[hash].')?{bundle:JSON.stringify(['js-bundle-v2',event.type,normalized,event.message])}:{}),
  ...(mapped?.status==='mapped'?{source:JSON.stringify(['js-source-v2',event.type,mapped.original.file,mapped.original.line,mapped.original.column])}:{}),
 };
}
export function storedRoute(route:GroupingRoute):RouteBasis|undefined {
 const value=JSON.parse(route.basis);
 return !Array.isArray(value)&&value?.version===2?value:undefined;
}
export function routeAdmission(route:GroupingRoute):string {
 return storedRoute(route)?.admission??route.basis;
}
export function isJavascriptIdentity(value:any):boolean {
 return Array.isArray(value)&&typeof value[1]==='string'&&typeof value[2]==='string'&&(
  value[0]==='js-bundle-v2'&&value.length===4&&typeof value[3]==='string'&&value[2].includes('-[hash].')||
  value[0]==='js-source-v2'&&value.length===5&&Number.isSafeInteger(value[3])&&value[3]>=1&&Number.isSafeInteger(value[4])&&value[4]>=0
 );
}
