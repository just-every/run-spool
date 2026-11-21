import { statement as s } from './types';
import { eligibleEvent, userKey } from './filters';
import { names, type MetricConfig, type Match } from './metric-rules';
function condition(expr:string,m:Match){
 if(m.op==='eq')return {sql:`${expr}=?`,args:[m.value]};
 if(m.op==='prefix')return {sql:`substr(${expr},1,length(?))=?`,args:[m.value,m.value]};
 // Only * is a wildcard; SQL's GLOB metacharacters are escaped literally.
 return {sql:`${expr} GLOB ?`,args:[m.value.replace(/[[\]?]/g,c=>`[${c}]`)]};
}
export function metricQuery(project:string,c:MetricConfig,start:number,end:number){
 const parts:string[]=[],args:(string|number|null)[]=[project,start,end];
 if(c.filters.environment!==undefined){parts.push('environment=?');args.push(c.filters.environment)}
 if(c.dataset==='errors'){
  for(const [key,m] of Object.entries(c.query.tags??{})){const x=condition('json_extract(e.payload,?)',m);parts.push(x.sql);args.push('$.sentry.tags.'+JSON.stringify(key),...x.args)}
  const users=c.aggregate==='users';
  const count=users?`COUNT(DISTINCT ${userKey})`:'COUNT(*)';
  const value=users?`NULLIF(${count},0)`:count;
  const from=users?'events e LEFT JOIN event_identities x ON x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence':'events e';
  return {sql:`SELECT ${value} value,${count} samples FROM ${from} WHERE e.project=? AND e.received>=? AND e.received<? AND ${eligibleEvent()} AND COALESCE(json_array_length(e.payload,'$.sentry.exceptions'),1)>0${parts.map(p=>' AND '+p).join('')}`,args};
 }
 if(c.dataset==='transactions'){
  if(c.query.transaction){const x=condition('name',c.query.transaction);parts.push(x.sql);args.push(...x.args)}
  return {sql:`WITH ranked AS (SELECT duration_ms,ROW_NUMBER() OVER (ORDER BY duration_ms,id) rank,COUNT(*) OVER () total FROM sentry_transactions WHERE project=? AND received>=? AND received<?${parts.map(p=>' AND '+p).join('')}) SELECT MAX(CASE WHEN rank=CAST((total*95+99)/100 AS INTEGER) THEN duration_ms END) value,COUNT(*) samples FROM ranked`,args};
 }
 const where=['project=?','started>=?','started<?',...parts].join(' AND ');
 const total='SUM(quantity)';
 const crashes="SUM(CASE WHEN status='crashed' THEN quantity ELSE 0 END)";
 const failures="SUM(CASE WHEN errors>0 OR status IN ('errored','crashed','abnormal','unhandled') THEN quantity ELSE 0 END)";
 const value=c.aggregate==='session_count'?total:c.aggregate==='failure_rate'?`100.0*${failures}/${total}`:`100.0*(1.0-1.0*${crashes}/${total})`;
 return {sql:`WITH sessions AS (SELECT 1 quantity,status,errors FROM health_sessions WHERE ${where} UNION ALL SELECT quantity,status,0 errors FROM health_aggregates WHERE ${where}) SELECT ${value} value,COALESCE(${total},0) samples FROM sessions`,args:[...args,...args]};
}
export async function metricMeasure(db:D1Database,project:string,c:MetricConfig,start:number,end:number){
 const query=metricQuery(project,c,start,end),row=(await s(db,query.sql,...query.args).first<{value:number|null;samples:number}>())!;
 const reason=row.value===null?'No retained observations in this window'
  :c.aggregate==='users'?`${row.value} distinct retained users`
  :c.dataset==='errors'?`${row.samples} accepted error events`
  :c.dataset==='transactions'?`p95 ${row.value.toFixed(1)} ms over ${row.samples} retained transactions`
  :c.aggregate==='session_count'?`${row.samples} observed sessions`
  :c.aggregate==='crash_free_rate'?`Crash-free ${row.value.toFixed(3)}% over ${row.samples} observed sessions`
  :`${names[c.aggregate]}: ${row.value.toFixed(3)}% over ${row.samples} observed sessions`;
 return {...row,reason};
}
