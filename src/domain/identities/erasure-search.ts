import { hash, canonical } from '../privacy';

// FIND-001 reads its tag predicates and facets directly from event payloads.
// Remove exact copies of retained identity fields, never guess from substrings
// or edit another occurrence. Hash-only fields cannot reveal old raw aliases.
export async function erasureSearchPlan(db: D1Database, project: string, predicate: string, digest: string | null, value: string) {
 const rows=(await db.prepare(`SELECT e.id,e.occurrence,e.digest,e.payload,i.payload AS identity
  FROM events e JOIN event_identities i ON i.project=e.project AND i.event=e.id AND i.occurrence=e.occurrence
  WHERE e.project=? AND e.id IN (${predicate}) AND EXISTS(
   SELECT 1 FROM json_each(e.payload,'$.sentry.tags') t WHERE
    t.key IN (?,?) OR CAST(t.value AS TEXT) IN (?,?) OR EXISTS(
     SELECT 1 FROM json_each(i.payload) f WHERE t.key IN (json_extract(f.value,'$.value'),json_extract(f.value,'$.hash'))
      OR CAST(t.value AS TEXT) IN (json_extract(f.value,'$.value'),json_extract(f.value,'$.hash')))) ORDER BY e.id`)
  .bind(project,project,digest,value,digest,value,digest).all<{id:string;occurrence:string;digest:string;payload:string;identity:string}>()).results;
 let count=0;
 const changes=await Promise.all(rows.map(async row=>{
  const tokens=new Set([value,digest,...Object.values(JSON.parse(row.identity)).flatMap((field:any)=>[field.value,field.hash])]);
  const payload=JSON.parse(row.payload),tags=payload.sentry.tags;
  payload.sentry.tags=Object.fromEntries(Object.entries(tags).filter(([key,item])=>{
   const remove=tokens.has(key)||tokens.has(String(item));if(remove)count++;return !remove;
  }));
  const encoded=JSON.stringify(payload);
  return {id:row.id,occurrence:row.occurrence,before:row.digest,payload:encoded,digest:await hash(encoded)};
 }));
 return {count,changes,fingerprint:await hash(canonical(changes))};
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
  db.prepare(`WITH changes AS MATERIALIZED (SELECT value FROM json_each(?))
   UPDATE events SET (payload,digest)=(SELECT json_extract(value,'$.payload'),json_extract(value,'$.digest')
    FROM changes WHERE json_extract(value,'$.id')=events.id)
   WHERE project=? AND id IN (SELECT json_extract(value,'$.id') FROM changes)`).bind(text,project),
 ]);
}
