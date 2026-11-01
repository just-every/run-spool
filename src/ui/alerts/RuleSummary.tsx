export const installationOwner='Installation owner';
export const destinationLabel=(destination:any)=>destination?`${destination.label} · ${destination.kind==='slack'?'Slack':destination.channel==='mail'?'Email':'Webhook'}${destination.configured===false?' · blocked':''}`:'Removed destination';
export const ruleConfig=(rule:any)=>typeof rule.config==='string'?JSON.parse(rule.config):rule.config??{metric:'count',filters:{},tagKeys:[]};
export function filterSummary(filters:any){return [filters.environment&&`Environment: ${filters.environment}`,filters.level&&`Severity: ${filters.level}`,filters.release!==undefined&&`Release: ${filters.release||'No release'}`,...Object.entries(filters.tags??{}).map(([key,value])=>`${key}: ${value}`)].filter(Boolean).join(' · ')}
export function metricSummary(rule:any){
 if(!JSON.parse(rule.kinds).includes('spike'))return '';
 const metric=ruleConfig(rule).metric,n=rule.threshold;
 return `${metric==='users'?`More than ${n} affected users`:metric==='session_percent'?`At least ${n}% of observed sessions affected`:metric==='baseline'?`At least ${n} times the historical rate`:`At least ${n} accepted occurrences`} in ${rule.window_ms/60000} minutes`;
}
export function ruleSummary(rule:any,destination:any){return [destinationLabel(destination),rule.enabled?'Enabled':'Disabled',JSON.parse(rule.kinds).map((kind:string)=>kind.replaceAll('_',' ')).join(', '),metricSummary(rule),filterSummary(ruleConfig(rule).filters)].filter(Boolean).join(' · ')}
