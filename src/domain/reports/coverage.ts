import {readRetentionPolicy,retentionCutoffs} from '../retention-policy';
import type {ReportRead,ReportInput} from './types';
import {reportScopeLimit} from './read';

export async function reportCoverage(db:D1Database,projects:string[],data:ReportRead,input:ReportInput,at:number){
 const retention=await Promise.all(projects.map(async project=>{
  const policy=await readRetentionPolicy(db,project),gaps=data.history.filter(r=>r.project===project&&r.kind==='retention_gap').map(r=>({at:r.created,...JSON.parse(r.detail)}));
  return {project,windows:policy.windows,held:policy.held,policyCutoffs:retentionCutoffs(policy.windows,at),
   appliedCutoff:gaps.length?gaps.reduce((latest,g)=>Math.max(latest,Number(g.cutoff)),0):null,removedEvents:gaps.reduce((n,g)=>n+Number(g.removed??0),0),
   removedDuringWindow:gaps.filter(g=>g.at>=input.from&&g.at<input.to).reduce((n,g)=>n+Number(g.removed??0),0),
   lastApplied:gaps.length?gaps.reduce((latest,g)=>Math.max(latest,g.at),0):null,
   definition:'Policy cutoffs describe current expiry policy at generation time. Applied cutoff and removed counts come from recorded retention operations; they do not reconstruct missing event-time buckets. Legal hold pauses expiry only.'};
 }));
 const count=(predicate:(reason:string)=>boolean)=>data.outcomes.filter(r=>predicate(r.reason)).reduce((n,r)=>n+r.count,0);
 return {bounds:{retainedInputRows:reportScopeLimit,complete:true,definition:'A report above the retained-input row budget is refused with report_scope_limit; no input rows are silently truncated. Choose fewer projects or a narrower window.'},
  sampling:'Every retained event in the requested receipt-time window is counted; no server query sampling. Upstream SDK sampling and losses before receipt are unknown. These are observed retained counts, not an estimate of all real failures.',
  retention,outcomes:data.outcomes,dropped:{
   serverRefused:count(r=>['rate_limited','budget','rejected','invalid','oversized','unregistered_release_or_build','missing_release_register_required'].includes(r)),
   clientDiscardedErrors:count(r=>r.startsWith('client_discarded:error:')),
   nativeClientDropped:data.events.reduce((n,r)=>n+(typeof r.dropped==='number'&&Number.isSafeInteger(r.dropped)&&r.dropped>0?r.dropped:0),0),
   filtered:count(r=>r==='filtered'),
  },
  outcomeWindow:{from:Math.floor(input.from/60000)*60000,to:input.to,precision:'receipt minute',definition:'Counters include whole receipt-minute buckets whose start is within this range; a partial first or last minute may include receipts outside the exact event window. Counter reasons can overlap and must not be summed as a single lost-event denominator. Filter detail reasons overlap the filtered total. Session counters are separate from error counters.'},
  coverage:[
   'Event totals use retained receipt times in [from,to); issue and state transitions use their recorded creation times. Daily boundaries follow the chosen IANA time zone; changing zone never changes the underlying instant window or totals.',
   'Affected users use retained project-scoped keys only; identities are not joined between projects. Unattributed events remain in every error total.',
   'Backlog and duration exclusions name issues with missing lifetime history, grouping changes, inconsistent state or unfinished cycles. Resolved is a recorded triage state, not proof of a successful repair.',
   'Ownership and project teams are current assignments. Assignment labels are operator labels, not verified member identities or notifications; historical ownership is unavailable.',
   'No-release errors count in all non-release totals and are explicitly excluded from named release rows. SDK-005 health uses session start time and retains its own denominators, uncertainty and coverage notes.',
  ]};
}
