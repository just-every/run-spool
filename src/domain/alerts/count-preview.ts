import type { AlertEnvironment } from './types';
import { statement as s } from './types';
import { destinationChoices } from './destinations.server';
import { auditActor } from '../audit/identity';

// Preview and both scheduler reads use this exact retained-event predicate.
const eligible="e.historical=0 AND NOT EXISTS(SELECT 1 FROM event_suppressions x WHERE x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence) AND NOT EXISTS(SELECT 1 FROM event_grouping g WHERE g.project=e.project AND g.event=e.id AND g.occurrence=e.occurrence)";
export const countableIssue=(alias:string)=>`${alias}.algorithm IN ('js-frame-v1','python-frame-v1','go-frame-v1','sentry-chain-v1') AND ${alias}.state<>'suppressed'`;
const matching=`${eligible} AND e.received>=? AND e.received<? AND (? IS NULL OR e.environment=? COLLATE BINARY)`;
export const windowCountsSql=`SELECT i.id,COUNT(*) count FROM events e JOIN issues i ON i.id=e.issue AND i.project=e.project WHERE e.project=? AND ${matching} AND ${countableIssue('i')} GROUP BY i.id`;
export const issueWindowCountSql=`(SELECT COUNT(*) FROM events e WHERE e.project=issues.project AND e.issue=issues.id AND ${matching})`;
export const windowArguments=(start:number,end:number,environment:string|null)=>([start,end,environment,environment] as const);

export async function countPreview(env:AlertEnvironment,project:string,rule:{kinds:string;windowMs:number;threshold:number;environment:string|null;destination:string;channel:string},time:number,requestedStart?:unknown) {
 if(rule.kinds!=='["spike"]')throw new Error('Preview currently supports fixed-window occurrence counts only');
 const start=requestedStart===undefined?Math.floor(time/rule.windowMs)*rule.windowMs:requestedStart;
 if(typeof start!=='number'||!Number.isSafeInteger(start)||start<0||start%rule.windowMs||start>time||!Number.isSafeInteger(start+rule.windowMs))throw new Error('Invalid preview window');
 const end=start+rule.windowMs;
 const counts=(await s(env.DB,windowCountsSql+' ORDER BY count DESC,i.id',project,...windowArguments(start,end,rule.environment)).all<{id:string;count:number}>()).results;
 const choices=await destinationChoices(env,project),destination=choices.find(d=>d.id===rule.destination&&d.channel===rule.channel);
 if(!destination)throw new Error('destination_unconfigured');
 const owner=await s(env.DB,"SELECT id FROM oa_operators WHERE role='owner' AND status='active'").first<{id:string}>();
 if(!owner)throw new Error('Accountable owner unavailable');
 const actor=await auditActor(env.DB,{kind:'owner',authority:owner.id});
 return {mode:'fixed_window_occurrence_count',environment:rule.environment,window:{start,end,durationMs:rule.windowMs,complete:end<=time},threshold:rule.threshold,
  matchingCount:counts.reduce((n,row)=>n+row.count,0),qualifyingIssues:counts.filter(row=>row.count>=rule.threshold).length,issues:counts.slice(0,50),truncated:counts.length>50,
  owner:{role:'Installation owner',auditAlias:actor.label},destination:{id:destination.id,label:destination.label,channel:destination.channel,configured:destination.configured,reviewed:destination.test?.state==='passing'&&!!destination.test.reviewed_at},
  limitations:'Retained accepted occurrences only; suppressed, corrected and imported history is excluded. Expired evidence and missing capture cannot be recovered. Counts do not estimate traffic, sampling, seasonality or loss and are not anomaly detection. Enabling evaluates future complete windows only.'};
}
