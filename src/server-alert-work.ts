import { WorkerEntrypoint } from 'cloudflare:workers';
import { runtimeBindings, type Bindings } from './auth/bindings';
import type { AlertEnvironment, MailExpansionIntent, QueuedAlertMail, ScheduledAlertWork } from './domain/alerts/types';

declare global {
 namespace Cloudflare {
  interface GlobalProps {mainModule: typeof import('./server');}
 }
}

type Environment = Bindings & AlertEnvironment;

async function spikes(env: Environment, time: number, lastRule: string) {
 const {evaluateSpikes} = await import('./domain/alerts/spikes');
 return evaluateSpikes(env,time,lastRule);
}
async function expandMail(env: Environment, project: string, intents: MailExpansionIntent[], time: number, started: number) {
 const {expandProjectAlerts,webhookService}=await import('./domain/alerts/dispatch');
 const now=()=>Math.max(Date.now(),time+Date.now()-started);
 return expandProjectAlerts(env,project,intents,now,()=>webhookService(env,project,now));
}
async function deliverMail(env: Environment, jobs: QueuedAlertMail[], time: number, started: number) {
 const {dispatchMailJob} = await import('./domain/alerts/mail');
 for(const job of jobs)await dispatchMailJob(env,job,()=>time+Date.now()-started);
}

// The demo loader already runs scheduled work inside its own Durable Object
// and its database is scoped to that invocation.
export function demoAlertWork(env: Environment): ScheduledAlertWork {
 return {
  spikes: (time,lastRule) => spikes(env,time,lastRule),
  expandMail: (project,intents,time,started) => expandMail(env,project,intents,time,started),
  deliverMail: (jobs,time,started) => deliverMail(env,jobs,time,started),
 };
}

// Private loopback entrypoints give spike evaluation and individual mail
// attempts separate CPU budgets. The caller awaits each attempt in order.
export class SpoolAlertWork extends WorkerEntrypoint<Environment> implements ScheduledAlertWork {
 spikes(time: number, lastRule: string) {
  return spikes(runtimeBindings(this.env),time,lastRule);
 }
 expandMail(project: string, intents: MailExpansionIntent[], time: number, started: number) {
  return expandMail(runtimeBindings(this.env),project,intents,time,started);
 }
 deliverMail(jobs: QueuedAlertMail[], time: number, started: number) {
  return deliverMail(runtimeBindings(this.env),jobs,time,started);
 }
}
