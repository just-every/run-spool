import {Hono} from 'hono';
import {AuthError} from '../../modules/operator-auth/index.mjs';
import {auditCommit} from '../audit/context';
import {authorize,body,s,write,conflict} from '../operators/common';
import {canWrite} from '../discussion/model';
import {resolveIssue} from '../short-ids/lookup';
import {planSuppression,suppressionSignature,suppressionFences,suppressionStatements} from './model';

const routes=new Hono<any>();
routes.onError((error,c)=>error instanceof AuthError?c.json({error:error.code},error.status as any):conflict(c,error));
routes.use('/:project/issues/:issue/suppression',async(c,next)=>{
 const auth=await authorize(c);if('response' in auth)return auth.response;
 const project=c.req.param('project')!,found=await resolveIssue(c.env.DB,project,c.req.param('issue')!);
 const issue=found&&await s(c.env.DB,'SELECT id,revision,count,state FROM issues WHERE project=? AND id=?',project,found.issue).first<any>();
 if(!issue)return c.json({error:'Issue not found'},404);
 if(c.req.method!=='GET'&&!canWrite(auth.session))return c.json({error:'Issue not found'},404);
 c.set('suppressionSession',auth.session);c.set('suppressionIssue',issue);c.header('Cache-Control','no-store');await next();
});
routes.get('/:project/issues/:issue/suppression',async c=>{
 const issue=c.get('suppressionIssue'),history=(await s(c.env.DB,'SELECT * FROM issue_suppressions WHERE project=? AND issue=? ORDER BY started DESC,id DESC LIMIT 100',c.req.param('project'),issue.id).all()).results;
 return c.json({issue:issue.id,revision:issue.revision,history});
});
routes.post('/:project/issues/:issue/suppression',async c=>{
 const input=await body(c),issue=c.get('suppressionIssue');
 if(!input||Object.keys(input).some(key=>!['revision','suppression','apply','preview'].includes(key))||!Number.isSafeInteger(input.revision)||typeof input.apply!=='boolean')return c.json({error:'Expected revision, archive condition and preview/apply choice'},400);
 if(issue.revision!==input.revision)return c.json({error:'Issue changed; preview the archive again'},409);
 const db=c.env.DB,project=c.req.param('project'),time=Date.now();let plan;
 try{plan=await planSuppression(db,project,issue,input.suppression,time)}catch(error){return c.json({error:(error as Error).message},400)}
 const preview=await suppressionSignature(plan);
 if(!input.apply)return c.json({preview,suppression:plan});
 if(input.preview!==preview)return c.json({error:'Archive preview changed; preview again'},409);
 try{await write(c,c.get('suppressionSession'),[...suppressionFences(db,plan),...suppressionStatements(db,plan,crypto.randomUUID(),time),auditCommit(db)]);return c.json({issue:issue.id,state:'suppressed',revision:issue.revision+1})}catch(error){return conflict(c,error)}
});
export default routes;
