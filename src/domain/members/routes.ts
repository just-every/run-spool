import { Hono } from 'hono';
import { ownerSession, ownerWrite, operatorAuth } from '../../auth/session.server';
import { AuthError } from '../../modules/operator-auth/index.mjs';
import { ownerBatch, authorityGuard } from '../owner-authority';
import { auditCommit } from '../audit/context';
import { jsonBody } from '../owner-router';
import { identity } from '../privacy';
import { memberProjects, resolveMembership } from './resolver';
import { fields, name, version, check } from './input';
import { invite, updateMember } from './mutations';
import { serviceRoutes } from './services';
import { s } from './model';
import { mintedByCurrentPerson } from '../credential-fence';

export const memberRoutes=new Hono<any>();
memberRoutes.use('*',async(c,next)=>{
 const session=await ownerSession(c.req.raw,c.env,resolveMembership);
 if(!session)return c.json({error:'Sign in required'},401);
 if(!['GET','HEAD'].includes(c.req.method)&&!ownerWrite(c.req.raw,c.env))return c.json({error:'Same-origin required'},403);
 c.set('teamSession',session);c.header('Cache-Control','no-store');await next();
});
const organization=(db:D1Database)=>s(db,'SELECT * FROM spool_organizations ORDER BY created LIMIT 1').first<any>();
memberRoutes.get('/me',async c=>{
 const session=c.get('teamSession'), org=await organization(c.env.DB);
 return c.json({role:session.operator.role==='owner'?'owner':session.membership.role,memberId:session.membership?.id??(await s(c.env.DB,'SELECT id FROM spool_members WHERE operator_id=?',session.operator.id).first<any>())?.id,organization:org,projects:await memberProjects(c.env.DB,session)});
});
memberRoutes.get('/usage',async c=>{
 const session=c.get('teamSession');
 if(session.operator.role!=='owner'&&!['admin','billing'].includes(session.membership?.role))return c.json({error:'Project not found'},404);
 return c.json({usage:(await s(c.env.DB,'SELECT project,reason,SUM(count) count FROM outcomes GROUP BY project,reason').all()).results,budgets:[],invoices:[],availability:{budgets:'not configured',invoices:'not configured'}});
});
memberRoutes.use('*',async(c,next)=>{
 const session=c.get('teamSession');
 if(session.operator.role!=='owner'&&session.membership?.role!=='admin')return c.json({error:'Project not found'},404);
 await next();
});
memberRoutes.get('/',async c=>{
 const db=c.env.DB;
 const [org,members,grants,teams,services,scopes,invites]=await Promise.all([
  organization(db),s(db,"SELECT m.*,COALESCE(o.status,'inert') operatorStatus,CASE WHEN o.role='owner' THEN 'owner' ELSE m.role END role FROM spool_members m LEFT JOIN oa_operators o ON o.id=m.operator_id ORDER BY m.created,m.id").all(),
  s(db,'SELECT * FROM spool_project_grants').all(),s(db,'SELECT * FROM spool_project_teams').all(),s(db,'SELECT * FROM spool_service_accounts').all(),s(db,'SELECT * FROM spool_service_scopes').all(),s(db,'SELECT * FROM spool_member_invites').all(),
 ]);
 return c.json({organization:org,members:members.results,grants:grants.results,teams:teams.results,services:services.results,scopes:scopes.results,invites:invites.results});
});
memberRoutes.post('/',async c=>{
 const session=c.get('teamSession');if(session.operator.role!=='owner')return c.json({error:'Project not found'},404);
 const b=await jsonBody(c.req.raw,2048);fields(b,['id','name']);const id=identity(b.id,'organization'), label=name(b.name),time=Date.now();
 if(await organization(c.env.DB))return c.json({error:'Organization already exists'},409);
 await ownerBatch(c.env.DB,session,[check(c.env.DB,'NOT EXISTS(SELECT 1 FROM spool_organizations)'),s(c.env.DB,'INSERT INTO spool_organizations VALUES(?,?,?)',id,label,time),
  s(c.env.DB,"INSERT INTO spool_members VALUES(?,?,?,?,?,'admin','active',1,?)",crypto.randomUUID(),id,session.operator.id,session.operator.email,session.operator.displayName,time),
  s(c.env.DB,"INSERT INTO spool_project_teams SELECT id,?,'Default team' FROM projects",id),auditCommit(c.env.DB)]);
 return c.json({id,name:label,created:time},201);
});
memberRoutes.post('/invites',async c=>{
 const org=await organization(c.env.DB);if(!org)return c.json({error:'Create an organization first'},409);
 return c.json(await invite(c.req.raw,c.env,c.get('teamSession'),org.id,await jsonBody(c.req.raw,32768)),202);
});
memberRoutes.on(['PUT','DELETE'],'/members/:id',async c=>{
 const org=await organization(c.env.DB);if(!org)return c.json({error:'Organization not found'},404);
 return c.json(await updateMember(c.env,c.get('teamSession'),org.id,c.req.param('id'),await jsonBody(c.req.raw,32768),c.req.method==='DELETE'));
});
memberRoutes.put('/projects/:project',async c=>{
 const b=await jsonBody(c.req.raw,2048);fields(b,['team']);const team=name(b.team),project=c.req.param('project'),org=await organization(c.env.DB);
 if(!org||!await s(c.env.DB,'SELECT 1 FROM spool_project_teams WHERE project=? AND organization=?',project,org.id).first())return c.json({error:'Project not found'},404);
 await ownerBatch(c.env.DB,c.get('teamSession'),[s(c.env.DB,'UPDATE spool_project_teams SET team=? WHERE project=? AND organization=?',team,project,org.id),auditCommit(c.env.DB)]);return c.json({project,team});
});
memberRoutes.post('/transfer',async c=>{
 const session=c.get('teamSession');if(session.operator.role!=='owner')return c.json({error:'Project not found'},404);
 const b=await jsonBody(c.req.raw,2048);fields(b,['member','version']);const expected=version(b.version);
 await operatorAuth(c.env).requireStepUp(c.req.raw,'owner:transfer');
 const target=await s(c.env.DB,"SELECT m.*,o.version operator_version FROM spool_members m JOIN oa_operators o ON o.id=m.operator_id WHERE m.id=? AND m.version=? AND m.state='active' AND o.status='active' AND o.role='member'",b.member,expected).first<any>();
 if(!target)throw new AuthError('Verified member required',409);
 // The final guard belongs to the newly promoted owner; the predecessor's
 // old session intentionally ceases to authorize this very transaction.
 const { auditedBatch }=await import('../audit/context');
 await auditedBatch(c.env.DB,[authorityGuard(c.env.DB,session),
  check(c.env.DB,"EXISTS(SELECT 1 FROM spool_members m JOIN oa_operators o ON o.id=m.operator_id WHERE m.id=? AND m.version=? AND m.state='active' AND o.status='active' AND o.role='member' AND o.version=?)",target.id,expected,target.operator_version),
  // Carry only live bindings across these two role changes. The identity fence
  // still retires sessions and every credential fenced before this transaction.
  s(c.env.DB,`UPDATE credentials SET minted_version=minted_version+1 WHERE minted_by IN (?,?) AND revoked IS NULL AND ${mintedByCurrentPerson}`,session.operator.id,target.operator_id),
  s(c.env.DB,"UPDATE oa_operators SET role='owner' WHERE id=?",target.operator_id),s(c.env.DB,"UPDATE oa_operators SET role='member' WHERE id=?",session.operator.id),
  s(c.env.DB,"UPDATE spool_members SET role='admin',version=version+1 WHERE operator_id=?",session.operator.id),auditCommit(c.env.DB),s(c.env.DB,'DELETE FROM spool_authority_guards')]);
 return c.json({transferred:true,signInRequired:true});
});
memberRoutes.route('/services',serviceRoutes);
