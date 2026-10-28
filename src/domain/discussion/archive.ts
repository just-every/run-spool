import { scrubText } from '../scrub';
import { safeAlias } from '../audit/types';

export const discussionTables={
 issue_comments:['id','project','issue','operator_id','actor_kind','actor_label','body','mentions','version','created','updated'],
 issue_subscriptions:['project','issue','operator_id','reason','state','updated'],
 issue_activity:['id','project','issue','kind','actor_kind','actor_label','detail','created'],
};
export const discussionDefaults=(data:any)=>({...Object.fromEntries(Object.keys(discussionTables).map(table=>[table,[]])),...data});
export function discussionExportRow(table:string,row:any) {
 if(table==='issue_comments')return {...row,operator_id:'',body:scrubText(row.body,4000)};
 if(table==='issue_subscriptions')return {...row,state:'inert'};
 if(table==='issue_activity')return {...row,detail:scrubText(row.detail,32768)};
 return row;
}
const integer=(value:any)=>Number.isSafeInteger(value)&&value>=0;
const require=(condition:any)=>{if(!condition)throw new Error('Invalid discussion archive');};
export function validateDiscussionArchive(data:any) {
 const issues=new Map<string,string>(data.issues.map((row:any)=>[row.id,row.project]));
 const ids=new Set<string>(),counts=new Map<string,number>();
 for(const row of data.issue_comments) {
  require(issues.get(row.issue)===row.project&&typeof row.id==='string'&&row.id.length>0&&!ids.has(row.id));ids.add(row.id);
  const key=JSON.stringify([row.project,row.issue]);counts.set(key,(counts.get(key)??0)+1);require(counts.get(key)!<=200);
  require(row.operator_id===''&&['owner','member'].includes(row.actor_kind)&&safeAlias(row.actor_label));
  require(typeof row.body==='string'&&row.body.trim()&&row.body.length<=4000&&scrubText(row.body,4000)===row.body);
  require(integer(row.version)&&row.version>0&&integer(row.created)&&integer(row.updated)&&row.updated>=row.created);
  let mentions:any;try{mentions=JSON.parse(row.mentions)}catch{throw new Error('Invalid discussion archive');}
  require(Array.isArray(mentions)&&mentions.length<=2000&&new Set(mentions).size===mentions.length&&mentions.every(safeAlias));
 }
 const subscriptions=new Set<string>();
 for(const row of data.issue_subscriptions) {
  const key=JSON.stringify([row.project,row.issue,row.operator_id,row.reason]);
  require(issues.get(row.issue)===row.project&&!subscriptions.has(key));subscriptions.add(key);
  require(typeof row.operator_id==='string'&&row.operator_id.length>0&&['comment','mention','manual'].includes(row.reason)&&row.state==='inert'&&integer(row.updated));
 }
 const activityIds=new Set<string>();
 for(const row of data.issue_activity) {
  require(issues.get(row.issue)===row.project&&typeof row.id==='string'&&row.id.length>0&&!activityIds.has(row.id));activityIds.add(row.id);
  require(typeof row.kind==='string'&&row.kind.length<=100&&['owner','member','ingest','deploy','service','unknown','agent'].includes(row.actor_kind)&&safeAlias(row.actor_label)&&integer(row.created));
  require(typeof row.detail==='string'&&row.detail.length<=32768&&scrubText(row.detail,32768)===row.detail);
  let detail:any;try{detail=JSON.parse(row.detail)}catch{throw new Error('Invalid discussion archive');}
  require(detail&&typeof detail==='object'&&!Array.isArray(detail));
 }
}
