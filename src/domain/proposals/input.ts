import { canonical, identity } from '../privacy';
import { scrubText } from '../scrub';
import { validateGroupingPolicy, type GroupingPolicy } from '../grouping/rules';
import { scrubStack } from './text';

export const PROPOSAL_BYTES = 32768;
type ProposalChange =
 | {kind:'split';events:string[]}
 | {kind:'merge';target:string;targetRevision:number}
 | {kind:'rule';policy:GroupingPolicy;policyRevision:number};

export class ProposalInputError extends Error {
 constructor(readonly field:string, message:string) { super(message); }
}

const record=(value:unknown): value is Record<string,any> => !!value && typeof value==='object' && !Array.isArray(value);
function revision(value:unknown,field:string) {
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new ProposalInputError(field,'Use the current revision as a nonnegative integer.');
 return value;
}
function text(value:unknown,limit:number,field:string) {
 if(typeof value!=='string'||value.length>limit||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value))throw new ProposalInputError(field,`Use text up to ${limit} characters without control characters.`);
 return scrubText(value,limit);
}
function selection(value:unknown,field:string,kind:'issue'|'event') {
 try{return identity(value,kind);}catch{
  throw new ProposalInputError(field,kind==='issue'?'Use the full issue ID from the current packet.':'Use a retained event ID from the current packet.');
 }
}
function exactFields(value:Record<string,unknown>,fields:string[],path='body') {
 if(Object.keys(value).some(key=>!fields.includes(key)))throw new ProposalInputError(path,`Use only these fields: ${fields.join(', ')}.`);
}

export function normalizeProposal(input:unknown) {
 if(!record(input))throw new ProposalInputError('body','Send a JSON object.');
 const {kind}=input;
 if(kind!=='split'&&kind!=='merge'&&kind!=='rule')throw new ProposalInputError('kind','Use split, merge or rule.');
 exactFields(input,['kind','source','revision','variants','rationale','window',...(kind==='split'?['events']:kind==='merge'?['target','targetRevision']:['policy','policyRevision'])]);
 const common={source:selection(input.source,'source','issue'),revision:revision(input.revision,'revision')};
 const rationale=text(input.rationale,2000,'rationale');
 if(!rationale.trim())throw new ProposalInputError('rationale','Explain the proposed grouping change in one or more words.');
 if(!Array.isArray(input.variants)||!input.variants.length||input.variants.length>20)throw new ProposalInputError('variants','Cite 1 to 20 packet variants.');
 const variants=input.variants.map((variant:unknown,index:number)=>{
  const path=`variants[${index}]`;
  if(!record(variant))throw new ProposalInputError(path,'Use an object with stack, release and route.');
  exactFields(variant,['stack','release','route'],path);
  if(typeof variant.stack!=='string'||variant.stack.length>4000)throw new ProposalInputError(path+'.stack','Use JSON.stringify(row.event.frames), up to 4000 characters. If needed, select fewer whole frames before serializing.');
  let stack:string;
  try{stack=scrubStack(variant.stack);}catch{throw new ProposalInputError(path+'.stack','Serialize the retained packet frames with JSON.stringify(row.event.frames).');}
  if(typeof variant.release!=='string')throw new ProposalInputError(path+'.release','Copy row.event.release. Use an empty string if the release is unknown.');
  if(typeof variant.route!=='string')throw new ProposalInputError(path+'.route','Use the available sanitized route or an empty string.');
  const release=text(variant.release,200,path+'.release'),route=text(variant.route,500,path+'.route');
  return {stack,release,route};
 });
 const {window}=input;
 if(!record(window))throw new ProposalInputError('window','Use an object with start and end in received-time Unix milliseconds.');
 exactFields(window,['start','end'],'window');
 for(const field of ['start','end'])if(!Number.isSafeInteger(window[field])||window[field]<0)throw new ProposalInputError('window.'+field,'Use a nonnegative integer in received-time Unix milliseconds.');
 if(window.end<=window.start||window.end-window.start>31*86400000)throw new ProposalInputError('window.end','Use an end after window.start and within 31 days of it.');
 let change:ProposalChange;
 if(kind==='split'){
  const {events}=input;
  if(!Array.isArray(events)||!events.length||events.length>200||new Set(events).size!==events.length)throw new ProposalInputError('events','Select 1 to 200 distinct retained event IDs.');
  change={kind,events:events.map((id:unknown,index:number)=>selection(id,`events[${index}]`,'event'))};
 }else if(kind==='merge'){
  change={kind,target:selection(input.target,'target','issue'),targetRevision:revision(input.targetRevision,'targetRevision')};
 }else{
  let policy;
  try{policy=validateGroupingPolicy(input.policy);}catch{throw new ProposalInputError('policy','Use version 1 with valid stack and fingerprint rules. Use an empty string for an unused rule kind.');}
  change={kind,policy,policyRevision:revision(input.policyRevision,'policyRevision')};
 }
 const result={...common,...change,variants,rationale,window:{start:window.start,end:window.end}};
 if(new TextEncoder().encode(canonical(result)).length>PROPOSAL_BYTES)throw new ProposalInputError('body','Use fewer variant citations to fit within 32768 UTF-8 bytes.');
 return result;
}
