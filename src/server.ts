import { wrapRequest } from './domain/audit/request';
import { deploymentTimeouts } from './domain/deployments/timeouts';
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
import { providerEventResponse } from './domain/alerts/provider-events.server';
import { runAlerts } from './domain/alerts/dispatch';
import { queueDigests } from './domain/alerts/digests';
import { scheduledMail } from './domain/alerts/scheduled-mail';
import { scanFollowUp } from './domain/follow-up/scan';
import { queueNotices, dispatchNotices } from './domain/follow-up/notices';
import { staticAssetResponse } from './base/static-assets';
import { admitted, setupStateResponse } from './base/setup-state';
import { lobbyResponse } from './base/lobby';
import { identity } from './identity';
import { docsResponse, isDocsRequest } from './ui/docs/document.server';
import { continueErasures } from './domain/erasure/service';
import { ownerErasureResponse } from './domain/erasure/owner-routes';
import { AuthError } from './modules/operator-auth/index.mjs';
import type { AlertEnvironment } from './domain/alerts/types';
import { importDoorResponse, openDoorAtClaim } from './domain/sentry-import/door.server';
import { cutoverStatusPath, rerCutoverStatus } from './domain/rer-cutover-status.server';
export async function scheduled(event: ScheduledController, bindings: Bindings & AlertEnvironment, _execution: ExecutionContext) {
 const env = runtimeBindings(bindings) as Bindings & AlertEnvironment;
 try {
  await deploymentTimeouts(env,event.scheduledTime);
  await runAlerts(env,event.scheduledTime);
 } finally {
  // A broken dispatcher must not prevent independent operator follow-up.
  await scanFollowUp(env,event.scheduledTime);
  await queueDigests(env,event.scheduledTime);
  await scheduledMail(env,event.scheduledTime);
  await queueNotices(env,event.scheduledTime);
  await dispatchNotices(env,event.scheduledTime);
 }
 // Accepted erasure jobs continue here after the client disconnects.
 await continueErasures(env.DB, Date.now() + 20_000);
}
// A refusal raised while reading the session (a foreign Host, for one) answers as
// itself, the way the API's handlers answer it, instead of escaping the Worker.
function refused(error: unknown) {
 if (!(error instanceof AuthError)) throw error;
 return new Response(`Request refused: ${error.code}`, { status: error.status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
export default withDemo({
 scheduled,
 async fetch(request, bindings, execution) {
  return wrapRequest(request,runtimeBindings(bindings),()=>handle(request, bindings, execution)).catch(refused);
 },
} satisfies ExportedHandler<Bindings & AlertEnvironment>, { seed: seedDemo });
/** Claim answers (first, refused or already initialized) and every sign-in or
 * session start are owner paths: on a Business-provisioned install the door
 * opens at the first claim (see openDoorAtClaim). The claim has already
 * committed, so a failure here is logged and healed by the next owner path. */
async function afterOwnerPath(env: Bindings, response: Response): Promise<Response> {
 try { await openDoorAtClaim(env); } catch (error) { console.error('import door: first-claim enable failed', error); }
 return response;
}
async function handle(request: Request, bindings: Bindings & AlertEnvironment, execution: ExecutionContext): Promise<Response> {
 if (privateRuntimePath(request.url)) return new Response('Not found', { status: 404 });
 const env = runtimeBindings(bindings as Bindings);
 const path = new URL(request.url).pathname;
 const providerEvent=await providerEventResponse(request,env);if(providerEvent)return providerEvent;
 const asset = await staticAssetResponse(request, env); if (asset) return asset;
 const state = await setupStateResponse(request, env, setupClaimed); if (state) return state;
 // Admit the root before reading a native session; owners keep the workbench at /.
 if (path === '/' && (!admitted(request, env.AUTH_ORIGIN) || !await ownerSession(request, env))) {
  const lobby = await lobbyResponse(request, env, identity, setupClaimed); if (lobby) return lobby;
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
}
