import { Hono } from 'hono';
import type { Bindings } from '../../auth/bindings';
import { ownerSession } from '../../auth/session.server';
import { authorizeDeploy,deployBatch } from '../sentry/deploy';
import { canonical,hash } from '../privacy';
import { releaseIdentity } from '../releases/identity';
import { jsonBody } from '../owner-router';
import { findDestination } from '../alerts/destinations.server';
import { sender } from '../alerts/mail';
import { startInput,stepInput } from './input';
import { auditCommit } from '../audit/context';
import { commitsInput } from '../commits/input';
import { commitStatements, citationSummary } from '../commits/register';
import { readReleasePolicy } from '../releases/policy';
import { ensureShortIds } from '../short-ids/assign';
const routes=new Hono<{Bindings:Bindings}>();
const s=(db:D1Database,sql:string,...args:any[])=>db.prepare(sql).bind(...args);
routes.get('/:project/deployments',async c=>{
 if(!await ownerSession(c.req.raw,c.env))return c.json({error:'Owner session required'},401);
 const rows=(await s(c.env.DB,'SELECT * FROM deployment_runs WHERE project=? ORDER BY created DESC,id',c.req.param('project')).all<any>()).results;
 for(const row of rows){row.includedCommits=JSON.parse(row.included_commits);row.steps=(await s(c.env.DB,'SELECT * FROM deployment_steps WHERE project=? AND deployment=? ORDER BY sequence',row.project,row.id).all()).results;row.notice=await s(c.env.DB,'SELECT state,created,updated FROM deployment_notices WHERE project=? AND deployment=?',row.project,row.id).first();delete row.destination;}
 return c.json({rows,provenance:'Commit range, timing and exposure are owner or CI recorded; repository ancestry and provider success are not independently confirmed.'});
});
routes.post('/:project/deployments',async c=>{
 const project=c.req.param('project'),auth=await authorizeDeploy(c,project);if('response' in auth)return auth.response;
 const b=await jsonBody(c.req.raw,524288),input=startInput(b),release=releaseIdentity(b.release),db=c.env.DB,commits=commitsInput(b.includedCommits);
 const old=await s(db,'SELECT * FROM deployment_runs WHERE project=? AND id=?',project,input.id).first<any>();
 const values={release,build:input.build,environment:input.environment,repository:input.repository,commit_sha:input.commit_sha,previous_commit:input.previous_commit,included_commits:input.included_commits,started_at:input.deployed_at,deadline:input.deadline,destination:input.destination};
 if(old){await deployBatch(c,auth,[]);return Object.entries(values).every(([key,value])=>old[key]===value)?c.json({id:input.id},200):c.json({error:'Deployment identity conflicts'},409)}
 await findDestination(c.env,project,input.destination,'mail');sender(c.env);
 if(commits.length){await readReleasePolicy(db,project);await ensureShortIds(db,project)}
 const time=Date.now(),digest=await hash(canonical(values));
 await deployBatch(c,auth,[
  s(db,'INSERT INTO spool_authority_guards SELECT CASE WHEN EXISTS(SELECT 1 FROM releases WHERE project=? AND name=? AND (build=? OR EXISTS(SELECT 1 FROM release_builds WHERE project=? AND release=? AND build=? AND registered=1))) THEN 1 ELSE 0 END',project,release,input.build,project,release,input.build),
  s(db,'INSERT INTO deployment_runs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)',project,input.id,release,input.build,input.environment,input.repository,input.commit_sha,input.previous_commit,input.included_commits,input.deployed_at,input.deadline,input.destination,auth.actor,time),
  s(db,"INSERT INTO deployment_steps VALUES(?,?, 'start',1,'started',0,NULL,?,?,?,?)",project,input.id,input.deployed_at,time,auth.actor,digest),
  s(db,'UPDATE release_metadata SET auto_created=0 WHERE project=? AND release=?',project,release),
  auditCommit(db),
  ...commitStatements(db,project,release,'deployment',commits,time),
 ]);
 return c.json({id:input.id,...commits.length?{citations:await citationSummary(db,project,commits)}:{}},201);
});
routes.post('/:project/deployments/:deployment/callbacks',async c=>{
 const project=c.req.param('project'),id=c.req.param('deployment'),auth=await authorizeDeploy(c,project);if('response' in auth)return auth.response;
 const input=stepInput(await jsonBody(c.req.raw,3000)),db=c.env.DB,digest=await hash(canonical(input));
 const run=await s(db,'SELECT * FROM deployment_runs WHERE project=? AND id=?',project,id).first<any>();
 if(!run)return c.json({error:'Deployment not found'},404);
 if(run.historical)return c.json({error:'Restored deployment history is inert'},409);
 const old=await s(db,'SELECT digest FROM deployment_steps WHERE project=? AND deployment=? AND callback=?',project,id,input.callback).first<any>();
 if(old){await deployBatch(c,auth,[]);return old.digest===digest?c.json({id,duplicate:true}):c.json({error:'Callback identity conflicts'},409)}
 const last=await s(db,'SELECT * FROM deployment_steps WHERE project=? AND deployment=? ORDER BY sequence DESC LIMIT 1',project,id).first<any>();
 if(input.occurred<last.occurred||input.state==='rolled_back'&&last.state!=='succeeded'||input.state!=='rolled_back'&&!(['started','progress'].includes(last.state)||last.state==='timed_out'&&['succeeded','failed'].includes(input.state))||input.state!=='rolled_back'&&input.exposure<last.exposure)return c.json({error:'Deployment transition conflicts'},409);
 if(input.rollback_release&&!await s(db,'SELECT 1 FROM releases WHERE project=? AND name=?',project,input.rollback_release).first())return c.json({error:'Rollback release is not registered'},400);
 try{await deployBatch(c,auth,[
  s(db,'INSERT INTO spool_authority_guards SELECT CASE WHEN (SELECT MAX(sequence) FROM deployment_steps WHERE project=? AND deployment=?)=? THEN 1 ELSE 0 END',project,id,last.sequence),
  s(db,'INSERT INTO deployment_steps VALUES(?,?,?,?,?,?,?,?,?,?,?)',project,id,input.callback,last.sequence+1,input.state,input.exposure,input.rollback_release,input.occurred,Date.now(),auth.actor,digest),
  auditCommit(db),
 ]);}catch(e){if(/constraint/.test(String(e))){const retry=await s(db,'SELECT digest FROM deployment_steps WHERE project=? AND deployment=? AND callback=?',project,id,input.callback).first<any>();if(retry?.digest===digest){await deployBatch(c,auth,[]);return c.json({id,duplicate:true})}return c.json({error:'Deployment changed; refresh history'},409)}throw e}
 return c.json({id,state:input.state});
});
export default routes;
