import { destinations, findDestination } from './destinations.server';
import { holdAlerts, expireSnoozes } from './snoozes';
import { webhookService } from './webhook.server';
export { webhookService } from './webhook.server';
import { dispatchBoundMail, dispatchMail, expandMail, recoverMail } from './mail';
import { synchronizeHistory } from './history';
import { alertBody } from '../stored-text';
import type { ScheduledDue } from '../scheduled/due';
import { namespace, statement as s } from './types';
import type { AlertEnvironment, ExpansionCheckpoint, ImmediateAlertWork, Intent, MailExpansionIntent, MailIntent, PendingAlertIntent, ScheduledAlertWork } from './types';
// Expansion is idempotent: mail jobs and webhook deliveries are keyed by the intent id, and every send first takes a
// durable claim, so the scheduled run and the dispatch after ingest can both reach the same intent without a second send.
async function expandIntent(env:AlertEnvironment,service:()=>ReturnType<typeof webhookService>,intent:Intent,time:number) {
 try {
  if(!await s(env.DB,"SELECT 1 FROM alert_intents WHERE id=? AND state IN ('pending','blocked')",intent.id).first())return null;
  // An intent routed before a scrubber change is delivered with today's scrub.
  const body=alertBody(intent.body)!;
  if(body!==intent.body){await s(env.DB,'UPDATE alert_intents SET body=? WHERE id=? AND body=?',body,intent.id,intent.body).run();intent.body=body;}
  if(intent.channel==='webhook'&&(await findDestination(env,intent.project,intent.destination,'webhook')).kind==='slack')await s(env.DB,'INSERT INTO slack_delivery_meta(project,delivery_id,message_id) VALUES(?,?,NULL) ON CONFLICT(delivery_id) DO NOTHING',intent.project,intent.id).run();
  if(intent.channel==='mail')return await expandMail(env,intent,time)?'queued':null;
  await service().enqueue({id:intent.id,tenant:namespace(intent.project),destinationId:intent.destination,event:intent.event,protocol:'webhook',body:intent.body});
  await s(env.DB,`UPDATE alert_intents SET expanded=1,state='queued',code=NULL WHERE id=? AND state IN ('pending','blocked')`,intent.id).run();
  return 'queued';
 } catch(error) {
  const reason=(error as Error).message==='egress_unconfigured'?'egress_unconfigured':'configuration_or_authority';
  const result=await s(env.DB,`UPDATE alert_intents SET state='blocked',code=? WHERE id=? AND expanded=0 AND state IN ('pending','blocked') AND (state,code) IS NOT ('blocked',?)`,reason,intent.id,reason).run();
  return result.meta.changes?'blocked':null;
 }
}

function environmentMailDestinations(env:AlertEnvironment) {
 try{return destinations(env).filter(row=>row.channel==='mail');}catch{return [];}
}

async function pendingExpansion(db:D1Database,project:string) {
 // Seek on either side of the cursor. Sorting the selected IDs keeps work bounded by the page size.
 return (await s(db,`WITH cursor(last) AS MATERIALIZED (
   SELECT COALESCE((SELECT last_intent FROM alert_expansion_cursors WHERE project=?1),'')
  ), after AS MATERIALIZED (
   SELECT id FROM alert_intents INDEXED BY alert_intents_unexpanded
   WHERE project=?1 AND expanded=0 AND state IN ('pending','blocked') AND id>(SELECT last FROM cursor) ORDER BY id LIMIT 30
  ), around AS (
   SELECT id FROM alert_intents INDEXED BY alert_intents_unexpanded
   WHERE project=?1 AND expanded=0 AND state IN ('pending','blocked') AND id<=(SELECT last FROM cursor) ORDER BY id LIMIT (30-(SELECT COUNT(*) FROM after))
  ), selected AS (
   SELECT 0 segment,id FROM after UNION ALL SELECT 1,id FROM around
  ) SELECT i.*, CASE WHEN i.channel='mail' AND i.state='blocked' AND i.code='configuration_or_authority' THEN
   NOT EXISTS(SELECT 1 FROM alert_target_destinations t WHERE t.project=i.project AND t.id=i.destination)
   AND NOT EXISTS(SELECT 1 FROM alert_destinations d WHERE d.project=i.project AND d.id=i.destination)
  ELSE 0 END AS unresolved_mail
  FROM selected JOIN alert_intents i ON i.id=selected.id ORDER BY selected.segment,i.id`,project).all<PendingAlertIntent>()).results;
}

