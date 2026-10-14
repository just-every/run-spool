import { correctionMembership, originalMembership } from '../operators/provenance';
import { LOSS_REASONS } from '../repairs/observation';
import { EXPOSURE_LOSS } from './report';

// Whether a deployed fix reached the users the failure affected, measured from
// stored events and exposure reports. A quiet feed is never success by itself:
// without enough exposed users, a pre-fix baseline and complete capture the
// verdict says inconclusive and names the missing denominator.
const query = (db: D1Database, sql: string, ...args: any[]) => db.prepare(sql).bind(...args);
// A verdict of "reached" needs the chance that the old failure rate would have
// produced no failure among the exposed users to fall below this.
const CHANCE_LIMIT = 0.05;
export const EXPOSURE_LIMITS = 'Exposure counts only clients whose SDK sends a random client identifier and flow reports. Users without them, failures lost in the client before transport, and failures grouped differently after a rebuild are not in these denominators.';
type Reason = { code: string; reason: string };
// The lowest pre-fix failure rate the baseline supports: the lower end of the
// exact (Clopper-Pearson) 95% interval for `failed` of `exposed`. A small
// baseline gives a low bound, so a few quiet users cannot prove a fix.
export function rateLowerBound(failed: number, exposed: number) {
 if (!failed) return 0;
 const logFactorial = [0];
 for (let n = 1; n <= exposed; n++) logFactorial[n] = logFactorial[n - 1] + Math.log(n);
 const atLeast = (p: number) => {
  let sum = 0;
  for (let i = failed; i <= exposed; i++) {
   const term = Math.exp(logFactorial[exposed] - logFactorial[i] - logFactorial[exposed - i] + i * Math.log(p) + (exposed - i) * Math.log1p(-p));
   sum += term;
   // Past the mode the terms only shrink; stop once they no longer count.
   if (i > exposed * p && term < sum * 1e-12) break;
  }
  return sum;
 };
 let low = 0, high = failed / exposed;
 for (let step = 0; step < 50; step++) { const middle = (low + high) / 2; if (atLeast(middle) < 0.025) low = middle; else high = middle; }
 return low;
}
export type Deployment = { release: string; sequence: number; environment: string; at: number };

