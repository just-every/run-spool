import { safeAlias, actorKinds } from '../audit/types';
import { scrub } from '../privacy';
export const assignmentTables={issue_assignment_history:['id','project','issue','revision','kind','member','target_label','actor_kind','actor_label','created','historical']};
export const assignmentDefaults=(data:any)=>({issue_assignment_history:[],...data});
export const assignmentExportRow=(table:string,row:any)=>table==='issue_assignment_history'?{...row,member:null,historical:1}:row;
export function validateAssignmentArchive(data:any) {
 const seen=new Set<string>();
 for(const row of data.issue_assignment_history) {
  const key=JSON.stringify([row.issue,row.revision]),issue=data.issues.find((issue:any)=>issue.id===row.issue&&issue.project===row.project);
  if(seen.has(key)||!issue||!Number.isSafeInteger(row.revision)||row.revision<1||row.revision>issue.revision||row.member!==null||row.historical!==1||!Number.isSafeInteger(row.created)||row.created<0||!actorKinds.includes(row.actor_kind)||!safeAlias(row.actor_label)||
   !['member','label','unassigned'].includes(row.kind)||
   (row.kind==='member'?!safeAlias(row.target_label):row.kind==='unassigned'?row.target_label!==null:typeof row.target_label!=='string'||!row.target_label.trim()||row.target_label.length>80||scrub(row.target_label)!==row.target_label))throw new Error('Invalid assignment archive');
  seen.add(key);
 }
}
