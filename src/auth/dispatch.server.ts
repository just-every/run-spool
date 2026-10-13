import { devNotFound, safeReturnTo } from '../modules/operator-auth/index.mjs';
import { fontDocumentResponse } from '../base/font-response';
import { authResponse, ownerSession } from './session.server';
import { developmentOutboxResponse } from './outbox.server.mjs';
import { signInDocument } from './sign-in.server';
import type { Bindings } from './bindings';
export async function authenticationResponse(request: Request, env: Bindings): Promise<Response | null> {
 const path = new URL(request.url).pathname;
 if (path === '/__dev/personas' || path === '/auth/dev/enter') return devNotFound();
 if (path === '/__dev/outbox' || path === '/__dev/key') return developmentOutboxResponse(request, env);
 if (path.startsWith('/auth/')) {
  const response = await authResponse(request, env);
  if (response && path === '/auth/magic-link' && request.method === 'POST' && request.headers.get('accept')?.includes('text/html')) {
   return signInDocument(request, env, response.status);
  }
  return (await fontDocumentResponse(response)) ?? new Response('Not found', { status: 404 });
 }
 if (path === '/sign-in') return ['GET', 'HEAD'].includes(request.method) ? signInDocument(request, env) : new Response('Method not allowed', { status: 405 });
 return null;
}
export async function authorizeDocument(request: Request, env: Bindings): Promise<Response | null> {
 if (await ownerSession(request, env)) return null;
 return new Response(null, { status: 303, headers: { Location: '/sign-in?returnTo=' + encodeURIComponent(safeReturnTo(new URL(request.url).pathname + new URL(request.url).search, '/')), 'Cache-Control': 'no-store' } });
}
