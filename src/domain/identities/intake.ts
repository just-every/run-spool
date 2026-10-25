import {prepareScrubbing} from '../scrubbing/model';
import {prepareIdentityKey} from './key';
import {identityValues} from './values';
import {identityFields,readIdentityPolicy,identityPolicyFence} from './policy';
export async function prepareEventIdentity(db:D1Database,project:string,user:any){
 const snapshot=await readIdentityPolicy(db,project),key=identityFields.some(f=>snapshot.policy[f]!=='drop')?await prepareIdentityKey(db,project):null;
 const scrubbed=await prepareScrubbing(db,project,{user});
 const projected=await identityValues(scrubbed.document.user,snapshot.policy,key?.key??null);
 return {project,...snapshot,...projected,jobs:[...scrubbed.jobs,...key?.jobs??[]],present:user!==undefined};
}
export type PreparedIdentity=Awaited<ReturnType<typeof prepareEventIdentity>>;
export function eventIdentityStatements(db:D1Database,prepared:PreparedIdentity,event:string,occurrence:string){
 return [identityPolicyFence(db,prepared.project,prepared.revision),...prepared.jobs,...prepared.present?[db.prepare('INSERT INTO event_identities VALUES(?,?,?,?,?,?)').bind(prepared.project,event,occurrence,JSON.stringify(prepared.values),prepared.userKey,prepared.reason)]:[]];
}
