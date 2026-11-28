import {scheduleSuppression} from './domain/suppression/schedule';
import { expireReplayCalls } from './modules/agent-door/index.ts';
import {scheduledRetention} from './domain/retention-schedule';
import { deploymentTimeouts } from './domain/deployments/timeouts';
import { runAlerts } from './domain/alerts/dispatch';
import { queueDigests } from './domain/alerts/digests';
import { scheduledMail } from './domain/alerts/scheduled-mail';
import { scanFollowUp, closeFollowUp } from './domain/follow-up/scan';
import { scheduledDue, scheduledFollowUp } from './domain/scheduled/due';
import { queueNotices, dispatchNotices } from './domain/follow-up/notices';
import { continueErasures } from './domain/erasure/service';
import { expireBrowserArchives } from './domain/archive-pages';
import { runtimeBindings, type Bindings } from './auth/bindings';
import type { AlertEnvironment } from './domain/alerts/types';

export async function scheduled(event: ScheduledController, bindings: Bindings & AlertEnvironment, _execution: ExecutionContext) {
 const env = runtimeBindings(bindings) as Bindings & AlertEnvironment;
 const time = event.scheduledTime;
 const due = await scheduledDue(env.DB, time);
 let alertsChanged = false;
 // Accepted erasure jobs continue here after the client disconnects, even when
 // an earlier scheduled step fails.
 try {
  try {
   if (due.deployments) await deploymentTimeouts(env,time);
   alertsChanged = true; // A failed dispatcher may already have committed work.
   alertsChanged = await runAlerts(env,time,due);
   if (due.replay) await expireReplayCalls({options:{db:env.DB},now:()=>time});
  } finally {
   // A broken dispatcher must not prevent independent operator follow-up.
   if (due.retention) await scheduledRetention(env.DB,time,env);
   if (due.suppression) await scheduleSuppression(env,time);
   const followUp = due.deployments || alertsChanged || due.retention || due.suppression
    ? await scheduledFollowUp(env.DB,time) : due;
   if (followUp.followUp) await scanFollowUp(env,time);
   else if (followUp.close) await closeFollowUp(env,time);
   if (due.digests) await queueDigests(env,time);
   if (due.scheduledMail || due.digests || due.snoozes) await scheduledMail(env,time);
   const queueFollowUp = followUp.notices || followUp.followUp;
   if (queueFollowUp) await queueNotices(env,time);
   if (due.sendNotices || queueFollowUp) await dispatchNotices(env,time);
  }
 } finally {
  try {
   if (due.browserArchives) await expireBrowserArchives(env.DB,time);
  } finally {
   if (due.erasure) {
    const { spoolAgentDoor } = await import('./domain/agent-door/index.server');
    await continueErasures(env.DB, Date.now() + 20_000,env.SESSION_SECRET,(id,principal,key)=>spoolAgentDoor(env).invoke('spool.privacy.continue',{id,idempotency_key:key},principal));
   }
  }
 }
}
