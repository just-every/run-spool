import { Hono } from 'hono';
import { ownerSession } from '../../auth/session.server';
import { resolveMembership } from '../members/resolver';
import { computeReport } from './index';
import { reportExport } from './export';
import { currentProjects, finishRead } from '../dashboards/authority';
import { ReportScopeError } from './read';
import { AuthError } from '../../modules/operator-auth/index.mjs';

/** This independently mounted read door accepts people, never ingest or agent
 * credentials. A requested scope always intersects current project authority. */
export const reportRoutes = new Hono<any>();
reportRoutes.get('/', async c => {
 c.header('Cache-Control', 'no-store');
 c.header('X-Content-Type-Options', 'nosniff');
 if (c.req.header('authorization')) return c.json({ error: 'Project scope required' }, 403);
 const session = await ownerSession(c.req.raw, c.env, resolveMembership);
 if (!session) return c.json({ error: 'Sign in required' }, 401);
 const authority = await currentProjects(c.env.DB, session);
 const available = [...authority.values()];
 const requested = [...new Set((c.req.query('projects') ?? '').split(',').filter(Boolean))];
 const projects = available.filter((p: any) => !requested.length || requested.includes(p.id)).map((p: any) => p.id);
 if (!projects.length) return c.json({ error: 'Project not found' }, 404);
 if (projects.length > 100) return c.json({ error: 'report_project_limit', limit: 100, action: 'Choose a narrower project scope.' }, 413);
 const to = c.req.query('to') === undefined ? Date.now() : Number(c.req.query('to'));
 const from = c.req.query('from') === undefined ? Math.max(0, to - 30 * 86400000) : Number(c.req.query('from'));
 const input = { from, to, timeZone: c.req.query('timeZone') ?? 'UTC', ...(c.req.query('team') ? { team: c.req.query('team') } : {}) };
 const report = await computeReport(c.env.DB, projects, input);
 if (!report.scope.projects.length) return c.json({ error: 'Project not found' }, 404);
 const result = { ...report, omission: { projects: requested.filter(id => !projects.includes(id)).length, reason: 'Only currently accessible projects are included. Omitted project names and rows are withheld.' } };
 const format = c.req.query('format');
 if (format !== undefined && !['csv', 'json'].includes(format)) throw new Error('Export format must be json or csv');
 const response = c.req.query('download') === '1' || format ? reportExport(result, format ?? 'json') : c.json(result);
 if (response.status >= 400) return response;
 await finishRead(c.env.DB, session, report.scope.projects.map((id: string) => authority.get(id)!));
 return response;
});
reportRoutes.onError((error, c) => {
 if (error instanceof ReportScopeError) return c.json({ error: error.code, limit: error.limit, matched: error.matched, action: error.action }, 413);
 if (error instanceof AuthError) return c.json({ error: error.code }, error.status as any);
 throw error;
});
