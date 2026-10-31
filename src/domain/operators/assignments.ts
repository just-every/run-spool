import { AuthError } from '../../modules/operator-auth/index.mjs';
import { currentAuditScope } from '../audit/context';
import { randomAuditLabel } from '../audit/identity';
import { scrub } from '../privacy';
import { s, guard, audit, write, conflict } from './common';

// A native assignee must still be able to triage this project when the batch commits.
export const assignmentMembersSql = `SELECT m.id,m.version,m.name FROM spool_members m
 JOIN oa_operators o ON o.id=m.operator_id AND o.status='active'
 JOIN spool_project_teams t ON t.organization=m.organization AND t.project=?
 WHERE m.state='active' AND (o.role='owner' OR m.role='admin' OR
 (m.role='member' AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=t.project AND g.role IN ('maintainer','member'))))`;
export async function assignmentMembers(db:D1Database, project:string) {
 return (await s(db,assignmentMembersSql+' ORDER BY m.name,m.id',project).all<any>()).results.map(row=>({id:row.id,name:scrub(row.name)}));
}
export function assignmentTarget(row:any, members:any[]) {
 if (!row) return null;
 if(row.kind==='member') {
  const member=!row.historical&&members.find(member=>member.id===row.member);
  return {kind:'member',alias:row.target_label,member:member?.id??null,name:member?.name??(row.historical?'Historical member':'Former project member'),active:!!member};
 }
 return {kind:row.kind,label:row.target_label};
}
export async function readAssignment(db:D1Database,project:string,issue:string,before?:string) {
 const found=await s(db,'SELECT revision FROM issues WHERE project=? AND id=?',project,issue).first<any>();
 if(!found)throw new AuthError('Issue not found',404);
 if(before!==undefined&&(!/^[1-9][0-9]*$/.test(before)||!Number.isSafeInteger(Number(before))))throw new AuthError('Invalid assignment cursor',400);
 const members=await assignmentMembers(db,project);
 const [latest,legacy,history]=await Promise.all([
  s(db,'SELECT * FROM issue_assignment_history WHERE project=? AND issue=? ORDER BY revision DESC LIMIT 1',project,issue).first<any>(),
  s(db,'SELECT * FROM issue_assignments WHERE project=? AND issue=?',project,issue).first<any>(),
  s(db,`SELECT * FROM issue_assignment_history WHERE project=? AND issue=?${before?' AND revision<?':''} ORDER BY revision DESC LIMIT 51`,project,issue,...before?[Number(before)]:[]).all<any>(),
 ]);
 return {issue,revision:found.revision,members,current:latest?assignmentTarget(latest,members):{kind:legacy?.label?'label':'unassigned',label:legacy?.label??null},
  history:history.results.slice(0,50).map(row=>({id:row.id,revision:row.revision,target:assignmentTarget(row,members),actor:{kind:row.actor_kind,label:row.actor_label},created:row.created})),
  next:history.results.length>50?String(history.results[49].revision):null};
}
export async function assignIssue(c:any,session:any,project:string,issue:string,input:any) {
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['revision','member','label'].includes(key))||!Number.isSafeInteger(input.revision)||input.revision<1||input.revision>=Number.MAX_SAFE_INTEGER)throw new AuthError('Invalid assignment request',400);
 const native=Object.hasOwn(input,'member');
 if(native&&(Object.hasOwn(input,'label')||typeof input.member!=='string'||!input.member))throw new AuthError('Choose one member or an operator label',400);
 if(!native&&input.label!==null&&(typeof input.label!=='string'||!input.label.trim()||input.label.length>80||scrub(input.label)!==input.label))throw new AuthError('Use a scrubbed operator label up to 80 characters, or null to unassign',400);
 const db=c.env.DB;
 const member=native?await s(db,assignmentMembersSql+' AND m.id=?',project,input.member).first<any>():null;
 if(native&&!member)throw new AuthError('Assignable member not found',404);
 const time=Date.now(),kind=native?'member':input.label===null?'unassigned':'label';
 // Stable within this member's assignment history, never derived from a personal identifier.
 const previous=member?await s(db,'SELECT target_label FROM issue_assignment_history WHERE project=? AND member=? AND historical=0 ORDER BY revision DESC LIMIT 1',project,member.id).first<any>():null;
 const label=native?previous?.target_label??randomAuditLabel():input.label,actor=currentAuditScope().actor;
 try {
  await write(c,session,[guard(db,'EXISTS(SELECT 1 FROM issues WHERE project=? AND id=? AND revision=?)',project,issue,input.revision),
   ...member?[guard(db,`EXISTS(${assignmentMembersSql} AND m.id=? AND m.version=?)`,project,member.id,member.version)]:[],
   s(db,'UPDATE issues SET revision=revision+1 WHERE project=? AND id=?',project,issue),
   s(db,'INSERT INTO issue_assignments(project,issue,label,updated) VALUES(?,?,?,?) ON CONFLICT(issue) DO UPDATE SET label=excluded.label,updated=excluded.updated',project,issue,label,time),
   s(db,'INSERT INTO issue_assignment_history(id,project,issue,revision,kind,member,target_label,actor_kind,actor_label,created,historical) VALUES(?,?,?,?,?,?,?,?,?,?,0)',crypto.randomUUID(),project,issue,input.revision+1,kind,member?.id??null,label,actor.kind,actor.label,time),
   audit(db,project,'issue_assigned',{issue,label,revision:input.revision+1}),
  ]);
  return c.json({issue,label,kind,revision:input.revision+1});
 } catch(error) {return conflict(c,error)}
}
