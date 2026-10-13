// Local-only Worker entry. vite.config.ts loads it only for `vite dev`; the deployed main stays
// src/server.ts, and `rer build` refuses any output that contains the dev layer. It adds dev
// sign-in, personas and the dev badge.
import worker from './server';
import { withDevIdentity } from './modules/operator-auth/dev/index.mjs';
import { authConfig } from './auth/session.server';
import { runtimeBindings, type Bindings } from './auth/bindings';
import { signInDocument } from './auth/sign-in.server';
import { devPersonas } from './auth/dev-personas';

// "/" sends a visitor without a session to /sign-in, a page the key exchange never runs on (the
// dev layer adds it to the root document). Locally, the root answers with the sign-in page itself.
const local = {
 ...worker,
 async fetch(request, bindings, execution) {
  const response = await worker.fetch(request, bindings, execution);
  const redirect = response.status === 303 && response.headers.get('location')?.startsWith('/sign-in');
  if (new URL(request.url).pathname === '/' && request.method === 'GET' && redirect) return signInDocument(request, runtimeBindings(bindings as Bindings));
  return response;
 },
} satisfies typeof worker;

export default withDevIdentity<Bindings, typeof local>(local, { bindings: runtimeBindings, config: authConfig, personas: devPersonas });
