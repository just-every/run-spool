// Local-only Worker entry. vite.config.ts loads it only for `vite dev`; the deployed main stays
// src/server.ts, and `rer build` refuses any output that contains the dev layer. It adds dev
// sign-in, personas and the Dev product label.
import worker from './server';
import { managedInstallation, withDevIdentity } from './modules/operator-auth/dev/index.mjs';
import { devGate } from './modules/operator-auth/dev-gate.mjs';
import { admitLocalProjectKeys } from './domain/dev-credentials';
import { authConfig } from './auth/session.server';
import { runtimeBindings, type Bindings } from './auth/bindings';
import { signInPage } from './auth/sign-in.server';
import { devPersonas } from './auth/dev-personas';
import { privateRuntimePath } from './auth/private-runtime.server';

// "/" sends a visitor without a session to /sign-in, a page the key exchange never runs on (the
// dev layer adds it to the root document). Locally, the root answers with the sign-in page itself.
const local = {
 ...worker,
 async fetch(request, bindings, execution) {
  if (privateRuntimePath(request.url)) return new Response('Not found', { status: 404 });
  // Vite's virtual client entry has no file extension. The shared production
  // asset handler serves built files; local module namespaces belong to Vite.
  const path = new URL(request.url).pathname;
  if (bindings.ASSETS && (request.method === 'GET' || request.method === 'HEAD') && /^\/(?:@id\/|@fs\/|@vite\/|@react-refresh$|node_modules\/)/.test(path)) {
   return bindings.ASSETS.fetch(request);
  }
  const env = runtimeBindings(bindings as Bindings);
  // SDKs and build tools hold only their scoped project key. Recognize this
  // request in the local entry, without giving those clients the owner gate.
  if (!managedInstallation(env) && devGate({ key: env.RER_DEV_KEY, origin: env.AUTH_ORIGIN, local: env.AUTH_LOCAL === 'true' })) admitLocalProjectKeys(request);
  const response = await worker.fetch(request, bindings, execution);
  const redirect = response.status === 303 && response.headers.get('location')?.startsWith('/sign-in');
  if (new URL(request.url).pathname === '/' && request.method === 'GET' && redirect) return await signInPage(request, runtimeBindings(bindings as Bindings));
  return response;
 },
} satisfies typeof worker;

export default withDevIdentity<Bindings, typeof local>(local, { bindings: runtimeBindings, config: authConfig, personas: devPersonas });
