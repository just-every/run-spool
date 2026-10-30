import { AuthError } from '../../modules/operator-auth/index.mjs';
import { auditActor } from '../audit/identity';
import { activity } from '../discussion/model';
import { guard,s } from '../operators/common';

/** Labels remain inert. Native targets are explicit and resolved inside the
 * same project; membership snapshots are fenced in the assignment batch. */
export async function assignmentStatements(db:D1Database,project:string,issue:string,input:any) {
 if(input.member!==undefined&&input.team!==undefined||input.member!==undefined&&typeof input.member!=='string'||input.team!==undefined&&typeof input.team!=='string'||input.label===null&&(input.member!==undefined||input.team!==undefined))throw new AuthError('invalid_assignment_target',400);
 const native=input.member!==undefined||input.team!==undefined;
 const targets=native?(await s(db,`SELECT m.id,m.operator_id,m.version,o.role FROM spool_members m JOIN oa_operators o ON o.id=m.operator_id AND o.status='active'
 JOIN spool_project_teams t ON t.organization=m.organization AND t.project=? WHERE m.state='active'
 AND (o.role='owner' OR m.role='admin' OR m.role='member' AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=t.project AND g.role<>'read-only'))
 AND ${input.member!==undefined?'m.id=?':'t.team=?'} ORDER BY m.id`,project,input.member??input.team).all<any>()).results:[];
 if(native&&!targets.length)throw new AuthError('Assignment target not found',404);
 const time=Date.now(),jobs=[s(db,"DELETE FROM spool_issue_follows WHERE project=? AND issue=? AND reason IN('assignment','team') AND historical=0",project,issue)];
 for(const target of targets){
  const alias=await auditActor(db,{kind:target.role==='owner'?'owner':'member',authority:target.operator_id});
  jobs.push(guard(db,"EXISTS(SELECT 1 FROM spool_members m JOIN oa_operators o ON o.id=m.operator_id WHERE m.id=? AND m.version=? AND m.state='active' AND o.status='active')",target.id,target.version),
   s(db,'INSERT INTO spool_issue_follows(project,issue,operator_id,actor_label,reason,updated) VALUES(?,?,?,?,?,?)',project,issue,target.operator_id,alias.label,input.member!==undefined?'assignment':'team',time));
 }
 if(native)jobs.push(activity(db,project,issue,'assignment',{recipients:targets.length},time));
 return jobs;
}
