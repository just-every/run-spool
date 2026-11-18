// Project metric rule configuration and status transitions.
// Pure of delivery so preview, archive validation and evaluation share it.
import { scrub } from '../privacy';
export type Match={op:'eq'|'prefix'|'glob';value:string};
export type Status='ok'|'warning'|'critical';
export type MetricConfig={metric:'aggregate';dataset:'errors'|'transactions'|'sessions';aggregate:'count'|'users'|'p95_duration'|'crash_free_rate'|'failure_rate'|'session_count';
 query:{tags?:Record<string,Match>;transaction?:Match};filters:{environment?:string};thresholdType:'above'|'below';
 triggers:{label:'critical'|'warning';alertThreshold:number}[];resolveThreshold:number|null;tagKeys:string[]};
const aggregates:Record<MetricConfig['dataset'], readonly MetricConfig['aggregate'][]> = {
 errors:['count','users'],transactions:['p95_duration'],sessions:['crash_free_rate','failure_rate','session_count'],
};
function hasAggregate(dataset:unknown,aggregate:unknown) {
 return typeof dataset==='string' && Object.hasOwn(aggregates,dataset) &&
  (aggregates[dataset as MetricConfig['dataset']] as readonly unknown[]).includes(aggregate);
}
const keys=(v:any,allowed:string[],required=allowed)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>allowed.includes(k))&&required.every(k=>k in v);
const safe=(v:any,max=200)=>typeof v==='string'&&!!v&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v)&&scrub(v)===v;
const finite=(v:any)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e12;
function match(v:any){if(!keys(v,['op','value'])||!['eq','prefix','glob'].includes(v.op)||!safe(v.value))throw new Error('Invalid metric query condition');return {op:v.op,value:v.value} as Match}
export function metricConfig(value:any):MetricConfig {
 const fail=(m='Invalid metric rule configuration')=>{throw new Error(m)};
 if(!keys(value,['metric','dataset','aggregate','query','filters','thresholdType','triggers','resolveThreshold','tagKeys'])||value.metric!=='aggregate'||!hasAggregate(value.dataset,value.aggregate))fail();
 if(!Array.isArray(value.tagKeys)||value.tagKeys.length>20||value.tagKeys.some((k:any)=>!safe(k,100))||new Set(value.tagKeys).size!==value.tagKeys.length)fail('Choose at most twenty approved tag keys');
 if(!keys(value.filters,['environment'],[])||value.filters.environment!==undefined&&!safe(value.filters.environment))fail('Invalid metric filters');
 const q=value.query;if(!keys(q,['tags','transaction'],[]))fail('Invalid metric query');
 if(q.tags!==undefined&&(value.dataset!=='errors'||!keys(q.tags,value.tagKeys,[])))fail('Tag conditions apply to error counts and require an owner-approved key');
 if(q.transaction!==undefined&&value.dataset!=='transactions')fail('Transaction conditions apply to the transactions dataset');
 if(!['above','below'].includes(value.thresholdType)||!Array.isArray(value.triggers)||!value.triggers.length||value.triggers.length>2)fail('Invalid metric triggers');
 const triggers=[...value.triggers].map(t=>{if(!keys(t,['label','alertThreshold'])||!['critical','warning'].includes(t.label)||!finite(t.alertThreshold))fail('Invalid metric triggers');return {label:t.label,alertThreshold:t.alertThreshold}}).sort((a,b)=>a.label==='critical'?-1:b.label==='critical'?1:0);
 const above=value.thresholdType==='above',beyond=(a:number,b:number)=>above?a>b:a<b;
 if(triggers[0].label!=='critical'||new Set(triggers.map(t=>t.label)).size!==triggers.length||triggers[1]&&!beyond(triggers[0].alertThreshold,triggers[1].alertThreshold))fail('A metric rule needs a critical trigger; a warning trigger must be less severe');
 if(value.resolveThreshold!==null&&(!finite(value.resolveThreshold)||!beyond(triggers.at(-1)!.alertThreshold,value.resolveThreshold)&&triggers.at(-1)!.alertThreshold!==value.resolveThreshold))fail('The resolve threshold must not breach the lowest trigger');
 if([...triggers.map(t=>t.alertThreshold),...(value.resolveThreshold===null?[]:[value.resolveThreshold])].some(t=>t<0))fail('Metric thresholds must be nonnegative');
 if(value.dataset==='sessions'&&value.aggregate!=='session_count'&&[...triggers.map(t=>t.alertThreshold),...(value.resolveThreshold===null?[]:[value.resolveThreshold])].some(t=>t<0||t>100))fail('Crash-free rate thresholds are percentages');
 const query:MetricConfig['query']={};
 if(q.tags!==undefined)query.tags=Object.fromEntries(Object.keys(q.tags).sort().map(k=>[k,match(q.tags[k])]));
 if(q.transaction!==undefined)query.transaction=match(q.transaction);
 return {metric:'aggregate',dataset:value.dataset,aggregate:value.aggregate,query,filters:value.filters.environment===undefined?{}:{environment:value.filters.environment},thresholdType:value.thresholdType,triggers,resolveThreshold:value.resolveThreshold,tagKeys:[...value.tagKeys].sort()};
}
// Critical wins; while nothing breaches, an open status holds until the resolve threshold
// is crossed, or, without one, resolves as soon as no trigger is breached.
export function metricStatus(c:MetricConfig,previous:Status,value:number):{status:Status;label?:string;threshold?:number}{
 const above=c.thresholdType==='above',hit=c.triggers.find(t=>above?value>t.alertThreshold:value<t.alertThreshold);
 if(hit)return {status:hit.label,label:hit.label,threshold:hit.alertThreshold};
 if(previous==='ok')return {status:'ok'};
 const r=c.resolveThreshold;
 return r===null||(above?value<r:value>r)?{status:'ok',label:'resolve',threshold:r??c.triggers.at(-1)!.alertThreshold}:{status:previous};
}
export const names = {
 count:'count()',users:'unique users',p95_duration:'p95(transaction.duration)',crash_free_rate:'crash-free session rate',
 failure_rate:'session failure rate',session_count:'session count',
};
// Archive check for a metric feed row; its rule must travel in the same archive.
export function validMetricAlert(a:any,p:any,rule:any){
 const t=(v:any,fields:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===[...fields].sort().join();
 const statuses=['ok','warning','critical'],m=p.metric,w=p.window;
 return a.issue===null&&t(p,['schema','alertId','kind','projectId','issueId','occurredAt','title','release','issueUrl','window','rule','metric'])&&p.schema==='spool.alert.v1'&&p.alertId===a.id&&p.kind==='metric'&&p.projectId===a.project&&p.issueId===null&&p.release===null&&p.issueUrl===null
  &&p.occurredAt===new Date(a.created).toISOString()&&typeof p.title==='string'&&p.title.length<=1000&&scrub(p.title)===p.title&&t(w,['start','end','durationMs'])&&w.end===p.occurredAt&&Date.parse(w.end)-Date.parse(w.start)===w.durationMs&&Number.isSafeInteger(w.durationMs)&&w.durationMs>=60000&&w.durationMs<=86400000
  &&t(p.rule,['id','revision'])&&rule?.project===a.project&&rule.id===p.rule.id&&Number.isSafeInteger(p.rule.revision)&&p.rule.revision>=1&&p.rule.revision<=rule.revision
  &&t(m,['dataset','aggregate','from','to','label','value','threshold','thresholdType','reason'])&&hasAggregate(m.dataset,m.aggregate)&&statuses.includes(m.from)&&statuses.includes(m.to)&&m.from!==m.to&&['critical','warning','resolve'].includes(m.label)&&finite(m.value)&&finite(m.threshold)&&['above','below'].includes(m.thresholdType)&&typeof m.reason==='string'&&m.reason.length<=500&&scrub(m.reason)===m.reason;
}

export { metricMeasure } from './metric-measure';
