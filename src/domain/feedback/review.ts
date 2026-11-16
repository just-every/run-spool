import { jsonBody, ownerWrites } from '../owner-router';
import { recordAudit } from '../audit/record';
import { currentAuditScope, auditCommit } from '../audit/context';
import { sender } from '../alerts/mail';
import { mailSuppressed } from '../../auth/mail.server.mjs';
import { prepareScrubbing } from '../scrubbing/model';
import { privateData, privateLimits, privateSummary, type PrivateFeedback, type Reply } from './private';
import type { feedbackRoutes } from './routes';

// Private review never enters issue reads or read-only/service/agent evidence.
export function mayReview(session:any){
 return session.kind!=='agent'&&session.kind!=='reviewer'&&(session.operator.role==='owner'||session.membership?.role==='admin'||['maintainer','member'].includes(session.membership?.projectRole));
}
export function installReview(routes:typeof feedbackRoutes){
 routes.use('/:id/*',async(c,next)=>{
  if(!mayReview(c.get('ownerSession')))return c.json({error:'Feedback review not found'},404);
  c.header('Cache-Control','private, no-store');
  await next();
  if(c.req.method==='GET'&&c.res.status<400)await recordAudit(c.env.DB,{...currentAuditScope(),source:'request',outcome:'succeeded',status:c.res.status});
 });
 const read=async(c:any):Promise<{private_data:string|null}|null>=>c.env.DB.prepare('SELECT private_data FROM feedback WHERE project=? AND id=?').bind(c.req.param('project'),c.req.param('id')).first();
 const save=async(c:any,old:string|null,data:PrivateFeedback,jobs:D1PreparedStatement[]=[])=>{
  await ownerWrites(c,[...jobs,c.env.DB.prepare('INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM feedback WHERE project=? AND id=? AND private_data IS ?) THEN 1 ELSE 0 END').bind(c.req.param('project'),c.req.param('id'),old),
   c.env.DB.prepare('UPDATE feedback SET private_data=? WHERE project=? AND id=?').bind(JSON.stringify(data),c.req.param('project'),c.req.param('id')),auditCommit(c.env.DB)]);
 };
 routes.get('/:id/private',async c=>{
  const row=await read(c);if(!row)return c.json({error:'Feedback not found'},404);
  return c.json({private:privateSummary(privateData(row.private_data)),mail:mailState(c.env)});
 });
 routes.get('/:id/screenshot',async c=>{
  const row=await read(c),data=row&&privateData(row.private_data);
  if(!data?.screenshot)return c.json({error:'Screenshot not found'},404);
  return new Response(Uint8Array.from(atob(data.screenshot),char=>char.charCodeAt(0)),{headers:{
   'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
   'Content-Security-Policy':"default-src 'none'; sandbox",'Cross-Origin-Resource-Policy':'same-origin',
   'Content-Disposition':'inline; filename="screenshot.png"',
  }});
 });
 routes.post('/:id/review',async c=>{
  const row=await read(c),data=row&&privateData(row.private_data);
  if(!data)return c.json({error:'No consented details to review'},404);
  let body;try{body=await jsonBody(c.req.raw,1024)}catch{return c.json({error:'Invalid review'},400)}
  if(body.reviewed!==true)return c.json({error:'Review confirmation required'},400);
  await save(c,row.private_data,{...data,review:'reviewed'});
  return c.json({private:privateSummary({...data,review:'reviewed'})});
 });
 routes.post('/:id/replies',async c=>{
  let body;try{body=await jsonBody(c.req.raw,12000)}catch{return c.json({error:'Invalid reply'},400)}
  if(body.consent!==true||typeof body.id!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(body.id)||typeof body.message!=='string'||!body.message.trim()||body.message.length>privateLimits.replyCharacters)return c.json({error:'A reply, unique request ID and explicit send confirmation are required'},422);
  const row=await read(c),data=row&&privateData(row.private_data);
  if(!data?.contact)return c.json({error:'No consented contact for this report'},409);
  const existing=data.replies.find(reply=>reply.id===body.id);
  if(existing)return existing.message===body.message?c.json({reply:privateSummary({...data,replies:[existing]})!.replies[0]}):c.json({error:'Reply request ID already used'},409);
  if(data.replies.length>=privateLimits.replies)return c.json({error:'Reply limit reached for this report'},429);
  const privacy=await prepareScrubbing(c.env.DB,c.req.param('project')!,{message:body.message});
  if(!privacy.document.message.trim())return c.json({error:'Reply removed by privacy policy'},422);
  const mail=mailState(c.env);
  const reply:Reply={id:body.id,message:privacy.document.message,created:Date.now(),state:mail.enabled?'queued':'never_sent',code:mail.enabled?'queued':mail.code};
  const queued={...data,replies:[...data.replies,reply]};
  await save(c,row!.private_data,queued,privacy.jobs);
  if(!mail.enabled)return c.json({reply},201);
  // One explicit request starts at most one provider attempt. Repeated IDs only
  // read the ledger; restore and uncertain results never replay mail.
  let state:Reply['state']='failed',code='delivery_unconfirmed';
  try{
   const result=await sender(c.env).send({deliveryId:`feedback:${c.req.param('project')}:${c.req.param('id')}:${reply.id}`,from:c.env.MAIL_FROM!,to:[data.contact],subject:'Reply to your feedback',text:reply.message});
   if(result.status==='accepted'){state='sent';code='provider_accepted'}
   else if(result.status==='development'){state='never_sent';code='mail_suppressed'}
   else if(result.status!=='uncertain')code='provider_failed';
  }catch{/* A provider attempt may have started; never claim definite non-delivery. */}
  const finished={...reply,state,code};
  // Withdrawal wins: update only the same surviving consented report. No row
  // is recreated, and no recipient/body is written to another product store.
  const current=await read(c),kept=current&&privateData(current.private_data);
  if(kept?.replies.some(item=>item.id===reply.id&&item.state==='queued'))await save(c,current!.private_data,{...kept,replies:kept.replies.map(item=>item.id===reply.id?finished:item)});
  return c.json({reply:finished},201);
 });
}
export function mailState(env:any):{enabled:boolean;code:'mail_off'|'mail_suppressed'|'mail_unconfigured'|'queued'}{
 if(env.MAIL_PROVIDER==='none')return {enabled:false,code:'mail_off'};
 if(mailSuppressed(env))return {enabled:false,code:'mail_suppressed'};
 try{sender(env);return {enabled:true,code:'queued'}}catch{return {enabled:false,code:'mail_unconfigured'}}
}
