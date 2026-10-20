import { canonical, identity } from '../privacy';
import { scrubText } from '../scrub';
import { scrubStack, scrubProposalSnapshot } from './text';
import { safeAlias } from '../audit/types';
import { normalizeProposal } from './input';
import { validateGroupingPolicy } from '../grouping/rules';
import { validateOccurrence } from '../occurrences';

export const proposalTables = {grouping_proposals:['id','project','kind','state','actor','input','explanation','revisions','correction','rule_revision','created','updated']};
export const proposalDefaults = (data:any) => ({grouping_proposals:[],...data});
const integer = (value:unknown):value is number => Number.isSafeInteger(value) && (value as number)>=0;
const digest = (value:unknown):value is string => typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
function insist(ok:unknown,reason:string):asserts ok {if(!ok)throw new Error('Archive proposal '+reason);}

// Restoring saved owner intent never invokes preview, approval or application.
export function validateProposalArchive(data:any) {
 const projects=new Set(data.projects.map((row:any)=>row.id));
 const issues=new Map<string,any>(data.issues.map((row:any)=>[row.id,row]));
 const corrections=new Map<string,any>(data.grouping_corrections.map((row:any)=>[row.id,row]));
 const seen=new Set<string>(),counts=new Map<string,number>();
 for(const row of data.grouping_proposals) {
  insist(typeof row.id==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(row.id) && !seen.has(row.id),'identity');
  insist(projects.has(row.project) && ['split','merge','rule'].includes(row.kind) && ['proposed','rejected','approved','applied','undone','stale'].includes(row.state) && safeAlias(row.actor),'identity');
  insist(integer(row.created) && integer(row.updated) && row.updated>=row.created,'timestamp');
  const input=normalizeProposal(JSON.parse(row.input));
  insist(canonical(input)===row.input && input.kind===row.kind,'input');
  validateProposalExplanation(row.explanation,data,row.project,input);
  const revisions=JSON.parse(row.revisions);
  insist(Array.isArray(revisions) && revisions.length>=1 && revisions.length<=10002 && canonical(revisions)===row.revisions,'revisions');
  const snapshot=new Map<string,number>();
  for(const saved of revisions) {
   insist(saved && typeof saved==='object' && !Array.isArray(saved) && Object.keys(saved).sort().join()==='id,revision' && digest(saved.id) && integer(saved.revision) && saved.revision>=1 && !snapshot.has(saved.id),'revision shape');
   const issue=issues.get(saved.id);
   insist(issue?.project===row.project && saved.revision<=issue.revision,'issue reference');
   snapshot.set(saved.id,saved.revision);
  }
  insist(snapshot.get(input.source)===input.revision,'source revision');
  if(input.kind==='merge')insist(snapshot.size===2 && snapshot.get(input.target)===input.targetRevision,'target revision');
  if(input.kind==='split') {
   insist(snapshot.size===1,'split revision');
   for(const id of input.events) {
    // Retention may have removed selected occurrences; existing IDs must still
    // belong to this project. A missing occurrence cannot be applied on restore.
    const retained=data.events.filter((event:any)=>event.id===id);
    insist(!retained.length || retained.some((event:any)=>event.project===row.project),'event reference');
   }
  }
  if(row.kind==='rule') {
   insist(row.correction===null,'rule correction');
   const policy=data.grouping_policies.find((policy:any)=>policy.project===row.project);
   insist(input.kind==='rule' && input.policyRevision<=(policy?.revision??0),'policy reference');
   insist(row.rule_revision===null || integer(row.rule_revision) && row.rule_revision>=1 && row.rule_revision<=(policy?.revision??0),'rule revision');
   if(['applied','undone'].includes(row.state))insist(row.rule_revision!==null,'applied rule revision');
  } else {
   insist(row.rule_revision===null,'correction revision');
   if(row.correction!==null) {
    const correction=corrections.get(row.correction);
    insist(correction?.project===row.project && correction.kind===row.kind,'correction reference');
    if(['applied','undone'].includes(row.state))insist(correction.state===row.state,'correction state');
   }
   if(['applied','undone'].includes(row.state))insist(row.correction!==null,'applied correction');
  }
  seen.add(row.id);counts.set(row.project,(counts.get(row.project)??0)+1);
  insist(counts.get(row.project)!<=50,'budget');
 }
}

