import { Hono } from 'hono';
import { ownerSession, ownerWrite } from '../../auth/session.server';
import { ownerClaimConfig } from '../../editor/owner-claim-config.server';
import type { ManagedBindings } from '../../editor/bindings';
import { readImportDoorHistory, writeImportDoorSettings } from '../../modules/import-kit/src/door/index.ts';
import { ownerImportPredicate } from './context';
import { doorKey, importDoorResponse } from './door.server';
import { jsonBody } from '../owner-router';
import type { OwnerSession } from '../owner-authority';

const routes = new Hono<{Bindings:ManagedBindings;Variables:{owner:OwnerSession}}>();
routes.use('*',async(c,next)=>{
 const session=await ownerSession(c.req.raw,c.env);
 if(!session)return c.json({error:'Owner sign-in required'},401);
 if(c.req.method!=='GET'&&!ownerWrite(c.req.raw,c.env))return c.json({error:'Same-origin owner request required'},403);
 c.set('owner',session);await next();
});
/** Business opt-in and keys, and the history of every door import (the
 * owner's own and Business's) under the installation's permanent door key. */
async function settings(env:ManagedBindings, session:OwnerSession) {
 const key=await doorKey(env);
 let claim;
 try { claim=ownerClaimConfig(env); } catch { claim=null; }
 const row=await env.DB.prepare('SELECT enabled FROM ik_door_settings WHERE installation_id=?').bind(key).first<{enabled:number}>();
 const revoked=(await env.DB.prepare('SELECT kid FROM ik_door_revoked_keys WHERE installation_id=?').bind(key).all<{kid:string}>()).results.map(row=>row.kid);
 return {configured:!!claim,enabled:row?.enabled===1,
  keys:[...new Set([...Object.keys(claim?.publicKeys??{}),...revoked])].map(kid=>({kid,revoked:revoked.includes(kid)})),
  history:await readImportDoorHistory(env.DB,key,ownerImportPredicate(session))};
}
routes.get('/',async c=>c.json(await settings(c.env,c.get('owner'))));
routes.post('/',async c=>{
 const input=await jsonBody(c.req.raw,10_000);
 if(Object.keys(input).some(k=>!['enabled','revokedKids'].includes(k))||typeof input.enabled!=='boolean'||
  (input.revokedKids!==undefined&&(!Array.isArray(input.revokedKids)||input.revokedKids.some((kid:unknown)=>typeof kid!=='string'))))return c.json({error:'Invalid settings'},400);
 // Business grants need RER's trusted key ring; turning them off never does.
 if(input.enabled){try{ownerClaimConfig(c.env)}catch{return c.json({error:'Owner-claim trust configuration required'},409)}}
 await writeImportDoorSettings(c.env.DB,await doorKey(c.env),input,ownerImportPredicate(c.get('owner')));
 return c.json(await settings(c.env,c.get('owner')));
});
/** Undo from history is one bounded step of the door's own undo, as the owner,
 * whichever authority approved the import and whether or not Business is on. */
routes.post('/:planId/undo',async c=>{
 const plan=await c.env.DB.prepare('SELECT namespace FROM ik_door_plans WHERE id=? AND installation_id=?').bind(c.req.param('planId'),await doorKey(c.env)).first<{namespace:string}>();
 if(!plan)return c.json({error:'Import not found'},404);
 const headers=new Headers(c.req.raw.headers);headers.delete('Content-Length');headers.set('Content-Type','application/json');headers.set('X-Import-Source',plan.namespace);
 const response=await importDoorResponse(new Request(new URL('/api/operator/import/undo',c.req.url),{method:'POST',headers,body:JSON.stringify({planId:c.req.param('planId')})}),c.env);
 return response!;
});
export default routes;
