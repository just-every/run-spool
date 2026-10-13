import type { WireResponse } from '../integrations/core/types.ts';
import { EgressError, FORBIDDEN_HEADER, RESPONSE_BODY_LIMIT, RESPONSE_HEAD_LIMIT } from './policy.ts';

const token = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const fieldValue = /^[\t\x20-\x7e\x80-\xff]*$/;
const encoder = new TextEncoder();

/** One HTTP/1.1 POST written by the service itself: Host, Content-Length and Connection are its own. */
export function serializeRequest(url: URL, headers: Record<string, string>, body: Uint8Array): Uint8Array {
  const seen = new Set<string>();
  let head = `POST ${url.pathname || '/'}${url.search} HTTP/1.1\r\nHost: ${url.host}\r\n`;
  for (const [name, value] of Object.entries(headers)) {
    if (FORBIDDEN_HEADER.test(name)) throw new EgressError('egress_header_forbidden');
    if (!token.test(name) || typeof value !== 'string' || !fieldValue.test(value) || seen.has(name.toLowerCase())) throw new EgressError('egress_header_invalid');
    seen.add(name.toLowerCase());
    if (head.length + name.length + value.length + 4 > RESPONSE_HEAD_LIMIT) throw new EgressError('egress_request_too_large');
    head += `${name}: ${value}\r\n`;
  }
  head += `Content-Length: ${body.byteLength}\r\nConnection: close\r\n\r\n`;
  if (head.length > RESPONSE_HEAD_LIMIT) throw new EgressError('egress_request_too_large');
  // Header text is latin1 on the wire, as Node writes it; the checks above keep every code unit below 0x100.
  const bytes = Uint8Array.from(head, char => char.charCodeAt(0)), out = new Uint8Array(bytes.byteLength + body.byteLength);
  out.set(bytes); out.set(body, bytes.byteLength);
  return out;
}

/** Buffered reads from the socket; every wait is bounded by the caller's deadline and the caps below. */
class Reader {
  private buffer = new Uint8Array(0);
  private done = false;
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  constructor(stream: ReadableStream<Uint8Array>) { this.reader = stream.getReader(); }
  private async fill(): Promise<boolean> {
    if (this.done) return false;
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try { chunk = await this.reader.read(); } catch { throw new EgressError('egress_connection_failed'); }
    if (chunk.done) { this.done = true; return false; }
    const next = new Uint8Array(this.buffer.byteLength + chunk.value.byteLength);
    next.set(this.buffer); next.set(chunk.value, this.buffer.byteLength);
    this.buffer = next;
    return true;
  }
  /** Bytes up to a CRLF CRLF (head) or CRLF (line), within `limit` bytes. */
  async until(marker: 'head' | 'line', limit: number, tooLarge: EgressError['code']): Promise<string> {
    const pattern = marker === 'head' ? [13, 10, 13, 10] : [13, 10];
    for (let from = 0; ; ) {
      const at = indexOf(this.buffer, pattern, from);
      if (at >= 0 && at <= limit) {
        const text = latin1(this.buffer.subarray(0, at));
        this.buffer = this.buffer.subarray(at + pattern.length);
        return text;
      }
      if (this.buffer.byteLength > limit + pattern.length) throw new EgressError(tooLarge);
      from = Math.max(0, this.buffer.byteLength - pattern.length + 1);
      if (!(await this.fill())) throw new EgressError('egress_response_incomplete');
    }
  }
  async exactly(length: number): Promise<Uint8Array> {
    while (this.buffer.byteLength < length) if (!(await this.fill())) throw new EgressError('egress_response_incomplete');
    const bytes = this.buffer.subarray(0, length);
    this.buffer = this.buffer.subarray(length);
    return bytes;
  }
  /** Everything until the peer closes, within `limit` bytes. */
  async rest(limit: number): Promise<Uint8Array> {
    while (await this.fill()) if (this.buffer.byteLength > limit) throw new EgressError('egress_response_too_large');
    if (this.buffer.byteLength > limit) throw new EgressError('egress_response_too_large');
    return this.buffer;
  }
  release() { try { this.reader.releaseLock(); } catch { /* a timed-out read may still hold the lock; the socket is closed next */ } }
}

