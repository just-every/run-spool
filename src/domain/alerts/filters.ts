import { scrub } from '../privacy';
export type RuleConfig={metric:'count'|'users'|'session_percent'|'baseline';filters:{environment?:string;level?:string;release?:string;tags?:Record<string,string>};tagKeys:string[]};
export const defaultConfig=():RuleConfig=>({metric:'count',filters:{},tagKeys:[]});
export function ruleConfig(value:any):RuleConfig {
 if(value===undefined)return defaultConfig();
 if(!value||Object.keys(value).sort().join()!=='filters,metric,tagKeys'||!['count','users','session_percent','baseline'].includes(value.metric)||!Array.isArray(value.tagKeys)||value.tagKeys.length>20)throw new Error('Invalid rule configuration');
 const safe=(v:any,max=200)=>typeof v==='string'&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v)&&scrub(v)===v;
 if(value.tagKeys.some((k:any)=>!safe(k,100)||!k)||new Set(value.tagKeys).size!==value.tagKeys.length)throw new Error('Choose at most twenty approved tag keys');
 const f=value.filters;if(!f||typeof f!=='object'||Array.isArray(f)||Object.keys(f).some(k=>!['environment','level','release','tags'].includes(k)))throw new Error('Invalid rule filters');
 for(const k of ['environment','release'])if(f[k]!==undefined&&!safe(f[k]))throw new Error('Invalid rule filter value');
 if(f.level!==undefined&&!['debug','info','log','warning','error','fatal'].includes(f.level))throw new Error('Invalid severity');
 if(f.tags!==undefined&&(!f.tags||typeof f.tags!=='object'||Array.isArray(f.tags)||Object.keys(f.tags).some(k=>!value.tagKeys.includes(k)||!safe(f.tags[k]))))throw new Error('Tag filters require an owner-approved key');
 if(value.metric==='session_percent'&&(f.level!==undefined||Object.keys(f.tags??{}).length))throw new Error('Sessions have no event severity or tag attribution; choose environment and release filters');
 return {metric:value.metric,filters:f,tagKeys:[...value.tagKeys].sort()};
}
// Shared by preview, intake routing, and scheduled admission. JSON paths are bound,
// so literal dotted tag keys never become executable SQL or nested selectors.
export function eventFilter(config:RuleConfig,alias='e') {
 const parts:string[]=[],args:any[]=[];const f=config.filters;
 for(const key of ['environment','release'] as const)if(f[key]!==undefined){parts.push(`${alias}.${key}=?`);args.push(f[key])}
 if(f.level!==undefined){parts.push(`COALESCE(json_extract(${alias}.payload,'$.sentry.level'),'error')=?`);args.push(f.level)}
 for(const [key,value] of Object.entries(f.tags??{})){parts.push(`json_extract(${alias}.payload,?)=?`);args.push('$.sentry.tags.'+JSON.stringify(key),value)}
 return {sql:parts.length?parts.join(' AND '):'1',args};
}
export const eligibleEvent=(e='e')=>`${e}.historical=0 AND NOT EXISTS(SELECT 1 FROM event_suppressions x WHERE x.project=${e}.project AND x.event=${e}.id AND x.occurrence=${e}.occurrence) AND NOT EXISTS(SELECT 1 FROM event_grouping g WHERE g.project=${e}.project AND g.event=${e}.id AND g.occurrence=${e}.occurrence)`;
export const userKey=`COALESCE(x.user_key,CASE WHEN json_extract(e.payload,'$.sentry') IS NULL AND json_extract(e.payload,'$.client') IS NOT NULL THEN 'native:'||json_extract(e.payload,'$.client') END)`;
