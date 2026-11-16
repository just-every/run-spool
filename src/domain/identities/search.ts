import { identityFields, type IdentityField } from './policy';
import { identityHash } from './key';
import { permittedValue } from './values';

// This is the retained identity projection itself, not a second index. Keep
// private match hashes server-side; facet values follow the saved keep/hash
// policy. The router admits installation owners only.
export async function searchIdentities(db: D1Database, project: string, field: string | undefined, value: string | undefined) {
 const selected=field==='user.ip'?'ip_address':field?.replace(/^user\./,'');
 if(selected!==undefined&&!identityFields.includes(selected as IdentityField)||selected===undefined&&value!==undefined||selected!==undefined&&(value===undefined||!/^[a-f0-9]{64}$/.test(value)&&permittedValue(value,selected,false)!==value))throw new Error('Choose a supported identity field and value');
 const key=selected?await db.prepare('SELECT key FROM project_identity_keys WHERE project=?').bind(project).first<{key:string}>():null;
 const digest=key&&value!==undefined?await identityHash(key.key,value):null;
 const predicate=selected?`AND (json_extract(i.payload,'$.${selected}.value')=? OR json_extract(i.payload,'$.${selected}.hash')=?)`:'';
 const args=selected?[value!,digest]:[];
 const from=`FROM event_identities i JOIN events e ON e.project=i.project AND e.id=i.event AND e.occurrence=i.occurrence WHERE i.project=? ${predicate}`;
 const total=await db.prepare(`SELECT COUNT(*) count ${from}`).bind(project,...args).first<{count:number}>();
 const rows=(await db.prepare(`SELECT e.id event,e.occurrence,e.issue ${from} ORDER BY e.received DESC,e.id LIMIT 25`).bind(project,...args).all()).results;
 const facets=(await db.prepare(`SELECT j.key field,json_extract(j.value,'$.mode') mode,json_extract(j.value,'$.value') value,COUNT(*) events
  FROM event_identities i JOIN events e ON e.project=i.project AND e.id=i.event AND e.occurrence=i.occurrence,json_each(i.payload) j
  WHERE i.project=? ${predicate} GROUP BY j.key,mode,value ORDER BY j.key,events DESC,value LIMIT 1001`).bind(project,...args).all()).results;
 return {version:1,matchingEvents:total!.count,rows,facets:facets.slice(0,1000),bounds:{events:25,facets:1000,facetsComplete:facets.length<=1000},coverage:'Retained identity projection only. Dropped fields and unknown aliases cannot be searched.'};
}
