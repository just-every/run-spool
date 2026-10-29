import { scrub } from '../../../src/domain/privacy.ts';

/** Where events go and which release and build produced them. Release and build must be registered in Spool. */
export interface SpoolOptions {
  /** Your Spool installation's origin, such as `https://spool.example.com`. */
  endpoint: string;
  /** The project identifier, such as `web-app`. */
  project: string;
  /** A project ingest key. It can only send events to this project. */
  ingestKey: string;
  /** The release name your build reports, such as `web@1.4.0`. */
  release: string;
  /** The build within that release, such as a commit or build number. */
  build: string;
  /** Defaults to `production`. */
  environment?: string;
  /** Set only when your bundle was not processed by Spool's build plugin or CLI, which register debug IDs themselves. */
  debugId?: string;
  /** A random identifier for this install or browser, never a name or address (16 to 64 letters, digits, `-` or `_`). With it,
   * Spool can count how many affected users a deployed fix reached. In the browser, `anonymousClient()` makes and keeps one. */
  client?: string;
  /** Called with every capture outcome, including transport failures and, in the browser, each uncaught error the SDK did not send (`dropped` with reason `client_cap` or `duplicate`). */
  onOutcome?: (result: CaptureResult) => void;
  /** Opt in to one observed session per browser page or Node process. Off by default. */
  sessions?: boolean;
  /** Session sampling probability, from 0 to 1. Defaults to 1; rates describe observed sessions only. */
  sessionSampleRate?: number;
  /** Session outcomes are separate from error outcomes and accepted-error usage. */
  onSessionOutcome?: (result: SessionResult) => void;
}

export type SessionStatus = 'exited' | 'crashed' | 'abnormal' | 'unhandled';
export interface SessionResult { outcome: 'accepted' | 'rejected' | 'dropped' | 'unknown'; sid: string; reason?: string }
export type ExposureResult = { outcome: string; reason?: string };
export interface SpoolSession {
  /** Update this observed session after an error; unhandled ends it as crashed. */
  recordError(unhandled?: boolean | 'unhandled'): Promise<SessionResult>;
  /** Finish once. Repeated calls return the same outcome and never add exposure. */
  end(status?: SessionStatus): Promise<SessionResult>;
  /** Send the current observation and wait for earlier sends. No automatic retry or offline persistence. */
  flush(): Promise<SessionResult>;
}

export type CaptureOutcome = 'accepted' | 'duplicate' | 'conflict' | 'rejected' | 'dropped' | 'unavailable' | 'unknown';
/** What Spool answered. `unknown` means the request did not complete; it is never reported as success. A capture the SDK could not send settles as `rejected` with a `reason`. */
export interface CaptureResult { outcome: CaptureOutcome; eventId: string; reason?: string; issue?: string; [field: string]: unknown }

/** Explicit labels only: no DOM values, form text, automatic requests or console output. Each label is scrubbed when added and again at capture. Labels that are not strings are ignored. */
export interface Breadcrumbs { add(category: string, message: string): void; clear(): void; snapshot(): string[] }
/** Keeps the last `limit` labels, at most 20. */
export function createBreadcrumbs(limit = 20): Breadcrumbs {
  const keep = Number.isSafeInteger(limit) ? Math.min(20, Math.max(1, limit)) : 20;
  const chronology: string[] = [];
  return {
    add(category, message) {
      if (typeof category !== 'string' || typeof message !== 'string') return;
      chronology.push(scrub(`${category.slice(0, 100)}: ${message}`));
      if (chronology.length > keep) chronology.shift();
    },
    clear() { chronology.length = 0; },
    snapshot: () => chronology.slice(),
  };
}
