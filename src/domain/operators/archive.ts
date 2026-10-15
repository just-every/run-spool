import { admissionBasis } from '../bundle-grouping';
import { pathMappings } from '../path-mappings';
import { canonical, grouping, hash, scrub } from '../privacy';
import { deploymentInput } from './deployments';
import { policyInput } from './policies';
import { captureAuditKinds } from '../alerts/capture-history';
export const operatorTables:Record<string,string[]>={
 grouping_corrections:['id','project','kind','state','plan','created','updated'],
 event_grouping:['project','event','occurrence','original_issue','algorithm','basis','fingerprint','correction','direction'],
 issue_assignments:['project','issue','label','updated'],
 suppression_policies:['id','project','revision','field','mode','value','enabled','created','updated'],
 event_suppressions:['project','event','occurrence','reasons'],
 deployment_path_mappings:['project','release','environment','build','payload'],
 deployment_manifests:['project','release','environment','commit_sha','repository','deployed_at','created'],
};
export const operatorDefaults=(data:any)=>({...Object.fromEntries(Object.keys(operatorTables).map(name=>[name,[]])),...data});
export const operatorAuditKinds=['issue_assigned','suppression_changed','grouping_applied','grouping_undone','deployment_registered',...captureAuditKinds];
function assert(ok:unknown,message='Archive operator integrity'):asserts ok{if(!ok)throw new Error(message)}
function fields(value:any,names:string[]){assert(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join()===names.sort().join())}
const integer=(n:any)=>Number.isSafeInteger(n)&&n>=0;
const digest=(s:any)=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const uuid=(s:any)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(s);
export async function validateOperators(data:any){
 const issues=new Map<string,any>(data.issues.map((i:any)=>[i.id,i]));
 const events=new Map<string,any>(data.events.map((e:any)=>[JSON.stringify([e.project,e.id,e.occurrence]),e]));
 const corrections=new Map<string,any>();
 for(const r of data.grouping_corrections){
  assert(uuid(r.id)&&['split','merge'].includes(r.kind)&&['preview','applied','undone'].includes(r.state)&&integer(r.created)&&integer(r.updated)&&r.updated>=r.created);
  const p=JSON.parse(r.plan);fields(p,['version','project','kind','moves','issues','target','fingerprint']);
  assert(p.version===1&&p.project===r.project&&p.kind===r.kind&&digest(p.target)&&Array.isArray(p.moves)&&p.moves.length>0&&p.moves.length<=200&&Array.isArray(p.issues)&&p.issues.length===(p.kind==='split'?1:2));
  const seen=new Set();
  for(const m of p.moves){fields(m,['event','occurrence','from','to']);assert(typeof m.event==='string'&&m.event.length<=128&&typeof m.occurrence==='string'&&m.to===p.target&&m.from===p.issues[0].id&&m.from!==m.to&&!seen.has(m.event));seen.add(m.event)}
  for(const [index,i] of p.issues.entries()){fields(i,['id','revision','count','after']);assert(digest(i.id)&&issues.get(i.id)?.project===r.project&&integer(i.revision)&&integer(i.count)&&integer(i.after)&&i.after===i.count+(index===0?-p.moves.length:p.moves.length));}
  if(p.kind==='split'){assert(p.fingerprint===await hash('operator-split:'+r.id)&&p.target===await hash(r.project+':'+p.fingerprint));if(r.state!=='preview')assert(issues.get(p.target)?.project===r.project&&issues.get(p.target)?.fingerprint===p.fingerprint)}
  else assert(p.fingerprint===null&&p.issues[1].id===p.target);
  corrections.set(r.id,{...r,plan:p});
 }
 const originals=new Map<string,any>();
 for(const r of data.event_grouping){
  const key=JSON.stringify([r.project,r.event,r.occurrence]),event=events.get(key),change=corrections.get(r.correction),original=issues.get(r.original_issue);
  assert(event&&!event.historical&&['js-frame-v1','python-frame-v1','go-frame-v1'].includes(r.algorithm)&&digest(r.fingerprint)&&original?.project===r.project&&original.fingerprint===r.fingerprint&&r.original_issue===await hash(r.project+':'+r.fingerprint));
  const payload=JSON.parse(event.payload),basis=await admissionBasis(payload,original,data.grouping_routes);
  assert(r.algorithm===grouping(payload).algorithm&&original.algorithm===r.algorithm&&r.basis===basis&&await hash(basis)===r.fingerprint&&change?.project===r.project&&['apply','undo'].includes(r.direction)&&change.state===(r.direction==='apply'?'applied':'undone'));
  const move=change.plan.moves.find((m:any)=>m.event===r.event&&m.occurrence===r.occurrence);assert(move&&event.issue===(r.direction==='apply'?move.to:move.from));
  originals.set(key,r);
 }
 for(const r of data.issue_assignments)assert(issues.get(r.issue)?.project===r.project&&integer(r.updated)&&(r.label===null||typeof r.label==='string'&&r.label.trim()&&r.label.length<=80&&scrub(r.label)===r.label));
 for(const r of data.suppression_policies){assert(uuid(r.id)&&Number.isSafeInteger(r.revision)&&r.revision>0&&[0,1].includes(r.enabled)&&integer(r.created)&&integer(r.updated));policyInput({...r,enabled:r.enabled===1})}
 for(const r of data.event_suppressions){
  const e=events.get(JSON.stringify([r.project,r.event,r.occurrence]));assert(e&&!e.historical);const reasons=JSON.parse(r.reasons);assert(Array.isArray(reasons)&&reasons.length>0&&reasons.length<=20);
  const event=JSON.parse(e.payload),original=originals.get(JSON.stringify([r.project,r.event,r.occurrence])),issue=issues.get(original?.original_issue??e.issue),fp=await hash(original?.basis??await admissionBasis(event,issue,data.grouping_routes));
  const seen=new Set();for(const reason of reasons){fields(reason,['id','revision','field','mode','value']);const p=data.suppression_policies.find((p:any)=>p.id===reason.id&&p.project===r.project);assert(p&&integer(reason.revision)&&reason.revision>0&&reason.revision<=p.revision&&!seen.has(reason.id));seen.add(reason.id);policyInput({...reason,enabled:true});const value=reason.field==='fingerprint'?fp:reason.field==='release'?e.release:event.message;assert(reason.mode==='exact'?value===reason.value:value.includes(reason.value));}
 }
 for(const r of data.deployment_manifests){assert(data.releases.some((release:any)=>release.project===r.project&&release.name===r.release)&&integer(r.created)&&integer(r.deployed_at));const normalized=deploymentInput({commitSha:r.commit_sha,repository:r.repository,deployedAt:new Date(r.deployed_at).toISOString(),environment:r.environment});assert(canonical(normalized)===canonical({commit_sha:r.commit_sha,repository:r.repository,deployed_at:r.deployed_at,environment:r.environment}))}
 for(const r of data.deployment_path_mappings){assert(data.deployment_manifests.some((m:any)=>m.project===r.project&&m.release===r.release&&m.environment===r.environment)&&data.releases.some((m:any)=>m.project===r.project&&m.name===r.release&&m.build===r.build));assert(canonical(pathMappings(JSON.parse(r.payload)))===r.payload)}
 const captureFacts=new Set<string>();
 for(const r of data.audit.filter((r:any)=>operatorAuditKinds.includes(r.kind))){
  assert(integer(r.created));const d=JSON.parse(r.detail);
  if(captureAuditKinds.includes(r.kind)){
   fields(d,['issue']);const issue=issues.get(d.issue),key=JSON.stringify([r.project,d.issue,r.kind]);
   assert(uuid(r.id)&&issue?.project===r.project&&['js-frame-v1','python-frame-v1','go-frame-v1'].includes(issue.algorithm)&&!captureFacts.has(key));captureFacts.add(key);
  }
  if(r.kind==='issue_assigned'){fields(d,['issue','label','revision']);assert(issues.get(d.issue)?.project===r.project&&integer(d.revision)&&d.revision>0&&(d.label===null||typeof d.label==='string'&&d.label.length<=80&&scrub(d.label)===d.label))}
  if(r.kind==='suppression_changed'){fields(d,['policy','revision','field','mode','value','enabled']);assert(data.suppression_policies.some((p:any)=>p.id===d.policy&&p.project===r.project&&p.revision>=d.revision)&&integer(d.revision)&&d.revision>0&&[0,1].includes(d.enabled));policyInput({...d,enabled:d.enabled===1})}
  if(r.kind.startsWith('grouping_')){fields(d,['correction']);assert(corrections.get(d.correction)?.project===r.project)}
  if(r.kind==='deployment_registered'){fields(d,['release','environment']);assert(data.deployment_manifests.some((m:any)=>m.project===r.project&&m.release===d.release&&m.environment===d.environment))}
 }
 for(const p of data.projects){assert(data.grouping_corrections.filter((r:any)=>r.project===p.id).length<=50&&data.suppression_policies.filter((r:any)=>r.project===p.id).length<=20)}
 return originals;
}
