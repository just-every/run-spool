// Project-wide metric alerts. A rule of kind 'metric' keeps its real thresholds in its config; each minute
// run measures the trailing complete window and routes one alert per status change.
import type { AlertEnvironment, Rule } from './types';
import { statement as s } from './types';
import { metricQuery } from './metric-measure';
import { routeStatements } from './admission';
import { hash } from '../privacy';
import { metricConfig, metricMeasure, metricStatus, names, type MetricConfig, type Status } from './metric-rules';
const shown=(n:number)=>Number.isInteger(n)?String(n):n.toFixed(2);
export async function evaluateMetrics(env:AlertEnvironment,time:number) {
 const end=Math.floor(time/60000)*60000;
 await s(env.DB,'DELETE FROM sentry_transactions WHERE received<?',end-30*86400000).run();
 const rules=(await s(env.DB,`SELECT r.*,cfg.config,m.status state_status,m.revision state_revision,m.window_end state_end FROM alert_rules r JOIN alert_rule_configs cfg ON cfg.rule_id=r.id LEFT JOIN alert_metric_states m ON m.rule_id=r.id WHERE r.enabled=1 AND EXISTS(SELECT 1 FROM json_each(r.kinds) WHERE value='metric') AND (m.rule_id IS NULL OR m.revision<>r.revision OR m.window_end<?) ORDER BY COALESCE(m.window_end,0),r.id LIMIT 50`,end).all<Rule&{state_status:Status|null;state_revision:number|null;state_end:number|null}>()).results;
 for(const rule of rules){
  let c:MetricConfig;try{c=metricConfig(JSON.parse(rule.config))}catch{continue}
  const start=end-rule.window_ms,previous:Status=rule.state_revision===rule.revision?rule.state_status!:'ok',m=await metricMeasure(env.DB,rule.project,c,start,end);
  const next=m.value===null?{status:previous} as ReturnType<typeof metricStatus>:metricStatus(c,previous,m.value);
  // Compare-and-set on the read state: a concurrent run of the same minute writes nothing twice.
  const query=metricQuery(rule.project,c,start,end);
  const jobs=[s(env.DB,`INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM (${query.sql}) measured WHERE measured.value IS ? AND measured.samples=?) THEN 1 ELSE 0 END`,...query.args,m.value,m.samples),s(env.DB,`INSERT INTO alert_metric_states SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM alert_rules WHERE id=? AND revision=? AND enabled=1) ON CONFLICT(rule_id) DO UPDATE SET revision=excluded.revision,status=excluded.status,value=excluded.value,reason=excluded.reason,window_end=excluded.window_end,updated=excluded.updated,
   since=CASE WHEN alert_metric_states.status=excluded.status AND alert_metric_states.revision=excluded.revision THEN alert_metric_states.since ELSE excluded.since END
   WHERE alert_metric_states.revision IS ? AND alert_metric_states.window_end IS ? AND alert_metric_states.window_end<excluded.window_end`,rule.id,rule.project,rule.revision,next.status,m.value,m.reason,end,end,time,rule.id,rule.revision,rule.state_revision,rule.state_end)];
  if(next.status!==previous){
   const id=await hash(JSON.stringify(['metric',rule.id,rule.revision,end,previous,next.status])),label=next.label!;
   const verb=next.status==='ok'?'resolved':previous==='ok'?next.status:`${previous} → ${next.status}`,op=label==='resolve'?(c.thresholdType==='above'?'<':'>'):(c.thresholdType==='above'?'>':'<');
   const payload=JSON.stringify({schema:'spool.alert.v1',alertId:id,kind:'metric',projectId:rule.project,issueId:null,occurredAt:new Date(end).toISOString(),
    title:`${rule.name}: ${verb} (${names[c.aggregate]} ${shown(m.value!)} ${op} ${shown(next.threshold!)})`,release:null,issueUrl:null,
    window:{start:new Date(start).toISOString(),end:new Date(end).toISOString(),durationMs:rule.window_ms},rule:{id:rule.id,revision:rule.revision},
    metric:{dataset:c.dataset,aggregate:c.aggregate,from:previous,to:next.status,label,value:m.value,threshold:next.threshold,thresholdType:c.thresholdType,reason:m.reason}});
   jobs.push(s(env.DB,`INSERT INTO alert_metric_events SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM alert_rules WHERE id=? AND revision=? AND enabled=1) ON CONFLICT(id) DO NOTHING`,id,rule.project,rule.id,rule.revision,previous,next.status,label,m.value,next.threshold!,start,end,time,rule.id,rule.revision),
    s(env.DB,`INSERT INTO alerts(id,project,issue,kind,created,payload) SELECT ?,?,NULL,'metric',?,? WHERE EXISTS(SELECT 1 FROM alert_metric_events WHERE id=?) ON CONFLICT(id) DO NOTHING`,id,rule.project,end,payload,id),
    ...routeStatements(env.DB,id,time,rule.id));
  }
  jobs.push(s(env.DB,'DELETE FROM spool_authority_guards'));
  await env.DB.batch(jobs);
 }
}
