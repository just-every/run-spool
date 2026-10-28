import type { NativeAuthority } from '../agent-door/native-authority';
import { agentAuthority } from '../agent-door/native-authority';
import { resolveMembership } from '../members/resolver';
import { Hono } from 'hono';
import { requestAuthority as ownerSession, nativeWrite as ownerWrite } from '../agent-door/native-authority';
import { ownerBatch, type OwnerSession } from '../owner-authority';
import { runtimeBindings, type Bindings } from '../../auth/bindings';
import { boundedText, checkInput, REPAIR_FACTS, repairLink, revision, type RepairFact } from './input';
import { issueRepairs, repairView } from './view';

// Owner-recorded repair history. Recording never sends mail or webhooks, never
// creates alert rows and never starts work: every write touches only repairs,
// repair_checks and the audit table.
const routes = new Hono<{ Bindings: Bindings; Variables: { repairSession: NativeAuthority } }>();
const s = (db: D1Database, sql: string, ...args: any[]) => db.prepare(sql).bind(...args);
const audit = (db: D1Database, project: string, kind: string, detail: object, time: number) =>
 s(db, `INSERT INTO audit SELECT ?,?,?,?,? WHERE changes()=1`, crypto.randomUUID(), project, kind, JSON.stringify(detail), time);

// This router authenticates its own direct transport as well as its parent API mount.
routes.use('*', async (c, next) => {
 const env = runtimeBindings(c.env);
 const session=await ownerSession(c.req.raw,env,resolveMembership);
 if (!session) return c.json({ error: 'Owner session required' }, 401);
 c.set('repairSession',session);
 if (!['GET', 'HEAD'].includes(c.req.method) && !ownerWrite(c.req.raw, env)) return c.json({ error: 'Same-origin required' }, 403);
 if (!await s(env.DB, 'SELECT 1 FROM projects WHERE id=?', c.req.param('project')!).first()) return c.json({ error: 'Project not found' }, 404);
 await next();
});
async function input(c: any) {
 const reader = c.req.raw.body?.getReader(); if (!reader) throw new Error('Invalid repair request');
 let size = 0; const chunks: Uint8Array[] = [];
 for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 8192) { await reader.cancel(); throw new Error('Repair request too large'); } chunks.push(part.value); }
 const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
 try { const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); if (value && typeof value === 'object' && !Array.isArray(value)) return value; } catch { /* refused below */ }
 throw new Error('Invalid repair request');
}
const budget = (error: unknown, c: any) => /repair(_check)?_budget/.test(String((error as Error).message)) ? c.json({ error: String((error as Error).message).includes('check') ? 'A repair holds at most 10 checks' : 'An issue holds at most 20 repairs' }, 409) : null;
const current = (c: any, id: string) => s(c.env.DB, 'SELECT * FROM repairs WHERE project=? AND id=?', c.req.param('project'), id).first<any>();
const write = (c: any, statements: D1PreparedStatement[]) => ownerBatch(c.env.DB, c.get('repairSession'), statements);

routes.get('/', async c => {
 const issue = c.req.query('issue');
 if (!issue || !await s(c.env.DB, 'SELECT 1 FROM issues WHERE project=? AND id=?', c.req.param('project')!, issue).first()) return c.json({ error: 'Issue not found' }, 404);
 return c.json(await issueRepairs(c.env.DB, c.req.param('project')!, issue));
});

routes.post('/', async c => {
 const project = c.req.param('project')!, b = await input(c);
 const issue = typeof b.issue === 'string' ? await s(c.env.DB, 'SELECT id,revision,algorithm,latest_release_seq FROM issues WHERE project=? AND id=?', project, b.issue).first<any>() : null;
 if (!issue) return c.json({ error: 'Issue not found' }, 404);
 if (!['js-frame-v1','python-frame-v1','go-frame-v1','sentry-chain-v1'].includes(issue.algorithm)) throw new Error('Imported history cannot recur in live capture; record repairs on live issues');
 const link = repairLink(b.link), note = boundedText(b.note, 'Note', 1000), id = crypto.randomUUID(), time = Date.now();
 // The evidence snapshot: issue revision, the packet's newest retained event IDs
 // and the issue's release watermark when the repair was recorded.
 const events = (await s(c.env.DB, 'SELECT id FROM events WHERE project=? AND issue=? ORDER BY received DESC,id DESC LIMIT 10', project, issue.id).all<any>()).results.map(row => row.id);
 try {
  await write(c,[
   s(c.env.DB, 'INSERT INTO repairs(id,project,issue,snapshot_revision,snapshot_events,snapshot_release_seq,link,note,revision,created,updated,recorded_by) VALUES(?,?,?,?,?,?,?,?,1,?,?,?)', id, project, issue.id, issue.revision, JSON.stringify(events), issue.latest_release_seq ?? 0, link, note, time, time,agentAuthority(c.req.raw)?.context.actor.label??'owner'),
   audit(c.env.DB, project, 'repair_recorded', { repair: id, issue: issue.id }, time),
  ]);
 } catch (error) { const refused = budget(error, c); if (refused) return refused; throw error; }
 return c.json(await repairView(c.env.DB, await current(c, id)), 201);
});

