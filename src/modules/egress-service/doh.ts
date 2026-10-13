import { EgressError } from './policy.ts';
import type { EgressPorts } from './transport.ts';

/** The one fixed resolver. Destination fetch is separately restricted to validated Cloudflare-only answer sets. */
export const DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
const DOH_RESPONSE_LIMIT = 65536;

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

async function boundedText(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader(), parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > DOH_RESPONSE_LIMIT) { await reader.cancel().catch(() => {}); throw new EgressError('egress_dns_failed'); }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
}

/** RFC 8484 JSON form: A and AAAA queried together; CNAME records in the chain are skipped,
 * every address record is returned for validation. Any non-success answer fails the lookup. */
export function dohResolver(request: Fetch): EgressPorts['resolve'] {
  return async (hostname, signal) => {
    const query = async (type: 'A' | 'AAAA') => {
      const response = await request(`${DOH_ENDPOINT}?name=${encodeURIComponent(hostname)}&type=${type}`, {
        method: 'GET', headers: { accept: 'application/dns-json' }, redirect: 'manual', signal,
      });
      if (response.status !== 200) { await response.body?.cancel().catch(() => {}); throw new EgressError('egress_dns_failed'); }
      let message: { Status?: unknown; Answer?: unknown };
      try { message = JSON.parse(await boundedText(response)); } catch { throw new EgressError('egress_dns_failed'); }
      if (message?.Status !== 0) throw new EgressError('egress_dns_failed');
      const records = message.Answer ?? [];
      if (!Array.isArray(records)) throw new EgressError('egress_dns_failed');
      // A response may carry both address families. None may bypass validation
      // merely because its record type differs from the requested query type.
      return records.filter(record => record?.type === 1 || record?.type === 28).map(record => {
        if (typeof record.data !== 'string') throw new EgressError('egress_dns_failed');
        return record.data.toLowerCase();
      });
    };
    const [v4, v6] = await Promise.all([query('A'), query('AAAA')]);
    return [...v4, ...v6];
  };
}
