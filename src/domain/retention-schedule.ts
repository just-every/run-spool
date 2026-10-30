import {guard} from '../modules/portability/storage.mjs';
import {applyRetention} from './retention';
import {readRetentionPolicy,retentionCutoffs,type RetentionWindows} from './retention-policy';
import {serviceActor,auditSubject,projectAuditLabel,runAuditScope,auditedBatch} from './audit';
export const retentionBatchLimit=50;
export async function retentionRemaining(db:D1Database,project:string,c:RetentionWindows){
 const queries=[['suspect_commit_files','received<?',[c.commits]],['events','received<?',[c.events]],['feedback','received<?',[c.feedback]],['health_sessions','updated<?',[c.sessions]],['exposures','last<?',[c.exposures]],['commits','received<? AND expired IS NULL AND COALESCE(message,author_name,author_email) IS NOT NULL',[c.commits]]] as const;
 const counts=await Promise.all(queries.map(async([table,where,values])=>(await db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE project=? AND ${where}`).bind(project,...values).first<any>())!.n));return counts.reduce((a,b)=>a+b,0);
}
// A minute cron visits at most five due projects. Each visit removes at most
// fifty rows per type plus linked feedback (project cap 1,000); pending work resumes next cron.
export async function scheduledRetention(db:D1Database,time:number){
 const day=Math.floor(time/86400000);
 const projects=(await db.prepare(`SELECT p.id FROM projects p LEFT JOIN retention_policies policy ON policy.project=p.id LEFT JOIN retention_runs r ON r.project=p.id
 WHERE COALESCE(policy.held,0)=0 AND (r.last_day IS NULL OR r.last_day<>?) AND COALESCE(r.lease_until,0)<=?
 AND EXISTS(SELECT 1 FROM oa_operators WHERE role='owner' AND status='active')
 AND NOT EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase<>'complete')
 ORDER BY COALESCE(r.last_run,0),p.id LIMIT 5`).bind(day,time).all<{id:string}>()).results;
 for(const {id:project} of projects){
  const token=crypto.randomUUID();
  await db.prepare(`INSERT INTO retention_runs(project,generation,last_run,lease_until,status) SELECT ?,?,?,?,'running' WHERE EXISTS(SELECT 1 FROM projects WHERE id=?) AND NOT EXISTS(SELECT 1 FROM retention_policies WHERE project=? AND held=1)
   ON CONFLICT(project) DO UPDATE SET generation=excluded.generation,last_run=excluded.last_run,lease_until=excluded.lease_until,status='running' WHERE retention_runs.lease_until<=? AND (retention_runs.last_day IS NULL OR retention_runs.last_day<>?)`).bind(project,token,time,time+60000,project,project,time,day).run();
  if(!await db.prepare('SELECT 1 FROM retention_runs WHERE project=? AND generation=?').bind(project,token).first())continue;
  try{
   const policy=await readRetentionPolicy(db,project);if(policy.held)throw new Error('retention_held');const cutoffs=retentionCutoffs(policy.windows,time);
   if(await retentionRemaining(db,project,cutoffs)){
    const scope={actor:await serviceActor(db,'scheduled retention'),action:'retention.scheduled' as const,subject:await auditSubject(db,'project',project,project),projectLabel:await projectAuditLabel(db,project)};
    const scoped=new Proxy(db,{get(target,key){if(key==='batch')return async(statements:D1PreparedStatement[])=>{const fence=guard(target,"EXISTS(SELECT 1 FROM projects WHERE id=?) AND EXISTS(SELECT 1 FROM oa_operators WHERE role='owner' AND status='active') AND NOT EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase<>'complete') AND EXISTS(SELECT 1 FROM retention_runs WHERE project=? AND generation=?)",project,project,token);return (await auditedBatch(target,[fence,...statements],scope)).slice(1)};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}});
    await runAuditScope(scope,()=>applyRetention(scoped,project,cutoffs.events,cutoffs,retentionBatchLimit));
   }
   const remaining=await retentionRemaining(db,project,cutoffs);
   await db.prepare("UPDATE retention_runs SET last_day=?,last_run=?,lease_until=0,status=?,remaining=? WHERE project=? AND generation=?").bind(remaining?null:day,time,remaining?'pending':'complete',remaining,project,token).run();
  }catch{
   await db.prepare("UPDATE retention_runs SET last_run=?,lease_until=0,status='failed',last_day=NULL WHERE project=? AND generation=?").bind(time,project,token).run();
   console.error('Scheduled retention did not complete; the project remains pending');
  }
 }
}
