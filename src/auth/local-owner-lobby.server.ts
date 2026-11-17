import { localDevelopmentEnabled } from './local.server.mjs';
import type { Bindings } from './bindings';

// Spool owns its local recovery wording; the shared Lobby stays unchanged.
export function localOwnerLobby(response: Response, env: Bindings): Response {
 if (!localDevelopmentEnabled(env) || response.headers.get('x-rer-document') !== 'lobby') return response;
 return new HTMLRewriter().on('p.credit', {
  text(chunk) {
   chunk.replace(chunk.text.replace(/\brer dev/g, '~/.local/bin/rer dev').replace('project folder', 'run-spool folder'));
  },
 }).transform(response);
}
