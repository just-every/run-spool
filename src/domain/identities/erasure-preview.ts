import { ownerProjectRouter, ownerWrites, jsonBody } from '../owner-router';
import { identityFields, type IdentityField } from './policy';
import { permittedValue } from './values';
import { endUserPlan, endUserStatements, endUserReceipt, type EndUserSelection } from '../erasure/end-user';

export const endUserErasurePreviewRoutes = ownerProjectRouter();
endUserErasurePreviewRoutes.use('*',async(c,next)=>{c.header('Cache-Control','no-store');c.header('X-Content-Type-Options','nosniff');await next()});
function selection(input:any):EndUserSelection {
 // Preserve the existing email preview API; extended selections name exactly
 // one permitted field. Neither response nor errors echo the supplied value.
 const legacy=Object.keys(input).join()==='email';
 const field=legacy?'email':input.field as IdentityField,value=legacy?input.email:input.value,action=legacy?'remove_identity':input.action;
 if(!identityFields.includes(field)||typeof value!=='string'||permittedValue(value,field)!==value||field==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)||!['remove_identity','delete_events'].includes(action))throw new Error('Supply one retained user identity and choose an erasure action');
 return {field,value,action};
}
endUserErasurePreviewRoutes.post('/preview', async c => {
 if(c.req.header('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new Error('JSON request required');
 const input=await jsonBody(c.req.raw,2048);
 if(Object.keys(input).some(key=>!['email','field','value','action'].includes(key))||Object.hasOwn(input,'email')&&Object.keys(input).length!==1)throw new Error('Supply exactly one identity');
 const plan=await endUserPlan(c.env.DB,c.req.param('project')!,selection(input));
 // Preview stays read-only and checks the admitting session on both sides.
 await ownerWrites(c,[plan.query]);
 return c.json(plan.public);
});
endUserErasurePreviewRoutes.post('/confirm',async c=>{
 const actor=c.get('ownerSession');
 if((actor.kind==='agent'||actor.kind==='reviewer')||actor.operator.role!=='owner'||actor.membership)return c.json({error:'Installation owner session required'},403);
 const input=await jsonBody(c.req.raw,2048);
 if(Object.keys(input).sort().join()!=='action,confirm,field,planHash,value'||input.confirm!=='ERASE USER DATA'||typeof input.planHash!=='string')return c.json({error:'Type ERASE USER DATA to confirm the previewed erasure'},400);
 const selected=selection(input),project=c.req.param('project')!,plan=await endUserPlan(c.env.DB,project,selected);
 if(input.planHash!==plan.public.planHash)return c.json({error:'Erasure preview changed; preview again'},409);
 if(plan.public.events.status!=='available'||plan.public.hold)return c.json({error:plan.public.hold??'Identity matching unavailable; nothing was erased'},409);
 const work=await endUserStatements(c.env.DB,project,selected,plan);
 try{await ownerWrites(c,work.statements)}catch(error){if(/CHECK constraint failed: value=1/.test(String(error)))return c.json({error:'Erasure preview changed; preview again'},409);throw error}
 return c.json(await endUserReceipt(c.env.DB,work.id));
});
