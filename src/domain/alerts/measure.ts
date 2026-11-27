import { statement as s } from './types';
import { eligibleEvent,eventFilter,userKey,type RuleConfig } from './filters';
const eventCounts=`COUNT(*) count,COUNT(DISTINCT ${userKey}) users,COALESCE(SUM(CASE WHEN ${userKey} IS NULL THEN 1 ELSE 0 END),0) unattributed`;
const eventIdentities='LEFT JOIN event_identities x ON x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence';
type EventCounts={count:number;users:number;unattributed:number};

type EventMeasure=EventCounts&{scaled:number;sampleRate:number|null};
// sample_rate is SDK-supplied metadata, never inferred from a quiet feed.
const rate="CASE WHEN json_type(e.payload,'$.sentry.sdk.sample_rate') IN ('real','integer') AND CAST(json_extract(e.payload,'$.sentry.sdk.sample_rate') AS REAL)>0 AND CAST(json_extract(e.payload,'$.sentry.sdk.sample_rate') AS REAL)<=1 THEN CAST(json_extract(e.payload,'$.sentry.sdk.sample_rate') AS REAL) ELSE 1 END";
const scaled=`COALESCE(SUM(1.0/(${rate})),0) scaled`;

async function eventMeasure(db:D1Database,project:string,config:RuleConfig,start:number,end:number,issue:string){
 const f=eventFilter(config);
 return (await s(db,`SELECT ${eventCounts} FROM events e ${eventIdentities}
  WHERE e.project=? AND e.received>=? AND e.received<? AND ${eligibleEvent()} AND ${f.sql} AND e.issue=?`,project,start,end,...f.args,issue).first<EventCounts>())!;
}

export async function spikeWindowCounts(db:D1Database,project:string,config:RuleConfig,start:number,end:number){
 const f=eventFilter(config);
 return (await s(db,`SELECT e.issue,${eventCounts} FROM events e
  JOIN issues i ON i.id=e.issue AND i.project=e.project ${eventIdentities}
  WHERE e.project=? AND e.received>=? AND e.received<? AND ${eligibleEvent()} AND ${f.sql} AND i.state<>'suppressed'
  GROUP BY e.issue ORDER BY e.issue LIMIT 100`,project,start,end,...f.args).all<EventCounts&{issue:string}>()).results;
}
export async function sessionMeasure(db:D1Database,project:string,config:RuleConfig,start:number,end:number){
 const parts=['project=?','started>=?','started<?'],args:any[]=[project,start,end];
 for(const key of ['environment','release'] as const)if(config.filters[key]!==undefined){parts.push(key+'=?');args.push(config.filters[key])}
 const where=parts.join(' AND '),[a,b]=await Promise.all([
 s(db,`SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN errors>0 OR status IN ('errored','crashed','abnormal','unhandled') THEN 1 ELSE 0 END),0) affected FROM health_sessions WHERE ${where}`,...args).first<any>(),
 s(db,`SELECT COALESCE(SUM(quantity),0) total,COALESCE(SUM(CASE WHEN status IN ('errored','crashed','abnormal','unhandled') THEN quantity ELSE 0 END),0) affected FROM health_aggregates WHERE ${where}`,...args).first<any>()]);
 return {denominator:a.total+b.total,affected:a.affected+b.affected};
}
const week=7*86400000;
const windowRows=`WITH windows AS (
 SELECT json_extract(value,'$.back') back,json_extract(value,'$.start') start,json_extract(value,'$.end') end FROM json_each(?)
)`;
const windowEvents=`FROM windows w CROSS JOIN events e INDEXED BY events_project_received`;
const inWindow=`e.project=? AND e.received>=w.start AND e.received<w.end`;
type Loss={reason:string;count:number};
type WindowLoss=Loss&{back:number};
type Cutoff={cutoff:number|null};
type Traffic={count:number;scaled:number};
type BaselineWindow={back:number;start:number;end:number};
const emptyTraffic:Traffic={count:0,scaled:0};
const emptyMeasure:EventMeasure={...emptyTraffic,users:0,unattributed:0,sampleRate:null};

async function baselineLoss(db:D1Database,project:string,windows:BaselineWindow[]){
 const encoded=JSON.stringify(windows);
 const [receipts,dropped,retention]=await db.batch<WindowLoss|Cutoff>([
  s(db,`${windowRows} SELECT w.back,o.reason,SUM(o.count) count FROM windows w CROSS JOIN outcomes o
   WHERE o.project=? AND o.window>=w.start-((w.start%60000+60000)%60000) AND o.window<w.end AND o.count>0
   AND (o.reason IN ('unauthorized','rejected','invalid','oversized','rate_limited','budget','storage_failure','unregistered_release_or_build','missing_release_register_required','sdk_dropped','retention')
    OR o.reason LIKE 'client_discarded:error:%' OR o.reason LIKE 'client_discarded:default:%' OR o.reason LIKE 'exposure_%')
   GROUP BY w.back,o.reason ORDER BY w.back,o.reason`,encoded,project),
  s(db,`${windowRows} SELECT w.back,'sdk_dropped' reason,SUM(COALESCE(json_extract(e.payload,'$.dropped'),0)) count
   ${windowEvents} WHERE ${inWindow} AND e.historical=0 GROUP BY w.back`,encoded,project),
  // A cutoff never passes its own audit time, so older retention cannot reach any of these windows.
  s(db,`SELECT MAX(json_extract(detail,'$.cutoff')) cutoff
   FROM audit WHERE project=? AND kind='retention_gap' AND created>?`,project,windows[windows.length-1].start),
 ]);
 const losses=windows.map(()=>[] as Loss[]);
 for(const row of [...receipts.results,...dropped.results]){
  if('back' in row&&row.count)losses[row.back].push({reason:row.reason,count:row.count});
 }
 const cutoff=retention.results[0] as Cutoff|undefined;
 return {losses,cutoff:cutoff?.cutoff??null};
}

