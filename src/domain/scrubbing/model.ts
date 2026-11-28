import {canonical,hash} from '../privacy';
import {prepareIdentityKey,identityHash} from '../identities/key';
import {emptyScrubbingPolicy,scrubbingPolicy,type ScrubbingPolicy} from './policy';
import {applyScrubbingDocument} from './apply';
export const policyId=(project:string|null)=>project===null?'installation':'project:'+project;
type PolicyRow = {id:string;revision:number;policy:string};
const decodePolicy = (row?: Pick<PolicyRow, 'revision' | 'policy'> | null) =>
 ({revision:row?.revision??0,policy:row?scrubbingPolicy(JSON.parse(row.policy)):emptyScrubbingPolicy()});

export async function readScrubbingPolicy(db:D1Database,project:string|null){
 return decodePolicy(await db.prepare('SELECT revision,policy FROM scrubbing_policies WHERE id=?').bind(policyId(project)).first<PolicyRow>());
}
export async function scrubbingSnapshot(db:D1Database,project:string|null){
 const installationId=policyId(null),projectId=policyId(project);
 const {results}=await db.prepare('SELECT id,revision,policy FROM scrubbing_policies WHERE id IN (?,?)').bind(installationId,projectId).all<PolicyRow>();
 const installation=decodePolicy(results.find(row=>row.id===installationId));
 const current=project===null?installation:decodePolicy(results.find(row=>row.id===projectId));
 return {...current,installationRevision:installation.revision,installationPolicy:installation.policy};
}
export function scrubbingFence(db:D1Database,project:string|null,revision:number){
 return db.prepare('INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN COALESCE((SELECT revision FROM scrubbing_policies WHERE id=?),0)=? THEN 1 ELSE 0 END').bind(policyId(project),revision);
}
export async function prepareScrubbing<T>(db:D1Database,project:string,document:T,sharedKey?:Awaited<ReturnType<typeof prepareIdentityKey>>|null){
 const snapshot=await scrubbingSnapshot(db,project),active=snapshot.policy.rules.length+snapshot.policy.sensitiveFields.length+snapshot.installationPolicy.rules.length+snapshot.installationPolicy.sensitiveFields.length;
 const key=active?(sharedKey??await prepareIdentityKey(db,project)):null;
 const applied=active?await applyScrubbingDocument(document,snapshot.installationPolicy,snapshot.policy,value=>identityHash(key!.key,'scrubbing:'+value)):{document,matches:[]};
 return {...applied,key,jobs:[scrubbingFence(db,null,snapshot.installationRevision),scrubbingFence(db,project,snapshot.revision),...key?.jobs??[]]};
}
export const policyDigest=(policy:ScrubbingPolicy)=>hash(canonical(policy));
