import {permittedValue} from './values';
import {identityPolicy,identityFields,defaultIdentityPolicy} from './policy';
import {identityHash} from './key';
import {hash,canonical} from '../privacy';
export const identityTables={identity_policies:['project','revision','policy','updated'],event_identities:['project','event','occurrence','payload','user_key','reason']};
export const identityDefaults=(data:any)=>({...Object.fromEntries(Object.keys(identityTables).map(k=>[k,[]])),...data});
export async function validateIdentityArchive(data:any){
 const policies=new Map<string,any>(),keys=new Map<string,string>(data.project_identity_keys.map((r:any)=>[r.project,r.key])),seen=new Set<string>();
 for(const r of data.identity_policies){const policy=identityPolicy(JSON.parse(r.policy));if(policies.has(r.project)||JSON.stringify(policy)!==r.policy||!Number.isSafeInteger(r.revision)||r.revision<1||!Number.isSafeInteger(r.updated)||r.updated<0)throw new Error('Archive identity policy');policies.set(r.project,{...r,policy})}
 for(const r of data.event_identities){
  const id=JSON.stringify([r.project,r.event,r.occurrence]),policy=policies.get(r.project)?.policy??defaultIdentityPolicy(),values=JSON.parse(r.payload);
  if(seen.has(id)||!data.events.some((e:any)=>e.project===r.project&&e.id===r.event&&e.occurrence===r.occurrence)||!values||Array.isArray(values)||typeof values!=='object'||JSON.stringify(values)!==r.payload||!['retained','policy_drop','client_address_unavailable','sdk_sent_no_permitted_identity'].includes(r.reason))throw new Error('Archive event identity');seen.add(id);
  for(const [field,v] of Object.entries(values) as any){
   if(!identityFields.includes(field)||!v||Object.keys(v).sort().join()!=='hash,mode,value'||!['keep','hash'].includes(v.mode)||policy[field]==='drop'||policy[field]==='hash'&&v.mode==='keep'||typeof v.value!=='string'||!v.value||v.value.length>320||!/^[a-f0-9]{64}$/.test(v.hash)||!keys.has(r.project)||v.mode==='hash'&&v.value!==v.hash||v.mode==='keep'&&permittedValue(v.value,field)!==v.value||v.mode==='keep'&&await identityHash(keys.get(r.project)!,v.value)!==v.hash)throw new Error('Archive identity value');
  }
  if(r.user_key!==(identityFields.map(f=>(values as any)[f]?.hash).find(Boolean)??null))throw new Error('Archive affected user key');
 }
 for(const r of data.audit.filter((r:any)=>r.kind==='identity_policy_changed')){const d=JSON.parse(r.detail),current=policies.get(r.project);if(!Number.isSafeInteger(d.revision)||d.revision<1||current&&d.revision>current.revision||!Number.isSafeInteger(d.converted)||d.converted<0||!/^[a-f0-9]{64}$/.test(d.policyDigest)||current&&d.revision===current.revision&&d.policyDigest!==await hash(canonical(current.policy)))throw new Error('Archive identity policy audit')}
}
