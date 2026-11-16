import { hash, canonical } from '../privacy';
import { identityHash } from './key';

// FIND-001 reads its tag predicates and facets directly from event payloads.
// Remove exact copies of retained identity fields, never guess from substrings
// or edit another occurrence. Candidate tag values can be matched to retained
// private hashes without recovering or exporting the original identity.
export async function erasureSearchPlan(db: D1Database, project: string, predicate: string, digest: string | null, value: string, key: string | null) {
 const rows=(await db.prepare(`SELECT e.id,e.occurrence,e.digest,e.payload,i.payload AS identity
  FROM events e JOIN event_identities i ON i.project=e.project AND i.event=e.id AND i.occurrence=e.occurrence
  WHERE e.project=? AND e.id IN (${predicate}) AND EXISTS(SELECT 1 FROM json_each(e.payload,'$.sentry.tags')) ORDER BY e.id`)
  .bind(project,project,digest).all<{id:string;occurrence:string;digest:string;payload:string;identity:string}>()).results;
 const hashes=new Map<string,Promise<string>>();
 const tagHash=(text:string)=>{if(!hashes.has(text))hashes.set(text,identityHash(key!,text));return hashes.get(text)!};
 let count=0;
 const changes=await Promise.all(rows.map(async row=>{
  const fields=Object.values(JSON.parse(row.identity)) as {value:string;hash:string}[],tokens=new Set([value,digest,...fields.flatMap(field=>[field.value,field.hash])]),privateHashes=new Set(fields.map(field=>field.hash));
  const payload=JSON.parse(row.payload),tags=payload.sentry.tags;
  const retained=[];
  for(const [name,item] of Object.entries(tags)){
   const text=String(item),remove=tokens.has(name)||tokens.has(text)||!!key&&(privateHashes.has(await tagHash(name))||privateHashes.has(await tagHash(text)));
   if(remove)count++;else retained.push([name,item]);
  }
  payload.sentry.tags=Object.fromEntries(retained);
  const encoded=JSON.stringify(payload);
  if(Object.keys(tags).length===retained.length)return null;
  return {id:row.id,occurrence:row.occurrence,before:row.digest,payload:encoded,digest:await hash(encoded)};
 }));
 const changed=changes.filter((row):row is NonNullable<typeof row>=>row!==null);
 return {count,changes:changed,fingerprint:await hash(canonical(changed))};
}

export function erasureSearchStatements(db:D1Database,project:string,changes:Awaited<ReturnType<typeof erasureSearchPlan>>['changes']) {
 // Bounded JSON parameters keep this one atomic owner batch proportional to
 // the changed tag data, rather than one D1 statement per retained event.
 const chunks:string[]=[];let chunk:typeof changes=[],bytes=2;
 for(const row of changes){const size=new TextEncoder().encode(JSON.stringify(row)).length+1;
  if(chunk.length&&bytes+size>262144){chunks.push(JSON.stringify(chunk));chunk=[];bytes=2}
  chunk.push(row);bytes+=size;
 }
 if(chunk.length)chunks.push(JSON.stringify(chunk));
 return chunks.flatMap(text=>[
  db.prepare(`INSERT INTO rer_portability_guard(value)
   SELECT CASE WHEN COUNT(*)=json_array_length(?) THEN 1 ELSE 0 END
   FROM json_each(?) c JOIN events e ON e.project=? AND e.id=json_extract(c.value,'$.id')
    AND e.occurrence=json_extract(c.value,'$.occurrence') AND e.digest=json_extract(c.value,'$.before')`).bind(text,text,project),
  db.prepare(`WITH changes AS MATERIALIZED (
    SELECT json_extract(value,'$.id') id,json_extract(value,'$.payload') payload,json_extract(value,'$.digest') digest FROM json_each(?))
   UPDATE events SET payload=changes.payload,digest=changes.digest FROM changes
   WHERE events.project=? AND events.id=changes.id`).bind(text,project),
 ]);
}
