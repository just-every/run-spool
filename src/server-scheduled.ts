import { scheduledDue, scheduledFollowUp } from './domain/scheduled/due';
import { runtimeBindings, type Bindings } from './auth/bindings';
import type { AlertEnvironment } from './domain/alerts/types';

const alertStages = [
 'recoverMail', 'snoozes', 'providerEvents', 'importedRules', 'spikes', 'transactions',
 'metrics', 'hold', 'expand', 'webhooks', 'mail', 'history',
] as const;

export async function scheduled(event: ScheduledController, bindings: Bindings & AlertEnvironment, _execution: ExecutionContext) {
 const env = runtimeBindings(bindings) as Bindings & AlertEnvironment;
 const time = event.scheduledTime;
 const due = await scheduledDue(env.DB, time);
 let alertsChanged = false;
 // Accepted erasure jobs continue here after the client disconnects, even when
 // an earlier scheduled step fails.
 try {
  try {
   if (due.deployments) await (await import('./domain/deployments/timeouts')).deploymentTimeouts(env,time);
   if (alertStages.some(stage => due[stage])) {
    alertsChanged = true; // A failed dispatcher may already have committed work.
    alertsChanged = await (await import('./domain/alerts/dispatch')).runAlerts(env,time,due);
   }
   if (due.replay) await (await import('./modules/agent-door/erasure')).expireReplayCalls({options:{db:env.DB},now:()=>time});
  } finally {
   // A broken dispatcher must not prevent independent operator follow-up.
   if (due.retention) await (await import('./domain/retention-schedule')).scheduledRetention(env.DB,time,env);
   if (due.suppression) await (await import('./domain/suppression/schedule')).scheduleSuppression(env,time);
   const followUp = due.deployments || alertsChanged || due.retention || due.suppression
    ? await scheduledFollowUp(env.DB,time) : due;
   if (followUp.followUp || followUp.close) {
    const {scanFollowUp, closeFollowUp} = await import('./domain/follow-up/scan');
    if (followUp.followUp) await scanFollowUp(env,time);
    else await closeFollowUp(env,time);
   }
   if (due.digests) await (await import('./domain/alerts/digests')).queueDigests(env,time);
   if (due.scheduledMail || due.digests || due.snoozes) await (await import('./domain/alerts/scheduled-mail')).scheduledMail(env,time);
   const queueFollowUp = followUp.notices || followUp.followUp;
   if (due.sendNotices || queueFollowUp) {
    const {queueNotices, dispatchNotices} = await import('./domain/follow-up/notices');
    if (queueFollowUp) await queueNotices(env,time);
    await dispatchNotices(env,time);
   }
  }
 } finally {
  try {
   if (due.browserArchives) await (await import('./domain/archive-pages')).expireBrowserArchives(env.DB,time);
  } finally {
   if (due.erasure) {
    const [{spoolAgentDoor}, {continueErasures}] = await Promise.all([
     import('./domain/agent-door/index.server'), import('./domain/erasure/service'),
    ]);
    await continueErasures(env.DB, Date.now() + 20_000,env.SESSION_SECRET,(id,principal,key)=>spoolAgentDoor(env).invoke('spool.privacy.continue',{id,idempotency_key:key},principal));
   }
  }
 }
}
