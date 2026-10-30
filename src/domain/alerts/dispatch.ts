import { findDestination } from './destinations.server';
import { holdAlerts, expireSnoozes } from './snoozes';
import { queueDigests } from './digests';
import { scheduledMail } from './scheduled-mail';
import { projectProviderEvents } from './provider-events.server';
import { webhookService } from './webhook.server';
export { webhookService } from './webhook.server';
import { dispatchMail, expandMail, recoverMail } from './mail';
import { evaluateSpikes } from './spikes';
import { alertBody } from '../stored-text';
import { namespace, statement as s } from './types';
import type { AlertEnvironment, Intent } from './types';
export async function synchronizeHistory(env:AlertEnvironment,time:number) {
 await env.DB.batch([
  s(env.DB,`UPDATE alert_history SET state=CASE WHEN EXISTS(SELECT 1 FROM alert_suppressed x JOIN alert_intents i ON i.id=x.delivery_id WHERE x.delivery_id=alert_history.id AND x.released_at IS NULL AND i.state='snoozed') THEN 'snoozed' ELSE COALESCE((SELECT CASE WHEN d.state='queued' AND d.attempts>0 THEN 'retrying' WHEN d.state='rejected' AND json_extract((SELECT outcome FROM integration_attempts WHERE namespace=d.namespace AND delivery_id=d.id ORDER BY number DESC LIMIT 1),'$.code')='preflight_failed' THEN 'blocked' ELSE d.state END FROM integration_deliveries d WHERE d.namespace='spool.'||alert_history.project AND d.id=alert_history.id),(SELECT CASE WHEN state='queued' AND attempts>0 THEN 'retrying' ELSE state END FROM alert_mail_jobs WHERE id=alert_history.id),(SELECT state FROM alert_intents WHERE id=alert_history.id),state) END,
   attempts=COALESCE((SELECT attempts FROM integration_deliveries WHERE namespace='spool.'||alert_history.project AND id=alert_history.id),(SELECT attempts FROM alert_mail_jobs WHERE id=alert_history.id),attempts),
   code=CASE WHEN channel='webhook' AND (code LIKE 'http_%_signature_sent' OR code LIKE 'slack_%') THEN code ELSE COALESCE((SELECT json_extract(outcome,'$.code') FROM integration_resolutions WHERE namespace='spool.'||alert_history.project AND delivery_id=alert_history.id ORDER BY at DESC LIMIT 1),(SELECT json_extract(outcome,'$.code') FROM integration_attempts WHERE namespace='spool.'||alert_history.project AND delivery_id=alert_history.id ORDER BY number DESC LIMIT 1),(SELECT code FROM alert_mail_jobs WHERE id=alert_history.id),(SELECT code FROM alert_intents WHERE id=alert_history.id)) END,updated=? WHERE historical=0 AND code IS NOT 'retention_removed'`,time),
 ]);
}
// Expansion is idempotent: mail jobs and webhook deliveries are keyed by the intent id, and every send first takes a
// durable claim, so the scheduled run and the dispatch after ingest can both reach the same intent without a second send.
async function expandIntent(env:AlertEnvironment,service:ReturnType<typeof webhookService>,intent:Intent,time:number) {
 try {
  if(!await s(env.DB,"SELECT 1 FROM alert_intents WHERE id=? AND state IN ('pending','blocked')",intent.id).first())return;
  // An intent routed before a scrubber change is delivered with today's scrub.
  const body=alertBody(intent.body)!;
  if(body!==intent.body){await s(env.DB,'UPDATE alert_intents SET body=? WHERE id=? AND body=?',body,intent.id,intent.body).run();intent.body=body;}
  if(intent.channel==='webhook'&&(await findDestination(env,intent.project,intent.destination,'webhook')).kind==='slack')await s(env.DB,'INSERT INTO slack_delivery_meta(project,delivery_id,message_id) VALUES(?,?,NULL) ON CONFLICT(delivery_id) DO NOTHING',intent.project,intent.id).run();
  if(intent.channel==='webhook')await service.enqueue({id:intent.id,tenant:namespace(intent.project),destinationId:intent.destination,event:intent.event,protocol:'webhook',body:intent.body});
  else await expandMail(env,intent,time);
  await s(env.DB,`UPDATE alert_intents SET expanded=1,state='queued',code=NULL WHERE id=? AND state IN ('pending','blocked')`,intent.id).run();
 } catch(error) {
  const personal=['personal_opt_out','personal_recipient_unavailable','personal_already_routed'].includes((error as Error).message);
  const reason=personal?(error as Error).message:(error as Error).message==='egress_unconfigured'?'egress_unconfigured':'configuration_or_authority';
  await s(env.DB,`UPDATE alert_intents SET state=?,code=? WHERE id=? AND expanded=0 AND state IN ('pending','blocked')`,personal?'cancelled':'blocked',reason,intent.id).run();
 }
}
/** Sends the new-issue and regression alerts one admitted event routed now, instead of at the next scheduled run. */
export async function dispatchAdmitted(env:AlertEnvironment,alertId:string) {
 const now=()=>Date.now();
 const intents=(await s(env.DB,`SELECT * FROM alert_intents WHERE alert_id=? AND event IN ('spool.issue.new','spool.issue.regressed') AND expanded=0 AND state='pending' ORDER BY id`,alertId).all<Intent>()).results;
 if(!intents.length)return;
 await holdAlerts(env,now());
 const service=webhookService(env,intents[0].project,now);
 for(const intent of intents)await expandIntent(env,service,intent,now());
 for(const intent of intents.filter(row=>row.channel==='webhook'))await service.dispatch(intent.id);
 const mail=intents.filter(row=>row.channel==='mail').map(row=>row.id);
 if(mail.length)await dispatchMail(env,now(),mail);
 await synchronizeHistory(env,now());
}

