import module from './tls/egress.wasm';
import { rustls } from './rustls.ts';
import { connect } from 'cloudflare:sockets';
import { dohResolver } from './doh.ts';
import { createEgressEntrypoint } from './entrypoint.ts';

/** The deployable egress Worker. Its ports are fixed here; no binding or variable selects others. */
const ports = () => ({
  resolve: dohResolver((input, init) => fetch(input, init)),
  connect,
  fetch: (url: string, init: RequestInit) => fetch(url, init),
});
const tls = rustls(module);
export const EgressService = createEgressEntrypoint(ports, { tls }, 'EgressService');
export const EgressRestricted = createEgressEntrypoint(ports, { tls }, 'EgressRestricted');
export default EgressService;
