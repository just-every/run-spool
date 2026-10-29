import {identity,scrub} from '../privacy';
import {reviewQuery} from '../review/model';
import {itemInput,name,shares} from './input';

export const reportingTables={
 spool_reporting_items:['id','organization','kind','name','author','revision','created','updated'],
 spool_reporting_projects:['item','project'],
 spool_reporting_widgets:['item','id','project','position','name','config','view_id'],
 spool_reporting_shares:['item','id','kind','target','active','created'],
};
export const reportingDefaults=(data:any)=>({...Object.fromEntries(Object.keys(reportingTables).map(table=>[table,[]])),...data});
export function reportingExportRow(table:string,row:any){
 if(table==='spool_reporting_items')return {...row,name:scrub(row.name),author:null};
 if(table==='spool_reporting_widgets')return {...row,name:scrub(row.name)};
 if(table==='spool_reporting_shares')return {...row,target:scrub(row.target),active:0};
 return row;
}
const valid=(condition:unknown):void=>{if(!condition)throw new Error('Invalid reporting archive')};
const integer=(value:any)=>Number.isSafeInteger(value)&&value>=0;
export function validateReportingArchive(data:any){
 const items=new Map<string,any>(),projects=new Set(data.projects.map((row:any)=>row.id)),pairs=new Set<string>(),widgetIds=new Set<string>(),positions=new Set<string>(),shareIds=new Set<string>(),shareTargets=new Set<string>();
 for(const row of data.spool_reporting_items){
  identity(row.id,'reporting item');valid(!items.has(row.id));items.set(row.id,row);
  valid(['dashboard','table','report'].includes(row.kind)&&name(row.name)===row.name&&row.author===null&&integer(row.revision)&&row.revision>0&&integer(row.created)&&integer(row.updated)&&row.updated>=row.created);
  valid(row.organization===null||data.spool_organizations.some((org:any)=>org.id===row.organization));
  valid(data.spool_reporting_items.filter((item:any)=>item.organization===row.organization&&item.kind===row.kind).length<=25);
 }
 for(const row of data.spool_reporting_projects){
  const key=JSON.stringify([row.item,row.project]);valid(items.has(row.item)&&projects.has(row.project)&&!pairs.has(key));pairs.add(key);
 }
 for(const row of data.spool_reporting_widgets){
  const item=items.get(row.item),key=JSON.stringify([row.item,row.id]),position=JSON.stringify([row.item,row.position]);
  valid(item&&pairs.has(JSON.stringify([row.item,row.project]))&&!widgetIds.has(key)&&!positions.has(position)&&integer(row.position)&&row.position<12);widgetIds.add(key);positions.add(position);
  valid(name(row.name)===row.name);
  const widget={id:row.id,project:row.project,name:row.name,config:JSON.parse(row.config),...item.kind==='table'?{viewId:row.view_id}:{}};
  const normalized=itemInput({kind:item.kind,name:item.name,widgets:[widget]}).widgets[0];
  valid((item.kind==='table'?normalized.viewId===row.view_id:row.view_id===null)&&JSON.stringify(normalized.config)===row.config);
  if(item.kind==='table'){
   const view=data.review_views.find((v:any)=>v.project===row.project&&v.id===row.view_id);valid(view);reviewQuery(JSON.parse(view.query));
  }
 }
 for(const row of data.spool_reporting_shares){
  const item=items.get(row.item),key=JSON.stringify([row.item,row.id]),target=JSON.stringify([row.item,row.kind,row.target]);identity(row.id,'reporting share');
  valid(item&&item.organization!==null&&!shareIds.has(key)&&!shareTargets.has(target)&&row.active===0&&integer(row.created));shareIds.add(key);shareTargets.add(target);
  valid(shares([{kind:row.kind,target:row.target}])[0].target===row.target);
 }
 for(const row of items.values()){
  valid(data.spool_reporting_widgets.filter((widget:any)=>widget.item===row.id).length<=12&&data.spool_reporting_shares.filter((share:any)=>share.item===row.id).length<=25);
 }
}
