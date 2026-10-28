import {Hono} from 'hono';
import {authorize,body,s,guard,write,conflict} from '../operators/common';
import {auditCommit,currentAuditScope} from '../audit';
import {priorities} from './model';
const routes=new Hono<any>();
routes.put('/:project/issues/:issue/priority',async c=>{
 const auth=await authorize(c);if('response' in auth)return auth.response;
 const project=c.req.param('project'),issue=c.req.param('issue'),b=await body(c);
 if(!b||Object.keys(b).sort().join()!=='priority,revision'||!priorities.includes(b.priority)||!Number.isSafeInteger(b.revision)||b.revision<1)throw new Error('Invalid priority');
 const row=await s(c.env.DB,'SELECT revision FROM issues WHERE project=? AND id=?',project,issue).first<any>();
 if(!row)return c.json({error:'Issue not found'},404);
 if(row.revision!==b.revision)return c.json({error:'Revision conflict'},409);
 const actor=currentAuditScope().actor;
 try{await write(c,auth.session,[guard(c.env.DB,'EXISTS(SELECT 1 FROM issues WHERE project=? AND id=? AND revision=?)',project,issue,b.revision),s(c.env.DB,'UPDATE issue_priorities SET manual=? WHERE project=? AND issue=?',b.priority,project,issue),s(c.env.DB,'UPDATE issues SET revision=revision+1 WHERE project=? AND id=?',project,issue),s(c.env.DB,'INSERT INTO issue_activity VALUES(?,?,?,?,?,?,?,?)',crypto.randomUUID(),project,issue,'priority',actor.kind,actor.label,JSON.stringify({priority:b.priority,manual:true}),Date.now()),auditCommit(c.env.DB)]);return c.json({priority:b.priority,revision:b.revision+1})}catch(error){return conflict(c,error)}
});
export default routes;