function currentBody(intent:Intent) {
 try{return alertBody(intent.body)===intent.body;}catch{return true;}
}
/** Sends the new-issue and regression alerts one admitted event routed now, instead of at the next scheduled run. */
export async function dispatchAdmitted(env:AlertEnvironment,alertId:string,work?:ImmediateAlertWork) {
 const now=()=>Date.now();
 const intents=(await s(env.DB,`SELECT * FROM alert_intents WHERE alert_id=? AND event IN ('spool.issue.new','spool.issue.regressed') AND expanded=0 AND state='pending' ORDER BY id`,alertId).all<Intent>()).results;
 if(!intents.length)return;
 await holdAlerts(env,now());
 if(work&&intents.every((intent):intent is MailIntent=>intent.channel==='mail')) {
  await work.expandAdmittedMail(intents);
  // The capture, its audit and planning calls, and expansion also count
  // toward the loopback invocation limit of this HTTP request.
  await dispatchBoundMail(env,now(),work,23,intents.map(intent=>intent.id));
  await synchronizeHistory(env,now());
  return;
 }
 let webhooks:ReturnType<typeof webhookService>|undefined;
 const service=()=>webhooks??=webhookService(env,intents[0].project,now);
 for(const intent of intents)await expandIntent(env,service,intent,now());
 for(const intent of intents.filter(row=>row.channel==='webhook'))await service().dispatch(intent.id);
 const mail=intents.filter(row=>row.channel==='mail').map(row=>row.id);
 if(mail.length)await dispatchMail(env,now(),mail);
 await synchronizeHistory(env,now());
}

export async function expandAdmittedMail(env:AlertEnvironment,intents:MailIntent[]) {
 const service=()=>webhookService(env,intents[0].project,Date.now);
 for(const intent of intents)await expandIntent(env,service,intent,Date.now());
}

const advanceProject=(db:D1Database,project:string)=>s(db,"INSERT INTO alert_scheduler(id,last_project) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET last_project=excluded.last_project",project);

export async function expandProjectAlerts(env:AlertEnvironment,project:string,intents:PendingAlertIntent[],now:()=>number,service:()=>ReturnType<typeof webhookService>,checkpoint?:ExpansionCheckpoint) {
 let configuredMail:ReturnType<typeof environmentMailDestinations>|undefined;
 let lastIntent=checkpoint?.previous,changed=false,mail=false,webhook=false,completed=false;
 try {
  for(const intent of intents) {
   // Missing destinations are checked at selection on every visit. A newly configured
   // destination or an older body needing scrubbing still takes the full live path.
   const unchanged=intent.unresolved_mail && !(configuredMail??=environmentMailDestinations(env)).some(d=>d.project===project&&d.id===intent.destination) && currentBody(intent);
   if(!unchanged){
    const result=await expandIntent(env,service,intent,now());
    if(result)changed=true;
    if(result==='queued'&&intent.channel==='mail')mail=true;
    if(result==='queued'&&intent.channel==='webhook')webhook=true;
   }
   lastIntent=intent.id;
  }
  completed=true;
 } finally {
  // A successful intermediate batch leaves the cursor to the final batch.
  // An interrupted batch records the last intent processed across all batches.
  if(lastIntent!==undefined&&(!completed||!checkpoint||checkpoint.final)){
   const cursor=s(env.DB,'INSERT INTO alert_expansion_cursors(project,last_intent) VALUES(?,?) ON CONFLICT(project) DO UPDATE SET last_intent=excluded.last_intent',project,lastIntent);
   if(completed&&checkpoint?.advanceProject)await env.DB.batch([cursor,advanceProject(env.DB,project)]);
   else await cursor.run();
  }
 }
 return {changed,mail,webhook};
}

