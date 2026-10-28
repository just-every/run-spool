import { agentAuthority } from '../agent-door/native-authority';
import { runtimeBindings } from '../../auth/bindings';
import { jsonBody, ownerProjectRouter, ownerWrites } from '../owner-router';
import { reproducerView } from '../reproducers/view';
import { connection, publicConnection } from './connection';
import { grantSpec, proposalInput } from './grant';
import { GrantRefused, RECEIPT_LIMIT, STEP_RECEIPTS } from './provider';
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
// A provider step needs the workflow's lease: taken atomically, only while no
// other step holds it and only when the receipt budget can hold the whole step.
const LEASE_MS = 5 * 60_000;
const expiredLease = (c: any, row: any, time: number) => s(c.env.DB, 'DELETE FROM fix_leases WHERE workflow=? AND until<=?', row.id, time);
// With `afterClaim`, this must directly follow the claim UPDATE: changes()=1 means
// this request's own claim succeeded, so a stale request never takes the lease.
const takeLease = (c: any, row: any, time: number, afterClaim: boolean) => s(c.env.DB,
 `INSERT INTO fix_leases(workflow,project,until) SELECT ?,?,? WHERE ${afterClaim ? 'changes()=1 AND ' : ''}(SELECT COUNT(*) FROM fix_receipts WHERE workflow=?)+?<=? ON CONFLICT(workflow) DO NOTHING`,
 row.id, row.project, time + LEASE_MS, row.id, STEP_RECEIPTS, RECEIPT_LIMIT);
async function refusedLease(c: any, row: any) {
 const used = (await s(c.env.DB, 'SELECT COUNT(*) n FROM fix_receipts WHERE workflow=?', row.id).first<any>()).n;
 const error = used + STEP_RECEIPTS > RECEIPT_LIMIT
  ? `This workflow's receipt budget (${RECEIPT_LIMIT}) cannot hold another step, so nothing was sent to GitHub. Propose a new fix workflow to continue.`
  : 'Another step of this workflow is in progress; nothing was sent to GitHub.';
 return c.json({ error, workflow: await view(c, await current(c)) }, 409);
}
// Runs one leased step and always releases the lease.
async function leasedStep(c: any, row: any) {
 try { await advance(c.env.DB, runtimeBindings(c.env), row,agentAuthority(c.req.raw)); return null; }
 catch (error) { return c.json({ error: String((error as Error).message), workflow: await view(c, await current(c)) }, error instanceof GrantRefused ? 409 : 502); }
 finally { await s(c.env.DB, 'DELETE FROM fix_leases WHERE workflow=?', row.id).run(); }
}
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
 const actor=agentAuthority(c.req.raw);if(actor)grant.pullRequest.body+=`\n\nPrepared by ${actor.context.actor.label}. This is a data artifact, not a code repair.`;
 try {
  await ownerWrites(c, [
   s(c.env.DB, 'INSERT INTO fix_workflows(id,project,issue,reproducer,run,flow,grant_spec,revision,proposed,updated) VALUES(?,?,?,?,?,?,?,1,?,?)', id, project, row.issue, row.id, run.id, input.flow, JSON.stringify(grant), time, time),
   ...actor?[s(c.env.DB,'INSERT INTO spool_agent_custody VALUES(?,?,?,?,?)','fix',id,project,JSON.stringify((({person,agent,scopes,clientId,consent})=>({person:{id:person.id},agent,scopes,clientId,consent}))(actor.context)),JSON.stringify(actor.context.actor))]:[],
   audit(c.env.DB, project, 'fix_proposed', { workflow: id, issue: row.issue, repository: input.repository }, time),
  ]);
 } catch (error) { if (String((error as Error).message).includes('fix_workflow_budget')) return c.json({ error: 'An issue holds at most 10 fix workflows' }, 409); throw error; }
 return c.json(await view(c, await s(c.env.DB, 'SELECT * FROM fix_workflows WHERE id=?', id).first()), 201);
});

// Approval (or renewal after expiry) of exactly the recorded grant.
routes.post('/:fix/approve', async c => {
 const session=c.get('ownerSession');
 if(session.kind==='agent')return c.json({code:'native_person_required'},403);
 const b = await jsonBody(c.req.raw, 1024), expected = revision(b.revision), row = await current(c), time = Date.now();
 if (!row) return c.json({ error: 'Workflow not found' }, 404);
 if (row.approved !== null && time < row.expires) return c.json({ error: 'The grant is already approved and unexpired' }, 409);
 const minutes = JSON.parse(row.grant_spec).durationMinutes,proofReference=crypto.randomUUID();
 const [updated] = await ownerWrites(c, [
  s(c.env.DB, 'UPDATE fix_workflows SET approved=?,expires=?,revision=revision+1,updated=? WHERE id=? AND revision=?', time, time + minutes * 60_000, time, row.id, expected),
  s(c.env.DB,'INSERT INTO spool_native_approvals(kind,id,project,person,name,revision,created,reference) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1','fix',row.id,row.project,session.operator.id,session.operator.displayName,expected+1,time,proofReference),
  audit(c.env.DB, row.project, 'fix_approved', { workflow: row.id, revision: expected + 1 }, time),
 ]);
 if (!updated.meta.changes) return c.json({ error: 'Revision conflict' }, 409);
 const approved = await current(c);
 const agentPrepared=await s(c.env.DB,"SELECT 1 FROM spool_agent_custody WHERE kind='fix' AND id=?",row.id).first();
 if (!agentPrepared && connection(runtimeBindings(c.env)).state === 'configured' && !approved.pull_number) {
  const time = Date.now(), [, leased] = await ownerWrites(c, [expiredLease(c, approved, time), takeLease(c, approved, time, false)]);
  if (!leased.meta.changes) return refusedLease(c, approved);
  const failed = await leasedStep(c, approved); if (failed) return failed;
 }
 return c.json(await view(c, await current(c)));
});

routes.post('/:fix/advance', async c => {
 const b = await jsonBody(c.req.raw, 1024), expected = revision(b.revision), row = await current(c);
 if (!row) return c.json({ error: 'Workflow not found' }, 404);
 if (row.approved === null) return c.json({ error: 'Approve the grant first' }, 409);
 // Claim this step by revision so two clicks cannot open two branches.
 // Order matters: the lease and the audit row follow the claim, each on changes()=1.
 const time = Date.now(), [, claimed, leased] = await ownerWrites(c, [
  expiredLease(c, row, time),
  s(c.env.DB, 'UPDATE fix_workflows SET revision=revision+1,updated=? WHERE id=? AND revision=?', time, row.id, expected),
  takeLease(c, row, time, true),
  audit(c.env.DB, row.project, 'fix_advanced', { workflow: row.id, revision: expected + 1 }, time),
 ]);
 if (!claimed.meta.changes) return c.json({ error: 'Revision conflict' }, 409);
 if (!leased.meta.changes) return refusedLease(c, row);
 const failed = await leasedStep(c, await current(c)); if (failed) return failed;
 return c.json(await view(c, await current(c)));
});

export default routes;
