import {canonical,hash} from '../privacy';
import {prepareIdentityKey,identityHash} from '../identities/key';
import {emptyScrubbingPolicy,scrubbingPolicy,type ScrubbingPolicy} from './policy';
import {applyScrubbingDocument} from './apply';
export const policyId=(project:string|null)=>project===null?'installation':'project:'+project;
export async function readScrubbingPolicy(db:D1Database,project:string|null){
 const row=await db.prepare('SELECT revision,policy FROM scrubbing_policies WHERE id=?').bind(policyId(project)).first<{revision:number;policy:string}>();
 return {revision:row?.revision??0,policy:row?scrubbingPolicy(JSON.parse(row.policy)):emptyScrubbingPolicy()};
}
export async function scrubbingSnapshot(db:D1Database,project:string|null){
 const installation=await readScrubbingPolicy(db,null),current=project===null?installation:await readScrubbingPolicy(db,project);
 return {...current,installationRevision:installation.revision,installationPolicy:installation.policy};
}
export function scrubbingFence(db:D1Database,project:string|null,revision:number){
 return db.prepare('INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN COALESCE((SELECT revision FROM scrubbing_policies WHERE id=?),0)=? THEN 1 ELSE 0 END').bind(policyId(project),revision);
}
export async function prepareScrubbing<T>(db:D1Database,project:string,document:T){
 const snapshot=await scrubbingSnapshot(db,project),active=snapshot.policy.rules.length+snapshot.policy.sensitiveFields.length+snapshot.installationPolicy.rules.length+snapshot.installationPolicy.sensitiveFields.length;
 const key=active?await prepareIdentityKey(db,project):null;
 const applied=active?await applyScrubbingDocument(document,snapshot.installationPolicy,snapshot.policy,value=>identityHash(key!.key,'scrubbing:'+value)):{document,matches:[]};
 return {...applied,jobs:[scrubbingFence(db,null,snapshot.installationRevision),scrubbingFence(db,project,snapshot.revision),...key?.jobs??[]]};
}
export const policyDigest=(policy:ScrubbingPolicy)=>hash(canonical(policy));
