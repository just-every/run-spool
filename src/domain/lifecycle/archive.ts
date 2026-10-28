import {suppressionTables,suppressionDefaults,validateSuppressionArchive} from '../suppression/archive';
import {discussionTables,discussionDefaults,validateDiscussionArchive} from '../discussion/archive';
import {recurrenceTables,recurrenceDefaults,validateRecurrenceArchive} from '../recurrence/archive';
export const lifecycleTables={...suppressionTables,...discussionTables,...recurrenceTables,issue_priorities:['project','issue','automatic','manual']};
export function lifecycleDefaults(data:any){
 // Older archives have no stored priorities. Their retained levels and history
 // provide the same initial value as the migration, without reviving work.
 if(!data.issue_priorities?.length&&data.issues.length){
  const levels=new Map<string,number>();
  for(const event of data.events){const level=JSON.parse(event.payload).sentry?.level??'error',rank=['fatal','error'].includes(level)?3:level==='warning'?2:1;levels.set(event.issue,Math.max(levels.get(event.issue)??1,rank))}
  for(const alert of data.alerts)if(['regression','spike'].includes(alert.kind))levels.set(alert.issue,3);
  data={...data,issue_priorities:data.issues.map((issue:any)=>({project:issue.project,issue:issue.id,automatic:levels.get(issue.id)??3,manual:null}))};
 }
 return {issue_priorities:[],...suppressionDefaults(discussionDefaults(recurrenceDefaults(data)))};
}
export function validateLifecycleArchive(data:any){
 validateSuppressionArchive(data);validateRecurrenceArchive(data);validateDiscussionArchive(data);
 const seen=new Set();
 for(const priority of data.issue_priorities){if(seen.has(priority.issue)||!Number.isSafeInteger(priority.automatic)||priority.automatic<1||priority.automatic>3||priority.manual!==null&&!['high','medium','low'].includes(priority.manual))throw new Error('Archive issue priority');seen.add(priority.issue)}
 if(data.issues.some((issue:any)=>!seen.has(issue.id)))throw new Error('Archive missing priority');
}
