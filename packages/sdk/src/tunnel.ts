/**
 * Server-side tunnel for the Sentry browser SDK's standard `tunnel` option. Ad-blockers block requests to
 * ingest hosts and paths; the page posts its envelope to a same-origin route instead and this handler
 * forwards it to the Spool project it is configured for. Fetch-style, so it runs in Node, Workers and
 * Next.js route handlers.
 */
export interface TunnelOptions {
  /** DSN of each Spool project this tunnel may forward to. An envelope that names any other DSN is refused. */
  dsn: string | string[];
  /** The browser's address, forwarded as X-Forwarded-For. Defaults to the first X-Forwarded-For hop the platform set. */
  clientAddress?: (request: Request) => string | undefined;
  /** Outbound fetch; defaults to the global one. */
  fetch?: typeof fetch;
}

const limit = 1_048_576;
const forwarded = ['content-type', 'content-encoding', 'user-agent', 'origin', 'referer'];
const returned = ['content-type', 'retry-after', 'x-sentry-rate-limits', 'x-sentry-error'];

type Target = { key: string; origin: string; project: string };

function target(dsn: string): Target {
  const url = new URL(dsn), project = url.pathname.replace(/^\//, '');
  if (!['http:', 'https:'].includes(url.protocol) || !url.username || url.password || !/^[1-9][0-9]{0,15}$/.test(project)) throw new Error('A Spool DSN names an HTTP(S) origin, a public key and a numeric project');
  return { key: url.username, origin: url.origin, project };
}

const refuse = (status: number, error: string) => Response.json({ error }, { status });

async function expand(bytes: Uint8Array, encoding: string | null): Promise<Uint8Array | undefined> {
  if (!encoding || encoding === 'identity') return bytes;
  if (encoding !== 'gzip' && encoding !== 'deflate') return undefined;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream(encoding));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Returns a handler for POST requests carrying a Sentry envelope. */
export function spoolTunnel(options: TunnelOptions): (request: Request) => Promise<Response> {
  const allowed = (Array.isArray(options.dsn) ? options.dsn : [options.dsn]).map(target);
  if (!allowed.length) throw new Error('At least one Spool DSN is required');
  return async request => {
    if (request.method !== 'POST') return refuse(405, 'Tunnel accepts POST only');
    const encoding = request.headers.get('content-encoding')?.toLowerCase() ?? null;
    const body = new Uint8Array(await request.arrayBuffer());
    if (!body.length || body.length > limit) return refuse(body.length ? 413 : 400, body.length ? 'Envelope too large' : 'Empty envelope');
    let plain: Uint8Array | undefined;
    try { plain = await expand(body, encoding); } catch { return refuse(400, 'Envelope could not be decoded'); }
    if (!plain) return refuse(415, 'Unsupported content encoding');
    if (plain.length > limit) return refuse(413, 'Envelope too large');
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
    let upstream: Response;
    try {
      upstream = await (options.fetch ?? fetch)(`${project.origin}/api/${project.project}/envelope/`, { method: 'POST', headers, body });
    } catch { return refuse(502, 'Spool could not be reached'); }
    const out = new Headers();
    for (const name of returned) { const value = upstream.headers.get(name); if (value) out.set(name, value); }
    return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: out });
  };
}

function defaultAddress(request: Request): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
}

type NodeRequest = AsyncIterable<Uint8Array> & { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } };
type NodeResponse = { statusCode: number; setHeader(name: string, value: string): unknown; end(body?: Uint8Array): unknown };

/** The same tunnel for a Node `http` server, Express or Connect: `app.post('/monitoring', nodeTunnel({ dsn }))`. */
export function nodeTunnel(options: TunnelOptions): (request: NodeRequest, response: NodeResponse) => Promise<void> {
  spoolTunnel(options); // refuse bad options when the route is created, not on the first error
  return async (request, response) => {
    const chunks: Uint8Array[] = [];
    for await (const chunk of request) chunks.push(chunk);
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    const direct = request.socket?.remoteAddress;
    const handle = spoolTunnel({ ...options, clientAddress: from => (options.clientAddress ?? defaultAddress)(from) ?? direct });
    const result = await handle(new Request('http://tunnel.invalid/', { method: request.method ?? 'POST', headers, body: request.method === 'GET' || request.method === 'HEAD' ? undefined : new Blob(chunks as BlobPart[]) }));
    response.statusCode = result.status;
    result.headers.forEach((value, name) => response.setHeader(name, value));
    response.end(new Uint8Array(await result.arrayBuffer()));
  };
}
