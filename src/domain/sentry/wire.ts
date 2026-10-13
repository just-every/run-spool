/** Byte framing for Sentry envelopes. Unsupported payloads never undergo decoding. */
export const wireLimits = { compressed: 262144, expanded: 1048576, items: 100, header: 8192 };
export type WireObject = Record<string, any>;
export interface SentryItem { header: WireObject; bytes: Uint8Array }
export interface SentryEnvelope { header: WireObject; items: SentryItem[] }
const decoder = new TextDecoder('utf-8', { fatal: true });
export class SentryWireError extends Error {
  reason: string; status: number;
  constructor(reason: string, status = 400) { super(reason); this.reason = reason; this.status = status }
}
export function objectJson(bytes: Uint8Array): WireObject {
  try {
    const value = JSON.parse(decoder.decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new SentryWireError('invalid_json') }
}
async function boundedStream(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array> {
  const reader = stream.getReader(), chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new SentryWireError('body_too_large', 413) }
      chunks.push(value);
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return bytes;
}
export async function readSentryBytes(request: Request): Promise<Uint8Array> {
  const encoding = (request.headers.get('content-encoding') ?? 'identity').trim().toLowerCase();
  if (!['identity', 'gzip'].includes(encoding)) throw new SentryWireError('unsupported_content_encoding', 415);
  const length = request.headers.get('content-length');
  const limit = encoding === 'gzip' ? wireLimits.compressed : wireLimits.expanded;
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) throw new SentryWireError('body_too_large', 413);
  if (!request.body) throw new SentryWireError('missing_body');
  const input = await boundedStream(request.body, limit);
  if (encoding === 'identity') return input;
  try {
    const compressed = new ReadableStream<BufferSource>({ start(controller) { controller.enqueue(input as Uint8Array<ArrayBuffer>); controller.close() } });
    return await boundedStream(compressed.pipeThrough(new DecompressionStream('gzip')), wireLimits.expanded);
  } catch (error) {
    if (error instanceof SentryWireError) throw error;
    throw new SentryWireError('invalid_gzip');
  }
}
export function parseEnvelope(bytes: Uint8Array): SentryEnvelope {
  if (!bytes.length || bytes.length > wireLimits.expanded) throw new SentryWireError('invalid_envelope_size');
  let offset = 0;
  const line = (payloadFollows = false) => {
    const end = bytes.indexOf(10, offset), boundary = end < 0 ? bytes.length : end;
    if (payloadFollows && end < 0) throw new SentryWireError('invalid_item_framing');
    if (boundary - offset > wireLimits.header) throw new SentryWireError('header_too_large');
    const result = objectJson(bytes.subarray(offset, boundary)); offset = end < 0 ? bytes.length : end + 1;
    return result;
  };
  const header = line(), items: SentryItem[] = [];
  while (offset < bytes.length) {
    if (items.length >= wireLimits.items) throw new SentryWireError('too_many_items');
    const item = line(true);
    if (typeof item.type !== 'string' || !item.type || item.type.length > 100) throw new SentryWireError('invalid_item_type');
    let end: number;
    if (Object.hasOwn(item, 'length')) {
      if (!Number.isSafeInteger(item.length) || item.length < 0) throw new SentryWireError('invalid_item_length');
      end = offset + item.length;
      if (end > bytes.length || (end < bytes.length && bytes[end] !== 10)) throw new SentryWireError('invalid_item_framing');
    } else { const newline = bytes.indexOf(10, offset); end = newline < 0 ? bytes.length : newline }
    items.push({ header: item, bytes: bytes.subarray(offset, end) });
    offset = end < bytes.length ? end + 1 : end;
  }
  return { header, items };
}
const categories: Record<string, string> = {
  session: 'session', sessions: 'session', transaction: 'performance', span: 'performance', attachment: 'attachment',
  client_report: 'client_report', replay_event: 'replay', replay_recording: 'replay', replay_video: 'replay',
  profile: 'profile', profile_chunk: 'profile', feedback: 'feedback', user_report: 'feedback', check_in: 'check_in',
  log: 'other_telemetry', logs: 'other_telemetry', metrics: 'other_telemetry', statsd: 'other_telemetry', security: 'other_telemetry',
};
export function unsupportedReason(type: string): string { return `sentry_unsupported_${Object.hasOwn(categories, type) ? categories[type] : 'unknown'}` }
