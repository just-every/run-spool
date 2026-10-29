import { capturer, invalidOptions } from './core.ts';
import { createBreadcrumbs, type CaptureResult, type SpoolOptions } from './types.ts';
export { createBreadcrumbs };
export { startSession } from './sessions.ts';
export type { Breadcrumbs, CaptureOutcome, CaptureResult, SpoolOptions, SpoolSession, SessionResult, SessionStatus } from './types.ts';

/** The handler's execution context, such as the third argument of `fetch(request, env, ctx)`. */
export interface WaitUntil { waitUntil(promise: Promise<unknown>): void }

/**
 * Send an error from a Cloudflare Worker. The request is kept alive with ctx.waitUntil until Spool answers.
 * It never throws, so your catch block always finishes: with wrong options the capture settles as `rejected`
 * with reason `invalid_options`.
 */
export function captureException(error: unknown, options: SpoolOptions & { breadcrumbs?: string[] }, ctx: WaitUntil): Promise<CaptureResult> {
  let result: Promise<CaptureResult>;
  try { const { breadcrumbs, ...rest } = options; result = capturer(rest)(error, breadcrumbs); }
  catch (problem) { result = Promise.resolve(invalidOptions(problem, options)); }
  // Without a usable ctx the capture still runs; the Worker may just end before Spool answers.
  try { ctx.waitUntil(result); } catch {}
  return result;
}
