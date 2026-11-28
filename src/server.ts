import { wrapRequest } from './domain/audit/request';
import type { RequestAuditWork } from './domain/audit/request';
import { currentAuditScope } from './domain/audit/context';
import { withDemo } from './modules/demo/index.mjs';
import { privateRuntimePath } from './auth/private-runtime.server';
import { runtimeBindings, type Bindings } from './auth/bindings';
import { AuthError } from './modules/operator-auth/errors.mjs';
import type { AlertEnvironment } from './domain/alerts/types';
import { ingestApi, nativeIngestRoute, type AuthorizeNative, type NativeCaptureInput } from './domain/ingest-api';
import { dispatchAfterCapture, type IngestScope } from './domain/admission';

export { SpoolAlertWork } from './server-alert-work';
export { SpoolCapture } from './server-capture';

export async function scheduled(event: ScheduledController, bindings: Bindings & AlertEnvironment, execution: ExecutionContext) {
 const scheduler = await import('./server-scheduled');
 return scheduler.scheduled(event, bindings, execution);
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
  const env = runtimeBindings(bindings) as Bindings & AlertEnvironment;
  const path = new URL(request.url).pathname;
  const native=nativeIngestRoute(request.method,path);
  // The local key gate and demo database belong to the request that opened them.
  const hostedCapture=native==='capture' && env.AUTH_LOCAL!=='true' && env.RER_DEMO!=='1';
  const auditWork:RequestAuditWork|undefined=hostedCapture ? {
   async bindAliases(...args) {
    using result=await execution.exports.SpoolCapture.bindAliases(...args);
    return {actor:result.actor,bound:result.bound,projectLabel:result.projectLabel};
   },
   observe: fact=>execution.exports.SpoolCapture.observe(fact),
  } : undefined;
  return wrapRequest(request, env, async () => {
   if (privateRuntimePath(request.url)) return new Response('Not found', { status: 404 });
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
   const { handle } = await import('./server-application');
   return handle(request, env, execution, path);
  },auditWork).catch(refused);
 },
} satisfies ExportedHandler<Bindings & AlertEnvironment>, {
 seed: async (env: Bindings, options: { ownerEmail: string; now: Date }) => (await import('./demo')).seedDemo(env, options),
});
