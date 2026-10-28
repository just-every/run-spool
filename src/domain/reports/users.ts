import {readIdentityPolicy,identityFields} from '../identities/policy';
import type {ReportEvent} from './types';

export async function reportUsers(db:D1Database,projects:string[],events:ReportEvent[]){
 const rows=await Promise.all(projects.map(async project=>{
  const snapshot=await readIdentityPolicy(db,project),selected=events.filter(e=>e.project===project),users=new Set(selected.map(e=>e.user_key).filter((key):key is string=>key!==null));
  return {project,affectedUsers:users.size||null,events:selected.length,unattributed:selected.filter(e=>e.user_key===null).length,policy:snapshot.policy,
   reason:users.size?'Known retained user keys only':identityFields.every(f=>snapshot.policy[f]==='drop')?'unavailable (policy: drop)':'unavailable (SDK identity absent, previously dropped, or connecting-client address unavailable)'};
 }));
 const known=rows.reduce((n,r)=>n+(r.affectedUsers??0),0);
 return {affectedUsers:known||null,unattributedEvents:rows.reduce((n,r)=>n+r.unattributed,0),projects:rows,
  definition:'SDK-008: first retained Sentry id, email, username or literal ip_address after policy; native Spool events use their bounded random client identifier. Keyed project hashes define equal values. Cross-project distinct counts sum project-scoped users; the same person in two projects cannot be deduplicated. No keys is unavailable, never zero. Forwarded addresses never resolve {{auto}}.'};
}
