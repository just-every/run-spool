import { objectJson, SentryWireError, type WireObject } from '../sentry/wire.ts';

// Sentry's check-in item (sentry-core `captureCheckIn`): the monitor slug, the check-in id, a status and
// optionally duration, release, environment, monitor_config and contexts.trace. Spool reads only
// what it routes or links; schedules and thresholds in monitor_config are Uptime's to evaluate.
export const checkInItemLimit = 102400;
export type CheckInStatus = 'in_progress' | 'ok' | 'error';
export interface CheckIn { id: string; slug: string; status: CheckInStatus; traceId?: string; release?: string; environment?: string }
const slug = /^[A-Za-z0-9._-]{1,64}$/, id = /^[A-Za-z0-9-]{1,64}$/, trace = /^[0-9a-f]{32}$/;
export function parseCheckIn(bytes: Uint8Array): CheckIn {
 const raw: WireObject = objectJson(bytes);
 if (typeof raw.monitor_slug !== 'string' || !slug.test(raw.monitor_slug) || typeof raw.check_in_id !== 'string' || !id.test(raw.check_in_id) || !['in_progress', 'ok', 'error'].includes(raw.status)) throw new SentryWireError('invalid_item');
 const traceId = raw.contexts?.trace?.trace_id;
 return {
  id: raw.check_in_id, slug: raw.monitor_slug, status: raw.status, ...(typeof traceId === 'string' && trace.test(traceId) ? { traceId } : {}),
  ...(typeof raw.release === 'string' ? { release: raw.release.slice(0, 200) } : {}), ...(typeof raw.environment === 'string' ? { environment: raw.environment.slice(0, 200) } : {}),
 };
}
