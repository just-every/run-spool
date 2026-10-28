import { resolveMembership } from '../members/resolver';
import { Hono } from 'hono';
import { ownerSession } from '../../auth/session.server';
import { agentProject } from '../agent-access';
import { hash, scrub } from '../privacy';
import { eventQuery } from './query';
import { ensureReleaseOrderKeys } from '../releases/order';
const routes = new Hono<any>();
const paths = ['/:project/occurrences', '/:project/issues/:issue/occurrences', '/:project/feedback-reports'];
for (const path of paths) routes.use(path, async (c, next) => {
 c.header('Cache-Control', 'no-store'); c.header('X-Content-Type-Options', 'nosniff');
 const project = c.req.param('project'), grant = await agentProject(c.req.raw, c.env.DB);
 if (grant !== project && !await ownerSession(c.req.raw,c.env,resolveMembership)) return c.json({ error: 'Sign in required' }, 401);
 if (grant && grant !== project) return c.json({ error: 'Sign in required' }, 401);
 if (!await c.env.DB.prepare('SELECT 1 FROM projects WHERE id=?').bind(project).first()) return c.json({ error: 'Project not found' }, 404);
 await next();
});
async function records(c: any, feedback: boolean) {
 const project = c.req.param('project'), issue = c.req.param('issue') ?? c.req.query('issue') ?? null;
 const q = c.req.query('q') ?? '', order = c.req.query('order') ?? 'newest';
 if (!['oldest', 'newest'].includes(order)) throw new Error('Record order must be oldest or newest');
 if (feedback && q) throw new Error('Feedback reports do not support an event query');
 const query = eventQuery(q);
 if (query.usesLatest) await ensureReleaseOrderKeys(c.env.DB, project);
 if (issue && !await c.env.DB.prepare('SELECT 1 FROM issues WHERE project=? AND id=?').bind(project, issue).first()) return c.json({ error: 'Issue not found' }, 404);
 const signature = await hash(JSON.stringify([feedback ? 'feedback-v1' : 'occurrences-v1', project, issue, q, order]));
 let cursor: { signature: string; received: number; id: string } | null = null;
 if (c.req.query('cursor')) {
  try { cursor = JSON.parse(atob(c.req.query('cursor'))); } catch { throw new Error('Invalid record cursor'); }
  if (cursor?.signature !== signature || !Number.isSafeInteger(cursor.received) || cursor.received < 0 || typeof cursor.id !== 'string' || cursor.id.length > 150) throw new Error('Record cursor belongs to another query');
 }
 const table = feedback ? 'f' : 'e', direction = order === 'oldest' ? 'ASC' : 'DESC', comparison = order === 'oldest' ? '>' : '<';
 const from = feedback ? 'feedback f LEFT JOIN events e ON e.project=f.project AND e.id=f.event_id AND e.occurrence=f.occurrence' : 'events e';
 const where = `${table}.project=?${issue ? ' AND e.issue=?' : ''}${feedback ? '' : ` AND (${query.sql})`}`;
 const args = [project, ...issue ? [issue] : [], ...feedback ? [] : query.args];
 const columns = feedback ? 'f.id,f.message,f.received,f.event_id,f.occurrence,e.issue' : "e.id,e.occurrence,e.issue,e.received,e.release,e.build,e.environment,json_extract(e.payload,'$.type') type,json_extract(e.payload,'$.message') message";
 const [page, total] = await Promise.all([
  c.env.DB.prepare(`SELECT ${columns} FROM ${from} WHERE ${where}${cursor ? ` AND (${table}.received,${table}.id)${comparison}(?,?)` : ''} ORDER BY ${table}.received ${direction},${table}.id ${direction} LIMIT 26`).bind(...args, ...cursor ? [cursor.received, cursor.id] : []).all(),
  c.env.DB.prepare(`SELECT COUNT(*) total FROM ${from} WHERE ${where}`).bind(...args).first(),
 ]);
 const rows = page.results.slice(0, 25).map((row: any) => feedback ? {
  id: row.id, message: scrub(row.message), received: row.received, eventId: row.event_id, issueId: row.issue ?? null,
  association: row.occurrence ? 'attached' : row.event_id ? 'event_unavailable' : 'standalone',
 } : { ...row, type: scrub(row.type), message: scrub(row.message) });
 const last = page.results[24];
 return c.json({ version: 1, project, rows, total: total.total, next: page.results.length > 25 ? btoa(JSON.stringify({ signature, received: last.received, id: last.id })) : null,
  bounds: { pageSize: 25 }, order, coverage: feedback ? 'Retained scrubbed descriptions and exact-occurrence association only; withdrawn reports are absent.' : 'Retained occurrence metadata only; source, local variables, user identity and attachments are excluded. Cursors observe current retained data.' });
}
routes.get('/:project/occurrences', c => records(c, false));
routes.get('/:project/issues/:issue/occurrences', c => records(c, false));
routes.get('/:project/feedback-reports', c => records(c, true));
export default routes;
