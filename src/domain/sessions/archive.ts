import { scrub } from '../privacy';
export const sessionTables={project_identity_keys:['project','key'],health_sessions:['project','sid','release','environment','started','updated','status','errors','user_hash'],health_aggregates:['project','release','environment','started','status','quantity']};
export const sessionDefaults=(data:any)=>({...Object.fromEntries(Object.keys(sessionTables).map(k=>[k,[]])),...data});
export function validateSessionArchive(data:any){
 const keys=new Set<string>(),seen=new Set<string>(),int=(v:any)=>Number.isSafeInteger(v)&&v>=0,hex=(v:any)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 for(const r of data.project_identity_keys){if(keys.has(r.project)||!hex(r.key))throw new Error('Archive identity key');keys.add(r.project)}
 for(const table of ['health_sessions','health_aggregates'])for(const r of data[table]){
  const identity=JSON.stringify(table==='health_sessions'?[r.project,r.sid]:[r.project,r.release,r.environment,r.started,r.status]);
  if(seen.has(identity)||!data.releases.some((v:any)=>v.project===r.project&&v.name===r.release)||typeof r.environment!=='string'||r.environment.length>100||scrub(r.environment)!==r.environment||!int(r.started)||!['ok','exited','errored','crashed','abnormal','unhandled'].includes(r.status))throw new Error('Archive session reference');seen.add(identity);
  if(table==='health_sessions'){if(!/^[a-f0-9]{32}$/.test(r.sid)||!int(r.updated)||r.updated<r.started||!int(r.errors)||r.errors>1000000||r.user_hash!==null&&(!keys.has(r.project)||!hex(r.user_hash)))throw new Error('Archive individual session')}
  else if(!int(r.quantity)||r.quantity<1||r.quantity>1000000000||r.started%60000!==0||r.status==='ok')throw new Error('Archive session aggregate');
 }
 for(const p of data.projects){if(data.health_sessions.filter((r:any)=>r.project===p.id).length>50000||data.health_aggregates.filter((r:any)=>r.project===p.id).length>10000)throw new Error('Archive session budget')}
}
