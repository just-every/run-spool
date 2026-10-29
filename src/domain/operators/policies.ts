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
 return c.json({policies:policies.results,assignments:assignments.results,audit:await Promise.all(audits.results.map(async(row:any)=>{const operation=await s(db,'SELECT kind,actor,approvers FROM spool_native_audit_actors WHERE audit_id=?',row.id).first<any>();return {...row,preparedBy:operation?.kind==='agent'?JSON.parse(operation.actor):null,personActor:operation?.kind==='person'?JSON.parse(operation.actor):null,approvers:operation?JSON.parse(operation.approvers):[]};})),assignmentSemantics:'A bounded operator label, not an account, invitation, permission or notification.'});
});
routes.patch('/:project/issues/:issue/assignment',async c=>{
 const auth=await authorize(c);if('response' in auth)return auth.response;const db=c.env.DB,p=c.req.param('project'),issue=c.req.param('issue'),b=await body(c);
 if(!Number.isSafeInteger(b.revision)||b.label!==null&&(typeof b.label!=='string'||!b.label.trim()||b.label.length>80||scrub(b.label)!==b.label))throw new Error('Use a scrubbed operator label up to 80 characters, or null to unassign');
 try{await write(c,auth.session,[guard(db,'EXISTS(SELECT 1 FROM issues WHERE project=? AND id=? AND revision=?)',p,issue,b.revision),s(db,'UPDATE issues SET revision=revision+1 WHERE project=? AND id=?',p,issue),s(db,'INSERT INTO issue_assignments VALUES(?,?,?,?) ON CONFLICT(issue) DO UPDATE SET label=excluded.label,updated=excluded.updated',p,issue,b.label,Date.now()),audit(db,p,'issue_assigned',{issue,label:b.label,revision:b.revision+1})]);return c.json({issue,label:b.label,revision:b.revision+1})}catch(e){return conflict(c,e)}
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
