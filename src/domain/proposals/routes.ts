import { Hono } from 'hono';
import { ownerSession, ownerWrite } from '../../auth/session.server';
import { agentProject } from '../agent-access';
import { mintAdmission } from '../dev-credentials';
import { mintedByCurrentPerson } from '../credential-fence';
import { canonical, hash } from '../privacy';
import { jsonBody } from '../owner-router';
import { ownerBatch } from '../owner-authority';
import { auditedBatch, auditCommit, attributeAuditScope } from '../audit/context';
import { guard, s } from '../operators/common';
import { auditActor } from '../audit/identity';
import { normalizeProposal } from './input';
import { explainProposal, issueRevisions, proposalPreview } from './explanation';
import { proposalStale, revisionGuards } from './lifecycle';
const routes=new Hono<any>();
const parsed=(row:any)=>({...row,input:JSON.parse(row.input),revisions:JSON.parse(row.revisions),explanation:JSON.parse(row.explanation),label:`proposed by agent ${row.actor}`});
const summary=(row:any)=>{const r=parsed(row);return {id:r.id,kind:r.kind,state:r.state,actor:r.actor,label:r.label,input:r.input,revisions:r.revisions,created:r.created,updated:r.updated}};
routes.use('*',async(c,next)=>{
 const project=c.req.param('project')!,session=await ownerSession(c.req.raw,c.env),agent=await agentProject(c.req.raw,c.env.DB);
 if(!session&&agent!==project)return c.json({error:'Owner session or own-project agent grant required'},401);
 if(session&&!['GET','HEAD'].includes(c.req.method)&&!ownerWrite(c.req.raw,c.env))return c.json({error:'Same-origin required'},403);
 if(!await s(c.env.DB,'SELECT 1 FROM projects WHERE id=?',project).first())return c.json({error:'Project not found'},404);
 c.set('proposalOwner',session);c.set('proposalAgent',agent===project);await next();
});
routes.get('/',async c=>{
 const db=c.env.DB,project=c.req.param('project')!,rows=(await s(db,'SELECT * FROM grouping_proposals WHERE project=? ORDER BY created DESC,id',project).all<any>()).results;
 return c.json(await Promise.all(rows.map(async row=>{
  if(['proposed','approved'].includes(row.state)&&await proposalStale(db,row))row={...row,state:'stale'};
  return c.get('proposalOwner')?parsed(row):summary(row);
 })));
});
routes.post('/',async c=>{
 if(!c.get('proposalAgent'))return c.json({error:'An agent grant submits inert proposals; owner decisions use approve or reject'},403);
 const db=c.env.DB,project=c.req.param('project')!,input=normalizeProposal(await jsonBody(c.req.raw,32768)),id=crypto.randomUUID(),time=Date.now();
 let preview,revisions;
 try{preview=await proposalPreview(db,project,input,id);revisions=await issueRevisions(db,project,input,preview)}catch(e){if(/revision conflict/i.test(String(e)))return c.json({error:'Stale issue or rule revision'},409);throw e}
 const explanation=canonical(await explainProposal(db,{project,input},preview));
 if(new TextEncoder().encode(explanation).length>2097152)return c.json({error:'Exact proposal explanation exceeds 2 MiB; narrow the proposal'},400);
 const bearer=c.req.header('authorization')!.replace(/^Bearer /i,''),digest=await hash(bearer);
 const source=await s(db,"SELECT minted_by FROM credentials WHERE hash=? AND kind='agent'",digest).first<any>();
 const actor=await auditActor(db,{kind:'service',authority:digest,owner:source.minted_by,project});attributeAuditScope(actor);
 const row={id,project,kind:input.kind,state:'proposed',actor:actor.label,input:canonical(input),explanation,revisions:canonical(revisions),correction:null,rule_revision:null,created:time,updated:time};
 try{await auditedBatch(db,[
  guard(db,`EXISTS(SELECT 1 FROM credentials WHERE hash=? AND project=? AND kind='agent' AND revoked IS NULL AND ${mintedByCurrentPerson} AND ${await mintAdmission(c.req.raw)})`,digest,project),
  ...revisionGuards(db,project,revisions),
  ...(input.kind==='rule'?[guard(db,'COALESCE((SELECT revision FROM grouping_policies WHERE project=?),0)=?',project,input.policyRevision)]:[]),
  s(db,'INSERT INTO grouping_proposals VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',id,project,input.kind,'proposed',row.actor,row.input,row.explanation,row.revisions,null,null,time,time),auditCommit(db),s(db,'DELETE FROM operator_guards')
 ]);}catch(e){if(/grouping_proposal_budget/.test(String(e)))return c.json({error:'Project holds at most 50 grouping proposals'},409);if(/operator_guards/.test(String(e)))return c.json({error:'Authority or issue revision conflict'},409);throw e}
 return c.json(summary(row),201);
});
routes.get('/:id',async c=>{
 if(!c.get('proposalOwner'))return c.json({error:'Owner-only proposal explanation'},403);
 const db=c.env.DB,row=await s(db,'SELECT * FROM grouping_proposals WHERE project=? AND id=?',c.req.param('project')!,c.req.param('id')).first<any>();
 if(!row)return c.json({error:'Proposal not found'},404);
 if(['proposed','approved'].includes(row.state)&&await proposalStale(db,row))return c.json({...parsed(row),state:'stale'});
 if(!['proposed','approved'].includes(row.state))return c.json(parsed(row));
 const preview=await proposalPreview(db,row.project,JSON.parse(row.input),row.id);
 return c.json({...parsed(row),explanation:await explainProposal(db,row,preview),...(row.state==='approved'?{preview}:{})});
});
routes.post('/:id/:action',async c=>{
 const session=c.get('proposalOwner');if(!session)return c.json({error:'Only the owner may approve or reject'},403);
 const action=c.req.param('action');if(!['approve','reject'].includes(action))return c.notFound();
 const db=c.env.DB,project=c.req.param('project')!,row=await s(db,'SELECT * FROM grouping_proposals WHERE project=? AND id=?',project,c.req.param('id')).first<any>();
 if(!row)return c.json({error:'Proposal not found'},404);
 if(row.state!=='proposed')return c.json({error:'Proposal state conflict'},409);
 if(await proposalStale(db,row)){
  await ownerBatch(db,session,[s(db,"UPDATE grouping_proposals SET state='stale',updated=? WHERE project=? AND id=?",Date.now(),project,row.id),auditCommit(db)]);
  return c.json({error:'Stale issue or rule revision; request a new proposal'},409);
 }
 const input=JSON.parse(row.input),preview=await proposalPreview(db,project,input,row.id),state=action==='approve'?'approved':'rejected',time=Date.now();
 const explanation=canonical(await explainProposal(db,row,preview));
 if(new TextEncoder().encode(explanation).length>2097152)return c.json({error:'Exact proposal explanation exceeds 2 MiB'},400);
 const jobs=[guard(db,'EXISTS(SELECT 1 FROM grouping_proposals WHERE project=? AND id=? AND state=?)',project,row.id,row.state),...revisionGuards(db,project,JSON.parse(row.revisions)),...(input.kind==='rule'?[guard(db,'COALESCE((SELECT revision FROM grouping_policies WHERE project=?),0)=?',project,input.policyRevision)]:[])];
 if(action==='approve'&&row.kind!=='rule')jobs.push(s(db,"UPDATE grouping_proposals SET state='stale',correction=NULL,updated=? WHERE project=? AND correction IN (SELECT id FROM grouping_corrections WHERE project=? AND state='preview')",time,project,project),s(db,"DELETE FROM grouping_corrections WHERE project=? AND state='preview'",project),s(db,"INSERT INTO grouping_corrections VALUES(?,?,?,'preview',?,?,?)",preview.id,project,row.kind,JSON.stringify(preview.plan),time,time));
 jobs.push(s(db,'UPDATE grouping_proposals SET state=?,correction=?,explanation=?,updated=? WHERE project=? AND id=?',state,action==='approve'&&row.kind!=='rule'?preview.id:null,explanation,time,project,row.id),auditCommit(db),s(db,'DELETE FROM operator_guards'));
 try{await ownerBatch(db,session,jobs)}catch(e){if(/operator_guards/.test(String(e)))return c.json({error:'Issue or proposal revision conflict'},409);throw e}
 return c.json({...parsed({...row,state,correction:action==='approve'&&row.kind!=='rule'?preview.id:null,updated:time}),explanation:await explainProposal(db,row,preview),...(action==='approve'?{preview}:{})});
});
export default routes;
