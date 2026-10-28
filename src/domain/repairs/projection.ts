import { number, text } from '../agent-projection';
import { issueRepairs, REPAIR_TRUST } from './view';

// The packet carries the newest repairs so the next attempt starts informed.
// Leaves are selected and scrubbed again; links and notes stay untrusted data.
export const PACKET_REPAIR_LIMIT = 3;
const NO_REPAIR = { state: 'inconclusive', reason: 'No independently measured workflow exposure or postdeploy proof' };
const event = (row: any) => ({ id: text(row.id), release: text(row.release), sequence: number(row.sequence), received: number(row.received) });
function repair(row: any) {
 const o = row.observation, e = o.evidence;
 return {
  id: text(row.id), recordedBy: text(row.recordedBy), trust: REPAIR_TRUST, revision: number(row.revision), link: text(row.link, 2048), note: text(row.note, 1000), created: number(row.created),
  snapshot: { issueRevision: number(row.snapshot.issueRevision), releaseSequence: number(row.snapshot.releaseSequence), events: row.snapshot.events.map((item: any) => ({ id: text(item.id), state: text(item.state) })) },
  facts: { proposed: number(row.facts.proposed), approved: number(row.facts.approved), merged: number(row.facts.merged),
   deployed: row.facts.deployed && { release: text(row.facts.deployed.release), sequence: number(row.facts.deployed.sequence), at: number(row.facts.deployed.at) },
   exercised: row.facts.exercised && { release: text(row.facts.exercised.release), at: number(row.facts.exercised.at), note: text(row.facts.exercised.note, 1000) } },
  checks: row.checks.map((check: any) => ({ name: text(check.name, 80), outcome: text(check.outcome), note: text(check.note, 300), recorded: number(check.recorded) })),
  observation: { verdict: text(o.verdict), reasons: o.reasons.map((item: any) => ({ code: text(item.code), reason: text(item.reason, 400) })), limits: text(o.limits, 400),
   evidence: { release: e.release && { name: text(e.release.name), sequence: number(e.release.sequence), build: text(e.release.build), registered: number(e.release.registered) },
    window: e.window && { start: number(e.window.start), end: number(e.window.end) },
    recurrence: { count: number(e.recurrence.count), events: e.recurrence.events.map(event) },
    olderReleaseEvents: { count: number(e.olderReleaseEvents.count), counted: false, events: e.olderReleaseEvents.events.map(event) },
    releaseEvents: number(e.releaseEvents), mapStored: e.mapStored === true, loss: e.loss.map((item: any) => ({ reason: text(item.reason), count: number(item.count) })) } },
 };
}

export async function packetRepairs(db: D1Database, project: string, issue: string) {
 const { available, repairs } = await issueRepairs(db, project, issue, PACKET_REPAIR_LIMIT);
 const latest = repairs[0];
 return {
  repairs: repairs.map(repair), available,
  verification: latest ? { state: latest.observation.verdict, reason: latest.observation.reasons.map(item => item.reason).join(' '), repair: text(latest.id), limits: latest.observation.limits } : NO_REPAIR,
 };
}
