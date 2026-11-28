import type { Bindings } from './auth/bindings';
import { applicationDocument } from './auth/document-path';
import { setupClaimed, setupDocumentResponse } from './domain/setup.server';
import { admitted, setupStateResponse } from './base/setup-state';
import { lobbyResponse } from './base/lobby';
import { localOwnerLobby } from './auth/local-owner-lobby.server';
import { identity } from './identity';
import { workbenchShellAsset } from './ui/workbench/shell-document';

export async function renderDocument(request: Request, env: Bindings, workbench = false) {
 const {editorDocument} = await import('./editor/config.server');
 if (workbench && import.meta.env?.PROD && env.RER_DEMO !== '1' && (request.method === 'GET' || request.method === 'HEAD')) {
  if (!env.ASSETS) throw new Error('Workbench assets are not bound');
  const shell = await env.ASSETS.fetch(new Request(new URL(workbenchShellAsset, request.url), { method: request.method }));
  if (!shell.ok) throw new Error('Workbench shell is missing from this build');
  return editorDocument(shell, env);
 }
 const {default: start} = await import('@tanstack/react-start/server-entry');
 return editorDocument(await start.fetch(request), env);
}

/** Document requests can use the native admission path before loading API handlers. */
export async function consoleDocument(request: Request, env: Bindings, path: string): Promise<Response | null> {
 if (path === '/sign-in' || path === '/signin') {
  const {authenticationResponse} = await import('./auth/dispatch.server');
  return authenticationResponse(request, env);
 }
 if (path === '/setup/state') return setupStateResponse(request, env, setupClaimed);
 if (!applicationDocument(path)) return null;
 const hosted = env.AUTH_LOCAL !== 'true' && env.RER_DEMO !== '1';
 let rootAdmitted = false;
 if (path === '/') {
  if (admitted(request, env.AUTH_ORIGIN) && (!hosted || request.headers.has('cookie'))) {
   const [{ownerSession}, {resolveMembership}] = await Promise.all([import('./auth/session.server'), import('./domain/members/resolver')]);
   rootAdmitted = !!await ownerSession(request, env, resolveMembership);
  }
  if (!rootAdmitted) {
   const lobby = await lobbyResponse(request, env, identity, setupClaimed);
   if (lobby) return localOwnerLobby(lobby, env);
  }
 }
 if (!rootAdmitted) {
  const {authorizeDocument} = await import('./auth/dispatch.server');
  const denied = await authorizeDocument(request, env);
  if (denied) return denied;
 }
 const setup = await setupDocumentResponse(request, env);
 if (setup) return setup;
 if (path === '/app') return Response.redirect(new URL('/', request.url), 303);
 // The root route only redirects to the project workbench. Keep document
 // navigation's status and headers without initializing Start for that redirect.
 if (path === '/' && hosted && import.meta.env?.PROD && (request.method === 'GET' || request.method === 'HEAD') && /(^|,)\s*(\*\/\*|text\/html)/.test(request.headers.get('accept') || '*/*')) {
  const {editorDocument} = await import('./editor/config.server');
  return editorDocument(new Response(null, {status:307, headers:{Location:'/projects'}}), env);
 }
 return renderDocument(request, env, path === '/projects' || path.startsWith('/projects/'));
}
