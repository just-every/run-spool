import { canonical,hash } from '../privacy';
import type { AlertEnvironment } from '../alerts/types';
import { findDestination } from '../alerts/destinations.server';
import { sender } from '../alerts/mail';
import { auditCommit, auditedBatch } from '../audit/context';
import { auditSubject, projectAuditLabel, serviceActor } from '../audit/identity';
const s=(db:D1Database,sql:string,...args:any[])=>db.prepare(sql).bind(...args);
export async function deploymentTimeouts(env:AlertEnvironment,time:number) {
 const rows=(await s(env.DB,"SELECT r.* FROM deployment_runs r WHERE historical=0 AND deadline<=? AND (SELECT state FROM deployment_steps WHERE project=r.project AND deployment=r.id ORDER BY sequence DESC LIMIT 1) IN ('started','progress','timed_out') AND NOT EXISTS(SELECT 1 FROM deployment_notices n WHERE n.project=r.project AND n.deployment=r.id) ORDER BY deadline,project,id LIMIT 30",time).all<any>()).results;
 for(const row of rows){
  // The deadline service records the timeout it writes, in the same transaction.
  const scope={actor:await serviceActor(env.DB,'deployment-deadline'),action:'deployment.timeout' as const,subject:await auditSubject(env.DB,'run',JSON.stringify([row.project,row.id]),row.project),projectLabel:await projectAuditLabel(env.DB,row.project)};
  await auditedBatch(env.DB,[
   s(env.DB,"INSERT INTO deployment_steps SELECT project,id,'timeout',(SELECT MAX(sequence)+1 FROM deployment_steps WHERE project=r.project AND deployment=r.id),'timed_out',(SELECT exposure FROM deployment_steps WHERE project=r.project AND deployment=r.id ORDER BY sequence DESC LIMIT 1),NULL,?,?,'service-deployment-deadline','timeout' FROM deployment_runs r WHERE project=? AND id=? AND historical=0 AND (SELECT state FROM deployment_steps WHERE project=r.project AND deployment=r.id ORDER BY sequence DESC LIMIT 1) IN ('started','progress')",time,time,row.project,row.id),
   auditCommit(env.DB,'changes()=1'),
   s(env.DB,"INSERT INTO deployment_notices SELECT project,id,'pending',?,? FROM deployment_runs r WHERE project=? AND id=? AND historical=0 AND EXISTS(SELECT 1 FROM deployment_steps WHERE project=r.project AND deployment=r.id AND state='timed_out') ON CONFLICT DO NOTHING",time,time,row.project,row.id),
  ],scope);
  const claim=await s(env.DB,"UPDATE deployment_notices SET state='uncertain',updated=? WHERE project=? AND deployment=? AND state='pending' RETURNING deployment",time,row.project,row.id).all();
  if(!claim.results.length)continue;
  let state='blocked';
  try{const destination=await findDestination(env,row.project,row.destination,'mail'),mail=sender(env);state='uncertain';const result=await mail.send({deliveryId:'deployment-'+await hash(canonical([row.project,row.id])),from:env.MAIL_FROM!,to:[destination.recipient!],subject:'Spool deployment deadline overdue',text:`Deployment ${row.id} in ${row.environment} passed its caller-supplied deadline without a final callback. Release: ${row.release}. Deadline: ${new Date(row.deadline).toISOString()}. No deployment failure has been inferred. Inspect the deployment history and record the outcome.`});state=result.status==='development'?'suppressed_locally':result.status;}catch{/* A send that started has unknown receipt; never send it twice. */}
  await s(env.DB,'UPDATE deployment_notices SET state=?,updated=? WHERE project=? AND deployment=?',state,time,row.project,row.id).run();
 }
}
