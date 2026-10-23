import {bounded,scrub} from '../scrub';
import {validIpRange} from '../filters/network';
import {identityFields,type IdentityPolicy} from './policy';
import {identityHash} from './key';
export type IdentityValues=Partial<Record<typeof identityFields[number],{mode:'keep'|'hash';value:string;hash:string}>>;
// Explicitly permitted identity fields retain PII under keep. Credential-shaped
// material and keyed credentials remain excluded; generic event text is unchanged.
export function permittedValue(value:unknown,field:string,keep=true):string|null{
 if(typeof value!=='string'&&typeof value!=='number')return null;
 const text=String(value),limit=field==='email'?320:field==='ip_address'?80:256;
 if(!text||text.length>limit||/[\x00-\x1f\x7f]/.test(text))return null;
 if(field==='ip_address'&&(!validIpRange(text)||text.includes('/')))return null;
 const cleaned=scrub(text),literalIp=!text.includes('/')&&validIpRange(text),literalEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
 if(keep&&cleaned!==text&&!literalIp&&!(literalEmail&&cleaned==='[email]'))return null;
 return bounded(text,limit);
}
export async function identityValues(user:any,policy:IdentityPolicy,key:string|null){
 const values:IdentityValues={};let unavailableAddress=false;
 if(user&&typeof user==='object'&&!Array.isArray(user))for(const field of identityFields){
  if(policy[field]==='drop')continue;
  if(field==='ip_address'&&user[field]==='{{auto}}'){unavailableAddress=true;continue} // No forwarded header is a connecting-client authority.
  const raw=permittedValue(user[field],field,policy[field]==='keep');if(raw===null)continue;
  const hash=await identityHash(key!,raw);values[field]={mode:policy[field] as 'keep'|'hash',value:policy[field]==='hash'?hash:raw,hash};
 }
 const userKey=identityFields.map(f=>values[f]?.hash).find(Boolean)??null;
 return {values,userKey,reason:userKey?'retained':identityFields.every(f=>policy[f]==='drop')?'policy_drop':unavailableAddress?'client_address_unavailable':'sdk_sent_no_permitted_identity'};
}
