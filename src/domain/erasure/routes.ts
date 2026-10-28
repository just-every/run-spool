import { Hono } from 'hono';
import { agentAuthority } from '../agent-door/native-authority';
import { agentErasureDatabase } from '../agent-door/erasure';
import { ownerDatabase } from '../owner-authority';
import { requestAuthority as ownerSession, nativeWrite as ownerWrite } from '../agent-door/native-authority';
import { runtimeBindings, type Bindings } from '../../auth/bindings';
import { ErasureError } from '../../modules/erasure/index.mjs';
import { hash } from '../privacy';
import { deniedResponse } from '../denied-response';
import { erasureExceptions } from './declaration';
import { projectErasureService, startProjectErasure, resumeProjectErasure, receiptView } from './service';

// Owner-only BASE-DATA-003 project erasure. These routers check their own
// direct transport: any project grant (ingest, agent or deploy key) is refused
// with 403, an anonymous request with 401, and owner writes must be same-origin.
type Env = { Bindings: Bindings };

async function guard(c: any, next: () => Promise<void>) {
 const env = runtimeBindings(c.env);
 const bearer = /^Bearer\s+(\S+)$/i.exec(c.req.header('authorization') ?? '')?.[1];
 if (bearer && await env.DB.prepare('SELECT 1 FROM credentials WHERE hash=?').bind(await hash(bearer)).first()) return deniedResponse(c.req.raw, c.json({ error: 'Project grants cannot erase projects' }, 403));
 const session = await ownerSession(c.req.raw, env);
 if (!session || session.operator.role!=='owner') return deniedResponse(c.req.raw, c.json({ error: 'Owner session required' }, 401));
 if (!['GET', 'HEAD'].includes(c.req.method) && !ownerWrite(c.req.raw, env)) return deniedResponse(c.req.raw, c.json({ error: 'Same-origin required' }, 403));
 await next();
}
const failure = (c: any, error: unknown) => {
 if (error instanceof ErasureError) return c.json({ error: error.code.startsWith('held:') ? error.code.slice(5) : error.code }, error.status as any);
 throw error;
};
async function confirmation(c: any) {
 const declared = Number(c.req.header('content-length') ?? 0);
 if (declared > 2048) return null;
 try { const value = JSON.parse(await c.req.text()); return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => ['confirm', 'planHash'].includes(key)) ? value : null; } catch { return null; }
}

export const projectErasureRoutes = new Hono<Env>();
projectErasureRoutes.use('*', guard);
projectErasureRoutes.get('/', async c => {
 const project = c.req.param('project')!;
 try {
  const preview = await (await projectErasureService(c.env.DB)).preview('project', { id: project });
  return c.json({ deleted: preview.deleted, redacted: preview.redacted, retained: preview.retained, exceptions: erasureExceptions, planHash: preview.planHash, hold: preview.hold?.replace(/^held:/, '') ?? null });
 } catch (error) { return failure(c, error); }
});
projectErasureRoutes.post('/', async c => {
 const project = c.req.param('project')!;
 if (!await c.env.DB.prepare('SELECT 1 FROM projects WHERE id=?').bind(project).first()) return deniedResponse(c.req.raw, c.json({ error: 'Project not found' }, 404));
 const input = await confirmation(c);
 // Typed confirmation: the exact project identifier, plus the previewed plan.
 if (!input || input.confirm !== project || typeof input.planHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.planHash)) return c.json({ error: 'Type the project identifier to confirm erasure' }, 400);
 try {
  const receipt = await startProjectErasure(agentAuthority(c.req.raw)?agentErasureDatabase(c.env.DB,agentAuthority(c.req.raw)!):c.env.DB, project, input.planHash);
  c.header('Location', `/api/erasures/${receipt.id}`);
  c.header('Cache-Control', 'no-store');
  return c.json(receiptView(receipt), 202);
 } catch (error) { return failure(c, error); }
});

export const erasureReceiptRoutes = new Hono<Env>();
erasureReceiptRoutes.use('*', guard);
erasureReceiptRoutes.get('/', async c => {
 const erasure = await projectErasureService(c.env.DB);
 const rows = (await c.env.DB.prepare("SELECT id FROM rer_erasure_operations WHERE entity='project' ORDER BY requested_at DESC LIMIT 20").all<{ id: string }>()).results;
 return c.json(await Promise.all(rows.map(async ({ id }) => receiptView(await erasure.receipt(id)))));
});
erasureReceiptRoutes.get('/:id', async c => {
 try { return c.json(receiptView(await (await projectErasureService(c.env.DB)).receipt(c.req.param('id')))); } catch (error) { return failure(c, error); }
});

// Explicit owner-only continuation: GET remains a side-effect-free status read.
erasureReceiptRoutes.post('/:id/resume', async c => {
 try {
  const actor=agentAuthority(c.req.raw),saved=await c.env.DB.prepare('SELECT principal FROM spool_erasure_agents WHERE operation=?').bind(c.req.param('id')).first<{principal:string}>();
  if(actor&&saved){const principal=JSON.parse(saved.principal);if(principal.person.id!==actor.context.person.id||principal.agent.id!==actor.context.agent.id||principal.consent!==actor.context.consent)return c.json({error:'Erasure not found'},404);}
  const receipt = await resumeProjectErasure(agentAuthority(c.req.raw)?ownerDatabase(c.env.DB,agentAuthority(c.req.raw)!):c.env.DB, c.req.param('id'));
  c.header('Cache-Control', 'no-store');
  return c.json(receiptView(receipt), receipt.phase === 'complete' ? 200 : 202);
 } catch (error) {
  if (error instanceof ErasureError && error.code === 'erasure_busy') {
   const receipt = await (await projectErasureService(c.env.DB)).receipt(c.req.param('id'));
   return c.json(receiptView(receipt), receipt.phase === 'complete' ? 200 : 202);
  }
  return failure(c, error);
 }
});
