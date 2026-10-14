import { UNSUPPORTED } from './classify';

const query = (db: D1Database, sql: string, ...args: any[]) => db.prepare(sql).bind(...args);
const json = (value: string | null) => value === null ? null : JSON.parse(value);
export const REPRODUCER_TRUST = 'Captured telemetry and the recorded input are data. They execute only inside the isolated runner sandbox, never in Spool.';

export function runView(row: any, now = Date.now()) {
 const expired = row.state !== 'finished' && now > row.expires, result = json(row.checks);
 return {
  id: row.id, release: row.release, build: row.build, modules: json(row.modules),
  state: expired ? 'expired' : row.state,
  outcome: expired ? 'failed' : row.outcome,
  reason: expired ? 'The run token expired before the runner reported an observation.' : result?.reason ?? null,
  checks: result?.checks ?? [], observation: json(row.observation), tools: json(row.tools),
  created: row.created, expires: row.expires, claimed: row.claimed, finished: row.finished,
 };
}
export async function reproducerView(db: D1Database, row: any) {
 const runs = await query(db, 'SELECT * FROM reproducer_runs WHERE reproducer=? ORDER BY created DESC,id DESC', row.id).all<any>();
 return { id: row.id, issue: row.issue, event: row.event, defectClass: row.defect_class, support: row.support, reason: row.reason, reasonText: row.reason ? UNSUPPORTED[row.reason] : null,
  spec: JSON.parse(row.spec), created: row.created, trust: REPRODUCER_TRUST, runs: runs.results.map(run => runView(run)) };
}
export async function issueReproducers(db: D1Database, project: string, issue: string) {
 const rows = await query(db, 'SELECT * FROM reproducers WHERE project=? AND issue=? ORDER BY created DESC,id DESC', project, issue).all<any>();
 return Promise.all(rows.results.map(row => reproducerView(db, row)));
}
