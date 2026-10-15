import { devNotFound, safeReturnTo } from '../modules/operator-auth/index.mjs';
import { fontDocumentResponse } from '../base/font-response';
import { authResponse, ownerSession } from './session.server';
import { signInPage } from './sign-in.server';
import { linkedOidcPresentation } from './oidc-presentation.server';
import type { Bindings } from './bindings';
export async function authenticationResponse(request: Request, env: Bindings): Promise<Response | null> {
 const path = new URL(request.url).pathname;
 if (path === '/__dev/personas' || path === '/auth/dev/enter') return devNotFound();
 if (path.startsWith('/__dev/')) return devNotFound();
 // The identity link's well-known document, keys and callback belong to Base's dependency routes.
 if (path.startsWith('/auth/') || path.startsWith('/.well-known/rer-')) {
  const response = await linkedOidcPresentation(request, nativeRequest => authResponse(nativeRequest, env));
  if (response && path === '/auth/magic-link' && request.method === 'POST' && request.headers.get('accept')?.includes('text/html')) {
   return await signInPage(request, env, response.status);
  }
  return (await fontDocumentResponse(response)) ?? new Response('Not found', { status: 404 });
 }
 if (path === '/sign-in' || path === '/signin') return ['GET', 'HEAD'].includes(request.method) ? await signInPage(request, env) : new Response('Method not allowed', { status: 405 });
 return null;
}
export async function authorizeDocument(request: Request, env: Bindings): Promise<Response | null> {
 if (await ownerSession(request, env)) return null;
 return new Response(null, { status: 303, headers: { Location: '/sign-in?returnTo=' + encodeURIComponent(safeReturnTo(new URL(request.url).pathname + new URL(request.url).search, '/')), 'Cache-Control': 'no-store' } });
}
