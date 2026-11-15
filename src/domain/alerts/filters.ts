import { scrub } from '../privacy';
// Sentry issue-rule operators: TaggedEventFilter eq/ne/co/nc/sw/ew/is/ns and LevelFilter eq/gte/lte.
export const tagOps=['eq','ne','contains','not_contains','starts_with','ends_with','is_set','not_set'] as const;
export type TagMatch=string|{op:typeof tagOps[number];value?:string};
export type RuleConfig={metric:'count'|'users'|'session_percent'|'baseline';filters:{environment?:string;level?:string;levelMatch?:'eq'|'gte'|'lte';release?:string;tags?:Record<string,TagMatch>};tagKeys:string[];actionIntervalMinutes?:number};
export const defaultConfig=():RuleConfig=>({metric:'count',filters:{},tagKeys:[]});
// Spool stores the derived `handled` tag as "true"/"false"; Sentry rules say yes/no.
const handledValue=(key:string,v:string)=>key==='handled'&&(v==='yes'||v==='no')?String(v==='yes'):v;
export function ruleConfig(value:any):RuleConfig {
 if(value===undefined)return defaultConfig();
 if(!value||typeof value!=='object'||Object.keys(value).filter(k=>k!=='actionIntervalMinutes').sort().join()!=='filters,metric,tagKeys'||!['count','users','session_percent','baseline'].includes(value.metric)||!Array.isArray(value.tagKeys)||value.tagKeys.length>20)throw new Error('Invalid rule configuration');
 const interval=value.actionIntervalMinutes;if(interval!==undefined&&(!Number.isSafeInteger(interval)||interval<1||interval>43200))throw new Error('Action interval must be 1 to 43200 minutes');
 const safe=(v:any,max=200)=>typeof v==='string'&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v)&&scrub(v)===v;
 if(value.tagKeys.some((k:any)=>!safe(k,100)||!k)||new Set(value.tagKeys).size!==value.tagKeys.length)throw new Error('Choose at most twenty approved tag keys');
 const f=value.filters;if(!f||typeof f!=='object'||Array.isArray(f)||Object.keys(f).some(k=>!['environment','level','levelMatch','release','tags'].includes(k)))throw new Error('Invalid rule filters');
 for(const k of ['environment','release'])if(f[k]!==undefined&&!safe(f[k]))throw new Error('Invalid rule filter value');
 if(f.level!==undefined&&!['debug','info','log','warning','error','fatal'].includes(f.level)||f.levelMatch!==undefined&&(f.level===undefined||!['eq','gte','lte'].includes(f.levelMatch)))throw new Error('Invalid severity');
 const match=(key:string,v:any):TagMatch=>{
  if(typeof v==='string'&&safe(v))return handledValue(key,v);
  if(!v||typeof v!=='object'||Array.isArray(v)||!tagOps.includes(v.op))throw new Error('Invalid tag match');
  const presence=v.op==='is_set'||v.op==='not_set';
  if(Object.keys(v).sort().join()!==(presence?'op':'op,value')||!presence&&(!v.value||!safe(v.value)))throw new Error('Invalid tag match');
  return presence?{op:v.op}:{op:v.op,value:handledValue(key,v.value)};
 };
 if(f.tags!==undefined&&(!f.tags||typeof f.tags!=='object'||Array.isArray(f.tags)||Object.keys(f.tags).some(k=>!value.tagKeys.includes(k))))throw new Error('Tag filters require an owner-approved key');
 const tags=f.tags===undefined?undefined:Object.fromEntries(Object.entries(f.tags).map(([k,v])=>[k,match(k,v)]));
 if(value.metric==='session_percent'&&(f.level!==undefined||Object.keys(f.tags??{}).length))throw new Error('Sessions have no event severity or tag attribution; choose environment and release filters');
 return {metric:value.metric,filters:tags?{...f,tags}:f,tagKeys:[...value.tagKeys].sort(),...interval!==undefined?{actionIntervalMinutes:interval}:{}};
}
const levelRank=(level:string)=>`CASE ${level} WHEN 'debug' THEN 10 WHEN 'info' THEN 20 WHEN 'log' THEN 20 WHEN 'warning' THEN 30 WHEN 'error' THEN 40 WHEN 'fatal' THEN 50 END`;
// Severity and tag conditions read from a stored configuration expression, so
// spike, preview and intake admission evaluate one definition. Tag keys reach
// SQL only through json_quote of the configuration's own key; no LIKE pattern
// is built, so % and _ in values match literally. Comparisons are case-sensitive.
export function levelTagSql(cfg:string,e='e') {
 const level=`COALESCE(json_extract(${e}.payload,'$.sentry.level'),'error')`,want=`json_extract(${cfg},'$.filters.level')`;
 const tag=`json_extract(${e}.payload,'$.sentry.tags.'||json_quote(t.key))`,op=`CASE t.type WHEN 'object' THEN json_extract(t.value,'$.op') ELSE 'eq' END`,v=`CASE t.type WHEN 'object' THEN json_extract(t.value,'$.value') ELSE t.value END`;
 return `(${want} IS NULL OR CASE COALESCE(json_extract(${cfg},'$.filters.levelMatch'),'eq') WHEN 'gte' THEN ${levelRank(level)}>=${levelRank(want)} WHEN 'lte' THEN ${levelRank(level)}<=${levelRank(want)} ELSE ${level}=${want} END)
 AND NOT EXISTS(SELECT 1 FROM json_each(${cfg},'$.filters.tags') t WHERE NOT COALESCE(CASE ${op} WHEN 'eq' THEN ${tag} IS ${v} WHEN 'ne' THEN ${tag} IS NOT ${v}
  WHEN 'contains' THEN instr(${tag},${v})>0 WHEN 'not_contains' THEN COALESCE(instr(${tag},${v}),0)=0 WHEN 'starts_with' THEN substr(${tag},1,length(${v}))=${v}
  WHEN 'ends_with' THEN substr(${tag},-length(${v}))=${v} WHEN 'is_set' THEN ${tag} IS NOT NULL WHEN 'not_set' THEN ${tag} IS NULL END,0))`;
}
// Shared by preview and scheduled admission; intake routing reads levelTagSql over the
// stored configuration. Keys stay data, so literal dotted tag keys never become
// executable SQL or nested selectors.
export function eventFilter(config:RuleConfig,alias='e') {
 const parts:string[]=[],args:any[]=[];const f=config.filters;
 for(const key of ['environment','release'] as const)if(f[key]!==undefined){parts.push(`${alias}.${key}=?`);args.push(f[key])}
 // The configuration is bound once as data, never interpolated.
 if(f.level!==undefined||Object.keys(f.tags??{}).length){parts.push(`EXISTS(SELECT 1 FROM (SELECT ? cfg) c WHERE ${levelTagSql('c.cfg',alias)})`);args.push(JSON.stringify({filters:{level:f.level,levelMatch:f.levelMatch,tags:f.tags}}))}
 return {sql:parts.length?parts.join(' AND '):'1',args};
}
export const eligibleEvent=(e='e')=>`${e}.historical=0 AND NOT EXISTS(SELECT 1 FROM event_suppressions x WHERE x.project=${e}.project AND x.event=${e}.id AND x.occurrence=${e}.occurrence) AND NOT EXISTS(SELECT 1 FROM event_grouping g WHERE g.project=${e}.project AND g.event=${e}.id AND g.occurrence=${e}.occurrence)`;
export const userKey=`COALESCE(x.user_key,CASE WHEN json_extract(e.payload,'$.sentry') IS NULL AND json_extract(e.payload,'$.client') IS NOT NULL THEN 'native:'||json_extract(e.payload,'$.client') END)`;
