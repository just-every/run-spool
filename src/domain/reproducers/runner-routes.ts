import { Hono } from 'hono';
import type { Bindings } from '../../auth/bindings';
import { canonical, hash } from '../privacy';
import { jsonBody } from '../owner-router';
import { behaviourCheck, reportInput } from './check';
import { mapModules, recorded, RUNNER_PROTOCOL } from './sandbox';

// The runner's only door. A run token is single-use, expires, and authorizes
// exactly one run: fetch its job once, then report one observation. It reads
// nothing else and cannot choose the outcome.
const routes = new Hono<{ Bindings: Bindings }>();
const s = (db: D1Database, sql: string, ...args: any[]) => db.prepare(sql).bind(...args);
async function authorized(c: any) {
 const bearer = /^Bearer ([a-f0-9]{64})$/.exec(c.req.header('authorization') ?? '')?.[1];
 if (!bearer) return null;
 return s(c.env.DB, 'SELECT r.* FROM reproducer_run_tokens t JOIN reproducer_runs r ON r.id=t.run WHERE t.run=? AND t.hash=? AND t.expires>?', c.req.param('run'), await hash(bearer), Date.now()).first<any>();
}
const denied = (c: any) => c.json({ error: 'Valid run token required' }, 401);

routes.get('/runs/:run', async c => {
 const run = await authorized(c); if (!run) return denied(c);
 const claimed = await s(c.env.DB, "UPDATE reproducer_runs SET state='claimed',claimed=? WHERE id=? AND state='queued'", Date.now(), run.id).run();
 if (!claimed.meta.changes) return c.json({ error: 'Run already claimed' }, 409);
 const reproducer = await s(c.env.DB, 'SELECT spec FROM reproducers WHERE id=?', run.reproducer).first<any>(), spec = JSON.parse(reproducer.spec);
 const artifacts = (await s(c.env.DB, 'SELECT payload FROM artifacts WHERE project=? AND release=? AND build=?', run.project, run.release, run.build).all<any>()).results;
 // The job carries exactly the modules recorded when the run was queued.
 for (const artifact of artifacts) {
  const modules = await mapModules(artifact.payload);
  if (canonical(recorded(modules)) === canonical(JSON.parse(run.modules))) return c.json({ run: run.id, protocol: RUNNER_PROTOCOL, environment: spec.environment, call: spec.call, modules: modules.map(({ name, source }) => ({ name, source })) });
 }
 return c.json({ error: 'The stored map for this run changed after it was queued' }, 409);
});

routes.post('/runs/:run/observation', async c => {
 const run = await authorized(c); if (!run) return denied(c);
 if (run.state !== 'claimed') return c.json({ error: 'Fetch the job before reporting' }, 409);
 const { tools, observation } = reportInput(await jsonBody(c.req.raw, 16384));
 const reproducer = await s(c.env.DB, 'SELECT spec FROM reproducers WHERE id=?', run.reproducer).first<any>();
 const result = behaviourCheck(JSON.parse(reproducer.spec), JSON.parse(run.modules), observation), time = Date.now();
 const [finished] = await c.env.DB.batch([
  s(c.env.DB, "UPDATE reproducer_runs SET state='finished',outcome=?,observation=?,checks=?,tools=?,finished=? WHERE id=? AND state='claimed'", result.outcome, JSON.stringify(observation), JSON.stringify({ reason: result.reason, checks: result.checks }), JSON.stringify(tools), time, run.id),
  s(c.env.DB, 'DELETE FROM reproducer_run_tokens WHERE run=? AND changes()=1', run.id),
  s(c.env.DB, 'INSERT INTO audit SELECT ?,?,?,?,? WHERE changes()=1', crypto.randomUUID(), run.project, 'reproducer_run_finished', JSON.stringify({ reproducer: run.reproducer, run: run.id, outcome: result.outcome }), time),
 ]);
 if (!finished.meta.changes) return c.json({ error: 'Run already reported' }, 409);
 return c.json({ outcome: result.outcome, reason: result.reason });
});

export default routes;
