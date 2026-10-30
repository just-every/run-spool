import { normalize } from '../privacy';
import { previewCorrection } from '../operators/grouping';
import { previewGroupingPolicy } from '../grouping/routes';
import { readGroupingPolicy } from '../grouping/policy';
import { observe } from '../repairs/observation';
import { scrubProposalSnapshot } from './text';
import { s } from '../operators/common';
export async function proposalPreview(db:D1Database,project:string,input:any,id:string){
 if(input.kind!=='rule')return previewCorrection(db,project,input,id);
 const current=await readGroupingPolicy(db,project);
 if(current.revision!==input.policyRevision)throw new Error('Grouping rule revision conflict');
 const rows:any[]=[];let after='',page:any;
 do{page=await previewGroupingPolicy(db,project,input.policy,after);rows.push(...page.rows);after=page.next;}while(after);
 return {...page,rows,scanned:rows.length,next:null};
}
export async function issueRevisions(db:D1Database,project:string,input:any,preview:any,explanation:any){
 const ids=[...new Set<string>([input.source,...input.target?[input.target]:[],...explanation.affected.flatMap((r:any)=>[r.from,r.to]),...explanation.counterexamples.outside.map((r:any)=>r.issue)])].sort();
 const rows=(await s(db,'SELECT id,revision FROM issues WHERE project=? AND id IN (SELECT value FROM json_each(?)) ORDER BY id',project,JSON.stringify(ids)).all<any>()).results;
 if(!rows.some(r=>r.id===input.source&&r.revision===input.revision)||input.target&&!rows.some(r=>r.id===input.target&&r.revision===input.targetRevision))throw new Error('Issue revision conflict');
 return ids.map(id=>({id,revision:rows.find(r=>r.id===id)?.revision??0}));
}
export const traceUnavailableReasons=['native_event','missing_trace_context','invalid_trace_context','missing_trace_id','invalid_trace_id'] as const;
type TraceIdentity={id:string|null;unavailable:typeof traceUnavailableReasons[number]|null};
function traceIdentity(event:ReturnType<typeof normalize>):TraceIdentity {
 const unavailable=(reason:typeof traceUnavailableReasons[number]):TraceIdentity=>({id:null,unavailable:reason});
 if(!event.sentry)return unavailable('native_event');
 const context=event.sentry.contexts?.trace;
 if(context===undefined)return unavailable('missing_trace_context');
 if(!context||typeof context!=='object'||Array.isArray(context))return unavailable('invalid_trace_context');
 const id=context.trace_id;
 if(id===undefined)return unavailable('missing_trace_id');
 if(typeof id!=='string'||!(/^[a-f0-9]{32}$/i.test(id))||/^0{32}$/.test(id))return unavailable('invalid_trace_id');
 return {id:id.toLowerCase(),unavailable:null};
}
export const variantOf=(row:any)=>{
 const e=normalize(JSON.parse(row.payload));
 return {stack:JSON.stringify(e.frames),release:e.release,route:e.sentry?.transaction??(typeof e.sentry?.request?.url==='string'?e.sentry.request.url:''),trace:traceIdentity(e)};
};
export async function explainProposal(db:D1Database,row:any,preview:any){
 const input=typeof row.input==='string'?JSON.parse(row.input):row.input,project=row.project;
 const all=(await s(db,`SELECT e.*,EXISTS(SELECT 1 FROM event_suppressions x WHERE x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence) suppressed,EXISTS(SELECT 1 FROM event_grouping g WHERE g.project=e.project AND g.event=e.id AND g.occurrence=e.occurrence) corrected FROM events e WHERE project=? ORDER BY id`,project).all<any>()).results;
 const byId=new Map(all.map(e=>[e.id,e])),moves=input.kind==='rule'?preview.rows.filter((r:any)=>r.changed).map((r:any)=>({event:r.event,occurrence:r.occurrence,from:r.issue,to:r.destination})):preview.plan.moves;
 const variants=new Map(all.map(e=>[e.id,variantOf(e)])),moving=new Set(moves.map((m:any)=>m.event));
 // The reference is derived from retained affected events, never agent-supplied
 // trace claims. A rule with no moves uses retained events in its source issue.
 const candidates=all.filter(e=>moving.size?moving.has(e.id):e.issue===input.source);
 const referenceRow=candidates.find(e=>variants.get(e.id)!.trace.id!==null)??candidates[0];
 const reference=referenceRow?{event:referenceRow.id,occurrence:referenceRow.occurrence,...variants.get(referenceRow.id)!.trace}:null;
 const compared=(id:string)=>{
  const variant=variants.get(id)!,trace=variant.trace;
  return {...variant,trace:{...trace,comparison:!reference?.id||!trace.id?'unavailable':reference.id===trace.id?'same':'different'}};
 };
 const affected=moves.map((m:any)=>({...m,variant:compared(m.event)}));
 const inside=affected.map((m:any)=>{
  const differing=input.variants.map((v:any)=>['stack','release','route'].filter(k=>v[k]!==m.variant[k])).sort((a:any,b:any)=>a.length-b.length)[0];
  return {...m,issue:m.from,differing:[...differing,...m.variant.trace.comparison==='different'?['trace']:[]]};
 }).filter((m:any)=>m.differing.length);
 const outside=all.filter(e=>!moving.has(e.id)).map(e=>({event:e.id,occurrence:e.occurrence,issue:e.issue,variant:compared(e.id)})).filter(e=>input.variants.some((v:any)=>(['stack','release','route'] as const).some(k=>v[k]!==''&&v[k]===e.variant[k])));
 const ids=[...new Set<string>([input.source,...input.target?[input.target]:[],...moves.flatMap((m:any)=>[m.from,m.to])])],duration=(input.window.end-input.window.start)/60000;
 const issues=(await s(db,'SELECT i.id,i.state,a.label FROM issues i LEFT JOIN issue_assignments a ON a.project=i.project AND a.issue=i.id WHERE i.project=? AND i.id IN (SELECT value FROM json_each(?))',project,JSON.stringify(ids)).all<any>()).results;
 const inWindow=(e:any,w:any)=>!e.historical&&e.received>=w.start&&e.received<w.end;
 const rate=(issue:string)=>{
  const before=all.filter(e=>e.issue===issue&&inWindow(e,input.window)).length;
  const delta=input.kind==='rule'?0:moves.reduce((n:number,m:any)=>n+(inWindow(byId.get(m.event),input.window)?Number(m.to===issue)-Number(m.from===issue):0),0);
  return {issue,before,after:before+delta,delta,perMinuteBefore:before/duration,perMinuteAfter:(before+delta)/duration};
 };
 const rules=(await s(db,'SELECT id,revision,enabled,kinds,window_ms,threshold FROM alert_rules WHERE project=? ORDER BY id',project).all<any>()).results;
 const alertRules=rules.map(r=>{const end=input.window.end,start=end-r.window_ms;return {...r,window:{start,end},issues:ids.map(issue=>{
  const suppressed=issues.find(i=>i.id===issue)?.state==='suppressed';
  const eligible=all.filter(e=>e.issue===issue&&!suppressed&&!e.suppressed&&!e.corrected&&inWindow(e,{start,end}));
  // A corrected occurrence is excluded from spike windows, including after undo.
  const before=eligible.length,after=input.kind==='rule'?before:eligible.filter(e=>!moving.has(e.id)).length;
  return {issue,before,after,delta:after-before,conditionBefore:!!r.enabled&&JSON.parse(r.kinds).includes('spike')&&before>=r.threshold,conditionAfter:!!r.enabled&&JSON.parse(r.kinds).includes('spike')&&after>=r.threshold};
 })}});
 const open=(await s(db,"SELECT a.id,a.issue,a.kind,a.created FROM alerts a JOIN issues i ON i.project=a.project AND i.id=a.issue WHERE a.project=? AND i.state<>'resolved' AND a.issue IN (SELECT value FROM json_each(?)) ORDER BY a.created,a.id",project,JSON.stringify(ids)).all<any>()).results.map(a=>({...a,after:'preserved',movedEvents:affected.filter((m:any)=>m.from===a.issue).map((m:any)=>m.event)}));
 const repairs=(await s(db,'SELECT * FROM repairs WHERE project=? AND issue IN (SELECT value FROM json_each(?)) ORDER BY created,id',project,JSON.stringify(ids)).all<any>()).results;
 const observations=await Promise.all(repairs.map(async repair=>({id:repair.id,issue:repair.issue,created:repair.created,observation:await observe(db,repair),correctionAuditTimes:(await s(db,"SELECT created,kind FROM audit WHERE project=? AND kind IN ('grouping_applied','grouping_undone') AND created>=? ORDER BY created,id",project,repair.created).all()).results})));
 const policy=input.kind==='rule'?{before:(await readGroupingPolicy(db,project)).policy,after:input.policy,revision:input.policyRevision}:null;
 const explanation={policy,affected,counterexamples:{inside,outside},window:input.window,rates:ids.map(rate),ownership:ids.map(issue=>({issue,label:issues.find(i=>i.id===issue)?.label??null})),alerts:{rules:alertRules,open,behavior:'Corrections create no alerts or accepted units. Existing alerts and prior decisions are preserved. Moved occurrences leave spike eligibility, including after undo; suppression policies are unchanged. Rule activation affects future capture only.'},repair:{observations,behavior:'Witnessed recurrence is preserved through original membership and correction audit times. Apply and undo introduce a grouping-change coverage gap; regrouping cannot establish better repair verification. Rule changes preserve recurrence and also add this gap.'},trace:{reference,scope:'Retained Sentry error contexts only; matching identities do not establish a complete trace or sampled spans.'},behavior:input.kind==='rule'?'Exact native-rule comparison; retained events and their rates do not move on activation. Candidate destinations describe future intake.':'Exact correction moves; original payloads, membership evidence and prior decisions are preserved.'};
 return scrubProposalSnapshot(explanation);
}
