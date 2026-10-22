/**
 * Server-side tunnel for the Sentry browser SDK's standard `tunnel` option. Ad-blockers block requests to
 * ingest hosts and paths; the page posts its envelope to a same-origin route instead and this handler
 * forwards it to the Spool project it is configured for. Fetch-style, so it runs in Node, Workers and
 * Next.js route handlers.
 */
import { decodeBounded, limit, readBounded, TooLarge } from './tunnel-body.ts';

export interface TunnelOptions {
  /** DSN of each Spool project this tunnel may forward to. An envelope that names any other DSN is refused. */
  dsn: string | string[];
  /** The browser's address, forwarded as X-Forwarded-For. Defaults to the first X-Forwarded-For hop the platform set. */
  clientAddress?: (request: Request) => string | undefined;
  /** Outbound fetch; defaults to the global one. */
  fetch?: typeof fetch;
}

const forwarded = ['content-type', 'content-encoding', 'user-agent', 'origin', 'referer'];
const returned = ['content-type', 'retry-after', 'x-sentry-rate-limits', 'x-sentry-error'];

type Target = { key: string; origin: string; project: string };

function target(dsn: string): Target {
  const url = new URL(dsn), project = url.pathname.replace(/^\//, '');
  if (!['http:', 'https:'].includes(url.protocol) || !url.username || url.password || !/^[1-9][0-9]{0,15}$/.test(project)) throw new Error('A Spool DSN names an HTTP(S) origin, a public key and a numeric project');
  return { key: url.username, origin: url.origin, project };
}

const refuse = (status: number, error: string) => Response.json({ error }, { status });
const tooLarge = () => refuse(413, 'Envelope too large');

/** Returns a handler for POST requests carrying a Sentry envelope. */
export function spoolTunnel(options: TunnelOptions): (request: Request) => Promise<Response> {
  const allowed = (Array.isArray(options.dsn) ? options.dsn : [options.dsn]).map(target);
  if (!allowed.length) throw new Error('At least one Spool DSN is required');
  return async request => {
    if (request.method !== 'POST') return refuse(405, 'Tunnel accepts POST only');
    if (Number(request.headers.get('content-length')) > limit) return tooLarge();
    const encoding = request.headers.get('content-encoding')?.toLowerCase() ?? null;
    let body: Uint8Array<ArrayBuffer>, plain: Uint8Array | undefined;
    try { body = await readBounded(request.body); } catch (error) { if (error instanceof TooLarge) return tooLarge(); throw error; }
    if (!body.length) return refuse(400, 'Empty envelope');
    try { plain = await decodeBounded(body, encoding); } catch (error) { return error instanceof TooLarge ? tooLarge() : refuse(400, 'Envelope could not be decoded'); }
    if (!plain) return refuse(415, 'Unsupported content encoding');
    // The envelope's first line is its header; its DSN decides where, and whether, the envelope goes.
    const line = plain.indexOf(10) < 0 ? plain : plain.subarray(0, plain.indexOf(10));
    let named: Target;
    try {
      const header = JSON.parse(new TextDecoder().decode(line));
      if (typeof header?.dsn !== 'string') throw new Error();
      named = target(header.dsn);
    } catch { return refuse(400, 'Envelope header names no valid DSN'); }
    const project = allowed.find(entry => entry.key === named.key && entry.origin === named.origin && entry.project === named.project);
    if (!project) return refuse(403, 'Envelope DSN is not served by this tunnel');
    const headers = new Headers({ 'content-type': 'application/x-sentry-envelope' });
    for (const name of forwarded) { const value = request.headers.get(name); if (value) headers.set(name, value); }
    const address = (options.clientAddress ?? defaultAddress)(request);
    if (address) headers.set('x-forwarded-for', address);
    let upstream: Response, reply: Uint8Array<ArrayBuffer>;
    try {
      // A redirect is never followed: the envelope goes to the configured Spool origin or nowhere.
      upstream = await (options.fetch ?? fetch)(`${project.origin}/api/${project.project}/envelope/`, { method: 'POST', headers, body, redirect: 'manual' });
      if (upstream.type === 'opaqueredirect' || (upstream.status >= 300 && upstream.status < 400)) { await upstream.body?.cancel(); return refuse(502, 'Spool answered with a redirect, which the tunnel does not follow'); }
      reply = await readBounded(upstream.body);
    } catch { return refuse(502, 'Spool could not be reached'); }
    const out = new Headers();
    for (const name of returned) { const value = upstream.headers.get(name); if (value) out.set(name, value); }
    return new Response(reply, { status: upstream.status, headers: out });
  };
}

function defaultAddress(request: Request): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
}

type NodeRequest = AsyncIterable<Uint8Array> & { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } };
type NodeResponse = { statusCode: number; headersSent?: boolean; destroyed?: boolean; setHeader(name: string, value: string): unknown; end(body?: Uint8Array): unknown };

async function send(response: NodeResponse, result: Response, close = false): Promise<void> {
  const body = new Uint8Array(await result.arrayBuffer());
  if (response.headersSent || response.destroyed) return;
  response.statusCode = result.status;
  result.headers.forEach((value, name) => response.setHeader(name, value));
  // A refusal sent before the body was read closes the connection instead of reading the rest.
  if (close) response.setHeader('connection', 'close');
  response.end(body);
}

/** The same tunnel for a Node `http` server, Express or Connect: `app.post('/monitoring', nodeTunnel({ dsn }))`. */
export function nodeTunnel(options: TunnelOptions): (request: NodeRequest, response: NodeResponse) => Promise<void> {
  spoolTunnel(options); // refuse bad options when the route is created, not on the first error
  return async (request, response) => {
    // Never rejects: an aborted upload, an odd method or a failed send ends this request, not the host process.
    try {
      if (request.method !== 'POST') return await send(response, refuse(405, 'Tunnel accepts POST only'), true);
      if (Number(request.headers['content-length']) > limit) return await send(response, tooLarge(), true);
      const chunks: Uint8Array[] = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > limit) return await send(response, tooLarge(), true);
        chunks.push(chunk);
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      const direct = request.socket?.remoteAddress;
      const handle = spoolTunnel({ ...options, clientAddress: from => (options.clientAddress ?? defaultAddress)(from) ?? direct });
      await send(response, await handle(new Request('http://tunnel.invalid/', { method: 'POST', headers, body: new Blob(chunks as BlobPart[]) })));
    } catch {
      await send(response, refuse(400, 'Envelope could not be read'), true).catch(() => undefined);
    }
  };
}
