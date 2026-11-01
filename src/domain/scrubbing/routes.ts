import {ScrubbingRefusal,refusalCode,refusalMessage} from './refusal';
import {Hono} from 'hono';
import {ownerProjectRouter,ownerWrites,jsonBody} from '../owner-router';
import {ownerSession,ownerWrite} from '../../auth/session.server';
import {runtimeBindings} from '../../auth/bindings';
import {scrubbingPolicy} from './policy';
import {policyId,policyDigest,scrubbingSnapshot,scrubbingFence} from './model';
import {scrubbingPreview} from './preview';
export const projectScrubbingRoutes=ownerProjectRouter();
export const installationScrubbingRoutes=new Hono<any>();
installationScrubbingRoutes.use('*',async(c,next)=>{
 const env=runtimeBindings(c.env),session=await ownerSession(c.req.raw,env);
 if(!session)return c.json({error:'Owner session required'},401);
 if(!['GET','HEAD'].includes(c.req.method)&&!ownerWrite(c.req.raw,env))return c.json({error:'Same-origin required'},403);
 c.set('ownerSession',session);await next();
});
for(const routes of [projectScrubbingRoutes,installationScrubbingRoutes] as Hono<any>[]){
 const project=(c:any):string|null=>c.req.param('project')??null;
 routes.get('/',async c=>c.json(await scrubbingSnapshot(c.env.DB,project(c))));
 routes.post('/preview',async c=>{
  const p=project(c),db=c.env.DB,b=await jsonBody(c.req.raw,32768),current=await scrubbingSnapshot(db,p);
  try{
   const policy=scrubbingPolicy(b.policy,p===null?undefined:current.installationPolicy),preview=await scrubbingPreview(db,p,policy,current.installationPolicy),token=crypto.randomUUID();
   await ownerWrites(c,[scrubbingFence(db,p,current.revision),scrubbingFence(db,null,current.installationRevision),db.prepare('DELETE FROM scrubbing_previews WHERE created<?').bind(Date.now()-86400000),db.prepare('INSERT INTO scrubbing_previews VALUES(?,?,?,?,?,?,?)').bind(token,p,policyId(p),current.revision,current.installationRevision,await policyDigest(policy),Date.now())]);
   return c.json({...preview,token,refusal:null,revision:current.revision,installationRevision:current.installationRevision});
  }catch(error){return c.json({token:null,refusal:refusalCode(error),refusalTarget:error instanceof ScrubbingRefusal?error.target:undefined,revision:current.revision,installationRevision:current.installationRevision,matches:[],sample:[],coverage:null})}
 });
 routes.put('/',async c=>{
  const p=project(c),db=c.env.DB,b=await jsonBody(c.req.raw,32768),current=await scrubbingSnapshot(db,p);
  let policy;try{policy=scrubbingPolicy(b.policy,p===null?undefined:current.installationPolicy)}catch(error){return c.json({error:refusalMessage(refusalCode(error),error instanceof ScrubbingRefusal?error.target:undefined),refusal:refusalCode(error),refusalTarget:error instanceof ScrubbingRefusal?error.target:undefined},400)}
  const digest=await policyDigest(policy),preview=typeof b.token==='string'?await db.prepare('SELECT 1 FROM scrubbing_previews WHERE id=? AND scope=? AND revision=? AND installation_revision=? AND digest=? AND created>=?').bind(b.token,policyId(p),current.revision,current.installationRevision,digest,Date.now()-86400000).first():null;
  if(b.revision!==current.revision||!preview)return c.json({error:'Scrubbing preview is stale; preview the current policy again'},409);
  const revision=current.revision+1,time=Date.now(),detail=JSON.stringify({rules:policy.rules.map(r=>({id:r.id,selector:r.selector,method:r.method})),sensitiveFields:policy.sensitiveFields,safeFields:policy.safeFields});
  await ownerWrites(c,[scrubbingFence(db,p,current.revision),scrubbingFence(db,null,current.installationRevision),db.prepare('INSERT INTO scrubbing_policies VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,policy=excluded.policy,updated=excluded.updated').bind(policyId(p),p,revision,JSON.stringify(policy),time),db.prepare("INSERT INTO audit VALUES(?,?,'scrubbing_policy_changed',?,?)").bind(crypto.randomUUID(),p,JSON.stringify({revision,rules:policy.rules.map(r=>({id:r.id,selector:r.selector,method:r.method}))}),time),db.prepare('INSERT INTO scrubbing_changes VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),p,policyId(p),revision,detail,time),db.prepare('DELETE FROM scrubbing_previews WHERE id=?').bind(b.token)]);
  return c.json(await scrubbingSnapshot(db,p));
 });
}
