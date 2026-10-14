import { client, identity } from '../../../src/domain/privacy.ts';
import { sendExposure } from '../../../src/domain/exposure/report.ts';
import { captureException as send, currentFetch, settle, type CaptureOptions, type Dropped } from '../../../src/domain/capture.ts';
import type { CaptureResult, SpoolOptions } from './types.ts';

/** `dropped`: errors at this error's location the page listener did not send since its last send there. */
export type Capture = (error: unknown, breadcrumbs?: string[], dropped?: number) => Promise<CaptureResult>;

function captureOptions(options: SpoolOptions, breadcrumbs?: () => string[]): CaptureOptions {
  const endpoint = new URL(options.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error('Spool endpoint must be an HTTP(S) origin without credentials');
  if (typeof options.ingestKey !== 'string' || !options.ingestKey) throw new Error('Spool ingest key is required');
  return {
    endpoint: endpoint.origin, project: identity(options.project, 'project'), ingestKey: options.ingestKey,
    release: identity(options.release, 'release'), build: identity(options.build, 'build'), environment: identity(options.environment ?? 'production', 'environment'),
    ...(options.debugId ? { debugId: identity(options.debugId, 'debugId') } : {}),
    ...(options.client !== undefined ? { client: client(options.client) } : {}),
    ...(breadcrumbs ? { breadcrumbs } : {}),
    ...(options.onOutcome ? { onOutcome: options.onOutcome } : {}),
    // Sends go through the fetch present at setup, so a wrapper the app installs later never sees (or reports) them.
    transport: currentFetch(),
  };
}

/**
 * Checks the options once. Wrong options never throw into the app: every capture then settles as
 * `rejected` with reason `invalid_options` and the problem in `detail`, and is passed to onOutcome.
 */
export function capturer(options: SpoolOptions, breadcrumbs?: () => string[]): Capture {
  try {
    const capture = captureOptions(options, breadcrumbs);
    return (error, extra, dropped) => send(error, { ...capture, ...(extra ? { breadcrumbs: extra } : {}), ...(dropped ? { dropped } : {}) }) as Promise<CaptureResult>;
  } catch (problem) {
    return async () => invalidOptions(problem, options);
  }
}

/** Settles an error the page listener did not send through onOutcome, whatever the options. */
export function dropper(options: unknown): (result: Dropped) => CaptureResult {
  let onOutcome: unknown;
  try { onOutcome = (options as SpoolOptions).onOutcome; } catch {}
  return result => settle<CaptureResult>({ ...result }, typeof onOutcome === 'function' ? onOutcome as (result: CaptureResult) => void : undefined);
}

export function invalidOptions(problem: unknown, options: unknown): CaptureResult {
  let detail = 'Invalid options', onOutcome: unknown;
  try { detail = String((problem as Error).message); } catch {}
  try { onOutcome = (options as SpoolOptions).onOutcome; } catch {}
  return settle<CaptureResult>({ outcome: 'rejected', reason: 'invalid_options', detail, eventId: '' }, typeof onOutcome === 'function' ? onOutcome as (result: CaptureResult) => void : undefined);
}

export const notInitialized = (): CaptureResult => ({ outcome: 'rejected', reason: 'not_initialized', eventId: '' });

export type ExposureResult = { outcome: string; reason?: string };
/** Reports that this client reached the named flows in this release. Without a `client` option it settles as rejected. */
export function exposureReporter(options: SpoolOptions, capture: boolean): (flows: string[]) => Promise<ExposureResult> {
  try {
    const target = captureOptions(options);
    if (!target.client) return async () => ({ outcome: 'rejected', reason: 'client_required' });
    return flows => sendExposure({ ...target }, { version: 1, release: target.release, build: target.build, environment: target.environment, client: target.client!, flows, capture });
  } catch (problem) {
    return async () => ({ outcome: 'rejected', reason: 'invalid_options', detail: String((problem as Error)?.message) } as ExposureResult);
  }
}
