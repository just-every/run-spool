import { validateReleasePolicy } from './policy';
import { releaseVersionKey } from './identity';
import { canonical,hash,scrub } from '../privacy';
export const releaseTables={release_policies:['project','revision','policy','updated'],release_metadata:['project','release','first_seen','environment','sdk','auto_created','version_key'],release_builds:['project','release','build','registered'],issue_resolutions:['project','issue','mode','seen_without_release','updated','boundary_seq','observed_seq']};
export const releaseDefaults=(data:any)=>({...Object.fromEntries(Object.keys(releaseTables).map(k=>[k,[]])),...data});
export const releaseOutcomes=['sentry_release_invalid_release_name','sentry_release_automatic_release_pattern'];
export async function validateReleaseArchive(data:any){
 const integer=(v:any)=>Number.isSafeInteger(v)&&v>=0,unique=new Set<string>(),releases=new Map<string,any>(data.releases.map((r:any)=>[JSON.stringify([r.project,r.name]),r]));
 for(const row of data.release_policies){
  const policy=validateReleasePolicy(JSON.parse(row.policy));if(row.policy!==JSON.stringify(policy)||!integer(row.revision)||row.revision<1||!integer(row.updated)||unique.has(row.project))throw new Error('Archive release policy');unique.add(row.project);
 }
 unique.clear();for(const row of data.release_metadata){
  const key=JSON.stringify([row.project,row.release]);if(!releases.has(key)||unique.has(key)||!integer(row.first_seen)||!['0','1'].includes(String(row.auto_created))||typeof row.environment!=='string'||scrub(row.environment)!==row.environment||typeof row.sdk!=='string'||scrub(row.sdk)!==row.sdk||row.version_key!==releaseVersionKey(row.release)&&row.version_key!==previousVersionKey(row.release))throw new Error('Archive release metadata');JSON.parse(row.sdk);unique.add(key);
 }
 unique.clear();for(const row of data.release_builds){const key=JSON.stringify([row.project,row.release,row.build]);if(!releases.has(JSON.stringify([row.project,row.release]))||unique.has(key)||typeof row.build!=='string'||!row.build||row.build.length>100||![0,1].includes(row.registered))throw new Error('Archive release build');unique.add(key)}
 unique.clear();for(const row of data.issue_resolutions){const key=JSON.stringify([row.project,row.issue]);if(!data.issues.some((i:any)=>i.project===row.project&&i.id===row.issue)||unique.has(key)||!['plain','current','next','named'].includes(row.mode)||!integer(row.seen_without_release)||!integer(row.updated)||!integer(row.observed_seq)||row.boundary_seq!==null&&!integer(row.boundary_seq)||[row.observed_seq,row.boundary_seq].some(seq=>seq!==null&&seq!==0&&!data.releases.some((r:any)=>r.project===row.project&&r.seq===seq)))throw new Error('Archive issue resolution');unique.add(key)}
 const audits=new Set<string>();for(const row of data.audit.filter((r:any)=>r.kind==='release_policy_changed')){
  const d=JSON.parse(row.detail),current=data.release_policies.find((p:any)=>p.project===row.project),key=row.project+':'+d.revision;
  if(Object.keys(d).sort().join()!=='policyDigest,previousRevision,revision'||!current||!integer(d.revision)||d.revision<1||d.revision>current.revision||d.previousRevision!==d.revision-1||!/^[a-f0-9]{64}$/.test(d.policyDigest)||audits.has(key)||!integer(row.created))throw new Error('Archive release policy audit');
  if(d.revision===current.revision&&d.policyDigest!==await hash(canonical(JSON.parse(current.policy))))throw new Error('Archive release policy digest');audits.add(key);
 }
}

// Exact prior derived cache is accepted for archives; reads rebuild it before ordering.
function previousVersionKey(name:string):string|null {
 const m=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+(\d+))?$/.exec(name.slice(name.lastIndexOf('@')+1));
 if(!m||m[4]?.split('.').some(v=>/^0\d+$/.test(v)||!v))return null;
 const numeric=(v:string)=>String(v.length).padStart(3,'0')+':'+v;
 return [numeric(m[1]),numeric(m[2]),numeric(m[3]),m[4]?m[4].split('.').map(v=>/^\d+$/.test(v)?'0'+numeric(v):'1'+v).join('.')+'!':'~',numeric(m[5]??'0')].join('|');
}
