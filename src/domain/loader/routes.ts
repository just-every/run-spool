import { ownerProjectRouter, ownerWrites, jsonBody } from '../owner-router';
import { auditCommit } from '../audit/context';
import { loaderOptions, readLoader } from './options';

export const loaderRoutes = ownerProjectRouter();
loaderRoutes.use('*', async (c, next) => {
 if (!await c.env.DB.prepare("SELECT 1 FROM credentials WHERE project=? AND hash=? AND kind='ingest' AND revoked IS NULL").bind(c.req.param('project')!, c.req.param('hash')!).first()) return c.json({ error: 'Key not available' }, 404);
 await next();
});
loaderRoutes.get('/', async c => c.json(await readLoader(c.env.DB, c.req.param('project')!, c.req.param('hash')!)));
loaderRoutes.put('/', async c => {
 let input: any, settings;
 try {
  input = await jsonBody(c.req.raw, 2048);
  if (Object.keys(input).sort().join() !== 'revision,settings' || !Number.isSafeInteger(input.revision) || input.revision < 0 || input.revision >= Number.MAX_SAFE_INTEGER) throw new Error('Expected current revision and settings');
  settings = loaderOptions(input.settings);
 } catch (error) { return c.json({ error: (error as Error).message }, 400); }
 const project = c.req.param('project')!, key = c.req.param('hash')!, revision = input.revision + 1;
 const result = await ownerWrites(c, [
  c.env.DB.prepare(`INSERT INTO loader_settings(project,key_hash,revision,settings,updated)
   SELECT ?,?,?,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM loader_settings WHERE project=? AND key_hash=? AND revision=?)
   ON CONFLICT(project,key_hash) DO UPDATE SET revision=excluded.revision,settings=excluded.settings,updated=excluded.updated
   WHERE loader_settings.revision=? RETURNING revision`).bind(project, key, revision, JSON.stringify(settings), Date.now(), input.revision, project, key, input.revision, input.revision),
  auditCommit(c.env.DB, 'changes()=1'),
 ]);
 if (!result[0].results.length) return c.json({ error: 'loader_revision_conflict', ...await readLoader(c.env.DB, project, key) }, 409);
 return c.json({ revision, settings });
});
