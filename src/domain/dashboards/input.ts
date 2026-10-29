import {AuthError} from '../../modules/operator-auth/index.mjs';
import {identity,scrub} from '../privacy';
import {eventQuery} from '../investigation/query';
import {secretField} from '../scrub-keyed';
import {reportWindow} from '../reports/window';

export type ItemKind='dashboard'|'table'|'report';
export type Metric='count'|'rate'|'users'|'sessions';
export interface Window {from:number;to:number}
export interface MetricConfig extends Window {metric:Metric;q:string;groupBy?:string}
export interface Widget {id:string;project:string;name:string;config:MetricConfig|Window|{from:number;to:number;timeZone:string};viewId:string|null}
export interface ItemInput {name:string;kind:ItemKind;widgets:Widget[]}
export interface Share {kind:'team'|'role';target:string}
export const fail=(message:string,status=400):never=>{throw new AuthError(message,status)};
export function fields(value:any,names:string[]){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!names.includes(key)))fail('Invalid reporting fields');
}
export function name(value:unknown){
 if(typeof value!=='string'||!value.trim()||value.length>120||/[\x00-\x1f\x7f]/.test(value))return fail('Use a name of at most 120 characters');
 return scrub(value.trim());
}
export function revision(value:unknown):number{
 if(!Number.isSafeInteger(value)||Number(value)<1||Number(value)>=Number.MAX_SAFE_INTEGER)return fail('A current reporting revision is required');
 return Number(value);
}
export function window(value:any,defaults=false):Window{
 const to=value.to??(defaults?Date.now():undefined),from=value.from??(defaults?to-30*86400000:undefined);
 if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||to<=from||to-from>90*86400000||to>Date.now()+300000)return fail('Use an explicit reporting window of at most 90 days');
 return {from,to};
}
export function metricConfig(value:any):MetricConfig{
 fields(value,['metric','q','groupBy','from','to']);
 if(!['count','rate','users','sessions'].includes(value.metric))fail('Unsupported reporting metric');
 const q=value.q??'';
 if(typeof q!=='string'||scrub(q)!==q)fail('Use a scrubbed event query');
 try{eventQuery(q)}catch(error){return fail(String(error instanceof Error?error.message:error))}
 const group=value.groupBy;
 if(group!==undefined&&!['environment','release','level'].includes(group)){
  if(typeof group!=='string'||!/^tag:[-a-zA-Z0-9_.]{1,100}$/.test(group)||group.slice(4).startsWith('user.')||secretField(group.slice(4)))fail('Group by environment, release, level or an existing non-identity tag');
 }
 if(value.metric==='sessions'){
  if(group!==undefined&&!['environment','release'].includes(group))fail('Sessions support grouping by environment or release');
  const terms:string[]=q.match(/(?:[^\s"]|"[^"]*")+/g)??[];
  if(terms.some(term=>!['environment','release','after','before'].includes(term.slice(0,term.indexOf(':')))))fail('Session queries support only environment, release, after and before; session observations have no event association');
 }
 return {...window(value),metric:value.metric,q,...group===undefined?{}:{groupBy:group}};
}
export function itemInput(value:any,updating=false):ItemInput{
 fields(value,['name','kind','widgets',...updating?['revision']:[]]);
 if(!['dashboard','table','report'].includes(value.kind))fail('Unsupported reporting item kind');
 if(!Array.isArray(value.widgets)||value.widgets.length<1||value.widgets.length>12)fail('reporting_widget_limit: use between 1 and 12 widgets');
 const widgets:Widget[]=value.widgets.map((row:any)=>{
  fields(row,['id','project','name','config','viewId']);
  const common={id:row.id===undefined?crypto.randomUUID():identity(row.id,'widget'),project:identity(row.project,'project'),name:name(row.name)};
  if(value.kind==='table'){
   fields(row.config,['from','to']);
   return {...common,config:window(row.config),viewId:identity(row.viewId,'saved review view')};
  }
  if(row.viewId!==undefined&&row.viewId!==null)fail('Review view references belong to saved tables');
  if(value.kind==='report'){
   fields(row.config,['from','to','timeZone']);
   const bounds=reportWindow(row.config);
   return {...common,config:{from:bounds.from,to:bounds.to,timeZone:bounds.timeZone},viewId:null};
  }
  return {...common,config:metricConfig(row.config),viewId:null};
 });
 if(new Set(widgets.map(row=>row.id)).size!==widgets.length)fail('Widget identifiers must be unique');
 return {name:name(value.name),kind:value.kind,widgets};
}
export function shares(value:any):Share[]{
 if(!Array.isArray(value)||value.length>25)fail('Use at most 25 sharing grants');
 const result:Share[]=value.map((row:any)=>{
  fields(row,['kind','target']);
  if(!['team','role'].includes(row.kind))fail('Share with a project team or organization role');
  const target=name(row.target);
  if(row.kind==='role'&&!['admin','member','read-only'].includes(target))fail('Billing and service roles cannot read reports');
  return {kind:row.kind,target};
 });
 if(new Set(result.map(row=>JSON.stringify(row))).size!==result.length)fail('Sharing grants must be unique');
 return result;
}