function indexOf(bytes: Uint8Array, pattern: number[], from: number): number {
  outer: for (let i = from; i <= bytes.byteLength - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) if (bytes[i + j] !== pattern[j]) continue outer;
    return i;
  }
  return -1;
}
function latin1(bytes: Uint8Array): string {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return text;
}

interface Head { status: number; headers: Record<string, string> }

function parseHead(text: string): Head {
  const [statusLine, ...lines] = text.split('\r\n');
  const status = /^HTTP\/1\.[01] ([1-5][0-9][0-9])(?: [\t\x20-\x7e\x80-\xff]*)?$/.exec(statusLine ?? '');
  if (!status) throw new EgressError('egress_response_malformed');
  const headers = new Map<string, string>();
  for (const line of lines) {
    const colon = line.indexOf(':');
    const name = line.slice(0, colon).toLowerCase(), value = line.slice(colon + 1).trim();
    if (colon < 1 || !token.test(name) || !fieldValue.test(value)) throw new EgressError('egress_response_malformed');
    headers.set(name, headers.has(name) ? `${headers.get(name)}, ${value}` : value);
  }
  return { status: Number(status[1]), headers: Object.fromEntries(headers) };
}

async function chunkedBody(reader: Reader): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const line = await reader.until('line', 1024, 'egress_response_malformed');
    const match = /^([0-9a-fA-F]{1,8})(?:[ \t]*;[^\r\n]*)?$/.exec(line);
    if (!match) throw new EgressError('egress_response_malformed');
    const length = parseInt(match[1]!, 16);
    if (length === 0) break;
    size += length;
    if (size > RESPONSE_BODY_LIMIT) throw new EgressError('egress_response_too_large');
    parts.push(await reader.exactly(length));
    if ((await reader.exactly(2)).some((byte, i) => byte !== [13, 10][i])) throw new EgressError('egress_response_malformed');
  }
  // Trailers end with an empty line and share the head budget.
  for (let budget = RESPONSE_HEAD_LIMIT; ; ) {
    const line = await reader.until('line', budget, 'egress_response_head_too_large');
    if (!line) break;
    budget -= line.length + 2;
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { body.set(part, offset); offset += part.byteLength; }
  return body;
}

/** A complete bounded response: interim 1xx skipped, a 3xx returned as is, never followed. */
export async function readResponse(stream: ReadableStream<Uint8Array>): Promise<WireResponse> {
  const reader = new Reader(stream);
  try {
    let head: Head;
    do {
      head = parseHead(await reader.until('head', RESPONSE_HEAD_LIMIT, 'egress_response_head_too_large'));
      if (head.status === 101) throw new EgressError('egress_response_malformed');
    } while (head.status < 200);
    const encoding = head.headers['transfer-encoding'], length = head.headers['content-length'];
    let body: Uint8Array;
    if (head.status === 204 || head.status === 304) body = new Uint8Array(0);
    else if (encoding !== undefined) {
      if (length !== undefined || encoding.toLowerCase() !== 'chunked') throw new EgressError('egress_response_malformed');
      body = await chunkedBody(reader);
    } else if (length !== undefined) {
      if (!/^\d{1,16}$/.test(length)) throw new EgressError('egress_response_malformed');
      if (Number(length) > RESPONSE_BODY_LIMIT) throw new EgressError('egress_response_too_large');
      body = await reader.exactly(Number(length));
    } else body = await reader.rest(RESPONSE_BODY_LIMIT);
    const text = new TextDecoder().decode(body);
    // Replacement characters can grow a decoded body; the caller's cap is on its UTF-8 bytes.
    if (encoder.encode(text).byteLength > RESPONSE_BODY_LIMIT) throw new EgressError('egress_response_too_large');
    return { status: head.status, headers: head.headers, body: text };
  } finally { reader.release(); }
}
