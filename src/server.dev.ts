// Local-only Worker entry. vite.config.ts loads it only for `vite dev`; the deployed main stays
// src/server.ts, and `rer build` refuses any output that contains the dev layer. It adds dev
// sign-in, personas and the Dev product label.
import worker from './server';
import { managedInstallation } from './modules/operator-auth/dev/index.mjs';
import { withDevIdentity } from './auth/local-identity.server.mjs';
import { devGate } from './modules/operator-auth/dev-gate.mjs';
import { admitLocalProjectKeys } from './domain/dev-credentials';
import { authConfig, ownerSession } from './auth/session.server';
import { AuthError } from './modules/operator-auth/index.mjs';
import { runtimeBindings, type Bindings } from './auth/bindings';
import { signInPage } from './auth/sign-in.server';
import { devPersonas } from './auth/dev-personas';
import { localInvitationWitness } from './auth/local-members.server';
import { hashToken } from './modules/operator-auth/crypto.mjs';
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
  // Only the local owner's session can discover this machine's executable paths.
  // These bindings and this route are absent from the deployed Worker.
  if (path === '/api/agent-runtime') {
   const headers = { 'Cache-Control': 'no-store' };
   try {
    if (!await ownerSession(request, env)) return new Response('Unauthorized', { status: 401, headers });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers });
    const paths = bindings as Bindings & { SPOOL_AGENT_NODE: string; SPOOL_AGENT_CLI: string };
    return Response.json({ node: paths.SPOOL_AGENT_NODE, cli: paths.SPOOL_AGENT_CLI }, { headers });
   } catch (error) {
    if (error instanceof AuthError) return new Response('Unauthorized', { status: error.status, headers });
    throw error;
   }
  }
  // SDKs and build tools hold only their scoped project key. Recognize this
  // request in the local entry, without giving those clients the owner gate.
  if (!managedInstallation(env) && devGate({ key: env.RER_DEV_KEY, origin: env.AUTH_ORIGIN, local: env.AUTH_LOCAL === 'true' })) admitLocalProjectKeys(request);
  const response = await worker.fetch(request, bindings, execution);
  const redirect = response.status === 303 && response.headers.get('location')?.startsWith('/sign-in');
  if (new URL(request.url).pathname === '/' && request.method === 'GET' && redirect) return await signInPage(request, runtimeBindings(bindings as Bindings));
  const token = new URL(request.url).searchParams.get('token');
  if (path === '/auth/confirm' && request.method === 'GET' && response.status === 200 && token
   && await localInvitationWitness(env, await hashToken(env.SESSION_SECRET, 'link', token))) {
   return new HTMLRewriter().on('main h1', { element(element) {
    element.after('<p>Open your own invitation directly in a separate browser. It signs you in with your membership and project access. Do not open or share the owner’s RER_OPEN link; it signs in as the owner.</p>', { html: true });
   } }).transform(response);
  }
  return response;
 },
} satisfies typeof worker;

export default withDevIdentity<Bindings, typeof local>(local, { bindings: runtimeBindings, config: authConfig, personas: devPersonas });
