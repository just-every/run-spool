import { resolveMembership } from '../domain/members/resolver';
import { AuthError, devNotFound, safeReturnTo } from '../modules/operator-auth/index.mjs';
import { fontHead } from '../base/font-head';
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
 if (path === '/sign-in' || path === '/signin') {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
  if (await ownerSession(request,env,resolveMembership)) return new Response(null, { status: 303, headers: { Location: '/app', 'Cache-Control': 'no-store' } });
  return await signInPage(request, env);
 }
 return null;
}
export async function authorizeDocument(request: Request, env: Bindings): Promise<Response | null> {
 try { if (await ownerSession(request,env,resolveMembership)) return null; }
 catch (error) {
  if (!(error instanceof AuthError) || error.status !== 404 || !new URL(request.url).pathname.startsWith('/projects/')) throw error;
  return new Response(request.method === 'HEAD' ? null : `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Project unavailable · Spool</title>${fontHead}<link rel="stylesheet" href="/theme/spool.css"><link rel="stylesheet" href="/theme/sign-in.css"></head><body><main class="signin"><header class="signin-header"><a class="wordmark" href="/">Spool</a></header><section class="signin-panel card"><h1>This project is unavailable</h1><p class="signin-intro">This project may have been removed or your access may have changed. Ask an administrator or return to your issues.</p><a class="primary-button" href="/">Back to issues</a></section></main></body></html>`, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'" } });
 }
 return new Response(null, { status: 303, headers: { Location: '/sign-in?returnTo=' + encodeURIComponent(safeReturnTo(new URL(request.url).pathname + new URL(request.url).search, '/')), 'Cache-Control': 'no-store' } });
}
