import {reportBucketAt} from './window';
import type {ExcludedIssue,ReportRead,ReportBucket,ReportInput,StateCounts} from './types';

const key=(project:string,issue:string)=>JSON.stringify([project,issue]);
const states=['open','acknowledged','resolved','suppressed'] as const;
type State=typeof states[number];
type Transition={at:number;state:State;source:string;order:number};
const empty=():StateCounts=>({open:0,acknowledged:0,resolved:0,suppressed:0,total:0,excluded:0});
function distribution(samples:number[],excludedIssues:ExcludedIssue[]){
 samples.sort((a,b)=>a-b);const count=samples.length,middle=Math.floor(count/2);
 return {count,medianMs:count?(count%2?samples[middle]:(samples[middle-1]+samples[middle])/2):null,p90Ms:count?samples[Math.ceil(count*.9)-1]:null,excludedIssues};
}

export function reportHistory(data:ReportRead,input:ReportInput,buckets:ReportBucket[]){
 const started=new Map<string,number>(),transitions=new Map<string,Transition[]>(),corrected=new Set<string>();
 for(const row of data.corrections){const plan=JSON.parse(row.plan);for(const issue of [...plan.issues.map((i:{id:string})=>i.id),plan.target])corrected.add(key(row.project,issue))}
 data.history.forEach((row,order)=>{
  const detail=JSON.parse(row.detail);if(typeof detail.issue!=='string')return;
  const id=key(row.project,detail.issue);
  if(row.kind==='capture_history_started'){started.set(id,row.created);return}
  const state=row.kind==='commit_resolution'?'resolved':detail.state;
  if(row.kind!=='triage'&&row.kind!=='commit_resolution'||!states.includes(state))return;
  const list=transitions.get(id)??[];list.push({at:row.created,state,source:'audit',order});transitions.set(id,list);
 });
 for(const [order,row] of data.alerts.entries())if(row.kind==='regression'){
  const id=key(row.project,row.issue),list=transitions.get(id)??[];list.push({at:row.created,state:'open',source:'regression',order});transitions.set(id,list);
 }
 const start=empty(),end=empty(),excludedIssues:ExcludedIssue[]=[],ackSamples:number[]=[],repairSamples:number[]=[],ackExcluded:ExcludedIssue[]=[],repairExcluded:ExcludedIssue[]=[];
 let newIssues=0,regressions=0,resolutions=0;const regressed=new Set<string>(),resolved=new Set<string>();
 const inside=(at:number)=>at>=input.from&&at<input.to;
 for(const issue of data.issues){
  const id=key(issue.project,issue.id),birth=started.get(id),list=(transitions.get(id)??[]).sort((a,b)=>a.at-b.at||(a.source===b.source?a.order-b.order:a.source==='audit'?-1:1));
  const initial=birth??issue.first_seen;
  if(initial>=input.to)continue;
  let reason:string|null=null;
  if(birth===undefined)reason='Lifetime capture history is unavailable (legacy, imported or split issue)';
  else if(corrected.has(id))reason='Grouping correction changed issue membership; historical backlog and durations cannot be reconstructed';
  else if(list.some(t=>t.at<birth))reason='State history precedes the recorded issue lifetime';
  else if(list.some((t,n)=>n>0&&t.at===list[n-1].at&&t.source!==list[n-1].source))reason='State and regression timestamps are tied; their cross-source order is unavailable';
  else if((list.at(-1)?.state??'open')!==issue.state)reason='Recorded transitions do not reconcile the current issue state';
  if(reason){
   const exclusion={project:issue.project,issue:issue.id,reason};excludedIssues.push(exclusion);end.excluded++;if(initial<input.from)start.excluded++;
   if(inside(initial)||list.some(t=>t.source==='regression'&&inside(t.at))){ackExcluded.push(exclusion);repairExcluded.push(exclusion)}
   continue;
  }
  // Initial state is proven by the native capture fact, rather than inferred
  // from an old issue's current state or its oldest remaining event.
  const stateAt=(at:number)=>{let state:State='open';for(const t of list){if(t.at>=at)break;state=t.state}return state};
  if(initial<input.from){start[stateAt(input.from)]++;start.total++}
  end[stateAt(input.to)]++;end.total++;
  if(inside(initial)){newIssues++;reportBucketAt(buckets,initial)!.newIssues++}
  let previous:State='open';
  for(const t of list){
   if(t.source==='regression'&&inside(t.at)){regressions++;regressed.add(id);reportBucketAt(buckets,t.at)!.regressions++}
   if(t.state==='resolved'&&previous!=='resolved'&&inside(t.at)){resolutions++;resolved.add(id);reportBucketAt(buckets,t.at)!.resolutions++}
   previous=t.state;
  }
  const cycles=[initial,...list.filter(t=>t.source==='regression').map(t=>t.at)];
  for(let n=0;n<cycles.length;n++){
   const at=cycles[n];if(!inside(at))continue;
   const limit=Math.min(cycles[n+1]??input.to,input.to),cycle=list.filter(t=>t.at>=at&&t.at<limit);
   for(const [state,samples,excluded] of [['acknowledged',ackSamples,ackExcluded],['resolved',repairSamples,repairExcluded]] as const){
    const completion=cycle.find(t=>t.source==='audit'&&t.state===state);
    if(completion)samples.push(completion.at-at);
    else excluded.push({project:issue.project,issue:issue.id,reason:`${state==='resolved'?'Resolution':'Explicit acknowledgement'} was not recorded before ${cycles[n+1]!==undefined&&cycles[n+1]<input.to?'the next regression':'the window end'}`});
   }
  }
 }
 return {backlog:{start,end,newIssues,regressedIssues:regressed.size,regressions,resolvedIssues:resolved.size,resolutions,excludedIssues,
  method:'Backlog is the state immediately before each window boundary, reconstructed from lifetime capture, triage and commit-resolution audit and regression alerts. Missing or inconsistent chronology is excluded and named. New issues and transitions count only reconstructable lifetimes; repeated writes of the same resolved state add no resolution.'},
 durations:{acknowledge:distribution(ackSamples,ackExcluded),repair:distribution(repairSamples,repairExcluded),
  method:'One sample per new-issue or regression cycle starting in the window, ending at the first explicit acknowledgement or resolution before the next regression or window end. Review alone is not acknowledgement. Repair measures recorded resolution time, not independently verified successful repair. Median uses the middle value (mean of the two middle values for even samples); p90 uses nearest rank. Unfinished or unprovable cycles are excluded and named.'},
 review:{reviewed:data.reviews.filter(r=>inside(r.reviewed)).length,method:'Current retained review stamps recorded in the window; overwritten earlier review stamps cannot be reconstructed. Review and acknowledgement are distinct.'}};
}
