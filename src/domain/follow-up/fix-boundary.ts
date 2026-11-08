import { GrantRefused, type ProviderSession } from '../fixes/provider';
import { s } from './types';

/** The send boundary is durable before ProviderSession can reach the network.
 * Receipts remain its existing public evidence; this store holds custody when
 * the Worker dies before the receipt or workflow update commits. */
export async function protectFixSession(db:D1Database,row:any,session:ProviderSession,admit?:()=>Promise<void>) {
 const unresolved=await s(db,"SELECT 1 FROM follow_up_fix_steps WHERE workflow=? AND state IN ('running','uncertain') LIMIT 1",row.id).first();
 const attention=await s(db,"SELECT 1 FROM follow_up_attention WHERE project=? AND source='fix' AND source_id=? AND state='uncertain'",row.project,row.id).first();
 if(unresolved||attention)throw new GrantRefused('A previous provider step is uncertain. Inspect Needs attention and reconcile it or explicitly authorize a resend before advancing.');
 await s(db,"UPDATE follow_up_fix_steps SET state='authorized' WHERE workflow=? AND state='rejected'",row.id).run();
 const call=session.call.bind(session);
 session.call=async(step,method,path,body)=>{
  await admit?.();
  const id=crypto.randomUUID(),time=Date.now();
  await s(db,`INSERT INTO follow_up_fix_steps(id,workflow,project,step,method,state,started,due,target) VALUES(?,?,?,?,?,'running',?,?,?)`,id,row.id,row.project,step,method,time,time+300000,path).run();
  try {
   const result=await call(step,method,path,body);
   await s(db,"UPDATE follow_up_fix_steps SET state='completed',finished=? WHERE id=? AND state='running'",Date.now(),id).run();
   return result;
  }catch(error){
   const receipt=await s(db,'SELECT outcome,status FROM fix_receipts WHERE workflow=? AND step=? AND at>=? ORDER BY at DESC LIMIT 1',row.id,step,time).first<any>();
   const read=['GET','HEAD','OPTIONS'].includes(method);
   const rejected=error instanceof GrantRefused||read||receipt?.outcome==='refused'||(receipt?.status>=400&&receipt.status<500&&receipt.status!==408);
   await s(db,"UPDATE follow_up_fix_steps SET state=?,finished=? WHERE id=? AND state='running'",rejected?'rejected':'uncertain',Date.now(),id).run();
   throw error;
  }
 };
}
