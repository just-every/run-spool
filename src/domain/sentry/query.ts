import { REDACTED, secretField } from '../scrub-keyed.ts';
import { evidenceText, isObject } from './evidence-values.ts';
import type { Truncation } from './evidence-types.ts';

/** Decode before field-name checks and text scrubbing, then encode for display. */
export function requestQuery(value:unknown,notes:Truncation[]):string|undefined {
 const path='request.query_string',limit=16384;
 let entries:unknown[];
 if(typeof value==='string')entries=[...new URLSearchParams(value)];
 else if(Array.isArray(value))entries=value;
 else if(isObject(value))entries=Object.entries(value).flatMap(([key,v])=>Array.isArray(v)?v.map(item=>[key,item]):[[key,v]]);
 else {notes.push({path,reason:'invalid_query_string'});return undefined;}
 const query=new URLSearchParams();
 let invalid=0;
 for(const entry of entries){
  if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||!['string','number','boolean'].includes(typeof entry[1])){invalid++;continue;}
  // String inputs were decoded by URLSearchParams. Structured inputs are
  // already decoded, just like the request interface's other keyed fields.
  const [key,raw]=entry;
  query.append(evidenceText(key,`${path}.[key]`,notes),secretField(key)?REDACTED:evidenceText(String(raw),path,notes));
 }
 if(invalid)notes.push({path,reason:'invalid_query_parameters',omitted:invalid});
 const serialized=query.toString();
 if(serialized.length<=limit)return serialized;
 // Encoded output is ASCII. Cut only at a complete UTF-8 escape boundary,
 // reserving room for a visible marker and URLSearchParams' final '='.
 let prefix=serialized.slice(0,limit-20);
 for(;;){try {decodeURIComponent(prefix.replace(/\+/g,' '));break;}catch {prefix=prefix.slice(0,-1);}}
 const kept=[...new URLSearchParams(prefix)];
 if(kept.length)kept[kept.length-1][1]+=' [truncated]';
 const bounded=new URLSearchParams(kept).toString();
 notes.push({path,reason:'value_bytes',omitted:serialized.length-bounded.length});
 return bounded;
}
