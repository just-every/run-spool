import { convertSentry } from '../sentry/convert.ts';
import type { Envelope } from '../privacy.ts';
import { occurrenceUuid, seconds } from './source.ts';
const levels: Record<string, string> = { critical: 'fatal', error: 'error', warning: 'warning', info: 'info', debug: 'debug' };
/** Rollbar's occurrence detail (an item instance) is a different contract from SDK wire JSON.
 * Frames arrive oldest first with one-based columns, the order convertSentry already expects. */
export function rollbarEvent(row: any, release: string | undefined): { event: Envelope; received: number; located: number; total: number } {
  const data = row?.data, uuid = occurrenceUuid(row);
  if (!data || typeof data !== 'object' || !data.body || typeof data.body !== 'object') throw new Error('Occurrence body required');
  if (!uuid) throw new Error('Occurrence uuid required to keep its identity');
  const chain: any[] = Array.isArray(data.body.trace_chain) ? data.body.trace_chain : data.body.trace ? [data.body.trace] : [];
  const message = data.body.message?.body;
  if (!chain.length && typeof message !== 'string') throw new Error('Occurrence trace or message required');
  if (chain.some(trace => !Array.isArray(trace?.frames))) throw new Error('Occurrence stack frames required');
  // Rollbar lists the reported exception first; Spool's wire order lists it last.
  const values = [...chain].reverse().map(trace => ({ type: trace.exception?.class, value: trace.exception?.message ?? trace.exception?.description,
    stacktrace: { frames: trace.frames.map((frame: any) => ({ filename: frame.filename, lineno: frame.lineno, colno: frame.colno, function: frame.method })) } }));
  const telemetry = Array.isArray(data.body.telemetry) ? data.body.telemetry : [];
  const breadcrumbs = telemetry.filter((entry: any) => typeof entry?.body?.message === 'string').map((entry: any) => ({ category: typeof entry.type === 'string' ? entry.type : 'telemetry', message: entry.body.message }));
  const platform = ['python', 'go'].includes(data.language) ? data.language : undefined;
  const event = convertSentry({ event_id: uuid, release, environment: typeof data.environment === 'string' ? data.environment : undefined, level: levels[data.level], platform,
    ...values.length ? { exception: { values } } : { message }, breadcrumbs });
  const received = seconds(row.timestamp ?? data.timestamp, 'occurrence timestamp');
  const frames = chain.at(0)?.frames ?? [];
  return { event, received, located: event.frames.length, total: frames.length };
}
