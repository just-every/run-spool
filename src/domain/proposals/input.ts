import { canonical, identity } from '../privacy';
import { scrubText } from '../scrub';
import { scrubStack } from './text';
import { validateGroupingPolicy } from '../grouping/rules';
const revision=(n:any)=>{if(!Number.isSafeInteger(n)||n<0)throw new Error('Expected issue revision');return n};
const text=(value:any,limit:number)=>{if(typeof value!=='string'||value.length>limit||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value))throw new Error('Proposal text exceeds bounds');return scrubText(value,limit)};
export function normalizeProposal(b:any){
 if(!b||!['split','merge','rule'].includes(b.kind))throw new Error('Expected split, merge or rule proposal');
 const fields=['kind','source','revision','variants','rationale','window',...(b.kind==='split'?['events']:b.kind==='merge'?['target','targetRevision']:['policy','policyRevision'])];
 if(Object.keys(b).sort().join()!==fields.sort().join())throw new Error('Unexpected proposal fields');
 if(!Array.isArray(b.variants)||!b.variants.length||b.variants.length>20)throw new Error('Cite 1 to 20 variants');
 const variants=b.variants.map((v:any)=>{if(!v||Object.keys(v).sort().join()!=='release,route,stack')throw new Error('Each variant cites stack, release and route');return {stack:(()=>{if(typeof v.stack!=='string'||v.stack.length>4000)throw new Error('Stack citation exceeds bounds');return scrubStack(v.stack)})(),release:text(v.release,200),route:text(v.route,500)}});
 const w=b.window;
 if(!w||Object.keys(w).sort().join()!=='end,start'||!Number.isSafeInteger(w.start)||!Number.isSafeInteger(w.end)||w.start<0||w.end<=w.start||w.end-w.start>31*86400000)throw new Error('State a positive window of at most 31 days');
 const common={kind:b.kind,source:identity(b.source,'issue'),revision:revision(b.revision)};
 let change:any;
 if(b.kind==='split'){
  if(!Array.isArray(b.events)||!b.events.length||b.events.length>200||new Set(b.events).size!==b.events.length)throw new Error('Select 1 to 200 distinct events');
  change={events:b.events.map((id:any)=>identity(id,'event'))};
 }else if(b.kind==='merge')change={target:identity(b.target,'issue'),targetRevision:revision(b.targetRevision)};
 else change={policy:validateGroupingPolicy(b.policy),policyRevision:revision(b.policyRevision)};
 const result={...common,...change,variants,rationale:text(b.rationale,2000),window:{start:w.start,end:w.end}};
 if(!result.rationale.trim()||new TextEncoder().encode(canonical(result)).length>32768)throw new Error('Proposal exceeds bounds');
 return result;
}
