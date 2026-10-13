// Measured recovery is computed from stored events, releases, maps, counters and
// retention records. It is never declared by a person or a model.
const query = (db: D1Database, sql: string, ...args: any[]) => db.prepare(sql).bind(...args);
export const LOSS_REASONS = ['unauthorized', 'invalid', 'oversized', 'rejected', 'rate_limited', 'budget', 'storage_failure', 'unregistered_release_or_build', 'missing_release_register_required'];
const EVIDENCE_LIMIT = 10;
export const VERDICT_LIMITS = 'This verdict does not show users who never reached the affected flow, failures lost in the client before transport, or the same failure grouped differently after a rebuild.';
const CLIENT_LOSS = { code: 'client_loss_unknown', reason: 'Loss in the client before transport is unknown.' };
type Reason = { code: string; reason: string };
export type Observation = {
 verdict: 'recurred' | 'inconclusive' | 'no_recurrence_after_exercise';
 reasons: Reason[];
 evidence: {
  release: { name: string; sequence: number; build: string; registered: number } | null;
  window: { start: number; end: number } | null;
  recurrence: { count: number; events: any[] };
  olderReleaseEvents: { count: number; events: any[]; counted: false };
  releaseEvents: number;
  mapStored: boolean;
  loss: { reason: string; count: number }[];
 };
 limits: string;
};

export async function observe(db: D1Database, repair: any, now = Date.now()): Promise<Observation> {
 const empty = { release: null, window: null, recurrence: { count: 0, events: [] }, olderReleaseEvents: { count: 0, events: [], counted: false as const }, releaseEvents: 0, mapStored: false, loss: [] };
 if (repair.deployed_release === null) return { verdict: 'inconclusive', limits: VERDICT_LIMITS, evidence: empty,
  reasons: [{ code: 'not_deployed', reason: 'The repair is not marked deployed in a registered release.' }, CLIENT_LOSS] };
 const release = await query(db, 'SELECT name,seq,build,created FROM releases WHERE project=? AND name=?', repair.project, repair.deployed_release).first<any>();
 const start = release.created, seq = release.seq;
 const events = (order: string) => query(db, `SELECT id,release,release_seq,received FROM events WHERE project=? AND issue=? AND historical=0 AND received>=? AND ${order} ORDER BY received,id LIMIT ?`, repair.project, repair.issue, start, seq, EVIDENCE_LIMIT).all<any>();
 const count = (order: string) => query(db, `SELECT COUNT(*) total FROM events WHERE project=? AND issue=? AND historical=0 AND received>=? AND ${order}`, repair.project, repair.issue, start, seq).first<any>();
 const [recurred, recurredTotal, older, olderTotal, captured, map, losses, retention] = await Promise.all([
  events('release_seq>=?'), count('release_seq>=?'), events('release_seq<?'), count('release_seq<?'),
  query(db, 'SELECT COUNT(*) total FROM events WHERE project=? AND release=? AND historical=0', repair.project, release.name).first<any>(),
  query(db, 'SELECT 1 FROM artifacts WHERE project=? AND release=? AND build=? LIMIT 1', repair.project, release.name, release.build).first(),
  query(db, `SELECT reason,SUM(count) count FROM outcomes WHERE project=? AND window>=? AND reason IN (${LOSS_REASONS.map(() => '?').join(',')}) GROUP BY reason ORDER BY reason`, repair.project, Math.floor(start / 60000) * 60000, ...LOSS_REASONS).all<any>(),
  query(db, "SELECT COUNT(*) total FROM audit WHERE project=? AND kind='retention_gap' AND json_extract(detail,'$.cutoff')>?", repair.project, start).first<any>(),
 ]);
 const row = (event: any) => ({ id: event.id, release: event.release, sequence: event.release_seq, received: event.received });
 const evidence = {
  release: { name: release.name, sequence: seq, build: release.build, registered: start }, window: { start, end: now },
  recurrence: { count: recurredTotal.total, events: recurred.results.map(row) },
  olderReleaseEvents: { count: olderTotal.total, events: older.results.map(row), counted: false as const },
  releaseEvents: captured.total, mapStored: !!map, loss: losses.results.map(({ reason, count }) => ({ reason, count })),
 };
 if (evidence.recurrence.count) return { verdict: 'recurred', reasons: [{ code: 'recurred', reason: `The same group arrived again in release ${release.name} (sequence ${seq}) or a later registered release after ${release.name} was registered.` }], evidence, limits: VERDICT_LIMITS };
 const reasons: Reason[] = [];
 if (!evidence.releaseEvents) reasons.push({ code: 'no_capture_from_release', reason: `No event at all has arrived from release ${release.name}, so capture is not shown to be wired for it.` });
 if (repair.exercised === null) reasons.push({ code: 'flow_not_exercised', reason: `No one has recorded that the affected flow was exercised in release ${release.name} after the deploy.` });
 if (!evidence.mapStored) reasons.push({ code: 'map_missing', reason: `No source map is stored for release ${release.name} and build ${release.build}, so its frames stay unmapped.` });
 if (evidence.loss.length) reasons.push({ code: 'windowed_loss', reason: `The server rejected or dropped events since release ${release.name} was registered (${evidence.loss.map(row => `${row.reason} ${row.count}`).join(', ')}).` });
 if (retention.total) reasons.push({ code: 'retention_in_window', reason: `Retention removed events received after release ${release.name} was registered, so the window is incomplete.` });
 if (!reasons.length) return { verdict: 'no_recurrence_after_exercise', reasons: [{ code: 'no_recurrence_after_exercise', reason: `The affected flow was recorded as exercised in release ${release.name} after the deploy, capture from that release is shown, the server counters show no loss, and the group has not recurred.` }], evidence, limits: VERDICT_LIMITS };
 return { verdict: 'inconclusive', reasons: [...reasons, CLIENT_LOSS], evidence, limits: VERDICT_LIMITS };
}
