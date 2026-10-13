// Owner-configured transport policy. Origin is not authentication or execution authority.
export function browserOrigin(value:unknown):string {
  if(typeof value!=='string'||value.length>1024||!value.length)throw new Error('A canonical HTTP(S) origin is required');
  let url:URL;try{url=new URL(value)}catch{throw new Error('A canonical HTTP(S) origin is required')}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.origin!==value||url.hostname.includes('*'))throw new Error('Use only the canonical HTTP(S) origin, with no path, query, credentials or wildcard');
  return value;
}
export async function ingestOrigin(db:D1Database,project:string,origin:string|undefined,serviceOrigin:string){
  if(origin===undefined)return {allowed:true,foreign:null,cors:null};
  try{browserOrigin(origin)}catch{return {allowed:false,foreign:null,cors:null}}
  if(origin===serviceOrigin)return {allowed:true,foreign:null,cors:origin};
  const member=await db.prepare('SELECT 1 FROM browser_origins WHERE project=? AND origin=?').bind(project,origin).first();
  return {allowed:!!member,foreign:member?origin:null,cors:member?origin:null};
}
export function requestedHeaders(value:string|undefined):boolean {
  if(!value||value.length>256)return false;
  const headers=value.split(',').map(v=>v.replace(/^[ \t]+|[ \t]+$/g,'').toLowerCase());
  return headers.length===2&&new Set(headers).size===2&&headers.includes('authorization')&&headers.includes('content-type');
}
