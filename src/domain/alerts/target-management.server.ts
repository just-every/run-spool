import type { NativeAuthority } from '../agent-door/native-authority';
import { ownerBatch } from '../owner-authority';
import { auditCommit } from '../audit/context';
import { targetInput,findTarget,recipientChoices } from './targets';
import { statement as s,type AlertEnvironment } from './types';
export async function saveTarget(env:AlertEnvironment,session:NativeAuthority,project:string,previous:string|undefined,input:any){
 const b=targetInput(input),choices=await recipientChoices(env,project);
 if(b.type==='member'&&!choices.members.some((m:any)=>m.member===b.id)||b.type==='team'&&!choices.teams.some((t:any)=>t.team===b.id))throw new Error('Target has no authorized access to this project');
 const current=previous?await findTarget(env,project,previous):null;
 if(previous&&!current)throw new Error('Destination changed; refresh and try again');
 if(current&&current.targetType===b.type&&current.target===b.id&&current.fallthrough===b.fallthrough){
  await ownerBatch(env.DB,session,[s(env.DB,'UPDATE alert_target_destinations SET label=? WHERE project=? AND id=?',b.label,project,previous!),auditCommit(env.DB,'changes()>0')]);return {id:previous};
 }
 const id='target-'+crypto.randomUUID(),time=Date.now();
 await ownerBatch(env.DB,session,[
  ...(previous?[s(env.DB,'DELETE FROM alert_target_destinations WHERE project=? AND id=?',project,previous)]:[]),
  s(env.DB,'INSERT INTO alert_target_destinations VALUES(?,?,?,?,?,?,?)',id,project,b.label,b.type,b.id,b.fallthrough,time),
  ...(previous?[
   s(env.DB,`UPDATE alert_intents SET state='cancelled',code='rule_revised' WHERE project=? AND destination=? AND expanded=0 AND code IS NOT 'retention_removed'`,project,previous),
   s(env.DB,`UPDATE alert_mail_jobs SET state='blocked',code='rule_revised' WHERE state='queued' AND id IN(SELECT id FROM alert_intents WHERE project=? AND destination=?)`,project,previous),
   s(env.DB,'UPDATE alert_rules SET destination=?,enabled=0,revision=revision+1,updated=? WHERE project=? AND destination=?',id,time,project,previous),
  ]:[]),auditCommit(env.DB,'EXISTS(SELECT 1 FROM alert_target_destinations WHERE id=?)',id),
 ]);return {id};
}
