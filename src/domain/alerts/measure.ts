import { statement as s } from './types';
import { eligibleEvent,eventFilter,userKey,type RuleConfig } from './filters';
export async function eventMeasure(db:D1Database,project:string,config:RuleConfig,start:number,end:number,issue?:string){
 const f=eventFilter(config),where=`e.project=? AND e.received>=? AND e.received<? AND ${eligibleEvent()} AND ${f.sql}${issue?' AND e.issue=?':''}`;
 // sample_rate is SDK-supplied metadata, never inferred from a quiet feed.
 const rate="CASE WHEN CAST(json_extract(e.payload,'$.sentry.sdk.sample_rate') AS REAL)>0 AND CAST(json_extract(e.payload,'$.sentry.sdk.sample_rate') AS REAL)<=1 THEN CAST(json_extract(e.payload,'$.sentry.sdk.sample_rate') AS REAL) ELSE 1 END";
 return (await s(db,`SELECT COUNT(*) count,COUNT(DISTINCT ${userKey}) users,COALESCE(SUM(CASE WHEN ${userKey} IS NULL THEN 1 ELSE 0 END),0) unattributed,COALESCE(SUM(1.0/(${rate})),0) scaled,MIN(${rate}) sampleRate FROM events e LEFT JOIN event_identities x ON x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence WHERE ${where}`,project,start,end,...f.args,...issue?[issue]:[]).first<any>())!;
}
export async function sessionMeasure(db:D1Database,project:string,config:RuleConfig,start:number,end:number){
 const parts=['project=?','started>=?','started<?'],args:any[]=[project,start,end];
 for(const key of ['environment','release'] as const)if(config.filters[key]!==undefined){parts.push(key+'=?');args.push(config.filters[key])}
 const where=parts.join(' AND '),[a,b]=await Promise.all([
 s(db,`SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN errors>0 OR status IN ('errored','crashed','abnormal','unhandled') THEN 1 ELSE 0 END),0) affected FROM health_sessions WHERE ${where}`,...args).first<any>(),
 s(db,`SELECT COALESCE(SUM(quantity),0) total,COALESCE(SUM(CASE WHEN status IN ('errored','crashed','abnormal','unhandled') THEN quantity ELSE 0 END),0) affected FROM health_aggregates WHERE ${where}`,...args).first<any>()]);
 return {denominator:a.total+b.total,affected:a.affected+b.affected};
}
export async function captureLoss(db:D1Database,project:string,start:number,end:number){
 const rows=(await s(db,`SELECT reason,SUM(count) count FROM outcomes WHERE project=? AND window>=? AND window<? AND count>0 AND (reason IN ('unauthorized','rejected','invalid','oversized','rate_limited','budget','storage_failure','unregistered_release_or_build','missing_release_register_required','sdk_dropped','retention') OR reason LIKE 'client_discarded:error:%' OR reason LIKE 'client_discarded:default:%' OR reason LIKE 'exposure_%') GROUP BY reason`,project,Math.floor(start/60000)*60000,end).all<any>()).results;
 const dropped=await s(db,"SELECT SUM(COALESCE(json_extract(payload,'$.dropped'),0)) count FROM events WHERE project=? AND received>=? AND received<? AND historical=0",project,start,end).first<any>();
 if(dropped?.count)rows.push({reason:'sdk_dropped',count:dropped.count});return rows;
}
export async function decision(db:D1Database,project:string,config:RuleConfig,issue:string,start:number,end:number,threshold:number){
 const m=await eventMeasure(db,project,config,start,end,issue),base={start,end,issue,count:m.count,users:m.users,unattributed:m.unattributed,threshold,metric:config.metric};
 if(config.metric==='users')return {...base,fired:m.users>threshold,reason:`${m.users} distinct retained users; ${m.unattributed} events without user key; requires more than ${threshold}`};
 if(config.metric==='session_percent'){
  const sessions=await sessionMeasure(db,project,config,start,end),value=sessions.denominator?100*sessions.affected/sessions.denominator:null;
  return {...base,...sessions,value,fired:value!==null&&value>=threshold,reason:value===null?'Session data unavailable in this window':`${sessions.affected} affected / ${sessions.denominator} observed sessions (${value.toFixed(2)}%); threshold ${threshold}%`};
 }
 if(config.metric==='count')return {...base,fired:m.count>=threshold,reason:`Fixed threshold: ${m.count} accepted occurrences; requires ${threshold}`};
 const traffic=await eventMeasure(db,project,{...config,filters:{...config.filters,tags:undefined,level:undefined}},start,end),loss=await captureLoss(db,project,start,end),history:any[]=[],excluded:any[]=[];
 for(let week=1;week<=8;week++){
  const from=start-week*7*86400000,to=end-week*7*86400000;
  const missing=await captureLoss(db,project,from,to);
  const gap=await s(db,"SELECT 1 FROM audit WHERE project=? AND kind='retention_gap' AND json_extract(detail,'$.cutoff')>? LIMIT 1",project,from).first();
  if(missing.length||gap){excluded.push({start:from,end:to,reasons:missing.length?missing.map(r=>r.reason):['retention_gap']});continue}
  const [errors,total]=await Promise.all([eventMeasure(db,project,config,from,to,issue),eventMeasure(db,project,{...config,filters:{...config.filters,tags:undefined,level:undefined}},from,to)]);
  if(total.count<10){excluded.push({start:from,end:to,reasons:['low_traffic']});continue}
  history.push({start:from,end:to,rate:errors.scaled/total.scaled});
 }
 const baseline=history.length?history.reduce((n,w)=>n+w.rate,0)/history.length:null,value=traffic.scaled?m.scaled/traffic.scaled:null;
 const why=loss.length?'Current window has recorded capture loss':traffic.count<10?'Low traffic: fewer than 10 accepted project events':history.length<2?'Insufficient history: need two comparable same hour-of-week windows':baseline===0?'Insufficient history: zero baseline rate':`Sample-scaled issue rate ${value!.toFixed(4)} / accepted project event traffic; same hour-of-week baseline ${baseline!.toFixed(4)} × ${threshold}`;
 return {...base,baseline,value,denominator:traffic.count,sampleRate:m.sampleRate??1,history,excluded,loss,fired:!loss.length&&traffic.count>=10&&history.length>=2&&baseline!>0&&value!>=baseline!*threshold,reason:why};
}
