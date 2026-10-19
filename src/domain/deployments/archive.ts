import { startInput } from './input';
import { releaseIdentity } from '../releases/identity';
export const deploymentTables={
 deployment_runs:['project','id','release','build','environment','repository','commit_sha','previous_commit','included_commits','started_at','deadline','destination','actor','created','historical'],
 deployment_steps:['project','deployment','callback','sequence','state','exposure','rollback_release','occurred','recorded','actor','digest'],
 deployment_notices:['project','deployment','state','created','updated'],
};
export const deploymentDefaults=(data:any)=>({...Object.fromEntries(Object.keys(deploymentTables).map(k=>[k,[]])),...data});
export function deploymentExportRow(table:string,row:any){
 if(table==='deployment_runs')return {...row,destination:'',historical:1};
 return row;
}
export function validateDeploymentArchive(data:any){
 const integer=(v:any)=>Number.isSafeInteger(v)&&v>=0,keys=new Set<string>();
 for(const row of data.deployment_runs){
  startInput({id:row.id,build:row.build,commitSha:row.commit_sha,repository:row.repository,environment:row.environment,startedAt:new Date(row.started_at).toISOString(),deadline:new Date(row.deadline).toISOString(),previousCommit:row.previous_commit,includedCommits:JSON.parse(row.included_commits),destination:'archive'});releaseIdentity(row.release);
  const key=JSON.stringify([row.project,row.id]);if(keys.has(key)||row.historical!==1||row.destination!==''||!integer(row.created)||!/^actor-[a-f0-9-]{36}$/.test(row.actor)||!data.releases.some((r:any)=>r.project===row.project&&r.name===row.release))throw new Error('Archive deployment run');keys.add(key);
  const steps=data.deployment_steps.filter((r:any)=>r.project===row.project&&r.deployment===row.id).sort((a:any,b:any)=>a.sequence-b.sequence),callbacks=new Set<string>();
  if(!steps.length)throw new Error('Archive deployment has no start');
  for(let i=0;i<steps.length;i++){
   const step=steps[i],prior=steps[i-1];
   if(step.sequence!==i+1||callbacks.has(step.callback)||!integer(step.occurred)||!integer(step.recorded)||!Number.isInteger(step.exposure)||step.exposure<0||step.exposure>100||typeof step.digest!=='string'||!/^actor-[a-f0-9-]{36}$/.test(step.actor)&&step.actor!=='service-deployment-deadline')throw new Error('Archive deployment step');callbacks.add(step.callback);
   if(i===0){if(step.state!=='started'||step.exposure!==0||step.occurred!==row.started_at)throw new Error('Archive deployment start')}
   else if(step.occurred<prior.occurred||step.state==='rolled_back'&&(prior.state!=='succeeded'||!data.releases.some((r:any)=>r.project===row.project&&r.name===step.rollback_release))||step.state!=='rolled_back'&&(!(['started','progress'].includes(prior.state)||prior.state==='timed_out'&&['succeeded','failed'].includes(step.state))||!['progress','succeeded','failed','timed_out'].includes(step.state)||step.exposure<prior.exposure))throw new Error('Archive deployment chronology');
  }
 }
 for(const row of [...data.deployment_steps,...data.deployment_notices])if(!keys.has(JSON.stringify([row.project,row.deployment])))throw new Error('Archive deployment reference');
 for(const row of data.deployment_notices)if(!integer(row.created)||!integer(row.updated)||!['pending','uncertain','blocked','suppressed_locally','accepted','rejected','rate_limited'].includes(row.state))throw new Error('Archive deployment notice');
}
