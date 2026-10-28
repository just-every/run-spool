export const recurrenceTables={recurrence_policies:['project','revision','reopen_same_release','updated']};
export const recurrenceDefaults=(data:any)=>({recurrence_policies:[],...data});
export const recurrenceAuditKinds=['recurrence_policy_changed'];
const integer=(value:any)=>Number.isSafeInteger(value)&&value>=0;
export function validateRecurrenceArchive(data:any){
 const projects=new Set(data.projects.map((row:any)=>row.id)),policies=new Map<string,any>();
 for(const row of data.recurrence_policies){
  if(Object.keys(row).sort().join()!=='project,reopen_same_release,revision,updated'||!projects.has(row.project)||policies.has(row.project)||
   !integer(row.revision)||row.revision<1||![0,1].includes(row.reopen_same_release)||!integer(row.updated))throw new Error('Archive recurrence policy');
  policies.set(row.project,row);
 }
 const revisions=new Set<string>();
 for(const row of data.audit.filter((row:any)=>recurrenceAuditKinds.includes(row.kind))){
  const detail=JSON.parse(row.detail),policy=policies.get(row.project),key=JSON.stringify([row.project,detail.revision]);
  if(Object.keys(detail).sort().join()!=='affectedResolvedCount,previousRevision,reopenSameRelease,revision'||!policy||!integer(row.created)||
   !integer(detail.revision)||detail.revision<1||detail.revision>policy.revision||detail.previousRevision!==detail.revision-1||typeof detail.reopenSameRelease!=='boolean'||
   !integer(detail.affectedResolvedCount)||revisions.has(key)||detail.revision===policy.revision&&detail.reopenSameRelease!==(policy.reopen_same_release===1))
   throw new Error('Archive recurrence policy audit');
  revisions.add(key);
 }
}
