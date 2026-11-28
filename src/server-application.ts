import { emitPersonChange } from './domain/agent-door/events';
import { legacyAgentResponse } from './domain/agent-door/legacy';
import { agentDoorResponse } from './domain/agent-door/index.server';
import { resolveMembership } from './domain/members/resolver';
import { reportDialogResponse } from './domain/report-dialog/public.server';
import { loaderResponse } from './domain/loader/public.server';
import api from './domain/api';
import { setupDocumentResponse, setupClaimed } from './domain/setup.server';
import { dispatch } from './base/dispatch';
import { authenticationResponse, authorizeDocument } from './auth/dispatch.server';
import { applicationDocument } from './auth/document-path';
import { ownerSession } from './auth/session.server';
import { agentProject, agentReadPath } from './domain/agent-access';
import { ownerClaimResponse } from './editor/owner-claim.server';
import { editorConfigResponse, editorDocument } from './editor/config.server';
import { providerEventResponse } from './domain/alerts/provider-events.server';
import { staticAssetResponse } from './base/static-assets';
import { admitted, setupStateResponse } from './base/setup-state';
import { lobbyResponse } from './base/lobby';
import { localOwnerLobby } from './auth/local-owner-lobby.server';
import { identity } from './identity';
import { docsResponse, isDocsRequest } from './ui/docs/document.server';
import { ownerErasureResponse } from './domain/erasure/owner-routes';
import { importDoorResponse, openDoorAtClaim } from './domain/sentry-import/door.server';
import { cutoverStatusPath, rerCutoverStatus } from './domain/rer-cutover-status.server';
import type { Bindings } from './auth/bindings';
import type { AlertEnvironment } from './domain/alerts/types';

/** Claim answers (first, refused or already initialized) and every sign-in or
 * session start are owner paths: on a Business-provisioned install the door
 * opens at the first claim (see openDoorAtClaim). The claim has already
 * committed, so a failure here is logged and healed by the next owner path. */
async function afterOwnerPath(env: Bindings, response: Response): Promise<Response> {
 try { await openDoorAtClaim(env); } catch (error) { console.error('import door: first-claim enable failed', error); }
 return response;
}
async function renderDocument(request: Request, env: Bindings) {
 const {default: start} = await import('@tanstack/react-start/server-entry');
 return editorDocument(await start.fetch(request), env);
}

export async function handle(request: Request, env: Bindings & AlertEnvironment, execution: ExecutionContext, path: string): Promise<Response> {
 const agentDoor = await agentDoorResponse(request,env); if(agentDoor)return agentDoor;
 if(path.startsWith('/api/projects/')){const legacy=await legacyAgentResponse(request,env);if(legacy)return legacy;}
 const providerEvent=await providerEventResponse(request,env);if(providerEvent)return providerEvent;
 const reportDialog = await reportDialogResponse(request, env); if (reportDialog) return reportDialog;
 const loader = await loaderResponse(request, env); if (loader) return loader;
 const asset = await staticAssetResponse(request, env); if (asset) return asset;
 const state = await setupStateResponse(request, env, setupClaimed); if (state) return state;
 // Admit the root before reading a native session; owners keep the workbench at /.
 if (path === '/' && (!admitted(request, env.AUTH_ORIGIN) || !await ownerSession(request,env,resolveMembership))) {
  const lobby = await lobbyResponse(request, env, identity, setupClaimed); if (lobby) return localOwnerLobby(lobby, env);
 }
 if (isDocsRequest(request)) return docsResponse(request);
 // Independently mounted owner/auth handlers share the same agent denial.
 if (path.startsWith('/auth/') || path === '/api/editor/config' || path.startsWith('/api/operator/import/')) {
  const grant = await agentProject(request, env.DB);
  if (grant && !agentReadPath(request, grant)) return Response.json({ error: 'Agent keys are read-only and limited to their project.' }, { status: 403 });
 }
 if (path === '/auth/owner-claim') return afterOwnerPath(env, await ownerClaimResponse(request, env));
 if (path === '/api/editor/config') return editorConfigResponse(request, env);
 // Run Edit Run's signed cutover read and the import door (owner session and
 // Business grants) run before ordinary routing.
 if (path === cutoverStatusPath) return rerCutoverStatus(request, env);
 const importDoor = await importDoorResponse(request, env); if (importDoor) return importDoor;
 const ownerErasure = await ownerErasureResponse(request, env); if (ownerErasure) return ownerErasure;
 const auth = await authenticationResponse(request, env);
 if (auth) return path === '/auth/bootstrap' || auth.headers.has('set-cookie') ? afterOwnerPath(env, auth) : auth;
 const response = await dispatch(request, () => api.fetch(request, env, execution), async () => {
  if (!applicationDocument(path)) {
   if (!await ownerSession(request,env,resolveMembership)) return new Response('Not found', { status: 404 });
   // Owners keep the router's styled not-found page, even before project setup.
   return renderDocument(request, env);
  }
  const denied = await authorizeDocument(request, env); if (denied) return denied;
  const setup = await setupDocumentResponse(request, env); if (setup) return setup;
  if (new URL(request.url).pathname === '/app') return Response.redirect(new URL('/', request.url), 303);
  return renderDocument(request, env);
 });
 await emitPersonChange(request,env,response);
 return response;
}
