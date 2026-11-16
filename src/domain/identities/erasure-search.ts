import { hash, canonical, grouping, normalize } from '../privacy';
import { identityHash } from './key';
import { capturedTextRedactor } from './erasure-text';

type EventChange={id:string;occurrence:string;before:string;payload:string;digest:string};
type IssueChange={id:string;before:string;revision:number;title:string};

// FIND-001 reads event payloads; identity search reads event_identities itself.
// There is no second sensitive index to journal or restore independently.
export async function erasureSearchPlan(db: D1Database, project: string, predicate: string, digest: string | null, value: string, key: string | null, deleting=false) {
 const identities=(await db.prepare(`SELECT DISTINCT payload FROM event_identities WHERE project=? AND event IN (${predicate})`).bind(project,project,digest).all<{payload:string}>()).results;
 const tokens=new Set<string>([value,...digest?[digest]:[]]),privateHashes=new Set<string>();
 for(const row of identities)for(const field of Object.values(JSON.parse(row.payload)) as {value:string;hash:string}[]){tokens.add(field.value);tokens.add(field.hash);privateHashes.add(field.hash)}
 const hashes=new Map<string,Promise<string>>();
 const tagHash=(text:string)=>{if(!hashes.has(text))hashes.set(text,identityHash(key!,text));return hashes.get(text)!};
 const redactor=capturedTextRedactor(tokens),changes:EventChange[]=[],issueChanges:IssueChange[]=[];
 let count=0,textEvents=0,ambiguousEvents=0,groupingHeld=0,cursor='';
 // Page the read, and keep only actual mutations in the plan. Repeated strings
 // share HMAC work. No per-event database call, write or journal entry.
 for(;;){
  const rows=(await db.prepare(`SELECT id,occurrence,digest,payload FROM events WHERE project=? AND id>? ${deleting?`AND id IN (${predicate})`:''} ORDER BY id LIMIT 500`).bind(project,cursor,...deleting?[project,digest]:[]).all<{id:string;occurrence:string;digest:string;payload:string}>()).results;
  for(const row of rows){
   const payload=JSON.parse(row.payload),previous=redactor.counts();let removedTags=0;
   if(payload.sentry?.tags){const retained=[];
    for(const [name,item] of Object.entries(payload.sentry.tags)){
     const text=String(item),remove=tokens.has(name)||tokens.has(text)||!!key&&(privateHashes.has(await tagHash(name))||privateHashes.has(await tagHash(text)));
     // Whole tag entries are removed, including an exact raw copy of a
     // hash-policy alias. Partial tag content uses the same token rules.
     if(remove)removedTags++;else retained.push([name,item]);
    }
    payload.sentry.tags=Object.fromEntries(retained);
   }
   payload.message=redactor.text(payload.message);
   payload.breadcrumbs=redactor.content(payload.breadcrumbs);
   if(payload.sentry)for(const field of ['message','logentry','breadcrumbs','tags'] as const)if(payload.sentry[field]!==undefined)payload.sentry[field]=redactor.content(payload.sentry[field]);
   const current=redactor.counts();
   if(current.ambiguous>previous.ambiguous)ambiguousEvents++;
   // Content used as an immutable grouping key needs a separate migration of
   // its provenance. Do not make the next archive unrestorable or move events
   // silently. The preview and receipt name these retained copies.
   const encoded=JSON.stringify(normalize(payload));
   if(encoded===row.payload)continue;
   if(!deleting&&grouping(JSON.parse(row.payload)).basis!==grouping(JSON.parse(encoded)).basis){groupingHeld++;continue}
   count+=removedTags;
   if(current.removed>previous.removed)textEvents++;
   changes.push({id:row.id,occurrence:row.occurrence,before:row.digest,payload:encoded,digest:await hash(encoded)});
  }
  if(rows.length<500)break;cursor=rows.at(-1)!.id;
 }
 const issues=deleting?[]:(await db.prepare('SELECT id,title,revision FROM issues WHERE project=? ORDER BY id').bind(project).all<{id:string;title:string;revision:number}>()).results;
 for(const issue of issues){const title=redactor.text(issue.title);if(title!==issue.title)issueChanges.push({id:issue.id,before:issue.title,revision:issue.revision,title})}
 return {count,textEvents,ambiguousEvents,groupingHeld,changes,issueChanges,fingerprint:await hash(canonical([changes,issueChanges,ambiguousEvents,groupingHeld]))};
}

function chunks<T>(changes:T[]) {
 const chunks:string[]=[];let chunk:T[]=[],bytes=2;
 for(const row of changes){const size=new TextEncoder().encode(JSON.stringify(row)).length+1;
  if(chunk.length&&bytes+size>262144){chunks.push(JSON.stringify(chunk));chunk=[];bytes=2}
  chunk.push(row);bytes+=size;
 }
 if(chunk.length)chunks.push(JSON.stringify(chunk));
 return chunks;
}
export function erasureSearchStatements(db:D1Database,project:string,changes:EventChange[]) {
 return chunks(changes).flatMap(text=>[
  // CROSS JOIN fixes the loop order: one JSON row then an indexed exact
  // occurrence lookup. An ordinary JOIN scans the entire project for every
  // chunk and reparses its JSON once per event, making the guard quadratic.
  db.prepare(`INSERT INTO rer_portability_guard(value)
   SELECT CASE WHEN COUNT(*)=json_array_length(?) THEN 1 ELSE 0 END
   FROM json_each(?) c CROSS JOIN events e ON e.project=? AND e.id=json_extract(c.value,'$.id')
    AND e.occurrence=json_extract(c.value,'$.occurrence') AND e.digest=json_extract(c.value,'$.before')`).bind(text,text,project),
  db.prepare(`WITH changes AS MATERIALIZED (
    SELECT json_extract(value,'$.id') id,json_extract(value,'$.payload') payload,json_extract(value,'$.digest') digest FROM json_each(?))
   UPDATE events SET payload=changes.payload,digest=changes.digest FROM changes
   WHERE events.project=? AND events.id=changes.id`).bind(text,project),
 ]);
}
export function erasureIssueStatements(db:D1Database,project:string,changes:IssueChange[]) {
 return chunks(changes).flatMap(text=>[
  db.prepare(`INSERT INTO rer_portability_guard(value)
   SELECT CASE WHEN COUNT(*)=json_array_length(?) THEN 1 ELSE 0 END
   FROM json_each(?) c CROSS JOIN issues i ON i.project=? AND i.id=json_extract(c.value,'$.id')
    AND i.title=json_extract(c.value,'$.before') AND i.revision=json_extract(c.value,'$.revision')`).bind(text,text,project),
  db.prepare(`WITH changes AS MATERIALIZED (SELECT json_extract(value,'$.id') id,json_extract(value,'$.title') title FROM json_each(?))
   UPDATE issues SET title=changes.title,revision=revision+1 FROM changes WHERE issues.project=? AND issues.id=changes.id`).bind(text,project),
 ]);
}
