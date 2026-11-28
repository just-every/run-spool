import { wrapRequest } from './domain/audit/request';
import type { RequestAuditWork } from './domain/audit/request';
import { currentAuditScope } from './domain/audit/context';
import { withDemo } from './modules/demo/index.mjs';
import { privateRuntimePath } from './auth/private-runtime.server';
import { runtimeBindings, type Bindings } from './auth/bindings';
import { consoleObject, forwardConsoleRequest, refused, type WorkerBindings } from './server-console';
import { placedConsole } from './console-placement';
import { staticAssetResponse } from './base/static-assets';
import type { AlertEnvironment } from './domain/alerts/types';
import { ingestApi, nativeIngestRoute, type AuthorizeNative, type NativeCaptureInput } from './domain/ingest-api';
import { dispatchAfterCapture, type IngestScope } from './domain/admission';

export { SpoolAlertWork } from './server-alert-work';
export { SpoolCapture } from './server-capture';
export { SpoolConsole } from './server-console';
export { SpoolConsolePlacement } from './console-placement';

export async function scheduled(event: ScheduledController, bindings: Bindings & AlertEnvironment, execution: ExecutionContext) {
 const scheduler = await import('./server-scheduled');
 return scheduler.scheduled(event, bindings, execution);
}

export default withDemo({
 scheduled,
 async fetch(request, bindings, execution) {
  const env = runtimeBindings(bindings) as Bindings & AlertEnvironment;
  const path = new URL(request.url).pathname;
  const native=nativeIngestRoute(request.method,path);
  if (!native && env.AUTH_LOCAL !== 'true' && env.RER_DEMO !== '1') {
   const object = consoleObject(request, path);
   if (object) return forwardConsoleRequest(request, await placedConsole(bindings.CONSOLE, bindings.DB, object, () => execution.exports.SpoolConsolePlacement.discover()));
  }
  // The local key gate and demo database belong to the request that opened them.
  const hostedCapture=native==='capture' && env.AUTH_LOCAL!=='true' && env.RER_DEMO!=='1';
  const auditWork:RequestAuditWork|undefined=hostedCapture ? {
   async lookupCredential(digest) {
    using grant=await execution.exports.SpoolCapture.auditCredential(digest);
    return grant ? {kind:grant.kind,project:grant.project,minted_by:grant.minted_by,service:grant.service} : null;
   },
   async bindAliases(...args) {
    using result=await execution.exports.SpoolCapture.bindAliases(...args);
    return {actor:result.actor,bound:result.bound,projectLabel:result.projectLabel};
   },
   observe: fact=>execution.exports.SpoolCapture.observe(fact),
  } : undefined;
  return wrapRequest(request, env, async () => {
   if (privateRuntimePath(request.url)) return new Response('Not found', { status: 404 });
   if (path === '/health') return (await import('./domain/health')).healthApi.fetch(request, env, execution);
   if (native) {
    if (!hostedCapture) return ingestApi.fetch(request, env, execution);
    const authorizeNative:AuthorizeNative=async (...args)=>{
     using result=await execution.exports.SpoolCapture({props:{audit:currentAuditScope()}}).authorize(...args);
     return 'refusal' in result?{refusal:result.refusal,drain:result.drain}:{scope:result.scope};
    };
    const admitNative = async (capture:NativeCaptureInput, grant:IngestScope) => {
     using result=await execution.exports.SpoolCapture({props:{audit:currentAuditScope()}}).capture(capture,grant);
     if (result.alertId) {
      // A request-scoped transport or an unconfigured mail path retains
      // that request's delivery authority and diagnostics.
      const delivery=env.MAIL_PROVIDER && env.MAIL_FROM && !env.INTEGRATION_EGRESS
       ? execution.exports.SpoolAlertWork.deliverAdmitted(result.alertId)
       : dispatchAfterCapture(env,result.alertId);
      execution.waitUntil(delivery);
     }
     return new Response(result.body,{status:result.status,headers:result.headers});
    };
    return ingestApi.fetch(request,{...env,authorizeNative,admitNative},execution);
   }
   // Built assets do not need the application module. The SDK loader has
   // its own response headers and stays with the application dispatcher.
   if (path !== '/spool-sentry-sdk.js' && !path.startsWith('/api/') && !path.startsWith('/auth/') && !path.startsWith('/sdk/')) {
    const asset = await staticAssetResponse(request, env);
    if (asset) return asset;
   }
   const { handle } = await import('./server-application');
   return handle(request, env, execution, path);
  },auditWork).catch(refused);
 },
} satisfies ExportedHandler<WorkerBindings>, {
 seed: async (env: WorkerBindings, options: { ownerEmail: string; now: Date }) => (await import('./demo')).seedDemo(env, options),
});