export async function runAlerts(env:AlertEnvironment,scheduledTime:number) {
 if(!Number.isSafeInteger(scheduledTime)||scheduledTime<0)throw new Error('Invalid schedule time');
 const started=Date.now(),now=()=>Math.max(Date.now(),scheduledTime+Date.now()-started);
 // Every tick leaves a trace, so a cron that runs on an idle installation is told apart from one that never runs.
 await s(env.DB,'UPDATE alert_scheduler SET last_run=? WHERE id=1',started).run();
 await recoverMail(env,now());
 await expireSnoozes(env,scheduledTime);
 await holdAlerts(env,scheduledTime);
 await projectProviderEvents(env);
 await evaluateSpikes(env,scheduledTime);
 await holdAlerts(env,scheduledTime);
 const cursor=await s(env.DB,'SELECT last_project FROM alert_scheduler WHERE id=1').first<{last_project:string}>();
 const projects=(await s(env.DB,`SELECT project FROM (SELECT DISTINCT project FROM alert_intents WHERE expanded=0 AND state IN ('pending','blocked') UNION SELECT DISTINCT project FROM alert_mail_jobs WHERE state IN ('queued','sending') UNION SELECT DISTINCT substr(namespace,7) project FROM integration_deliveries WHERE state IN ('queued','sending')) ORDER BY CASE WHEN project>? THEN 0 ELSE 1 END,project LIMIT 20`,cursor?.last_project??'').all<{project:string}>()).results;
 for(const {project} of projects) {
  const service=webhookService(env,project,now);await service.recoverExpired();
  const expansion=await s(env.DB,'SELECT last_intent FROM alert_expansion_cursors WHERE project=?',project).first<{last_intent:string}>();
  const intents=(await s(env.DB,`SELECT * FROM alert_intents WHERE project=? AND expanded=0 AND state IN ('pending','blocked') ORDER BY CASE WHEN id>? THEN 0 ELSE 1 END,id LIMIT 30`,project,expansion?.last_intent??'').all<Intent>()).results;
  for(const intent of intents) {
   await expandIntent(env,service,intent,now());
   // Failed configuration still advances traversal, so another destination gets a turn.
   await s(env.DB,'INSERT INTO alert_expansion_cursors(project,last_intent) VALUES(?,?) ON CONFLICT(project) DO UPDATE SET last_intent=excluded.last_intent',project,intent.id).run();
  }
  const due=(await s(env.DB,`SELECT d.id FROM integration_deliveries d JOIN alert_intents i ON i.id=d.id AND d.namespace='spool.'||i.project WHERE i.project=? AND i.state<>'snoozed' AND d.state='queued' AND d.next_at<=? AND d.attempts<d.max_attempts ORDER BY d.next_at,d.id LIMIT 30`,project,now()).all<{id:string}>()).results;
  for(const delivery of due)await service.dispatch(delivery.id);
  await s(env.DB,"INSERT INTO alert_scheduler(id,last_project) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET last_project=excluded.last_project",project).run();
 }
 await dispatchMail(env,now());
 await synchronizeHistory(env,now());
}

