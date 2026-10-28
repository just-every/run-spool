import {discussionTables,discussionDefaults,validateDiscussionArchive} from '../discussion/archive';
import {recurrenceTables,recurrenceDefaults,validateRecurrenceArchive} from '../recurrence/archive';
import {scrub} from '../privacy';
import {safeAlias,actorKinds} from '../audit/types';
export const lifecycleTables={...discussionTables,...recurrenceTables,issue_priorities:['project','issue','automatic','manual'],issue_activity:['id','project','issue','kind','actor_kind','actor_label','detail','created']};
export function lifecycleDefaults(data:any){
 const rank=(level:string)=>['fatal','error'].includes(level)?3:level==='warning'?2:1;
 return {issue_priorities:data.issues.map((i:any)=>({project:i.project,issue:i.id,automatic:Math.max(3*(data.alerts.some((a:any)=>a.issue===i.id&&a.kind==='regression')?1:0),1,...data.events.filter((e:any)=>e.project===i.project&&e.issue===i.id).map((e:any)=>rank(JSON.parse(e.payload).sentry?.level??'error'))),manual:null})),issue_activity:[],...discussionDefaults(recurrenceDefaults(data))};
}
export function validateLifecycleArchive(data:any){
 validateRecurrenceArchive(data);
 validateDiscussionArchive(data);
 const seen=new Set();
 for(const p of data.issue_priorities){if(seen.has(p.issue)||!Number.isSafeInteger(p.automatic)||p.automatic<1||p.automatic>3||p.manual!==null&&!['high','medium','low'].includes(p.manual))throw new Error('Archive issue priority');seen.add(p.issue)}
 if(data.issues.some((i:any)=>!seen.has(i.id)))throw new Error('Archive missing priority');
 for(const a of data.issue_activity){if(!safeAlias(a.actor_label)||!actorKinds.includes(a.actor_kind)||typeof a.kind!=='string'||scrub(a.kind)!==a.kind||!Number.isSafeInteger(a.created)||a.created<0||typeof a.detail!=='string'||scrub(a.detail)!==a.detail)throw new Error('Archive issue activity');const detail=JSON.parse(a.detail);if(!detail||Array.isArray(detail)||typeof detail!=='object')throw new Error('Archive activity detail')}
}
