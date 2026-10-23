import { ownerProjectRouter, ownerWrites, jsonBody } from '../owner-router';
import { auditCommit } from '../audit/context';
import { maskedConnection, validateConnectionUrl } from './connection';
import { checkInItemLimit } from './item';

// Owner-edited connections from a Sentry monitor slug to one Uptime heartbeat capability URL.
// The URL is a secret: it is validated on save, stored only here and never returned by any read.
export const checkInRoutes = ownerProjectRouter();
const slug = /^[A-Za-z0-9._-]{1,64}$/, limit = 20;
const read = async (c: any) => (await c.env.DB.prepare('SELECT slug,url,enabled,revision,updated FROM checkin_routes WHERE project=? ORDER BY slug').bind(c.req.param('project')!).all()).results.map(maskedConnection as any);
const snapshot = async (c: any) => ({ connections: await read(c), limit, itemLimit: checkInItemLimit, egress: !!c.env.INTEGRATION_EGRESS });
checkInRoutes.get('/', async c => c.json(await snapshot(c)));
checkInRoutes.put('/:slug', async c => {
 const name = c.req.param('slug')!;
 let input: any, url: string | undefined;
 try {
  input = await jsonBody(c.req.raw, 4096);
  if (!slug.test(name) || !Object.keys(input).every(key => ['url', 'enabled'].includes(key)) || typeof input.enabled !== 'boolean') throw new Error('Expected a monitor slug and enabled');
  if (input.url !== undefined) url = validateConnectionUrl(input.url);
 } catch (error) { return c.json({ error: (error as Error).message }, 400); }
 const project = c.req.param('project')!, time = Date.now(), db = c.env.DB;
 const result = await ownerWrites(c, [
  url
   ? db.prepare(`INSERT INTO checkin_routes(project,slug,url,enabled,revision,updated) SELECT ?,?,?,?,1,? WHERE EXISTS(SELECT 1 FROM checkin_routes WHERE project=? AND slug=?) OR (SELECT COUNT(*) FROM checkin_routes WHERE project=?)<?
     ON CONFLICT(project,slug) DO UPDATE SET url=excluded.url,enabled=excluded.enabled,revision=checkin_routes.revision+1,updated=excluded.updated RETURNING slug`).bind(project, name, url, input.enabled ? 1 : 0, time, project, name, project, limit)
   : db.prepare('UPDATE checkin_routes SET enabled=?,revision=revision+1,updated=? WHERE project=? AND slug=? RETURNING slug').bind(input.enabled ? 1 : 0, time, project, name),
  auditCommit(db, 'changes()=1'),
 ]);
 if (!result[0].results.length) return c.json({ error: url ? `At most ${limit} monitor connections per project` : 'No connection for this monitor; send its Uptime heartbeat URL' }, url ? 409 : 404);
 return c.json(await snapshot(c));
});
checkInRoutes.delete('/:slug', async c => {
 const result = await ownerWrites(c, [c.env.DB.prepare('DELETE FROM checkin_routes WHERE project=? AND slug=? RETURNING slug').bind(c.req.param('project')!, c.req.param('slug')!), auditCommit(c.env.DB, 'changes()=1')]);
 if (!result[0].results.length) return c.json({ error: 'No connection for this monitor' }, 404);
 return c.json(await snapshot(c));
});