const decisionBase=(metric:RuleConfig['metric'],issue:string,start:number,end:number,threshold:number,m:EventCounts)=>
 ({start,end,issue,count:m.count,users:m.users,unattributed:m.unattributed,threshold,metric});

export function countDecision(metric:'count'|'users',issue:string,start:number,end:number,threshold:number,m:EventCounts){
 const base=decisionBase(metric,issue,start,end,threshold,m);
 if(metric==='users')return {...base,fired:m.users>threshold,reason:`${m.users} distinct retained users; ${m.unattributed} events without user key; requires more than ${threshold}`};
 return {...base,fired:m.count>=threshold,reason:`Fixed threshold: ${m.count} accepted occurrences; requires ${threshold}`};
}

export async function baselineDecisions(db:D1Database,project:string,config:RuleConfig,issues:string[],start:number,end:number,threshold:number){
 if(!issues.length)return [];
 const windows=Array.from({length:9},(_,back)=>({back,start:start-back*week,end:end-back*week}));
 const {losses,cutoff}=await baselineLoss(db,project,windows);
 const excluded=windows.map(({back,start})=>losses[back].length?losses[back].map(row=>row.reason):cutoff!==null&&cutoff>start?['retention_gap']:[]);
 const encoded=JSON.stringify(windows.filter(({back})=>back===0||!excluded[back].length));
 const trafficFilter=eventFilter({...config,filters:{...config.filters,tags:undefined,level:undefined}}),issueFilter=eventFilter(config);
 const [traffic,errors]=await db.batch([
  s(db,`${windowRows} SELECT w.back,COUNT(*) count,${scaled} ${windowEvents}
   WHERE ${inWindow} AND ${eligibleEvent()} AND ${trafficFilter.sql} GROUP BY w.back`,encoded,project,...trafficFilter.args),
  s(db,`${windowRows} SELECT w.back,e.issue,${eventCounts},${scaled},MIN(${rate}) sampleRate
   ${windowEvents} ${eventIdentities} WHERE ${inWindow} AND ${eligibleEvent()} AND ${issueFilter.sql}
   AND e.issue IN (SELECT value FROM json_each(?)) GROUP BY w.back,e.issue`,encoded,project,...issueFilter.args,JSON.stringify(issues)),
 ]);
 const totals=windows.map(()=>emptyTraffic);
 for(const row of traffic.results as (Traffic&{back:number})[])totals[row.back]=row;
 const byIssue=new Map<string,EventMeasure[]>();
 for(const issue of issues)byIssue.set(issue,windows.map(()=>emptyMeasure));
 for(const row of errors.results as (EventMeasure&{issue:string;back:number})[])byIssue.get(row.issue)![row.back]=row;
 return issues.map(issue=>baselineDecision(issue,start,end,threshold,windows,excluded,losses[0],totals,byIssue.get(issue)!));
}

function baselineDecision(issue:string,start:number,end:number,threshold:number,windows:BaselineWindow[],reasons:string[][],loss:Loss[],totals:Traffic[],errors:EventMeasure[]){
 const m=errors[0],traffic=totals[0],base=decisionBase('baseline',issue,start,end,threshold,m);
 const history:{start:number;end:number;rate:number}[]=[],excluded:{start:number;end:number;reasons:string[]}[]=[];
 for(const {back,start,end} of windows.slice(1)){
  const total=totals[back];
  if(reasons[back].length)excluded.push({start,end,reasons:reasons[back]});
  else if(total.count<10)excluded.push({start,end,reasons:['low_traffic']});
  else history.push({start,end,rate:errors[back].scaled/total.scaled});
 }
 const baseline=history.length?history.reduce((n,w)=>n+w.rate,0)/history.length:null,value=traffic.scaled?m.scaled/traffic.scaled:null;
 const why=loss.length?'Current window has recorded capture loss':traffic.count<10?'Low traffic: fewer than 10 accepted project events':history.length<2?'Insufficient history: need two comparable same hour-of-week windows':baseline===0?'Insufficient history: zero baseline rate':`Sample-scaled issue rate ${value!.toFixed(4)} / accepted project event traffic; same hour-of-week baseline ${baseline!.toFixed(4)} × ${threshold}`;
 return {...base,baseline,value,denominator:traffic.count,sampleRate:m.sampleRate??1,history,excluded,loss,fired:!loss.length&&traffic.count>=10&&history.length>=2&&baseline!>0&&value!>=baseline!*threshold,reason:why};
}

export async function decision(db:D1Database,project:string,config:RuleConfig,issue:string,start:number,end:number,threshold:number){
 if(config.metric==='baseline')return (await baselineDecisions(db,project,config,[issue],start,end,threshold))[0];
 const m=await eventMeasure(db,project,config,start,end,issue);
 if(config.metric==='users'||config.metric==='count')return countDecision(config.metric,issue,start,end,threshold,m);
 const base=decisionBase(config.metric,issue,start,end,threshold,m);
 const sessions=await sessionMeasure(db,project,config,start,end),value=sessions.denominator?100*sessions.affected/sessions.denominator:null;
 return {...base,...sessions,value,fired:value!==null&&value>=threshold,reason:value===null?'Session data unavailable in this window':`${sessions.affected} affected / ${sessions.denominator} observed sessions (${value.toFixed(2)}%); threshold ${threshold}%`};
}
