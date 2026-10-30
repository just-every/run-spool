import { safeAlias } from '../audit/types';
import { notificationTypes } from './types';
import { emailPreferences } from './model';

export const personalNotificationTables = {
 spool_personal_mail:['id','project','source','type','issue','operator_id','recipient_label','member_version','operator_version','state','code','created','updated','historical'],
 spool_issue_follows:['project','issue','operator_id','actor_label','reason','updated','historical'],
};

export const notificationPreferenceTables = {...personalNotificationTables,spool_notification_preferences:['project','actor_label','operator_id','email','revision','updated','historical']};
export const notificationPreferenceDefaults = (data:any) => ({...Object.fromEntries(Object.keys(notificationPreferenceTables).map(table=>[table,[]])),...data});
export const notificationPreferenceExportRow = (table:string,row:any) => table === 'spool_notification_preferences'||table==='spool_issue_follows' ? {...row,operator_id:null,historical:1} : table==='spool_personal_mail' ? {...row,operator_id:null,member_version:0,operator_version:0,state:'historical',code:'archive_inert',historical:1} : row;
export function validateNotificationPreferences(data:any) {
 const projects=new Set(data.projects.map((row:any)=>row.id)),issues=new Map(data.issues.map((row:any)=>[row.id,row.project]));
 const require=(ok:any)=>{if(!ok)throw new Error('Invalid personal notification archive');};
 const ids=new Set(),keys=new Set();
 for(const row of data.spool_personal_mail){
  require(typeof row.id==='string'&&/^[a-f0-9]{32}$/.test(row.id)&&!ids.has(row.id));ids.add(row.id);
  require(projects.has(row.project)&&typeof row.source==='string'&&row.source.length<=200&&notificationTypes.includes(row.type));
  require(row.issue===null||issues.get(row.issue)===row.project);
  require(row.operator_id===null&&safeAlias(row.recipient_label)&&row.member_version===0&&row.operator_version===0&&row.state==='historical'&&row.code==='archive_inert'&&row.historical===1);
  require(Number.isSafeInteger(row.created)&&row.created>=0&&Number.isSafeInteger(row.updated)&&row.updated>=row.created);
 }
 for(const row of data.spool_issue_follows){
  const key=JSON.stringify([row.project,row.issue,row.actor_label,row.reason]);require(!keys.has(key));keys.add(key);
  require(projects.has(row.project)&&issues.get(row.issue)===row.project&&row.operator_id===null&&safeAlias(row.actor_label)&&row.historical===1&&['assignment','team','bookmark'].includes(row.reason)&&Number.isSafeInteger(row.updated)&&row.updated>=0);
 }
 const seen = new Set<string>();
 for (const row of data.spool_notification_preferences) {
  const key = JSON.stringify([row.project,row.actor_label]);
  if (!safeAlias(row.actor_label) || row.operator_id !== null || row.historical !== 1 || seen.has(key) ||
   !Number.isSafeInteger(row.revision) || row.revision < 1 || !Number.isSafeInteger(row.updated) || row.updated < 0) throw new Error('Invalid notification preference archive');
  seen.add(key);
  if (JSON.stringify(emailPreferences(JSON.parse(row.email))) !== row.email) throw new Error('Invalid notification preference archive');
 }
}

