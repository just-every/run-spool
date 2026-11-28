import { DurableObject } from 'cloudflare:workers';
import { applicationDocument } from './auth/document-path';
import { privateRuntimePath } from './auth/private-runtime.server';
import { runtimeBindings, type Bindings } from './auth/bindings';
import { wrapRequest } from './domain/audit/request';
import type { AlertEnvironment } from './domain/alerts/types';
import { AuthError } from './modules/operator-auth/errors.mjs';

export type WorkerBindings = Bindings & AlertEnvironment & { CONSOLE: DurableObjectNamespace };

// Native SDK and agent/deploy transports keep their own execution path. A
// presented credential picks that transport even if a browser also sent a cookie.
export function consoleObject(request: Request, path: string): string | null {
 if (path.startsWith('/auth/') || path.startsWith('/.well-known/rer-') || path === '/sign-in' || path === '/signin') return 'auth';
 if (applicationDocument(path) || path === '/setup/state') return 'workbench';
 if (request.headers.has('authorization')) return null;
 return /^\/api\/(?:projects|organization|editor|audit|reports|reporting|scrubbing|owner|operator|erasures|archive|restore|imports)(?:\/|$)/.test(path)
  || path === '/api/rer/business-settings' ? 'workbench' : null;
}

// A refusal raised outside the API handlers keeps its original HTTP answer.
export function refused(error: unknown) {
 if (!(error instanceof AuthError)) throw error;
 return new Response(`Request refused: ${error.code}`, { status: error.status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function forwardConsoleRequest(request: Request, stub: DurableObjectStub): Promise<Response> {
 if (!request.body) return stub.fetch(request);
 // Rejoin cancellation when a handler refuses a request before reading its upload.
 const [body, unused] = request.body.tee();
 const [response] = await Promise.all([stub.fetch(new Request(request, {body})), unused.cancel()]);
 return response;
}

// Each installation has its own namespace. D1 remains authoritative for every
// request; the objects retain no sessions, membership, or application data.
export class SpoolConsole extends DurableObject<WorkerBindings> {
 async fetch(request: Request): Promise<Response> {
  try {
   const path = new URL(request.url).pathname;
   const name = consoleObject(request, path);
   if (!name || !this.ctx.id.equals(this.env.CONSOLE.idFromName(name))) return new Response('Not found', {status: 404});
   const env = runtimeBindings(this.env) as Bindings & AlertEnvironment;
   return await wrapRequest(request, env, async () => {
    if (privateRuntimePath(request.url)) return new Response('Not found', {status: 404});
    const { handle } = await import('./server-application');
    return handle(request, env, {
     waitUntil: promise => this.ctx.waitUntil(promise),
     passThroughOnException: () => { throw new Error('Console requests have no pass-through origin'); },
     props: this.ctx.props,
    }, path);
   }).catch(refused);
  } finally {
   if (!request.bodyUsed && !request.body?.locked) await request.body?.cancel().catch(() => {});
  }
 }
}
