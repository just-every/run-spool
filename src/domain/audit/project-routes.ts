import { Hono } from 'hono';
import { ownerSession } from '../../auth/session.server';
import { resolveMembership } from '../members/resolver';
import { agentProject } from '../agent-access';
import { hash } from '../privacy';
import { recordParameters, recordCursor, nextRecordCursor, recordFilter } from '../investigation/record-page';
import { projectAuditLabel } from './identity';
import { projectAuditRow } from './archive';
import { auditHighWater } from './read';
import { auditActions, outcomes, type AuditRow } from './types';

const routes = new Hono<any>();
routes.use('/:project/audit-records', async (c, next) => {
 c.header('Cache-Control', 'no-store'); c.header('X-Content-Type-Options', 'nosniff');
 const project = c.req.param('project'), grant = await agentProject(c.req.raw, c.env.DB);
 if (grant !== project && !await ownerSession(c.req.raw, c.env, resolveMembership) || grant && grant !== project) return c.json({error:'Sign in required'},401);
 if (!await c.env.DB.prepare('SELECT 1 FROM projects WHERE id=?').bind(project).first()) return c.json({error:'Project not found'},404);
 await next();
});
routes.get('/:project/audit-records', async c => {
 const project = c.req.param('project'), url = new URL(c.req.url);
 const db: D1Database = c.env.DB;
 const {order, direction, comparison} = recordParameters(url, ['order','cursor','action','outcome']);
 const action = recordFilter(url.searchParams.get('action'),100), outcome = recordFilter(url.searchParams.get('outcome'),30);
 if (action !== null && !auditActions.includes(action as any) || outcome !== null && !outcomes.includes(outcome as any)) throw new Error('Invalid audit filter');
 const label = await projectAuditLabel(db,project);
 const signature = await hash(JSON.stringify(['audit-records-v1',project,label,action,outcome,order]));
 const cursor = recordCursor(c.req.query('cursor'),signature), maximum = await auditHighWater(db);
 const highWater = cursor ? Number(cursor.id) : maximum;
 if (!Number.isSafeInteger(highWater) || highWater < 0 || highWater > maximum || cursor && (!/^\d{1,16}$/.test(cursor.id) || cursor.time > highWater)) throw new Error('Invalid audit cursor');
 const where = 'project_label=? AND sequence<=?' + (action === null ? '' : ' AND action=?') + (outcome === null ? '' : ' AND outcome=?');
 const args = [label,highWater,...action === null ? [] : [action],...outcome === null ? [] : [outcome]];
 const [page,total] = await Promise.all([
  db.prepare(`SELECT * FROM spool_audit_events WHERE ${where}${cursor ? ` AND sequence${comparison}?` : ''} ORDER BY sequence ${direction} LIMIT 26`).bind(...args,...cursor ? [cursor.time] : []).all<AuditRow>(),
  db.prepare(`SELECT COUNT(*) total FROM spool_audit_events WHERE ${where}`).bind(...args).first<{total:number}>(),
 ]);
 const rows = page.results.slice(0,25).map(projectAuditRow), last = rows[24];
 return c.json({version:1,project,rows,total:total!.total,highWater,order,filters:{action,outcome},bounds:{pageSize:25},
  next:page.results.length > 25 ? nextRecordCursor(signature,last.sequence,String(highWater)) : null,
  coverage:'Privacy-safe facts attributed to this current project alias. A traversal fixes its high-water sequence; later facts appear on refresh. Installation facts and other projects are excluded. Private restore preserves historical facts without reviving attribution links, so detached history remains in the organization audit only.'});
});
export default routes;
