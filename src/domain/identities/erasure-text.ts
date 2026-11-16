// Match complete captured tokens, including a token embedded in a sentence.
// A substring of another identifier is not an attributable copy. Never apply
// this to structural event IDs, release identities or grouping configuration.
const before=/(?:[\p{L}\p{M}\p{N}_]|[\p{L}\p{M}\p{N}_][.+@-])$/u;
const after=/^(?:[\p{L}\p{M}\p{N}_]|[.+@-][\p{L}\p{M}\p{N}_])/u;
export function capturedTextRedactor(tokens: Set<string>) {
 const ordered=[...tokens].filter(Boolean).sort((a,b)=>b.length-a.length);
 // Empty replacement cannot itself retain a short supplied identity or be
 // mistaken for a new alias. Message and breadcrumb strings may be empty.
 const expression=ordered.length?new RegExp(ordered.map(token=>token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gu'):null;
 let ambiguous=0,removed=0;
 const text=(input:string)=>expression?input.replace(expression,(match:string,offset:number)=>{
  if(before.test(input.slice(Math.max(0,offset-3),offset))||after.test(input.slice(offset+match.length,offset+match.length+3))){ambiguous++;return match}
  removed++;return '';
 }):input;
 const content=(value:any):any=>{
  if(typeof value==='string')return text(value);
  if(Array.isArray(value))return value.map(content);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>{
   // Captured map keys are content too. Drop an exactly attributable entry,
   // rather than inventing a key or colliding with another retained entry.
   const cleaned=text(key);return cleaned===key?[key,content(item)]:null;
  }).filter((entry):entry is [string,any]=>entry!==null));
  return value;
 };
 return {text,content,counts:()=>({ambiguous,removed})};
}
