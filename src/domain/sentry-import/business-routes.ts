import { Hono } from 'hono';
import { ownerSession, ownerWrite } from '../../auth/session.server';
import { ownerClaimConfig } from '../../editor/owner-claim-config.server';
import type { ManagedBindings } from '../../editor/bindings';
import { readImportDoorHistory, writeImportDoorSettings } from '../../modules/import-kit/src/door/index.ts';
import { undoD1Import } from '../../modules/import-kit/src/d1/index.ts';
import { ownerImportContext, ownerImportPredicate } from './context';
import { jsonBody } from '../owner-router';
import { ownerBatch, type OwnerSession } from '../owner-authority';

const routes = new Hono<{Bindings:ManagedBindings;Variables:{owner:OwnerSession}}>();
routes.use('*',async(c,next)=>{
 const session=await ownerSession(c.req.raw,c.env);
 if(!session)return c.json({error:'Owner sign-in required'},401);
 if(c.req.method!=='GET'&&!ownerWrite(c.req.raw,c.env))return c.json({error:'Same-origin owner request required'},403);
 c.set('owner',session);await next();
});
async function settings(env:ManagedBindings, session:OwnerSession) {
 let claim;
 try { claim=ownerClaimConfig(env); } catch { return {configured:false,enabled:false,keys:[],history:[]}; }
 const row=await env.DB.prepare('SELECT enabled FROM ik_door_settings WHERE installation_id=?').bind(claim.installationId).first<{enabled:number}>();
 const revoked=(await env.DB.prepare('SELECT kid FROM ik_door_revoked_keys WHERE installation_id=?').bind(claim.installationId).all<{kid:string}>()).results.map(row=>row.kid);
 return {configured:true,enabled:row?.enabled===1,
  keys:[...new Set([...Object.keys(claim.publicKeys),...revoked])].map(kid=>({kid,revoked:revoked.includes(kid)})),
  history:await readImportDoorHistory(env.DB,claim.installationId,ownerImportPredicate(session))};
}
routes.get('/',async c=>c.json(await settings(c.env,c.get('owner'))));
routes.post('/',async c=>{
 const input=await jsonBody(c.req.raw,10_000);
 if(Object.keys(input).some(k=>!['enabled','revokedKids'].includes(k))||typeof input.enabled!=='boolean'||
  (input.revokedKids!==undefined&&(!Array.isArray(input.revokedKids)||input.revokedKids.some((kid:unknown)=>typeof kid!=='string'))))return c.json({error:'Invalid settings'},400);
 const claim=ownerClaimConfig(c.env);
 await writeImportDoorSettings(c.env.DB,claim.installationId,input,ownerImportPredicate(c.get('owner')));
 return c.json(await settings(c.env,c.get('owner')));
});
routes.post('/:planId/undo',async c=>{
 const claim=ownerClaimConfig(c.env);
 const planId=c.req.param('planId');
 const row=await c.env.DB.prepare(`SELECT p.job_id,p.previous_id,p.namespace AS logical_namespace,j.namespace FROM ik_door_plans p JOIN ik_jobs j ON j.id=p.job_id
  WHERE p.id=? AND p.installation_id=?`).bind(planId,claim.installationId).first<{job_id:string;previous_id:string|null;logical_namespace:string;namespace:string}>();
 if(!row)return c.json({error:'Import not found'},404);
 const context=ownerImportContext(c.env,c.get('owner'),row.namespace),owner=ownerImportPredicate(c.get('owner'));
 context.authorization.predicate=()=>({sql:`(${owner.sql}) AND EXISTS(SELECT 1 FROM ik_door_namespaces WHERE installation_id=? AND namespace=? AND (pending_id=? OR (pending_id IS NULL AND head_id=?)))`,
  params:[...owner.params,claim.installationId,row.logical_namespace,planId,planId]});
 const job=await undoD1Import(row.job_id,context);
 if(job.state==='undone')await ownerBatch(c.env.DB,c.get('owner'),[
  c.env.DB.prepare('UPDATE ik_door_namespaces SET head_id=CASE WHEN head_id=? THEN ? ELSE head_id END,pending_id=NULL WHERE installation_id=? AND namespace=? AND (pending_id=? OR (pending_id IS NULL AND head_id=?))')
   .bind(planId,row.previous_id,claim.installationId,row.logical_namespace,planId,planId),
 ]);
 return c.json({job});
});
export default routes;
