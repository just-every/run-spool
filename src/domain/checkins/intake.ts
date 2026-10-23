import type { Context } from 'hono';
import { ingestBatch, outcomeStatement, stmt, type IngestScope } from '../admission';
import { filterCategory } from '../filters/categories';
import { SentryWireError, type SentryItem } from '../sentry/wire.ts';
import { checkInItemLimit, parseCheckIn } from './item';
import { routeCheckIn } from './forward';
import type { CheckInOutcome } from './outcomes';

// Bounded per-project check-in rate; counted refusals past it, never an unbounded forward.
const minuteLimit = 120, retainedLinks = 1000, retainedMs = 7 * 86400000;
/** SDK-024: every `check_in` item of one envelope. A check-in never becomes an occurrence, issue, alert or
 * accepted-error unit; each is counted under exactly one bounded reason and a failure never fails the other items. */
export async function admitCheckIns(c: Context<any>, scope: IngestScope, items: SentryItem[]): Promise<Record<string, number>> {
 const db = c.env.DB as D1Database, project = scope.project, counts: Record<string, number> = {};
 const record = async (reason: CheckInOutcome, ...jobs: D1PreparedStatement[]) => { counts[reason] = (counts[reason] ?? 0) + 1; await ingestBatch(c, scope, [outcomeStatement(db, project, reason), ...jobs]); };
 for (const item of items) {
  if (item.bytes.byteLength > checkInItemLimit) { await record('check_in_item_too_large'); continue; }
  let checkIn;
  try { checkIn = parseCheckIn(item.bytes); } catch (error) { if (!(error instanceof SentryWireError)) throw error; await record('check_in_invalid'); continue; }
  if ((await filterCategory(c, scope, { release: checkIn.release, environment: checkIn.environment })).length) { await record('check_in_refused'); continue; }
  const window = Math.floor(Date.now() / 60000) * 60000;
  const used = await stmt(db, "SELECT COALESCE(SUM(count),0) total FROM outcomes WHERE project=? AND window>=? AND reason LIKE 'check\\_in\\_%' ESCAPE '\\'", project, window).first<{ total: number }>();
  if (used!.total >= minuteLimit) { await record('check_in_refused', outcomeStatement(db, project, 'rate_limited')); continue; }
  const outcome = await routeCheckIn(c.env, project, checkIn), now = Date.now();
  await record(outcome, ...(checkIn.traceId ? [
   stmt(db, 'INSERT INTO checkin_links(project,check_in_id,trace_id,slug,status,outcome,received) VALUES(?,?,?,?,?,?,?) ON CONFLICT(project,check_in_id) DO UPDATE SET trace_id=excluded.trace_id,slug=excluded.slug,status=excluded.status,outcome=excluded.outcome,received=excluded.received', project, checkIn.id, checkIn.traceId, checkIn.slug, checkIn.status, outcome, now),
   stmt(db, 'DELETE FROM checkin_links WHERE project=? AND (received<? OR check_in_id NOT IN (SELECT check_in_id FROM checkin_links WHERE project=? ORDER BY received DESC,check_in_id LIMIT ?))', project, now - retainedMs, project, retainedLinks),
  ] : []));
 }
 return counts;
}
/** The check-ins an occurrence shares its trace with: the only link the SDK data carries. */
export async function linkedCheckIns(db: D1Database, project: string, traceId: unknown) {
 if (typeof traceId !== 'string' || !/^[0-9a-f]{32}$/.test(traceId)) return [];
 return (await stmt(db, 'SELECT slug monitor,status,check_in_id checkInId,outcome,received FROM checkin_links WHERE project=? AND trace_id=? ORDER BY received DESC,check_in_id LIMIT 5', project, traceId).all<any>()).results;
}
