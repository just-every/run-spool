import { frameProjection } from '../agent-projection';
import { scrubText } from '../scrub';
// A stack citation may be the packet's JSON frame array. Scrub its string
// leaves as frames, preserving the exact structured identity for comparison.
export function scrubStack(value:string):string{
 let parsed;try{parsed=JSON.parse(value)}catch{return scrubText(value,value.length||1)}
 if(!Array.isArray(parsed))return scrubText(value,value.length||1);
 if(parsed.length>30||parsed.some(f=>!f||typeof f!=='object'||Array.isArray(f)||Object.keys(f).some(k=>!['file','line','column','function','debugId'].includes(k))||typeof f.file!=='string'||typeof f.function!=='string'||!Number.isSafeInteger(f.line)||f.line<1||f.column!==null&&!Number.isSafeInteger(f.column)))throw new Error('Stack JSON must be a bounded packet frame array');
 return JSON.stringify(parsed.map(frameProjection));
}
export function scrubProposalSnapshot(value:any,key=''):any{
 if(typeof value==='string')return key==='stack'?scrubStack(value):scrubText(value,value.length||1);
 if(Array.isArray(value))return value.map(item=>scrubProposalSnapshot(item));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([name,item])=>[name,scrubProposalSnapshot(item,name)]));
 return value;
}
