import { assignmentStatements } from '../notifications/assignment';
import { Hono } from 'hono';
import { scrub } from '../privacy';
import { policyInput } from './validation';
import { authorize, body, s, guard, audit, write, conflict } from './common';
// Used directly inside the admission batch: enabled policies cannot race a stale JavaScript decision.
export const policyMatch=`p.project=? AND p.enabled=1 AND CASE p.mode WHEN 'exact' THEN (CASE p.field WHEN 'fingerprint' THEN ? WHEN 'release' THEN ? ELSE ? END)=p.value ELSE instr(CASE p.field WHEN 'fingerprint' THEN ? WHEN 'release' THEN ? ELSE ? END,p.value)>0 END`;
export const matchArgs=(project:string,fingerprint:string,release:string,message:string)=>[project,fingerprint,release,message,fingerprint,release,message];
const routes=new Hono<any>();
routes.get('/:project/operator-state',async c=>{
 const auth=await authorize(c);if('response' in auth)return auth.response;const db=c.env.DB,p=c.req.param('project');
 const [policies,assignments,audits]=await Promise.all([s(db,'SELECT * FROM suppression_policies WHERE project=? ORDER BY created,id',p).all(),s(db,'SELECT * FROM issue_assignments WHERE project=?',p).all(),s(db,"SELECT * FROM audit WHERE project=? AND kind IN ('issue_assigned','suppression_changed','grouping_applied','grouping_undone','deployment_registered') ORDER BY created DESC,id LIMIT 100",p).all()]);
 const assignmentMembers=(await s(db,`SELECT m.id,m.name FROM spool_members m JOIN oa_operators o ON o.id=m.operator_id AND o.status='active' JOIN spool_project_teams t ON t.organization=m.organization AND t.project=?
  WHERE m.state='active' AND (o.role='owner' OR m.role='admin' OR m.role='member' AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=t.project AND g.role<>'read-only')) ORDER BY m.name,m.id`,p).all()).results;
 const assignmentTeam=(await s(db,'SELECT team FROM spool_project_teams WHERE project=?',p).first<any>())?.team??null;
 const nativeAssignments=(await s(db,`SELECT f.issue,CASE f.reason WHEN 'assignment' THEN 'member:'||m.id ELSE 'team:'||t.team END target FROM spool_issue_follows f
  JOIN spool_members m ON m.operator_id=f.operator_id AND m.state='active' JOIN spool_project_teams t ON t.project=f.project AND t.organization=m.organization
  WHERE f.project=? AND f.historical=0 AND f.reason IN('assignment','team') GROUP BY f.issue,target`,p).all()).results;
 return c.json({assignmentMembers,assignmentTeam,nativeAssignments,policies:policies.results,assignments:assignments.results,audit:audits.results,assignmentSemantics:'A label alone grants no authority. Explicit native member or team targets add subscription reasons for current project members.'});
});
routes.patch('/:project/issues/:issue/assignment',async c=>{
 const auth=await authorize(c);if('response' in auth)return auth.response;const db=c.env.DB,p=c.req.param('project'),issue=c.req.param('issue'),b=await body(c);
 if(!Number.isSafeInteger(b.revision)||b.label!==null&&(typeof b.label!=='string'||!b.label.trim()||b.label.length>80||scrub(b.label)!==b.label))throw new Error('Use a scrubbed operator label up to 80 characters, or null to unassign');
 const native=await assignmentStatements(db,p,issue,b);
 try{await write(c,auth.session,[...native,guard(db,'EXISTS(SELECT 1 FROM issues WHERE project=? AND id=? AND revision=?)',p,issue,b.revision),s(db,'UPDATE issues SET revision=revision+1 WHERE project=? AND id=?',p,issue),s(db,'INSERT INTO issue_assignments VALUES(?,?,?,?) ON CONFLICT(issue) DO UPDATE SET label=excluded.label,updated=excluded.updated',p,issue,b.label,Date.now()),audit(db,p,'issue_assigned',{issue,label:b.label,revision:b.revision+1})]);return c.json({issue,label:b.label,revision:b.revision+1})}catch(e){return conflict(c,e)}
});
routes.post('/:project/suppression-policies',async c=>{
 const auth=await authorize(c);if('response' in auth)return auth.response;const db=c.env.DB,p=c.req.param('project'),b=policyInput(await body(c)),id=crypto.randomUUID(),time=Date.now();
 try{await write(c,auth.session,[s(db,'INSERT INTO suppression_policies VALUES(?,?,1,?,?,?,?,?,?)',id,p,b.field,b.mode,b.value,b.enabled?1:0,time,time),audit(db,p,'suppression_changed',{policy:id,revision:1,field:b.field,mode:b.mode,value:b.value,enabled:b.enabled?1:0})]);return c.json({id,revision:1,...b},201)}catch(e){return conflict(c,e)}
});
routes.patch('/:project/suppression-policies/:id',async c=>{
 const auth=await authorize(c);if('response' in auth)return auth.response;const db=c.env.DB,p=c.req.param('project'),id=c.req.param('id'),raw=await body(c),b=policyInput(raw);if(!Number.isSafeInteger(raw.revision))throw new Error('Revision required');
 try{await write(c,auth.session,[guard(db,'EXISTS(SELECT 1 FROM suppression_policies WHERE project=? AND id=? AND revision=?)',p,id,raw.revision),s(db,'UPDATE suppression_policies SET revision=revision+1,field=?,mode=?,value=?,enabled=?,updated=? WHERE project=? AND id=?',b.field,b.mode,b.value,b.enabled?1:0,Date.now(),p,id),audit(db,p,'suppression_changed',{policy:id,revision:raw.revision+1,field:b.field,mode:b.mode,value:b.value,enabled:b.enabled?1:0})]);return c.json({id,revision:raw.revision+1,...b})}catch(e){return conflict(c,e)}
});
export default routes;
