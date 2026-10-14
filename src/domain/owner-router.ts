import { Hono } from 'hono';
import { ownerSession, ownerWrite } from '../auth/session.server';
import { ownerBatch, type OwnerSession } from './owner-authority';
import { runtimeBindings, type Bindings } from '../auth/bindings';

export type OwnerContext = { Bindings: Bindings; Variables: { ownerSession: OwnerSession } };
// A project router that authenticates its own direct transport as well as its
// parent API mount: owner session, same-origin writes, an existing project.
export function ownerProjectRouter() {
 const routes = new Hono<OwnerContext>();
 routes.use('*', async (c, next) => {
  const env = runtimeBindings(c.env), session = await ownerSession(c.req.raw, env);
  if (!session) return c.json({ error: 'Owner session required' }, 401);
  c.set('ownerSession', session);
  if (!['GET', 'HEAD'].includes(c.req.method) && !ownerWrite(c.req.raw, env)) return c.json({ error: 'Same-origin required' }, 403);
  if (!await c.env.DB.prepare('SELECT 1 FROM projects WHERE id=?').bind(c.req.param('project')!).first()) return c.json({ error: 'Project not found' }, 404);
  await next();
 });
 return routes;
}
export const ownerWrites = (c: any, statements: D1PreparedStatement[]) => ownerBatch(c.env.DB, c.get('ownerSession'), statements);

// A bounded JSON object body; oversize is refused, never cut.
export async function jsonBody(request: Request, limit: number): Promise<any> {
 const reader = request.body?.getReader(); if (!reader) throw new Error('Invalid request body');
 let size = 0; const chunks: Uint8Array[] = [];
 for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > limit) { await reader.cancel(); throw new Error('Request body too large'); } chunks.push(part.value); }
 const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
 try { const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); if (value && typeof value === 'object' && !Array.isArray(value)) return value; } catch { /* refused below */ }
 throw new Error('Invalid request body');
}