export async function runAlerts(env:AlertEnvironment,scheduledTime:number,due:ScheduledDue,work:ScheduledAlertWork) {
 const started=Date.now(),now=()=>Math.max(Date.now(),scheduledTime+Date.now()-started);
 if(due.recoverMail)await recoverMail(env,now());
 if(due.snoozes)await expireSnoozes(env,scheduledTime);
 if(due.providerEvents)await (await import('./provider-events.server')).projectProviderEvents(env);
 if(due.importedRules)await (await import('./import-waiting')).activateImportedAlerts(env.DB,scheduledTime);
 const spikesChanged=due.spikes&&await work.spikes(scheduledTime,due.last_spike_rule);
 if(due.transactions)await s(env.DB,'DELETE FROM sentry_transactions WHERE received<?',Math.floor(scheduledTime/60000)*60000-30*86400000).run();
 // A newly activated metric has no state and is evaluated in this minute.
 const metricsChanged=(due.metrics||due.importedRules)&&await (await import('./metrics')).evaluateMetrics(env,scheduledTime);
 const newAlerts=spikesChanged||metricsChanged;
 if(due.hold||newAlerts&&due.holdsConfigured)await holdAlerts(env,scheduledTime);
 const dispatch=due.expand||due.webhooks||newAlerts;
 const projects=dispatch?(await s(env.DB,`SELECT project FROM (SELECT DISTINCT project FROM alert_intents INDEXED BY alert_intents_unexpanded WHERE expanded=0 AND state IN ('pending','blocked') UNION SELECT DISTINCT project FROM alert_mail_jobs INDEXED BY alert_mail_jobs_active WHERE state IN ('queued','sending') UNION SELECT DISTINCT substr(namespace,7) project FROM integration_deliveries WHERE state IN ('queued','sending')) ORDER BY CASE WHEN project>? THEN 0 ELSE 1 END,project LIMIT 20`,due.last_project).all<{project:string}>()).results:[];
 let expandedMail=false;
 let deliveryChanged=false;
 let invocations=Number(!!due.spikes);
 let remainingProjects=projects.length;
 for(const {project} of projects) {
  remainingProjects--;
  let webhook:ReturnType<typeof webhookService>|undefined;
  const service=()=>webhook??=webhookService(env,project,now);
  if(due.webhooks&&(await service().recoverExpired()).length)deliveryChanged=true;
  const intents=await pendingExpansion(env.DB,project);
  let expandedWebhook=false,projectAdvanced=false;
  if(intents.length && intents.every((intent): intent is MailExpansionIntent => intent.channel==='mail')) {
   // Preserve room for every later project and at least one delivery call.
   // A few recipient expansions in one invocation can exhaust a Free tick.
   const available=30-invocations-remainingProjects;
   const groups=Math.min(available,Math.ceil(intents.length/2));
   const size=Math.ceil(intents.length/groups);
   for(let offset=0;offset<intents.length;offset+=size){
    const final=offset+size>=intents.length;
    const checkpoint={final,previous:intents[offset-1]?.id,advanceProject:final&&!due.webhooks};
    const result=await work.expandMail(project,intents.slice(offset,offset+size),scheduledTime,started,checkpoint);
    invocations++;
    projectAdvanced=checkpoint.advanceProject;
    expandedMail ||= result.mail;
    deliveryChanged ||= result.changed;
   }
  } else {
   const result=await expandProjectAlerts(env,project,intents,now,service);
   expandedMail ||= result.mail;
   deliveryChanged ||= result.changed;
   expandedWebhook=result.webhook;
  }
  const webhooks=due.webhooks||expandedWebhook?(await s(env.DB,`SELECT d.id FROM integration_deliveries d JOIN alert_intents i ON i.id=d.id AND d.namespace='spool.'||i.project WHERE i.project=? AND i.state<>'snoozed' AND d.state='queued' AND d.next_at<=? AND d.attempts<d.max_attempts ORDER BY d.next_at,d.id LIMIT 30`,project,now()).all<{id:string}>()).results:[];
  for(const delivery of webhooks)await service().dispatch(delivery.id);
  if(webhooks.length)deliveryChanged=true;
  if(!projectAdvanced)await advanceProject(env.DB,project).run();
 }
 if(due.mail||expandedMail)await dispatchBoundMail(env,now(),work,31-invocations);
 const changed=!!(due.history||due.recoverMail||due.providerEvents||due.hold||due.mail||deliveryChanged||newAlerts);
 if(changed)await synchronizeHistory(env,now(),true);
 return changed;
}

