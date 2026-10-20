import { parseAddress } from '../../modules/mail/src/core/validation.mjs';
import { ownerBatch, type OwnerSession } from '../owner-authority';
import { auditCommit } from '../audit/context';
import { scrub } from '../privacy';
import { sender } from './mail';
import { findDestination } from './destinations.server';
import { statement as s, type AlertEnvironment } from './types';

export async function saveDestination(env:AlertEnvironment,session:OwnerSession,project:string,previous:string|undefined,input:any) {
 if(!input||Object.keys(input).sort().join()!=='label,recipient'||typeof input.label!=='string'||!input.label.trim()||input.label.length>100||scrub(input.label)!==input.label||/[\x00-\x1f\x7f]/.test(input.label)||typeof input.recipient!=='string')throw new Error('Use a destination name and one email address');
 const recipient=parseAddress(input.recipient.trim()).email,id=`ui-${crypto.randomUUID()}`,time=Date.now();
 // A label edit keeps recipient identity, enabled rules and queued work intact.
 if(previous){
  const current=await s(env.DB,'SELECT recipient FROM alert_destinations WHERE project=? AND id=?',project,previous).first<{recipient:string}>();
  if(current?.recipient===recipient){
   const changed=await ownerBatch(env.DB,session,[s(env.DB,'UPDATE alert_destinations SET label=? WHERE project=? AND id=? AND recipient=? RETURNING id',input.label.trim(),project,previous,recipient),auditCommit(env.DB,'changes()>0')]);
   if(!changed[0].results.length)throw new Error('Destination changed in another page; refresh and try again');
   return {id:previous};
  }
 }
 // A changed address gets a new immutable identity. Old queued work cannot be
 // redirected to a new recipient or continue using the previous recipient.
 const result=await ownerBatch(env.DB,session,[
  ...(previous?[s(env.DB,'DELETE FROM alert_destinations WHERE project=? AND id=? RETURNING id',project,previous)]:[]),
  s(env.DB,`INSERT INTO alert_destinations(id,project,label,recipient,created) SELECT ?,?,?,?,? ${previous?'WHERE changes()=1':''} RETURNING id`,id,project,input.label.trim(),recipient,time),
  ...(previous?[
   s(env.DB,`UPDATE alert_intents SET state='cancelled',code='rule_revised' WHERE project=? AND destination=? AND expanded=0 AND code IS NOT 'retention_removed' AND EXISTS(SELECT 1 FROM alert_destinations WHERE id=?)`,project,previous,id),
   s(env.DB,`UPDATE alert_mail_jobs SET state='blocked',code='rule_revised' WHERE state='queued' AND id IN(SELECT id FROM alert_intents WHERE project=? AND destination=?) AND EXISTS(SELECT 1 FROM alert_destinations WHERE id=?)`,project,previous,id),
   s(env.DB,`UPDATE alert_rules SET destination=?,enabled=0,revision=revision+1,updated=? WHERE project=? AND destination=? AND EXISTS(SELECT 1 FROM alert_destinations WHERE id=?)`,id,time,project,previous,id),
   s(env.DB,`UPDATE alert_cursors SET revision=(SELECT revision FROM alert_rules WHERE id=rule_id),next_start=(SELECT CAST((?+window_ms-1)/window_ms AS INTEGER)*window_ms FROM alert_rules WHERE id=rule_id) WHERE project=? AND rule_id IN(SELECT id FROM alert_rules WHERE project=? AND destination=?)`,time,project,project,id),
  ]:[]),
  auditCommit(env.DB,'EXISTS(SELECT 1 FROM alert_destinations WHERE project=? AND id=?)',project,id),
 ]);
 if(!result[previous?1:0].results.length)throw new Error('Destination changed in another page; refresh and try again');
 return {id};
}