// Reapply today's scrubber when saved intent leaves storage, as with events.
export function proposalExportRow(table:string,row:any) {
 return table==='grouping_proposals'?{...row,input:canonical(normalizeProposal(JSON.parse(row.input))),explanation:canonical(scrubProposalSnapshot(JSON.parse(row.explanation)))}:row;
}

const explanationLimit=2*1024*1024;
function fields(value:any,names:string[]) {
 insist(value && typeof value==='object' && !Array.isArray(value) && Object.keys(value).sort().join()===names.sort().join(),'explanation shape');
}
function list(value:any,max=10000):asserts value is any[] {insist(Array.isArray(value) && value.length<=max,'explanation list');}
function text(value:any,max=explanationLimit) {insist(typeof value==='string' && value.length<=max && scrubText(value,max)===value,'explanation text');}

// A historical review contains bounded summaries and identifiers, never raw
// event payloads. Missing retained occurrences are valid historical evidence.
function validateProposalExplanation(encoded:any,data:any,project:string,input:any) {
 insist(typeof encoded==='string' && new TextEncoder().encode(encoded).length<=explanationLimit,'explanation budget');
 const review=JSON.parse(encoded);
 insist(canonical(review)===encoded && canonical(scrubProposalSnapshot(review))===encoded,'explanation encoding');
 fields(review,['policy','affected','counterexamples','window','rates','ownership','alerts','repair','trace','behavior']);
 if(input.kind==='rule'){fields(review.policy,['before','after','revision']);validateGroupingPolicy(review.policy.before);validateGroupingPolicy(review.policy.after);insist(review.policy.revision===input.policyRevision && canonical(review.policy.after)===canonical(input.policy),'explanation policy');}else insist(review.policy===null,'explanation policy');
 const issue=(id:any)=>{insist(digest(id),'explanation issue');const row=data.issues.find((row:any)=>row.id===id);insist(!row || row.project===project,'explanation issue reference');};
 const event=(id:any,occurrence?:any)=>{identity(id,'event');if(occurrence!==undefined)validateOccurrence(occurrence);};
 const window=(value:any)=>{fields(value,['start','end']);insist(Number.isSafeInteger(value.start) && Number.isSafeInteger(value.end),'explanation window');};
 const variant=(value:any)=>{fields(value,['stack','release','route']);insist(typeof value.stack==='string'&&scrubStack(value.stack)===value.stack,'explanation stack');text(value.release,200);text(value.route);};
 const counter=(value:any,rate=false)=>{
  fields(value,['issue','before','after','delta',...(rate?['perMinuteBefore','perMinuteAfter']:['conditionBefore','conditionAfter'])]);issue(value.issue);
  insist(integer(value.before) && integer(value.after) && value.before<=10000 && value.after<=10000 && value.delta===value.after-value.before,'explanation count');
  if(rate)insist(Number.isFinite(value.perMinuteBefore) && value.perMinuteBefore>=0 && Number.isFinite(value.perMinuteAfter) && value.perMinuteAfter>=0,'explanation rate');
  else insist(typeof value.conditionBefore==='boolean' && typeof value.conditionAfter==='boolean','explanation alert condition');
 };
 const move=(value:any,inside=false)=>{
  fields(value,['event','occurrence','from','to','variant',...(inside?['issue','differing']:[])]);event(value.event,value.occurrence);issue(value.from);issue(value.to);variant(value.variant);
  if(inside){insist(value.issue===value.from,'explanation inside issue');list(value.differing,3);insist(new Set(value.differing).size===value.differing.length && value.differing.every((key:any)=>['stack','release','route'].includes(key)),'explanation differing');}
 };
 list(review.affected);review.affected.forEach((value:any)=>move(value));
 fields(review.counterexamples,['inside','outside']);list(review.counterexamples.inside);review.counterexamples.inside.forEach((value:any)=>move(value,true));
 list(review.counterexamples.outside);for(const value of review.counterexamples.outside){fields(value,['event','occurrence','issue','variant']);event(value.event,value.occurrence);issue(value.issue);variant(value.variant);}
 window(review.window);insist(canonical(review.window)===canonical(input.window),'explanation review window');
 list(review.rates,20002);review.rates.forEach((value:any)=>counter(value,true));
 list(review.ownership,20002);for(const value of review.ownership){fields(value,['issue','label']);issue(value.issue);if(value.label!==null)text(value.label,80);}
 fields(review.alerts,['rules','open','behavior']);text(review.alerts.behavior);list(review.alerts.rules,20);
 for(const rule of review.alerts.rules){
  fields(rule,['id','revision','enabled','kinds','window_ms','threshold','window','issues']);text(rule.id,201);insist(integer(rule.revision) && rule.revision>=1 && [0,1].includes(rule.enabled) && integer(rule.window_ms) && rule.window_ms>=60000 && rule.window_ms<=86400000 && integer(rule.threshold) && rule.threshold>=2 && rule.threshold<=10000,'explanation alert rule');
  const kinds=JSON.parse(rule.kinds);list(kinds,3);insist(kinds.length>0 && kinds.every((kind:any)=>['new_issue','regression','spike'].includes(kind)),'explanation alert kinds');
  window(rule.window);insist(rule.window.end-rule.window.start===rule.window_ms,'explanation alert window');list(rule.issues,20002);rule.issues.forEach((value:any)=>counter(value));
 }
 list(review.alerts.open);for(const alert of review.alerts.open){
  fields(alert,['id','issue','kind','created','after','movedEvents']);text(alert.id,201);issue(alert.issue);insist(['new_issue','regression','spike'].includes(alert.kind) && integer(alert.created) && alert.after==='preserved','explanation alert');list(alert.movedEvents);alert.movedEvents.forEach((id:any)=>event(id));
 }
 fields(review.repair,['observations','behavior']);text(review.repair.behavior);list(review.repair.observations);
 for(const repair of review.repair.observations){
  fields(repair,['id','issue','created','observation','correctionAuditTimes']);text(repair.id,100);issue(repair.issue);insist(integer(repair.created),'explanation repair time');list(repair.correctionAuditTimes);
  for(const audit of repair.correctionAuditTimes){fields(audit,['created','kind']);insist(integer(audit.created) && ['grouping_applied','grouping_undone'].includes(audit.kind),'explanation correction audit');}
  const observation=repair.observation;fields(observation,['verdict','reasons','evidence','limits']);insist(['recurred','inconclusive','no_recurrence_after_exercise'].includes(observation.verdict),'explanation verdict');text(observation.limits);list(observation.reasons,20);
  for(const reason of observation.reasons){fields(reason,['code','reason']);text(reason.code,100);text(reason.reason);}
  const evidence=observation.evidence;fields(evidence,['release','window','recurrence','olderReleaseEvents','releaseEvents','mapStored','loss']);
  if(evidence.release!==null){fields(evidence.release,['name','sequence','build','registered']);text(evidence.release.name,200);text(evidence.release.build,100);insist(integer(evidence.release.sequence) && integer(evidence.release.registered),'explanation release');}
  if(evidence.window!==null)window(evidence.window);
  insist(integer(evidence.releaseEvents) && evidence.releaseEvents<=10000 && typeof evidence.mapStored==='boolean','explanation evidence');
  for(const key of ['recurrence','olderReleaseEvents']){
   const value=evidence[key];fields(value,['count','events',...(key==='olderReleaseEvents'?['counted']:[])]);insist(integer(value.count) && value.count<=10000 && (key!=='olderReleaseEvents'||value.counted===false),'explanation recurrence');list(value.events,10);
   for(const saved of value.events){fields(saved,['id','release','sequence','received']);event(saved.id);text(saved.release,200);insist(integer(saved.sequence) && integer(saved.received),'explanation recurrence event');}
  }
  list(evidence.loss);for(const loss of evidence.loss){fields(loss,['reason','count']);text(loss.reason,200);insist(integer(loss.count),'explanation loss');}
 }
 text(review.trace,200);text(review.behavior);
}
