import {identityFields,type IdentityPolicy} from './policy';
import {hash,canonical} from '../privacy';
// Precomputed keyed hashes let a stricter conversion be one owner transaction,
// even for the full retained event corpus. Drop removes the hash as well.
export function convertedPayload(policy:IdentityPolicy){
 const text=JSON.stringify(policy).replaceAll("'","''");
 return `(SELECT COALESCE(json_group_object(j.key,json_object('mode',CASE WHEN json_extract('${text}','$.'||j.key)='hash' THEN 'hash' ELSE json_extract(j.value,'$.mode') END,'value',CASE WHEN json_extract('${text}','$.'||j.key)='hash' THEN json_extract(j.value,'$.hash') ELSE json_extract(j.value,'$.value') END,'hash',json_extract(j.value,'$.hash'))),'{}') FROM json_each(payload) j WHERE json_extract('${text}','$.'||j.key)<>'drop')`;
}
export const firstIdentityKey=(payload:string)=>`COALESCE(${identityFields.map(f=>`json_extract(${payload},'$.${f}.hash')`).join(',')})`;
export async function identityPreview(db:D1Database,project:string,revision:number,policy:IdentityPolicy){
 const rows=(await db.prepare('SELECT payload,user_key,reason FROM event_identities WHERE project=?').bind(project).all<any>()).results;
 const changes=Object.fromEntries(identityFields.map(f=>[f,0])),users=new Set<string>();let converted=0,unattributed=0;
 const total=await db.prepare("SELECT COUNT(*) n FROM events WHERE project=? AND json_extract(payload,'$.sentry') IS NOT NULL").bind(project).first<{n:number}>();
 const counts:Record<string,number>={records:rows.length,events:total!.n};
 for(const row of rows){const values=JSON.parse(row.payload);let changed=false;
  for(const f of identityFields){const v=values[f];for(const mode of ['keep','hash'])counts[f+'_'+mode]=(counts[f+'_'+mode]??0)+Number(v?.mode===mode);if(v&&(policy[f]==='drop'||policy[f]==='hash'&&v.mode==='keep')){changes[f]++;changed=true}if(policy[f]==='drop')delete values[f]}
  if(changed)converted++;const key=identityFields.map(f=>values[f]?.hash).find(Boolean);if(key)users.add(key);else unattributed++;
 }
 const snapshot=JSON.stringify(counts),token=await hash(canonical([project,revision,policy,counts,users.size,unattributed]));
 return {revision,policy,events:total!.n,records:rows.length,converted,fields:changes,affectedUsers:users.size||null,unattributed:total!.n-rows.length+unattributed,savedSearches:'User search keys and saved-search conversion are unavailable.',token,snapshot};
}
export function previewFence(db:D1Database,project:string,snapshot:string){
 const expected=JSON.parse(snapshot),parts=["(SELECT COUNT(*) FROM events WHERE project=? AND json_extract(payload,'$.sentry') IS NOT NULL)=?",'(SELECT COUNT(*) FROM event_identities WHERE project=?)=?'],args:any[]=[project,expected.events,project,expected.records];
 for(const f of identityFields)for(const mode of ['keep','hash']){parts.push(`(SELECT COUNT(*) FROM event_identities WHERE project=? AND json_extract(payload,'$.${f}.mode')=?)=?`);args.push(project,mode,expected[f+'_'+mode]??0)}
 return db.prepare('INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN '+parts.join(' AND ')+' THEN 1 ELSE 0 END').bind(...args);
}
