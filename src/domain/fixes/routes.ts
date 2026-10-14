import { runtimeBindings } from '../../auth/bindings';
import { jsonBody, ownerProjectRouter, ownerWrites } from '../owner-router';
import { reproducerView } from '../reproducers/view';
import { connection, publicConnection } from './connection';
import { grantSpec, proposalInput } from './grant';
import { GrantRefused } from './provider';
import { advance, workflowView } from './workflow';

// Owner routes for fix-branch workflows. Proposing records an exact grant;
// approving starts its expiry; only an approved, unexpired grant with an owner
// connection lets Spool call GitHub, and only through ProviderSession.
const routes = ownerProjectRouter();
const s = (db: D1Database, sql: string, ...args: any[]) => db.prepare(sql).bind(...args);
const audit = (db: D1Database, project: string, kind: string, detail: object, time: number) =>
 s(db, 'INSERT INTO audit SELECT ?,?,?,?,? WHERE changes()=1', crypto.randomUUID(), project, kind, JSON.stringify(detail), time);
const current = (c: any) => s(c.env.DB, 'SELECT * FROM fix_workflows WHERE project=? AND id=?', c.req.param('project'), c.req.param('fix')).first<any>();
const view = async (c: any, row: any) => workflowView(c.env.DB, runtimeBindings(c.env), row);
const revision = (value: unknown) => { if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error('Workflow revision required'); return value as number; };

routes.get('/', async c => {
 const project = c.req.param('project')!, issue = c.req.query('issue');
 if (!issue || !await s(c.env.DB, 'SELECT 1 FROM issues WHERE project=? AND id=?', project, issue).first()) return c.json({ error: 'Issue not found' }, 404);
 const rows = (await s(c.env.DB, 'SELECT * FROM fix_workflows WHERE project=? AND issue=? ORDER BY proposed DESC,id DESC', project, issue).all<any>()).results;
 return c.json({ connection: publicConnection(connection(runtimeBindings(c.env))), workflows: await Promise.all(rows.map(row => view(c, row))) });
});

routes.post('/', async c => {
 const project = c.req.param('project')!, b = await jsonBody(c.req.raw, 4096), input = proposalInput(b);
 const row = typeof b.reproducer === 'string' ? await s(c.env.DB, 'SELECT * FROM reproducers WHERE project=? AND id=?', project, b.reproducer).first<any>() : null;
 if (!row) return c.json({ error: 'Reproducer not found' }, 404);
 const reproducer = await reproducerView(c.env.DB, row), run = reproducer.runs.find(item => item.id === b.run);
 if (!run || run.outcome !== 'reproduced') return c.json({ error: 'A fix branch needs a run that Spool confirmed as reproduced' }, 409);
 const id = crypto.randomUUID(), time = Date.now(), grant = await grantSpec(id, input, reproducer, run);
 try {
  await ownerWrites(c, [
   s(c.env.DB, 'INSERT INTO fix_workflows(id,project,issue,reproducer,run,flow,grant_spec,revision,proposed,updated) VALUES(?,?,?,?,?,?,?,1,?,?)', id, project, row.issue, row.id, run.id, input.flow, JSON.stringify(grant), time, time),
   audit(c.env.DB, project, 'fix_proposed', { workflow: id, issue: row.issue, repository: input.repository }, time),
  ]);
 } catch (error) { if (String((error as Error).message).includes('fix_workflow_budget')) return c.json({ error: 'An issue holds at most 10 fix workflows' }, 409); throw error; }
 return c.json(await view(c, await s(c.env.DB, 'SELECT * FROM fix_workflows WHERE id=?', id).first()), 201);
});

// Approval (or renewal after expiry) of exactly the recorded grant.
routes.post('/:fix/approve', async c => {
 const b = await jsonBody(c.req.raw, 1024), expected = revision(b.revision), row = await current(c), time = Date.now();
 if (!row) return c.json({ error: 'Workflow not found' }, 404);
 if (row.approved !== null && time < row.expires) return c.json({ error: 'The grant is already approved and unexpired' }, 409);
 const minutes = JSON.parse(row.grant_spec).durationMinutes;
 const [updated] = await ownerWrites(c, [
  s(c.env.DB, 'UPDATE fix_workflows SET approved=?,expires=?,revision=revision+1,updated=? WHERE id=? AND revision=?', time, time + minutes * 60_000, time, row.id, expected),
  audit(c.env.DB, row.project, 'fix_approved', { workflow: row.id, revision: expected + 1 }, time),
 ]);
 if (!updated.meta.changes) return c.json({ error: 'Revision conflict' }, 409);
 const approved = await current(c);
 if (connection(runtimeBindings(c.env)).state === 'configured' && !approved.pull_number) {
  try { await advance(c.env.DB, runtimeBindings(c.env), approved); } catch (error) { return c.json({ error: String((error as Error).message), workflow: await view(c, await current(c)) }, 502); }
 }
 return c.json(await view(c, await current(c)));
});

routes.post('/:fix/advance', async c => {
 const b = await jsonBody(c.req.raw, 1024), expected = revision(b.revision), row = await current(c);
 if (!row) return c.json({ error: 'Workflow not found' }, 404);
 if (row.approved === null) return c.json({ error: 'Approve the grant first' }, 409);
 // Claim this step by revision so two clicks cannot open two branches.
 const time = Date.now(), [claimed] = await ownerWrites(c, [
  s(c.env.DB, 'UPDATE fix_workflows SET revision=revision+1,updated=? WHERE id=? AND revision=?', time, row.id, expected),
  audit(c.env.DB, row.project, 'fix_advanced', { workflow: row.id, revision: expected + 1 }, time),
 ]);
 if (!claimed.meta.changes) return c.json({ error: 'Revision conflict' }, 409);
 try { await advance(c.env.DB, runtimeBindings(c.env), await current(c)); }
 catch (error) { return c.json({ error: String((error as Error).message), workflow: await view(c, await current(c)) }, error instanceof GrantRefused ? 409 : 502); }
 return c.json(await view(c, await current(c)));
});

export default routes;