routes.post('/:repair/checks', async c => {
 const project = c.req.param('project')!, b = await input(c), expected = revision(b.revision), check = checkInput(b), time = Date.now(), id = crypto.randomUUID();
 if (!await current(c, c.req.param('repair'))) return c.json({ error: 'Repair not found' }, 404);
 let results;
 try {
  results = await write(c,[
   s(c.env.DB, 'UPDATE repairs SET revision=revision+1,updated=? WHERE project=? AND id=? AND revision=?', time, project, c.req.param('repair'), expected),
   s(c.env.DB, 'INSERT INTO repair_checks SELECT ?,?,?,?,?,?,? WHERE changes()=1', id, c.req.param('repair'), project, check.name, check.outcome, check.note, time),
   audit(c.env.DB, project, 'repair_check_recorded', { repair: c.req.param('repair'), check: id, revision: expected + 1 }, time),
  ]);
 } catch (error) { const refused = budget(error, c); if (refused) return refused; throw error; }
 if (!results[0].meta.changes) return c.json({ error: 'Revision conflict' }, 409);
 return c.json(await repairView(c.env.DB, await current(c, c.req.param('repair'))), 201);
});

routes.post('/:repair/facts', async c => {
 const project = c.req.param('project')!, b = await input(c), expected = revision(b.revision), time = Date.now();
 if (!REPAIR_FACTS.includes(b.fact)) throw new Error('Fact must be approved, merged, deployed or exercised');
 const fact = b.fact as RepairFact, repair = await current(c, c.req.param('repair'));
 if (!repair) return c.json({ error: 'Repair not found' }, 404);
 let update: D1PreparedStatement;
 if (fact === 'deployed') {
  // The release is chosen from owner-registered releases, so it carries their sequence.
  const release = typeof b.release === 'string' ? await s(c.env.DB, 'SELECT name,seq FROM releases WHERE project=? AND name=?', project, b.release).first<any>() : null;
  if (!release) throw new Error('Choose a registered release');
  // A new deploy starts a new observation: an earlier exercise record no longer applies.
  update = s(c.env.DB, 'UPDATE repairs SET deployed_release=?,deployed_seq=?,deployed=?,exercised=NULL,exercise_note=NULL,revision=revision+1,updated=? WHERE project=? AND id=? AND revision=?', release.name, release.seq, time, time, project, repair.id, expected);
 } else if (fact === 'exercised') {
  const note = boundedText(b.note, 'Exercise note', 1000, true);
  if (repair.deployed === null) throw new Error('Mark the repair deployed in a release before recording the exercised flow');
  update = s(c.env.DB, 'UPDATE repairs SET exercised=MAX(?,deployed),exercise_note=?,revision=revision+1,updated=? WHERE project=? AND id=? AND revision=? AND deployed IS NOT NULL', time, note, time, project, repair.id, expected);
 } else update = s(c.env.DB, `UPDATE repairs SET ${fact}=?,revision=revision+1,updated=? WHERE project=? AND id=? AND revision=?`, time, time, project, repair.id, expected);
 const results = await write(c,[update, audit(c.env.DB, project, 'repair_fact', { repair: repair.id, fact, revision: expected + 1 }, time)]);
 if (!results[0].meta.changes) return c.json({ error: 'Revision conflict' }, 409);
 return c.json(await repairView(c.env.DB, await current(c, repair.id)));
});

export default routes;
