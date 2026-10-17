import { scrubText } from '../scrub.ts';
import { secretField, REDACTED } from '../scrub-keyed.ts';
import type { Json, Truncation } from './evidence-types.ts';
export const isObject = (v:any):v is Record<string,any> => !!v && typeof v==='object' && !Array.isArray(v);
const encoder=new TextEncoder();
export function evidenceText(value:string,path:string,notes:Truncation[],limit=16384):string {
 const bound=(text:string)=>{
  const bytes=encoder.encode(text);
  if(bytes.length<=limit)return text;
  const kept=new TextDecoder().decode(bytes.subarray(0,limit-16)).replace(/\uFFFD$/,'')+' [truncated]';
  notes.push({path,reason:'value_bytes',omitted:bytes.length-encoder.encode(kept).length});
  return kept;
 };
 // Scrubbing may expand a short credential into a redaction marker. Apply the
 // byte bound after that expansion too, and always mark an actual cut.
 return bound(scrubText(bound(value),limit*16));
}
/** Every structured leaf is scrubbed; secret-named keys mask the whole value. */
export function evidenceValue(value:any,path:string,notes:Truncation[],depth=0):Json {
 if(value===null||typeof value==='boolean')return value;
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 if(typeof value==='string')return evidenceText(value,path,notes);
 if(depth>=10){notes.push({path,reason:'value_depth'});return '[truncated: nesting limit]';}
 if(Array.isArray(value))return value.map((item,index)=>evidenceValue(item,`${path}.${index}`,notes,depth+1));
 if(isObject(value))return Object.fromEntries(Object.entries(value).map(([key,item])=>[
  evidenceText(key,`${path}.[key]`,notes),secretField(key)?REDACTED:evidenceValue(item,`${path}.${key}`,notes,depth+1)
 ]));
 return null;
}
export function evidenceRecord(value:any,path:string,notes:Truncation[]):Record<string,Json>|undefined {
 return isObject(value)?evidenceValue(value,path,notes) as Record<string,Json>:undefined;
}
/** The 16 KiB bound applies to each local, including structured local values. */
export function frameVariables(value:any,path:string,notes:Truncation[]):Record<string,Json>|undefined {
 if(!isObject(value))return undefined;
 return Object.fromEntries(Object.entries(value).map(([key,raw])=>{
  const name=evidenceText(key,`${path}.[key]`,notes),at=`${path}.${key}`;
  let kept=secretField(key)?REDACTED:evidenceValue(raw,at,notes);
  if(kept!==null&&typeof kept==='object'){
   const serialized=JSON.stringify(kept);
   if(encoder.encode(serialized).length>16384)kept=evidenceText(serialized,at,notes);
  }
  return [name,kept];
 }));
}