export async function exposureProof(db: D1Database, project: string, issue: string, flow: string, deployed: Deployment) {
 const { sequence: seq, environment, at: start } = deployed;
 const membership = `(e.issue=? OR ${originalMembership('e', '?')} OR ${correctionMembership('e', '?')})`, member = [issue, issue, issue];
 const client = "json_extract(e.payload,'$.client')";
 const window = Math.floor(start / 60000) * 60000;
 const [affected, unattributed, sessions, exposed, baseline, recurred, loss] = await Promise.all([
  query(db, `SELECT DISTINCT ${client} client FROM events e WHERE e.project=? AND ${membership} AND e.historical=0 AND e.environment=? AND e.received<? AND ${client} IS NOT NULL`, project, ...member, environment, start).all<any>(),
  query(db, `SELECT COUNT(*) total FROM events e WHERE e.project=? AND ${membership} AND e.historical=0 AND e.environment=? AND e.received<? AND ${client} IS NULL`, project, ...member, environment, start).first<any>(),
  query(db, "SELECT COUNT(DISTINCT x.client) total,COUNT(DISTINCT CASE WHEN r.seq>=? THEN x.client END) fixed,COALESCE(SUM(CASE WHEN r.seq>=? THEN x.reports END),0) reports FROM exposures x JOIN releases r ON r.project=x.project AND r.name=x.release WHERE x.project=? AND x.environment=? AND x.flow='' AND x.last>=?", seq, seq, project, environment, start).first<any>(),
  query(db, 'SELECT x.client,MIN(x.capture) capture FROM exposures x JOIN releases r ON r.project=x.project AND r.name=x.release WHERE x.project=? AND x.environment=? AND x.flow=? AND r.seq>=? AND x.last>=? GROUP BY x.client', project, environment, flow, seq, start).all<any>(),
  query(db, 'SELECT DISTINCT x.client FROM exposures x JOIN releases r ON r.project=x.project AND r.name=x.release WHERE x.project=? AND x.environment=? AND x.flow=? AND r.seq<?', project, environment, flow, seq).all<any>(),
  query(db, `SELECT e.id,e.release,${client} client FROM events e WHERE e.project=? AND ${membership} AND e.historical=0 AND e.environment=? AND e.release_seq>=? AND e.received>=? ORDER BY e.received,e.id`, project, ...member, environment, seq, start).all<any>(),
  query(db, `SELECT reason,SUM(count) count FROM outcomes WHERE project=? AND window>=? AND reason IN (${[...LOSS_REASONS, ...EXPOSURE_LOSS].map(() => '?').join(',')}) GROUP BY reason ORDER BY reason`, project, window, ...LOSS_REASONS, ...EXPOSURE_LOSS).all<any>(),
 ]);
 const cohort = new Set(affected.results.map(row => row.client as string));
 const capturing = exposed.results.filter(row => row.capture === 1).map(row => row.client as string);
 const before = new Set(baseline.results.map(row => row.client as string));
 const failedBefore = [...before].filter(id => cohort.has(id)).length;
 const rate = before.size && failedBefore ? failedBefore / before.size : null;
 const bound = rate === null ? null : rateLowerBound(failedBefore, before.size);
 const chance = bound === null ? null : Math.pow(1 - bound, capturing.length);
 const reached = capturing.filter(id => cohort.has(id)).length;
 const recurrence = recurred.results, recurringClients = new Set(recurrence.map(row => row.client).filter(Boolean));
 const lossRows = loss.results.map(({ reason, count }) => ({ reason: String(reason), count: Number(count) }));
 const denominators = {
  cohort: { affectedUsers: cohort.size, unattributedEvents: unattributed.total as number, reachedOnFixedRelease: reached },
  rollout: { usersSinceDeploy: sessions.total as number, onFixedRelease: sessions.fixed as number, share: sessions.total ? sessions.fixed / sessions.total : null },
  traffic: { sessionReportsOnFixedRelease: sessions.reports as number },
  instrumentation: { flow, exposedOnFixedRelease: exposed.results.length, withCapture: capturing.length, withoutCapture: exposed.results.length - capturing.length, baselineExposed: before.size, baselineFailed: failedBefore, baselineRate: rate, baselineRateLowerBound: bound },
  captureGap: { loss: lossRows, usersWithoutCapture: exposed.results.length - capturing.length, unattributedEvents: unattributed.total as number },
  recurrence: { events: recurrence.length, users: recurringClients.size, previouslyAffected: [...recurringClients].filter(id => cohort.has(id as string)).length, sample: recurrence.slice(0, 10).map(row => ({ id: row.id, release: row.release })) },
  expectedFailuresIfUnfixed: bound === null ? null : bound * capturing.length, chanceOfNoFailureIfUnfixed: chance,
 };
 const result = (verdict: 'reached' | 'recurred' | 'inconclusive', reasons: Reason[]) => ({ verdict, reasons, deployment: deployed, denominators, limits: EXPOSURE_LIMITS });
 if (recurrence.length) return result('recurred', [{ code: 'recurred', reason: `${recurrence.length} event${recurrence.length === 1 ? '' : 's'} of this failure arrived from release ${deployed.release} or later after the deploy, from ${recurringClients.size} user${recurringClients.size === 1 ? '' : 's'}.` }]);
 const reasons: Reason[] = [];
 if (!capturing.length) reasons.push({ code: 'no_exposure', reason: `No user with error capture has reported reaching ${flow} on ${deployed.release} or later since the deploy.` });
 if (rate === null) reasons.push({ code: 'no_baseline', reason: `There is no pre-fix failure rate for ${flow}: ${before.size ? 'none of the users who reached it before the fix are in the affected cohort' : 'no user reported reaching it before the fix'}.` });
 else if (capturing.length && chance! > CHANCE_LIMIT) reasons.push({ code: 'exposure_too_low', reason: `Exposure is too low: with ${capturing.length} exposed user${capturing.length === 1 ? '' : 's'} and a pre-fix failure rate of at least ${(bound! * 100).toFixed(1)}% (${failedBefore} of ${before.size} failed; 95% lower bound), seeing no failure would happen ${(chance! * 100).toFixed(1)}% of the time even if the fix changed nothing.` });
 if (capturing.length && !reached) reasons.push({ code: 'affected_not_reached', reason: `None of the ${cohort.size} previously affected users has reached ${flow} on the fixed release yet.` });
 if (lossRows.length) reasons.push({ code: 'capture_gap', reason: `The server rejected or dropped reports since the deploy (${lossRows.map(row => `${row.reason} ${row.count}`).join(', ')}), so a recurrence may be missing.` });
 if (reasons.length) return result('inconclusive', reasons);
 return result('reached', [{ code: 'reached', reason: `The fix reached ${reached} of ${cohort.size} previously affected users and ${capturing.length} users in total on ${flow}. At the lowest pre-fix rate the baseline supports (${(bound! * 100).toFixed(1)}%, from ${failedBefore} of ${before.size}) about ${(bound! * capturing.length).toFixed(1)} failures were expected; none arrived (chance if unfixed ${(chance! * 100).toFixed(2)}%).` }]);
}
