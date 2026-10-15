import { withDemo } from './modules/demo/index.mjs';
import { seedDemo } from './demo';
import start from '@tanstack/react-start/server-entry';
import api from './domain/api';
import { setupDocumentResponse, setupClaimed } from './domain/setup.server';
import { dispatch } from './base/dispatch';
import { authenticationResponse, authorizeDocument } from './auth/dispatch.server';
import { applicationDocument } from './auth/document-path';
import { ownerSession } from './auth/session.server';
import { agentProject, agentReadPath } from './domain/agent-access';
import { privateRuntimePath } from './auth/private-runtime.server';
import { runtimeBindings, type Bindings } from './auth/bindings';
import { ownerClaimResponse } from './editor/owner-claim.server';
import { editorConfigResponse, editorDocument } from './editor/config.server';
import { runAlerts } from './domain/alerts/dispatch';
import { staticAssetResponse } from './base/static-assets';
import { admitted, setupStateResponse } from './base/setup-state';
import { lobbyResponse } from './base/lobby';
import { identity } from './identity';
import { docsResponse, isDocsRequest } from './ui/docs/document.server';
import { continueErasures } from './domain/erasure/service';
import { ownerErasureResponse } from './domain/erasure/owner-routes';
import type { AlertEnvironment } from './domain/alerts/types';
export async function scheduled(event: ScheduledController, bindings: Bindings & AlertEnvironment, _execution: ExecutionContext) {
 const env = runtimeBindings(bindings) as Bindings & AlertEnvironment;
 await runAlerts(env,event.scheduledTime);
 // A project erasure that outlived its request continues here.
 await continueErasures(env.DB, Date.now() + 20_000);
}
export default withDemo({
 scheduled,
 async fetch(request, bindings, execution) {
  if (privateRuntimePath(request.url)) return new Response('Not found', { status: 404 });
  const env = runtimeBindings(bindings as Bindings);
  const path = new URL(request.url).pathname;
  const asset = await staticAssetResponse(request, env); if (asset) return asset;
  const state = await setupStateResponse(request, env, setupClaimed); if (state) return state;
  // Admit the root before reading a native session; owners keep the workbench at /.
  if (path === '/' && (!admitted(request, env.AUTH_ORIGIN) || !await ownerSession(request, env))) {
   const lobby = await lobbyResponse(request, env, identity, setupClaimed); if (lobby) return lobby;
  }
  if (isDocsRequest(request)) return docsResponse(request);
  // Independently mounted owner/auth handlers share the same agent denial.
  if (path.startsWith('/auth/') || path === '/api/editor/config') {
   const grant = await agentProject(request, env.DB);
   if (grant && !agentReadPath(request, grant)) return Response.json({ error: 'Read-only project scope required' }, { status: 403 });
  }
  if (path === '/auth/owner-claim') return ownerClaimResponse(request, env);
  if (path === '/api/editor/config') return editorConfigResponse(request, env);
  const ownerErasure = await ownerErasureResponse(request, env); if (ownerErasure) return ownerErasure;
  const auth = await authenticationResponse(request, env); if (auth) return auth;
  return dispatch(request, () => api.fetch(request, env, execution), async () => {
   if (!applicationDocument(path)) {
    if (!await ownerSession(request, env)) return new Response('Not found', { status: 404 });
    // Owners keep the router's styled not-found page, even before project setup.
    return editorDocument(await start.fetch(request), env);
   }
   const denied = await authorizeDocument(request, env); if (denied) return denied;
   const setup = await setupDocumentResponse(request, env); if (setup) return setup;
   if (new URL(request.url).pathname === '/app') return Response.redirect(new URL('/', request.url), 303);
   return editorDocument(await start.fetch(request), env);
  });
 },
} satisfies ExportedHandler<Bindings & AlertEnvironment>, { seed: seedDemo });
