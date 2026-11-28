import type { Context, Next } from 'hono';
import { AuthError } from '../modules/operator-auth/errors.mjs';
import { PortabilityError } from '../modules/portability/storage.mjs';
import type { Bindings } from '../auth/bindings';
import { agentProject, agentReadPath } from './agent-access';
import { deniedResponse } from './denied-response';
import { scrub } from './privacy';

type ApiContext = Context<{Bindings:Bindings;Variables:{project:string|null}}>;

export async function apiAccess(c: ApiContext, next: Next) {
  c.header('Cache-Control','no-store');
  c.header('X-Content-Type-Options','nosniff');
  const grant=await agentProject(c.req.raw,c.env.DB);
  c.set('project',grant);
  // This precedes every independently mounted ingest, deploy and import router.
  if(grant&&!agentReadPath(c.req.raw,grant))return deniedResponse(c.req.raw,c.json({error:'Agent grants are limited to project evidence and inert grouping proposals.'},403));
  await next();
}
export function apiError(err: Error, c: Pick<ApiContext, 'json' | 'req'>) {
  if(['REVIEW_FINGERPRINT_MISMATCH','NATIVE_EDIT_CONFLICT','OPERATION_KEY_CONFLICT','DUPLICATE_SOURCE_CONFLICT','IMPORT_ATOMIC_GUARD','REVERSAL_MODE_CONFLICT','UNDO_REQUIRES_COMPLETED_IMPORT'].includes(err.message))return c.json({error:err.message},409);
  if(err instanceof AuthError)return c.json({error:err.code},err.status as any);
  if(err instanceof PortabilityError)return c.json({error:err.code},err.status as any);
  if(err.message.includes('restore_in_progress'))return c.json({error:'Restore in progress'},409);
  const storage=err.message.startsWith('D1')&&!/(SQLITE_CONSTRAINT|constraint failed)/i.test(err.message);
  if(storage)return c.req.path.startsWith('/api/ingest/')?c.json({outcome:'unavailable',reason:'transaction_not_confirmed'},503):c.json({error:'Storage operation not confirmed'},503);
  return c.json({error:err.message.startsWith('D1')?'Storage operation failed':scrub(err.message)},400);
}
