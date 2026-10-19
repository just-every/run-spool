import { canonical,hash } from '../privacy';
import { validateGroupingPolicy } from './rules';
export const groupingTables={grouping_policies:['project','revision','policy','updated']};
export const groupingDefaults=(data:any)=>({grouping_policies:[],...data});
export async function validateGroupingArchive(data:any){
 const projects=new Set(data.projects.map((p:any)=>p.id)),seen=new Set<string>();
 for(const row of data.grouping_policies){
  if(!projects.has(row.project)||seen.has(row.project)||!Number.isSafeInteger(row.revision)||row.revision<1||!Number.isSafeInteger(row.updated)||row.updated<0)throw new Error('Archive grouping policy identity');
  const policy=validateGroupingPolicy(JSON.parse(row.policy));if(JSON.stringify(policy)!==row.policy)throw new Error('Archive grouping policy shape');seen.add(row.project);
 }
 const revisions=new Set<string>(),digests=new Map<string,string>();
 for(const row of data.audit.filter((r:any)=>r.kind==='grouping_rules_changed')){
  const d=JSON.parse(row.detail),current=data.grouping_policies.find((p:any)=>p.project===row.project),key=row.project+':'+d.revision;
  if(!['policyDigest,previousRevision,revision','policy,policyDigest,previousRevision,revision'].includes(Object.keys(d).sort().join())||!current||!Number.isSafeInteger(d.revision)||d.revision<1||d.revision>current.revision||d.previousRevision!==d.revision-1||!/^[a-f0-9]{64}$/.test(d.policyDigest)||revisions.has(key)||!Number.isSafeInteger(row.created))throw new Error('Archive grouping policy audit');
  if(d.policy!==undefined&&await hash(canonical(validateGroupingPolicy(d.policy)))!==d.policyDigest)throw new Error('Archive grouping version digest');
  if(d.revision===current.revision&&d.policyDigest!==await hash(canonical(JSON.parse(current.policy))))throw new Error('Archive grouping policy digest');revisions.add(key);digests.set(key,d.policyDigest);
 }
 for(const row of data.events){
  const event=JSON.parse(row.payload),snapshot=event.grouping??event.sentry?.grouping;if(!snapshot)continue;
  if(snapshot.revision===0&&canonical(validateGroupingPolicy(snapshot.policy))===canonical({version:1,stack:'',fingerprint:''}))continue;
  const current=data.grouping_policies.find((p:any)=>p.project===row.project);
  if(!current||snapshot.revision<1||snapshot.revision>current.revision)throw new Error('Archive grouping snapshot revision');
  const digest=await hash(canonical(validateGroupingPolicy(snapshot.policy))),recorded=digests.get(row.project+':'+snapshot.revision);
  if(recorded&&recorded!==digest||snapshot.revision===current.revision&&digest!==await hash(canonical(JSON.parse(current.policy))))throw new Error('Archive grouping snapshot policy');
 }
}
