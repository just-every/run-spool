export const identityFields=['id','email','username','ip_address'] as const;
export type IdentityField=typeof identityFields[number];
export type Mode='keep'|'hash'|'drop';
export type IdentityPolicy=Record<IdentityField,Mode>;
export const defaultIdentityPolicy=():IdentityPolicy=>({id:'drop',email:'drop',username:'drop',ip_address:'drop'});
export function identityPolicy(v:any):IdentityPolicy{
 if(!v||typeof v!=='object'||Object.keys(v).sort().join()!==[...identityFields].sort().join()||identityFields.some(f=>!['keep','hash','drop'].includes(v[f])))throw new Error('Choose keep, hash or drop for id, email, username and ip_address');
 return Object.fromEntries(identityFields.map(f=>[f,v[f]])) as IdentityPolicy;
}
export async function readIdentityPolicy(db:D1Database,project:string){
 const row=await db.prepare('SELECT revision,policy FROM identity_policies WHERE project=?').bind(project).first<any>();
 if(row)return {revision:row.revision,policy:identityPolicy(JSON.parse(row.policy))};
 // Erasure removes configuration, while AUDIT-001 keeps safe chronology. A
 // successor starts at that revision floor without reviving any old policy.
 const history=await db.prepare("SELECT COALESCE(MAX(json_extract(detail,'$.revision')),0) revision FROM audit WHERE project=? AND kind='identity_policy_changed'").bind(project).first<{revision:number}>();
 return {revision:history!.revision,policy:defaultIdentityPolicy()};
}
export const identityPolicyFence=(db:D1Database,project:string,revision:number)=>db.prepare("INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN COALESCE((SELECT revision FROM identity_policies WHERE project=?),(SELECT MAX(json_extract(detail,'$.revision')) FROM audit WHERE project=? AND kind='identity_policy_changed'),0)=? THEN 1 ELSE 0 END").bind(project,project,revision);
