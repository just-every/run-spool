import type { WireResponse } from '../integrations/core/types.ts';
import { EgressError, RESPONSE_BODY_LIMIT, RESPONSE_HEAD_LIMIT } from './policy.ts';

/** Fetch exposes normalized response headers, not the HTTP wire head. Bound the exposed head
 * using an HTTP/1.1 representation; the platform owns parsing and TLS on this route. */
export async function readFetchResponse(response: Response, reader: ReadableStreamDefaultReader<Uint8Array> | undefined): Promise<WireResponse> {
  if (!Number.isInteger(response.status) || response.status < 200 || response.status > 599) throw new EgressError('egress_response_malformed');
  let headSize = `HTTP/1.1 ${response.status} ${response.statusText}\r\n\r\n`.length;
  const headers: Record<string, string> = {};
  for (const [name, value] of response.headers) {
    headSize += name.length + value.length + 4;
    if (headSize > RESPONSE_HEAD_LIMIT) throw new EgressError('egress_response_head_too_large');
    Object.defineProperty(headers, name, { value, enumerable: true });
  }
  if (headSize > RESPONSE_HEAD_LIMIT) throw new EgressError('egress_response_head_too_large');
  const length = response.headers.get('content-length');
  if (length !== null && !/^\d{1,16}$/.test(length)) throw new EgressError('egress_response_malformed');
  if (length !== null && Number(length) > RESPONSE_BODY_LIMIT) throw new EgressError('egress_response_too_large');
  const parts: Uint8Array[] = [];
  let size = 0;
  if (reader) for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > RESPONSE_BODY_LIMIT) throw new EgressError('egress_response_too_large');
    parts.push(value);
  }
  // Fetch may transparently decompress a body, so Content-Length need not match its exposed bytes.
  if (length !== null && !response.headers.has('content-encoding') && ![204, 304].includes(response.status) && size !== Number(length)) throw new EgressError('egress_response_incomplete');
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  const body = new TextDecoder().decode(bytes);
  if (new TextEncoder().encode(body).byteLength > RESPONSE_BODY_LIMIT) throw new EgressError('egress_response_too_large');
  return { status: response.status, headers, body };
}
