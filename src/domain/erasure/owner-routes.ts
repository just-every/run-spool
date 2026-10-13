import { AuthError } from '../../modules/operator-auth/index.mjs';
import { ErasureError } from '../../modules/erasure/index.mjs';
import { ownerSession, ownerWrite, operatorAuth } from '../../auth/session.server';
import type { Bindings } from '../../auth/bindings';
import { eraseOwner, ownerPreview, ownerReceipt, ownerErasureService } from './owner-service';
import { inviteSuccessor } from './owner-transfer';
import { readInput } from '../../modules/operator-auth/input.mjs';
import { ownerHoldMessage } from './owner-service';

export async function ownerErasureResponse(request: Request, env: Bindings): Promise<Response | null> {
 const path=new URL(request.url).pathname;
 if(!path.startsWith('/api/owner/erasure'))return null;
 const json=(value: unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
 try {
  if(request.headers.has('authorization'))return json({error:'Owner session required'},403);
  const session=await ownerSession(request,env);
  if(!session)return json({error:'Owner session required'},401);
  if(request.method!=='GET' && !ownerWrite(request,env))return json({error:'Same-origin required'},403);
  if(path==='/api/owner/erasure' && request.method==='GET')return json((await ownerPreview(env.DB,session.operator.id)).public);
  if(path==='/api/owner/erasure/receipts' && request.method==='GET') {
   const service=await ownerErasureService(env.DB);
   const rows=(await env.DB.prepare("SELECT id FROM rer_erasure_operations WHERE entity='installation-owner' ORDER BY requested_at DESC LIMIT 20").all<any>()).results;
   return json(await Promise.all(rows.map(async row=>ownerReceipt(await service.receipt(row.id)))));
  }
  if(request.method!=='POST')return json({error:'Not found'},404);
  const input=await readInput(request);
  if(path==='/api/owner/erasure/successor')return json(await inviteSuccessor(request,env,session,input),202);
  if(path!=='/api/owner/erasure')return json({error:'Not found'},404);
  if(Object.keys(input).sort().join()!=='confirm,planHash' || input.confirm!=='ERASE MY PERSONAL DATA' || !/^[0-9a-f]{64}$/.test(input.planHash ?? ''))return json({error:'Explicit confirmation and preview plan required'},400);
  await operatorAuth(env).requireStepUp(request,'delete');
  const receipt=await eraseOwner(env.DB,session,input,Date.now()+20_000);
  return json(ownerReceipt(receipt),receipt.phase==='complete'?200:202);
 }catch(error) {
  if(error instanceof ErasureError || error instanceof AuthError) { const code=error.code.replace(/^held:/,'');return json({error:code,message:ownerHoldMessage(code)},error.status); }
  return json({error:'owner_erasure_unavailable'},503);
 }
}
