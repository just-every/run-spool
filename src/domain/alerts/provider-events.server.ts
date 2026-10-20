import { createDeliveryEventIntake, createD1EventStore } from '../../modules/mail/src/events/index.mjs';
import { auditedBatch, auditCommit } from '../audit/context';
import { serviceActor, auditSubject, projectAuditLabel } from '../audit/identity';
import { statement as s, type AlertEnvironment } from './types';

export async function projectProviderEvents(env:AlertEnvironment) {
 // Also repairs a crash between Base's idempotent receipt and this safe projection.
 const rows=(await s(env.DB,`SELECT r.event_json FROM rer_mail_event_receipts r
  WHERE r.provider='sendgrid' AND r.tenant_id='spool' AND NOT EXISTS(
   SELECT 1 FROM alert_provider_events e WHERE e.event_id=r.event_id)`).all<any>()).results;
 for(const row of rows){const e=JSON.parse(row.event_json);
  if(!await s(env.DB,"SELECT 1 FROM alert_history WHERE project=? AND id=? AND channel='mail' AND historical=0",e.eventNamespace,e.deliveryId).first())continue;
  const scope={actor:await serviceActor(env.DB,'mail'),subject:await auditSubject(env.DB,'delivery',e.deliveryId,e.eventNamespace),projectLabel:await projectAuditLabel(env.DB,e.eventNamespace),action:'notification.attempt' as const};
  await auditedBatch(env.DB,[s(env.DB,`INSERT INTO alert_provider_events VALUES(?,?,?,?,?,?,?) ON CONFLICT(event_id) DO NOTHING`,e.eventId,e.eventNamespace,e.deliveryId,e.type,e.type==='dropped'?'dropped':e.status,e.occurredAt,env.ALERT_EVENT_PROVENANCE==='fixture'?'fixture':'sendgrid'),auditCommit(env.DB,'changes()>0')],scope);
 }
}
export async function providerEventResponse(request:Request,env:AlertEnvironment):Promise<Response|null> {
 const match=/^\/api\/alert-events\/sendgrid\/([a-zA-Z0-9._-]+)$/.exec(new URL(request.url).pathname);if(!match)return null;
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 if(!env.SENDGRID_EVENT_PUBLIC_KEY)return Response.json({error:'Signed event intake is not configured'},{status:503});
 const project=match[1],reader=request.body?.getReader();if(!reader)return new Response('Body required',{status:400});
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>262144){await reader.cancel();return new Response('Too large',{status:413})}chunks.push(part.value)}
 const rawBody=new Uint8Array(size);let offset=0;for(const c of chunks){rawBody.set(c,offset);offset+=c.length}
 try {
  const intake=createDeliveryEventIntake({provider:'sendgrid',tenantId:'spool',eventNamespace:project,key:env.SENDGRID_EVENT_PUBLIC_KEY,store:createD1EventStore({db:env.DB}),
   async authorize(e:any){
    if(!e.deliveryId)return false;
    const job=await s(env.DB,`SELECT j.message FROM alert_mail_jobs j JOIN alert_history h ON h.id=j.id AND h.project=j.project WHERE j.project=? AND j.id=? AND h.historical=0 AND h.channel='mail' AND j.state IN ('sending','accepted','uncertain')`,project,e.deliveryId).first<any>();
    return !!job&&e.recipients.length===1&&JSON.parse(job.message).to.includes(e.recipients[0]);
   }});
  if(!('ingestWebhook' in intake))throw new Error('Invalid event intake');
  const results=await intake.ingestWebhook({rawBody,headers:request.headers});await projectProviderEvents(env);
  return Response.json({events:results.map((r:any)=>({id:r.eventId,outcome:r.outcome}))});
 }catch{return Response.json({error:'Event signature, identity or delivery refused'},{status:403})}
}
