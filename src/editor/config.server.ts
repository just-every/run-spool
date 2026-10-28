import { ownerSession } from '../auth/session.server';
import { parseConfig } from '../modules/editor/config';
import type { ManagedBindings } from './bindings';

function editorConfig(env: ManagedBindings) {
 if (env.RER_MANAGEMENT_ORIGIN === undefined && env.RER_INSTALLATION_ID === undefined) return null;
 return parseConfig({enabled: true, managementOrigin: env.RER_MANAGEMENT_ORIGIN, installationId: env.RER_INSTALLATION_ID});
}

export async function editorConfigResponse(request: Request, env: ManagedBindings) {
 const headers = {'cache-control': 'no-store, private', vary: 'Cookie'};
 try {
  const session = await ownerSession(request, env);
  if (!session || session.kind === 'agent' || session.kind === 'native-reviewer') return Response.json({error: 'Owner authorization required'}, {status: 403, headers});
  if (request.method !== 'GET') return Response.json({error: 'GET required'}, {status: 405, headers: {...headers, allow: 'GET'}});
  const config = editorConfig(env);
  if (!config) return Response.json({config: null}, {headers});
  return Response.json({config, expiresAt: Math.min(session.expiresAt, Date.now() + 30_000)}, {headers});
 } catch {
  return Response.json({error: 'Editor authorization unavailable'}, {status: 503, headers});
 }
}

/** Preserve existing directives, narrowing embedding to the configured management origin. */
export function editorDocument(response: Response, env: ManagedBindings) {
 let origin: string | undefined;
 try { origin = editorConfig(env)?.managementOrigin; } catch { /* Invalid configuration disables embedding. */ }
 const headers = new Headers(response.headers);
 const directives = (headers.get('content-security-policy') ?? '').split(';').map(value => value.trim()).filter(Boolean);
 const retained = directives.filter(value => !/^frame-(?:src|ancestors)(?:\s|$)/i.test(value));
 retained.push(`frame-ancestors 'self'${origin ? ` ${origin}` : ''}`, `frame-src 'self'${origin ? ` ${origin}` : ''}`);
 if (!retained.some(value => /^object-src(?:\s|$)/i.test(value))) retained.push("object-src 'none'");
 if (!retained.some(value => /^base-uri(?:\s|$)/i.test(value))) retained.push("base-uri 'self'");
 headers.set('content-security-policy', retained.join('; '));
 headers.set('cache-control', 'no-store, private');
 headers.append('vary', 'Cookie');
 return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
}
