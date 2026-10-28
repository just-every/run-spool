import { agentAuthority } from '../agent-door/native-authority';
import { hash, identity, token } from '../privacy';
import { jsonBody, ownerProjectRouter, ownerWrites } from '../owner-router';
import { classify } from './classify';
import { mapModules, recorded, RUN_TOKEN_MS } from './sandbox';
import { issueReproducers, reproducerView } from './view';

// Owner routes: record a reproducer for a captured event and issue single-use
// run tokens. Nothing here executes code; runs happen in the runner sandbox.
const routes = ownerProjectRouter();
const s = (db: D1Database, sql: string, ...args: any[]) => db.prepare(sql).bind(...args);
const audit = (db: D1Database, project: string, kind: string, detail: object, time: number) =>
 s(db, 'INSERT INTO audit SELECT ?,?,?,?,? WHERE changes()=1', crypto.randomUUID(), project, kind, JSON.stringify(detail), time);
const budget = (error: unknown, c: any) => /reproducer(_run)?_budget/.test(String((error as Error).message)) ? c.json({ error: String((error as Error).message).includes('run') ? 'A reproducer holds at most 20 runs' : 'An issue holds at most 20 reproducers' }, 409) : null;

routes.get('/', async c => {
 const issue = c.req.query('issue'), project = c.req.param('project')!;
 if (!issue || !await s(c.env.DB, 'SELECT 1 FROM issues WHERE project=? AND id=?', project, issue).first()) return c.json({ error: 'Issue not found' }, 404);
 return c.json({ reproducers: await issueReproducers(c.env.DB, project, issue) });
});

routes.post('/', async c => {
 const project = c.req.param('project')!, b = await jsonBody(c.req.raw, 16384);
 const record = await classify(c.env.DB, project, identity(b.event, 'eventId'), b);
 if (!record) return c.json({ error: 'Event not found' }, 404);
 const id = crypto.randomUUID(), time = Date.now();
 try {
  await ownerWrites(c, [
   s(c.env.DB, 'INSERT INTO reproducers VALUES(?,?,?,?,?,?,?,?,?)', id, project, record.issue, b.event, record.spec.defectClass, record.support, record.reason, JSON.stringify(record.spec), time),
   audit(c.env.DB, project, 'reproducer_recorded', { reproducer: id, issue: record.issue, support: record.support }, time),
  ]);
 } catch (error) { const refused = budget(error, c); if (refused) return refused; throw error; }
 return c.json(await reproducerView(c.env.DB, await s(c.env.DB, 'SELECT * FROM reproducers WHERE id=?', id).first()), 201);
});

// A run against the captured release, or against another registered release
// whose stored map carries the same source file (to check a fix's behaviour).
routes.post('/:reproducer/runs', async c => {
 const project = c.req.param('project')!, b = await jsonBody(c.req.raw, 2048);
 const row = await s(c.env.DB, 'SELECT * FROM reproducers WHERE project=? AND id=?', project, c.req.param('reproducer')).first<any>();
 if (!row) return c.json({ error: 'Reproducer not found' }, 404);
 if (row.support !== 'supported') return c.json({ error: 'Unsupported defect class; nothing can run', reason: row.reason }, 409);
 const spec = JSON.parse(row.spec);
 const release = b.release === undefined ? { name: spec.source.release, build: spec.source.build } : await s(c.env.DB, 'SELECT name,build FROM releases WHERE project=? AND name=?', project, identity(b.release, 'release')).first<any>();
 if (!release) return c.json({ error: 'Choose a registered release' }, 404);
 const artifacts = (await s(c.env.DB, 'SELECT payload FROM artifacts WHERE project=? AND release=? AND build=? ORDER BY debug', project, release.name, release.build).all<any>()).results;
 let modules = null;
 for (const artifact of artifacts) { const found = await mapModules(artifact.payload); if (found.some(m => m.name === spec.call.module && m.original === spec.event.frame.original.file)) { modules = found; break; } }
 if (!modules) return c.json({ error: `No stored map for release ${release.name} carries ${spec.event.frame.original.file} with its source text` }, 409);
 const id = crypto.randomUUID(), secret = token(), time = Date.now();
 try {
  await ownerWrites(c, [
   s(c.env.DB, "INSERT INTO reproducer_runs(id,reproducer,project,release,build,modules,state,created,expires) VALUES(?,?,?,?,?,?,'queued',?,?)", id, row.id, project, release.name, release.build, JSON.stringify(recorded(modules)), time, time + RUN_TOKEN_MS),
   s(c.env.DB, 'INSERT INTO reproducer_run_tokens VALUES(?,?,?,?)', id, project, await hash(secret), time + RUN_TOKEN_MS),
   ...agentAuthority(c.req.raw)?[s(c.env.DB,'INSERT INTO spool_agent_custody VALUES(?,?,?,?,?)','reproducer',id,project,JSON.stringify((({person,agent,scopes,clientId,consent})=>({person:{id:person.id},agent,scopes,clientId,consent}))(agentAuthority(c.req.raw)!.context)),JSON.stringify(agentAuthority(c.req.raw)!.context.actor))]:[],
   audit(c.env.DB, project, 'reproducer_run_queued', { reproducer: row.id, run: id, release: release.name }, time),
  ]);
 } catch (error) { const refused = budget(error, c); if (refused) return refused; throw error; }
 const url = `${new URL(c.req.url).origin}/api/sandbox/runs/${id}`;
 return c.json({ run: id, token: secret, url, expires: time + RUN_TOKEN_MS, command: `SPOOL_RUN_TOKEN=${secret} pnpm reproduce ${url}` }, 201);
});

// The runner invokes this typed action with its saved principal before handing
// uploaded code to the isolated sandbox. It rechecks current role and policy.
routes.post('/:reproducer/claim', async c=>{
 const project=c.req.param('project')!,id=c.req.param('reproducer');
 const row=await s(c.env.DB,'SELECT reproducer,state,expires FROM reproducer_runs WHERE project=? AND id=?',project,id).first<any>();
 if(!row)return c.json({error:'Run not found'},404);
 if(row.state!=='queued'||row.expires<=Date.now())return c.json({error:'Run already claimed or expired'},409);
 const [result]=await ownerWrites(c,[s(c.env.DB,"UPDATE reproducer_runs SET state='claimed',claimed=? WHERE project=? AND id=? AND state='queued' AND expires>?",Date.now(),project,id,Date.now()),audit(c.env.DB,project,'reproducer_run_queued',{reproducer:row.reproducer,run:id},Date.now())]);
 if(!result.meta.changes)return c.json({error:'Run already claimed'},409);
 return c.json({id,reproducer:row.reproducer,state:'claimed'});
});
export default routes;
