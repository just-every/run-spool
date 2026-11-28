import { wrapRequest } from './domain/audit/request';
import { withDemo } from './modules/demo/index.mjs';
import { privateRuntimePath } from './auth/private-runtime.server';
import { runtimeBindings, type Bindings } from './auth/bindings';
import { AuthError } from './modules/operator-auth/errors.mjs';
import type { AlertEnvironment } from './domain/alerts/types';
import { ingestApi, isNativeIngest } from './domain/ingest-api';

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
  return wrapRequest(request, env, async () => {
   if (privateRuntimePath(request.url)) return new Response('Not found', { status: 404 });
   const path = new URL(request.url).pathname;
   if (isNativeIngest(request.method, path)) return ingestApi.fetch(request, env, execution);
   const { handle } = await import('./server-application');
   return handle(request, env, execution, path);
  }).catch(refused);
 },
} satisfies ExportedHandler<Bindings & AlertEnvironment>, {
 seed: async (env: Bindings, options: { ownerEmail: string; now: Date }) => (await import('./demo')).seedDemo(env, options),
});
