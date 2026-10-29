import {eventQuery} from '../investigation/query';
import {scrub} from '../privacy';
export const latestReviewAlert=(alias:string)=>`(SELECT id FROM alerts WHERE project=${alias}.project AND issue=${alias}.id AND kind IN ('new_issue','regression') ORDER BY created DESC,id DESC LIMIT 1)`;
export const pendingReview=(alias:string)=>`(${latestReviewAlert(alias)} IS NOT NULL AND NOT EXISTS(SELECT 1 FROM review_stamps reviewed WHERE reviewed.project=${alias}.project AND reviewed.issue=${alias}.id AND reviewed.alert=${latestReviewAlert(alias)}))`;
export function reviewQuery(value:any){
 if(!value||Array.isArray(value)||Object.keys(value).some(k=>!['q','status','release','sort'].includes(k)))throw new Error('Only validated query fields can be saved');
 const query={q:value.q??'',status:value.status??'all',release:value.release??'all',sort:value.sort??'priority'};
 if(Object.values(query).some(v=>typeof v!=='string'||scrub(v)!==v)||query.release.length>200||!['all','unresolved','open','acknowledged','resolved','suppressed'].includes(query.status)||!['priority','latest','occurrences'].includes(query.sort))throw new Error('Invalid saved query');
 eventQuery(query.q);return query;
}
export const reviewTables={review_stamps:['project','issue','generation','alert','reviewed'],review_views:['project','id','generation','query']};
export function validateReviewArchive(data:any){
 for(const [table,keys] of [['review_stamps',['project','issue']],['review_views',['project','id']]] as const){const seen=new Set();for(const row of data[table]){const key=JSON.stringify(keys.map(k=>row[k]));if(seen.has(key)||!data.projects.some((p:any)=>p.id===row.project)||typeof row.generation!=='string'||!/^[-a-f0-9]{36}$/.test(row.generation))throw new Error('Archive review identity');seen.add(key);if(table==='review_stamps'){if(!data.issues.some((i:any)=>i.project===row.project&&i.id===row.issue)||!data.alerts.some((a:any)=>a.project===row.project&&a.issue===row.issue&&a.id===row.alert&&['new_issue','regression'].includes(a.kind))||!Number.isSafeInteger(row.reviewed)||row.reviewed<0)throw new Error('Archive review stamp')}else{const query=reviewQuery(JSON.parse(row.query));if(JSON.stringify(query)!==row.query||!/^[-a-f0-9]{36}$/.test(row.id)||data[table].filter((r:any)=>r.project===row.project).length>25)throw new Error('Archive saved review query')}}}
}
