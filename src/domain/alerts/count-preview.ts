import { eligibleEvent,eventFilter,ruleConfig } from './filters';
import type { AlertEnvironment } from './types';
import { statement as s } from './types';
import { destinationChoices } from './destinations.server';
import { auditActor } from '../audit/identity';

// Share main's retained-event and routing predicates with scheduled admission.
const eligible=eligibleEvent();
export const countableIssue=(alias:string)=>`${alias}.state<>'suppressed'`;
export async function countPreview(env:AlertEnvironment,project:string,rule:{kinds:string;windowMs:number;threshold:number;environment:string|null;destination:string;channel:string;config:string},time:number,requestedStart?:unknown) {
 if(rule.kinds!=='["spike"]')throw new Error('Preview currently supports fixed-window occurrence counts only');
 const start=requestedStart===undefined?Math.floor(time/rule.windowMs)*rule.windowMs:requestedStart;
 if(typeof start!=='number'||!Number.isSafeInteger(start)||start<0||start%rule.windowMs||start>time||!Number.isSafeInteger(start+rule.windowMs))throw new Error('Invalid preview window');
 const end=start+rule.windowMs;
 const config=ruleConfig(JSON.parse(rule.config));if(config.metric!=='count')throw new Error('Preview requires occurrence counts');
 const f=eventFilter(config);
 const counts=(await s(env.DB,`SELECT i.id,COUNT(*) count FROM events e JOIN issues i ON i.id=e.issue AND i.project=e.project WHERE e.project=? AND ${eligible} AND e.received>=? AND e.received<? AND ${f.sql} AND ${countableIssue('i')} GROUP BY i.id ORDER BY count DESC,i.id`,project,start,end,...f.args).all<{id:string;count:number}>()).results;
 const choices=await destinationChoices(env,project),destination=choices.find(d=>d.id===rule.destination&&d.channel===rule.channel);
 if(!destination)throw new Error('destination_unconfigured');
 const owner=await s(env.DB,"SELECT id FROM oa_operators WHERE role='owner' AND status='active'").first<{id:string}>();
 if(!owner)throw new Error('Accountable owner unavailable');
 const actor=await auditActor(env.DB,{kind:'owner',authority:owner.id});
 return {mode:'fixed_window_occurrence_count',environment:config.filters.environment??null,window:{start,end,durationMs:rule.windowMs,complete:end<=time},threshold:rule.threshold,
  matchingCount:counts.reduce((n,row)=>n+row.count,0),qualifyingIssues:counts.filter(row=>row.count>=rule.threshold).length,issues:counts.slice(0,50),truncated:counts.length>50,
  owner:{role:'Installation owner',auditAlias:actor.label},destination:{id:destination.id,label:destination.label,channel:destination.channel,configured:destination.configured,reviewed:destination.test?.state==='passing'&&!!destination.test.reviewed_at},
  limitations:'Retained accepted occurrences only; suppressed, corrected and imported history is excluded. Expired evidence and missing capture cannot be recovered. Counts do not estimate traffic, sampling, seasonality or loss and are not anomaly detection. Enabling evaluates future complete windows only.'};
}
