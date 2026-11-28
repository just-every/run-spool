import { agentDoorRoute } from './domain/agent-door/paths';
import { resolveMembership } from './domain/members/resolver';
import { reportDialogResponse } from './domain/report-dialog/public.server';
import { loaderResponse } from './domain/loader/public.server';
import { dispatch } from './base/dispatch';
import { authenticationResponse } from './auth/dispatch.server';
import { ownerSession } from './auth/session.server';
import { agentProject, agentReadPath } from './domain/agent-access';
import { ownerClaimResponse } from './editor/owner-claim.server';
import { editorConfigResponse } from './editor/config.server';
import { staticAssetResponse } from './base/static-assets';
import { docsResponse, isDocsRequest } from './ui/docs/document.server';
import type { Bindings } from './auth/bindings';
import type { AlertEnvironment } from './domain/alerts/types';
import type { Context } from 'hono';
import { consoleDocument, renderDocument } from './server-documents';

/** Claim answers (first, refused or already initialized) and every sign-in or
 * session start are owner paths: on a Business-provisioned install the door
 * opens at the first claim (see openDoorAtClaim). The claim has already
 * committed, so a failure here is logged and healed by the next owner path. */
async function afterOwnerPath(env: Bindings, response: Response): Promise<Response> {
 try { await (await import('./domain/sentry-import/door.server')).openDoorAtClaim(env); } catch (error) { console.error('import door: first-claim enable failed', error); }
 return response;
}
export async function handle(request: Request, env: Bindings & AlertEnvironment, execution: Context['executionCtx'], path: string): Promise<Response> {
 const route=agentDoorRoute(path);
 if(route){const response=await (await import('./domain/agent-door/index.server')).agentDoorResponse(request,env,route);if(response)return response;}
 if(path.startsWith('/api/projects/')&&request.headers.has('authorization')){
  const legacy=await (await import('./domain/agent-door/legacy')).legacyAgentResponse(request,env);if(legacy)return legacy;
 }
 if(path.startsWith('/api/alert-events/sendgrid/')){
  const providerEvent=await (await import('./domain/alerts/provider-events.server')).providerEventResponse(request,env);if(providerEvent)return providerEvent;
 }
 const reportDialog = await reportDialogResponse(request, env); if (reportDialog) return reportDialog;
 const loader = await loaderResponse(request, env); if (loader) return loader;
 const asset = await staticAssetResponse(request, env); if (asset) return asset;
 const document = await consoleDocument(request, env, path); if (document) return document;
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
 if (path === '/api/rer/cutover-status') return (await import('./domain/rer-cutover-status.server')).rerCutoverStatus(request, env);
 if (path.startsWith('/api/rer/import/')||path.startsWith('/api/operator/import/')) {
  const importDoor=await (await import('./domain/sentry-import/door.server')).importDoorResponse(request,env);if(importDoor)return importDoor;
 }
 if (path.startsWith('/api/owner/erasure')) {
  const ownerErasure=await (await import('./domain/erasure/owner-routes')).ownerErasureResponse(request,env);if(ownerErasure)return ownerErasure;
 }
 const auth = await authenticationResponse(request, env);
 if (auth) return path === '/auth/bootstrap' || auth.headers.has('set-cookie') ? afterOwnerPath(env, auth) : auth;
 const response = await dispatch(request, async () => (await import('./domain/api')).default.fetch(request, env, execution), async () => {
  if (!await ownerSession(request,env,resolveMembership)) return new Response('Not found', { status: 404 });
  // Owners keep the router's styled not-found page, even before project setup.
  return renderDocument(request, env);
 });
 if (!['GET','HEAD','OPTIONS'].includes(request.method)&&response.ok&&!request.headers.has('authorization')) {
  await (await import('./domain/agent-door/events')).emitPersonChange(request,env,response);
 }
 return response;
}
