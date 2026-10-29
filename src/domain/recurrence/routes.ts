import {canonical} from '../privacy';
import { Hono } from 'hono';
import { auditCommit } from '../audit/context';
import { authorize,body,s,guard,audit,write,conflict } from '../operators/common';
import { readRecurrencePolicy,recurrenceInput,recurrencePreview } from './model';

const routes=new Hono<any>();
routes.use('/:project/recurrence-policy',async(c,next)=>{
 const auth=await authorize(c);if('response' in auth)return auth.response;
 if(!await s(c.env.DB,'SELECT 1 FROM projects WHERE id=?',c.req.param('project')).first())return c.json({error:'Project not found'},404);
 c.set('recurrenceSession',auth.session);await next();
});
routes.get('/:project/recurrence-policy',async c=>c.json(await readRecurrencePolicy(c.env.DB,c.req.param('project'))));
routes.post('/:project/recurrence-policy',async c=>{
 let input;try{input=recurrenceInput(await body(c))}catch(error){return c.json({error:(error as Error).message},400)}
 const db=c.env.DB,project=c.req.param('project'),current=await readRecurrencePolicy(db,project);
 if(input.revision!==current.revision)return c.json({error:'Recurrence policy changed; refresh and preview again'},409);
 const preview=await recurrencePreview(db,project,current,input.reopenSameRelease);
 if(!input.apply)return c.json({preview,behavior:'Applies to future accepted events only. Current issues and retained events are unchanged.'});
 if(canonical(input.preview)!==canonical(preview))return c.json({error:'Recurrence preview changed; preview again'},409);
 const revision=input.revision+1,time=Date.now();
 try{
  await write(c,c.get('recurrenceSession'),[
   guard(db,'EXISTS(SELECT 1 FROM projects WHERE id=?) AND COALESCE((SELECT revision FROM recurrence_policies WHERE project=?),0)=?',project,project,input.revision),
   s(db,`INSERT INTO recurrence_policies(project,revision,reopen_same_release,updated) VALUES(?,?,?,?)
    ON CONFLICT(project) DO UPDATE SET revision=excluded.revision,reopen_same_release=excluded.reopen_same_release,updated=excluded.updated`,project,revision,input.reopenSameRelease?1:0,time),
   auditCommit(db,'changes()=1'),
   audit(db,project,'recurrence_policy_changed',{previousRevision:input.revision,revision,reopenSameRelease:input.reopenSameRelease,affectedResolvedCount:preview.affectedResolvedCount}),
  ]);
  return c.json({revision,reopenSameRelease:input.reopenSameRelease,updated:time});
 }catch(error){return conflict(c,error)}
});
export default routes;
