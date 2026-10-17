import { ownerProjectRouter, ownerWrites } from '../owner-router';
import { AuthError } from '../../modules/operator-auth/index.mjs';
import { scrub, hash } from '../privacy';
import { feedbackCoverage, feedbackLimits } from './input';
import { withdrawalStatements } from './custody';

export const feedbackRoutes = ownerProjectRouter();
feedbackRoutes.onError((error, c) => {
 if (error instanceof AuthError) return c.json({ error: error.code }, error.status as any);
 throw error;
});
feedbackRoutes.get('/', async c => {
 const project = c.req.param('project')!, issue = c.req.query('issue') ?? null;
 const limit = c.req.query('limit') === undefined ? 25 : Number(c.req.query('limit'));
 if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) return c.json({ error: 'Feedback page size must be between 1 and 100' }, 400);
 if (issue && !await c.env.DB.prepare('SELECT 1 FROM issues WHERE project=? AND id=?').bind(project, issue).first()) return c.json({ error: 'Issue not found' }, 404);
 const signature = await hash(JSON.stringify([project, issue]));
 let cursor: { received: number; id: string; signature: string } | null = null;
 if (c.req.query('cursor')) {
  try {
   cursor = JSON.parse(atob(c.req.query('cursor')!));
   if (!cursor || cursor.signature !== signature || !Number.isSafeInteger(cursor.received) || cursor.received < 0 || !/^(?:[a-f0-9]{32}|user-report-[a-f0-9]{32})$/.test(cursor.id)) throw new Error();
  } catch { return c.json({ error: 'Invalid feedback cursor for this query' }, 400); }
 }
 const where = 'f.project=?' + (issue ? ' AND e.issue=?' : '');
 const args = [project, ...issue ? [issue] : []];
 const join = 'FROM feedback f LEFT JOIN events e ON e.project=f.project AND e.id=f.event_id AND e.occurrence=f.occurrence';
 const [page, total] = await Promise.all([
  c.env.DB.prepare(`SELECT f.*,e.issue ${join} WHERE ${where} ${cursor ? 'AND (f.received,f.id)<(?,?)' : ''} ORDER BY f.received DESC,f.id DESC LIMIT ?`).bind(...args, ...cursor ? [cursor.received, cursor.id] : [], limit + 1).all<any>(),
  c.env.DB.prepare(`SELECT COUNT(*) count ${join} WHERE ${where}`).bind(...args).first<{ count: number }>(),
 ]);
 const rows = page.results.slice(0, limit), last = rows.at(-1);
 return c.json({
  items: rows.map(row => ({ id: row.id, message: scrub(row.message), received: row.received, eventId: row.event_id, issueId: row.issue ?? null,
   association: row.occurrence ? 'attached' : row.event_id ? 'event_unavailable' : 'standalone' })),
  total: total!.count, next: page.results.length > limit && last ? btoa(JSON.stringify({ signature, received: last.received, id: last.id })) : null,
  bounds: { limit, retained: feedbackLimits.retained, perMinute: feedbackLimits.perMinute, messageCharacters: feedbackLimits.message }, coverage: feedbackCoverage,
 });
});
feedbackRoutes.delete('/:id', async c => {
 const project = c.req.param('project')!, id = c.req.param('id');
 const row = await c.env.DB.prepare('SELECT digest FROM feedback WHERE project=? AND id=?').bind(project, id).first<{ digest: string }>();
 if (!row) return c.json({ error: 'Feedback not found' }, 404);
 try {
  await ownerWrites(c, await withdrawalStatements(c.env.DB, project, id, row.digest));
 } catch (error) {
  if (/rer_portability_guard|CHECK constraint failed/.test(String(error))) return c.json({ error: 'Feedback or archive custody changed; refresh before withdrawing' }, 409);
  throw error;
 }
 return c.json({ withdrawn: true, externalCopies: 'Downloaded archives and external copies must be removed separately; an older archive requires the later erasure journal on a new installation.' });
});
