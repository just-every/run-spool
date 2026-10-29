import type { NativeAuthority } from '../agent-door/native-authority';
import { savedSlack } from './slack-destinations.server';
import { sendSlack } from './slack.server';
import {auditCommit} from '../audit/context';
import { ownerBatch, type OwnerSession } from '../owner-authority';
import { findDestination, destinationHash, destinationFingerprint, keyBytes } from './destinations.server';
import { sender } from './mail';
import { createWebhookProtocol } from '../../modules/integrations/core/webhook';
import { statement as s, type AlertEnvironment } from './types';
export async function testFingerprint(env:AlertEnvironment,project:string,id:string,channel:string){
 const d=await findDestination(env,project,id,channel);
 return destinationFingerprint(env,d);
}
export async function requireReviewedTest(env:AlertEnvironment,project:string,id:string,channel:string){
 const hash=await testFingerprint(env,project,id,channel);
 if(!await s(env.DB,`SELECT 1 FROM alert_destination_tests WHERE project=? AND destination=? AND fingerprint=? AND state='passing' AND reviewed_at IS NOT NULL`,project,id,hash).first())throw new Error('Test this destination and review its passing result before enabling');
 return s(env.DB,`INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM alert_destination_tests WHERE project=? AND destination=? AND fingerprint=? AND state='passing' AND reviewed_at IS NOT NULL) THEN 1 ELSE 0 END`,project,id,hash);
}
export async function testDestination(env:AlertEnvironment,session:NativeAuthority,project:string,id:string){
 const saved=await s(env.DB,'SELECT 1 FROM alert_destinations WHERE project=? AND id=?',project,id).first();
 const {destinations}=await import('./destinations.server');const channel=saved?'mail':await savedSlack(env,project,id)?'webhook':destinations(env).find(d=>d.id===id&&d.project===project)?.channel;
 if(!channel)throw new Error('Destination not found');
 const destination=await findDestination(env,project,id,channel),fingerprint=await testFingerprint(env,project,id,channel),time=Date.now(),testId=crypto.randomUUID();
 // Claiming the operational send slot is not a second completed owner change.
 const claim=await ownerBatch(env.DB,session,[s(env.DB,`INSERT INTO alert_destination_tests VALUES(?,?,?,?,'running','Test send started',?,NULL)
 ON CONFLICT(project,destination) DO UPDATE SET fingerprint=excluded.fingerprint,id=excluded.id,state='running',detail=excluded.detail,tested_at=excluded.tested_at,reviewed_at=NULL WHERE alert_destination_tests.tested_at<=? RETURNING id`,project,id,fingerprint,testId,time,time-60000)]);
 if(!claim[0].results.length)throw new Error('Wait one minute before testing this destination again');
 const attribution=session.kind==='agent'?{preparedBy:session.context.actor,approvers:session.context.approvers}:null;
 const label=attribution?` Prepared by ${attribution.preparedBy.label}.${attribution.approvers.length?' Approved by '+attribution.approvers.map(p=>p.name).join(', ')+'.':''}`:'';
 let state='failing',detail='Test failed before a response; check the destination before testing again.';
 try {
  if(channel==='mail'){
   await ownerBatch(env.DB,session,[]);
   const result=await sender(env).send({deliveryId:testId,from:env.MAIL_FROM!,to:[destination.recipient!],subject:'Spool TEST — destination check',text:`This is a TEST of your Spool destination for project ${project}. No issue, alert, assignment or usage counter was changed.${label}`});
   state=['accepted','development'].includes(result.status)?'passing':'failing';
   detail=result.status==='development'?'Local development suppresses mail; this passing local test sent no email.':result.status==='accepted'?'Provider accepted this TEST. Check the mailbox; acceptance does not confirm recipient receipt.':`TEST result: ${result.status}. Recipient receipt is unconfirmed.`;
  }else if(destination.kind==='slack'){
   await ownerBatch(env.DB,session,[]);
   const result=await sendSlack(env,destination,{test:true,...attribution??{}},Date.now);state=result.outcome.kind==='accepted'?'passing':'failing';detail=result.messageId?`Slack posted TEST · message identifier ${result.messageId}. Provider acknowledgment; recipient receipt unconfirmed.`:`Slack TEST failed: ${result.outcome.code}. Recipient receipt unconfirmed.`;
  }else{
   if(!env.INTEGRATION_EGRESS)throw new Error('egress_unconfigured');
   const protocol=createWebhookProtocol({resolveDestination:async()=>destination.url!,signingKey:async()=>keyBytes(destination.key)});
   const wire=await protocol.prepare({id:testId,tenant:'spool.'+project,destinationId:id,event:'spool.destination.test',protocol:'webhook',body:JSON.stringify({test:true,message:'This is a Spool TEST. No issue or alert was created.',...attribution??{}})},time);
   await ownerBatch(env.DB,session,[]);
   const response=await env.INTEGRATION_EGRESS.send(wire);state=response.status>=200&&response.status<300?'passing':'failing';
   detail=`TEST signature header sent; receiver answered HTTP ${response.status}. Receiver signature verification is not established.`;
  }
 }catch(error){if(destination.kind==='slack')detail=(error as Error).message==='egress_unconfigured'?'Slack TEST refused: egress_unconfigured.':'Slack TEST failed: timeout or transport failure; recipient receipt unconfirmed.';/* Persist the observed failure; never retry an uncertain effect automatically. */}
 await ownerBatch(env.DB,session,[s(env.DB,'UPDATE alert_destination_tests SET state=?,detail=? WHERE project=? AND destination=? AND id=?',state,detail,project,id,testId),auditCommit(env.DB,'changes()>0')]);
 return {id:testId,state,message:detail};
}
export async function reviewTest(env:AlertEnvironment,session:NativeAuthority,project:string,id:string,testId:string){
 const result=await ownerBatch(env.DB,session,[s(env.DB,`UPDATE alert_destination_tests SET reviewed_at=? WHERE project=? AND destination=? AND id=? AND state='passing' RETURNING id`,Date.now(),project,id,testId),auditCommit(env.DB,'changes()>0')]);
 if(!result[0].results.length)throw new Error('A current passing test is required');return {reviewed:true};
}
