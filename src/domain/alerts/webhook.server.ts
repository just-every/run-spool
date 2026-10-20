import { demoEffect } from '../../modules/demo/index.mjs';
import { D1SqlDatabase } from '../../modules/integrations/core/database';
import { IntegrationsRepository } from '../../modules/integrations/core/repository';
import { DeliveryService } from '../../modules/integrations/core/delivery';
import { createWebhookProtocol } from '../../modules/integrations/core/webhook';
import type { WireRequest } from '../../modules/integrations/core/types';
import { authorizedDestination, destinationHash, findDestination, keyBytes } from './destinations.server';
import { namespace, statement as s } from './types';
import { auditSubject, serviceActor } from '../audit/identity';
import { recordAudit } from '../audit/record';
import type { AlertEnvironment, Intent } from './types';

export function webhookService(env:AlertEnvironment,project:string,now:()=>number) {
 const repository=new IntegrationsRepository(new D1SqlDatabase(env.DB),namespace(project));
 const claims=new WeakMap<WireRequest,string>();
 const protocol=createWebhookProtocol({
  async resolveDestination(id){if(!env.INTEGRATION_EGRESS)throw new Error('egress_unconfigured');return (await findDestination(env,project,id,'webhook')).url!},
  async signingKey(envelope){
   const intent=await s(env.DB,'SELECT * FROM alert_intents WHERE project=? AND id=? AND destination=? AND channel=\'webhook\'',project,envelope.id,envelope.destinationId).first<Intent>();
   if(!intent||intent.body!==envelope.body||intent.event!==envelope.event||envelope.tenant!==namespace(project))throw new Error('delivery_authority');
   return keyBytes((await authorizedDestination(env,intent)).key);
  },
 });
 return new DeliveryService({repository,now,hashDestination:url=>destinationHash(env,url),
  protocols:[{...protocol,async prepare(envelope,time){
   // Bind this exact request to the attempt that prepared it. This stays local;
   // neither the signed interface nor Base's copied transport is changed.
   const attempt=await repository.get(envelope.id);
   const wire=await protocol.prepare(envelope,time);
   if(attempt?.state==='sending'&&attempt.claim)claims.set(wire,attempt.claim);
   return wire;
  }}],
  transport:{async send(request){
   if(!env.INTEGRATION_EGRESS)throw new Error('egress_unconfigured');
   const claim=claims.get(request);if(!claim)throw new Error('delivery_authority');
   const intent=await s(env.DB,'SELECT * FROM alert_intents WHERE project=? AND id=?',project,request.headers['webhook-id']).first<Intent>();
   if(!intent)throw new Error('delivery_authority');await authorizedDestination(env,intent);
   // Consumer authorization can yield after Base's last claim check. Fence again
   // after those awaits, and check the clock after the final database round trip.
   const authority=await s(env.DB,`SELECT d.claim_until FROM integration_deliveries d
    JOIN alert_intents i ON i.id=d.id AND d.namespace='spool.'||i.project
    JOIN alert_rules r ON r.id=i.rule_id AND r.project=i.project AND r.revision=i.rule_revision AND r.enabled=1 AND r.channel=i.channel AND r.destination=i.destination
    WHERE d.namespace=? AND d.id=? AND d.state='sending' AND d.claim=? AND d.claim_until>?`,namespace(project),intent.id,claim,now()).first<{claim_until:number}>();
   if(!authority||authority.claim_until<=now())throw new Error('delivery_authority');
   // The attempt is an effect outside this database: `started` before it, one outcome after.
   const fact={source:'service' as const,actor:await serviceActor(env.DB,'webhook'),action:'notification.attempt' as const,subject:await auditSubject(env.DB,'delivery',intent.id)};
   await recordAudit(env.DB,{...fact,outcome:'started'});
   let response;
   try{response=await demoEffect(() => env.INTEGRATION_EGRESS!.send(request), () => ({ status: 204, headers: {}, body: '' }));}
   catch(error){await recordAudit(env.DB,{...fact,outcome:'uncertain'});throw error}
   await s(env.DB,`UPDATE alert_history SET code=? WHERE id=? AND project=?`,'http_'+response.status+'_signature_sent',intent.id,project).run();
   await recordAudit(env.DB,{...fact,outcome:response.status>=200&&response.status<300?'accepted':'failed'});
   return response;
  }},
 });
}
