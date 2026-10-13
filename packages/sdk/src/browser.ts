import { listen } from '../../../src/domain/capture.ts';
import { capturer, dropper, notInitialized } from './core.ts';
import { createBreadcrumbs, type CaptureResult, type SpoolOptions } from './types.ts';
export { createBreadcrumbs };
export type { Breadcrumbs, CaptureOutcome, CaptureResult, SpoolOptions } from './types.ts';

export interface SpoolClient {
  /** Send one error now. The promise always settles with an outcome and never rejects. */
  captureException(error: unknown): Promise<CaptureResult>;
  /** Add an explicit, scrubbed label sent with later errors. The last 20 are kept. */
  breadcrumb(category: string, message: string): void;
  clearBreadcrumbs(): void;
  /** Remove the error and unhandled rejection listeners. */
  close(): void;
}

let active: SpoolClient | undefined;

/**
 * Install once: captures uncaught errors and unhandled promise rejections in this page. Each error location (type and
 * top frame) sends at most 30 at once, then one every 2 seconds; an error repeating one from the last 5 seconds is not
 * sent. Errors not sent settle through onOutcome as `dropped` (reason `client_cap` or `duplicate`); tracked locations
 * carry their missed count on the next send. Location tracking is bounded, so an unseen location at capacity still
 * settles but is not attributed to another issue; a very long stack is cut at a line boundary and sent. It never throws:
 * with wrong options every capture settles as `rejected` with reason `invalid_options`.
 */
export function init(options: SpoolOptions): SpoolClient {
  active?.close();
  const breadcrumbs = createBreadcrumbs(), capture = capturer(options, breadcrumbs.snapshot);
  const uninstall = listen((error, dropped) => capture(error, undefined, dropped), dropper(options));
  const client: SpoolClient = {
    captureException: error => capture(error),
    breadcrumb: breadcrumbs.add, clearBreadcrumbs: breadcrumbs.clear,
    close() { uninstall(); if (active === client) active = undefined; },
  };
  return active = client;
}

/** Send a caught error with the options given to init(). Before init() it settles as `rejected` with reason `not_initialized`. */
export function captureException(error: unknown): Promise<CaptureResult> { return active ? active.captureException(error) : Promise.resolve(notInitialized()); }
/** Labels added before init() are not kept. */
export function breadcrumb(category: string, message: string): void { active?.breadcrumb(category, message); }
