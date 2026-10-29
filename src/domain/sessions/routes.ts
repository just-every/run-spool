import { resolveMembership } from '../members/resolver';
import { Hono } from 'hono';
import { ownerSession } from '../../auth/session.server';
import { agentProject } from '../agent-access';
import { releaseHealth } from './health';
import { sessionRecords } from './records';
const routes=new Hono<any>();
for(const path of ['/:project/release-health','/:project/session-records'])routes.use(path,async(c,next)=>{
 c.header('Cache-Control','no-store');c.header('X-Content-Type-Options','nosniff');
 const project=c.req.param('project'),grant=await agentProject(c.req.raw,c.env.DB);
 if(grant!==project&&!await ownerSession(c.req.raw,c.env,resolveMembership)||grant&&grant!==project)return c.json({error:'Sign in required'},401);
 if(!await c.env.DB.prepare('SELECT 1 FROM projects WHERE id=?').bind(project).first())return c.json({error:'Project not found'},404);
 await next();
});
routes.get('/:project/session-records',sessionRecords);
routes.get('/:project/release-health',async c=>{
 const project=c.req.param('project');
 const to=c.req.query('to')===undefined?Date.now():Number(c.req.query('to')),from=c.req.query('from')===undefined?to-86400000:Number(c.req.query('from')),environment=c.req.query('environment')??null;
 if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||to<=from||to-from>90*86400000||to>Date.now()+300000||environment!==null&&(environment.length>100||/[\x00-\x1f\x7f]/.test(environment)))return c.json({error:'Use a positive window of at most 90 days and a bounded environment'},400);
 if(c.req.query('download')==='1')c.header('Content-Disposition','attachment; filename="spool-release-health.json"');
 return c.json(await releaseHealth(c.env.DB,project,from,to,environment));
});
export default routes;
