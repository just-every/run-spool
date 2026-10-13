import { capturer, notInitialized } from './core.ts';
import { createBreadcrumbs, type CaptureResult, type SpoolOptions } from './types.ts';
export { createBreadcrumbs };
export type { Breadcrumbs, CaptureOutcome, CaptureResult, SpoolOptions } from './types.ts';

export interface NodeOptions extends SpoolOptions {
  /** Wait at most this long for Spool before a crashing process exits. Defaults to 2000 ms. */
  exitTimeoutMs?: number;
}
export interface SpoolNodeClient {
  /** The promise always settles with an outcome and never rejects. */
  captureException(error: unknown, breadcrumbs?: string[]): Promise<CaptureResult>;
  /** Remove the uncaught exception handler. */
  close(): void;
}

let active: SpoolNodeClient | undefined;

// Prints the host's error as Node would. A value console.error cannot format (a Symbol name, a throwing getter)
// is printed from whichever of its own stack, name and message can be read, so the output always shows the host's error.
function printFatal(error: unknown) {
  try { console.error(error); return; } catch {}
  const field = (key: string) => { try { return String((error as Record<string, unknown>)[key] ?? ''); } catch { return ''; } };
  let text = field('stack') || [field('name'), field('message')].filter(Boolean).join(': ');
  if (!text) try { text = Object.prototype.toString.call(error); } catch {}
  try { process.stderr.write(`${text}\n`); } catch {}
}

/**
 * Install once: reports uncaught exceptions, and unhandled rejections (which Node raises as uncaught exceptions),
 * then prints the error and exits with code 1 as Node would, unless your own handler is also listening.
 * It never throws: with wrong options every capture settles as `rejected` with reason `invalid_options`.
 */
export function init(options: NodeOptions): SpoolNodeClient {
  active?.close();
  const capture = capturer(options);
  let timeout = 2000;
  try { if (Number.isFinite(options.exitTimeoutMs) && options.exitTimeoutMs! >= 0) timeout = options.exitTimeoutMs!; } catch {}
  // Whatever the capture does, the host's own error is what gets printed, and the process still exits. The exit timer
  // holds the event loop, so a fetch that never settles cannot let the process end silently with code 0. The first
  // fatal error is latched: later uncaught values while it is reported are ignored, as Node would never have run them.
  let crashing = false;
  const fatal = () => process.listenerCount('uncaughtException') === 1;
  const onUncaught = async (error: unknown) => {
    if (crashing) return;
    crashing = fatal();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      let report = false;
      try { report = error instanceof Error; } catch {}
      if (report) await Promise.race([capture(error), new Promise(resolve => { timer = setTimeout(resolve, timeout); })]);
    } finally {
      clearTimeout(timer);
      if (fatal()) { try { printFatal(error); } finally { process.exit(1); } }
      crashing = false;
    }
  };
  process.on('uncaughtException', onUncaught);
  const client: SpoolNodeClient = {
    captureException: (error, breadcrumbs) => capture(error, breadcrumbs),
    close() { process.off('uncaughtException', onUncaught); if (active === client) active = undefined; },
  };
  return active = client;
}

/** Send a caught error with the options given to init(). Await it before the process exits. Before init() it settles as `rejected` with reason `not_initialized`. */
export function captureException(error: unknown, breadcrumbs?: string[]): Promise<CaptureResult> {
  return active ? active.captureException(error, breadcrumbs) : Promise.resolve(notInitialized());
}
