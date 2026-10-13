import { isPublicAddress, validateDestination } from '../integrations/core/destination.ts';
import type { TrustedTransport, WireRequest, WireResponse } from '../integrations/core/types.ts';
import type { TlsFactory } from './rustls.ts';
import { serializeRequest, readResponse } from './http1.ts';
import { readFetchResponse } from './fetch-response.ts';
import { isCloudflareAddress } from './cloudflare-ranges.ts';
import { accountOwns, type OwnershipPolicy } from './ownership.ts';
import {
  DNS_TIMEOUT_MS, EgressError, REQUEST_BODY_LIMIT, REQUEST_TIMEOUT_MS,
  destinationAllowed, type DestinationPolicy,
} from './policy.ts';

/** The shape of a `cloudflare:sockets` Socket that the service uses. */
export interface EgressSocket {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
  readonly opened: Promise<unknown>;
  close(): Promise<void>;
}
/** Network edge ports. The deployable Worker passes a DNS-over-HTTPS resolver and `connect` from
 * `cloudflare:sockets` and destination fetch; tests and the dev double pass their own.
 * These capabilities cannot be selected by caller data or environment switches. */
export interface EgressPorts {
  /** Every A and AAAA answer for one name, resolved once. */
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  resolve(hostname: string, signal: AbortSignal): Promise<readonly string[]>;
  connect(address: { hostname: string; port: number }, options: { secureTransport: 'off'; allowHalfOpen: false }): EgressSocket | Promise<EgressSocket>;
}
export interface EgressOptions {
  tls: TlsFactory;
  policy?: DestinationPolicy;
  ownership: OwnershipPolicy;
  /** Library callers may shorten the limits (tests do); the deployable Worker uses the defaults. */
  dnsTimeoutMs?: number;
  requestTimeoutMs?: number;
}

function deadline<T>(work: Promise<T>, ms: number, code: EgressError['code'], onTimeout: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    work,
    new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { onTimeout(); reject(new EgressError(code)); }, ms); }),
  ]).finally(() => { if (timer !== undefined) clearTimeout(timer); });
}
const asEgressError = (code: EgressError['code']) => (error: unknown): never => {
  throw error instanceof EgressError ? error : new EgressError(code);
};

/** Validates the complete answer set before selecting one route. Raw TLS pins the first
 * non-Cloudflare address; an all-Cloudflare set uses platform fetch. Never retry or fall back. */
export class EgressTransport implements TrustedTransport {
  private ports: EgressPorts;
  private tls: TlsFactory;
  private policy: DestinationPolicy;
  private ownership: OwnershipPolicy;
  private dnsTimeoutMs: number;
  private requestTimeoutMs: number;
  constructor(ports: EgressPorts, options: EgressOptions) {
    this.ports = ports;
    this.tls = options.tls;
    this.ownership = options.ownership;
    this.policy = options.policy ?? { service: null, caller: null };
    this.dnsTimeoutMs = options.dnsTimeoutMs ?? DNS_TIMEOUT_MS;
    this.requestTimeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
    for (const ms of [this.dnsTimeoutMs, this.requestTimeoutMs]) if (!Number.isSafeInteger(ms) || ms < 1 || ms > 30000) throw new Error('Invalid egress limits');
  }

  async send(wire: WireRequest): Promise<WireResponse> {
    if (!wire || typeof wire !== 'object' || typeof wire.url !== 'string' || typeof wire.body !== 'string'
      || !wire.headers || typeof wire.headers !== 'object' || Array.isArray(wire.headers)) throw new EgressError('egress_request_invalid');
    let url: URL;
    try { url = validateDestination(wire.url); } catch { throw new EgressError('egress_destination_refused'); }
    const host = url.hostname.toLowerCase(), literal = host.startsWith('[') || /^[\d.]+$/.test(host);
    if (!destinationAllowed(host, this.policy)) throw new EgressError('egress_destination_not_allowed');
    const body = new TextEncoder().encode(wire.body);
    if (body.byteLength > REQUEST_BODY_LIMIT) throw new EgressError('egress_request_too_large');
    const headers = { ...wire.headers };
    const request = serializeRequest(url, headers, body);
    if (!this.ownership) throw new EgressError('egress_configuration_invalid');
    if (accountOwns(host, this.ownership)) throw new EgressError('egress_destination_not_allowed');

    const addresses = literal ? [host.replace(/^\[|\]$/g, '')] : await this.resolveOnce(host);
    const address = addresses.find(answer => !isCloudflareAddress(answer));
    if (address === undefined) return this.fetchExchange(wire.url, headers, body);
    return this.exchange(address.includes(':') ? `[${address}]` : address, host.replace(/^\[|\]$/g, ''), request);
  }

  private async resolveOnce(host: string): Promise<readonly string[]> {
    const abort = new AbortController();
    // One failed query settles the combined lookup before its sibling necessarily finishes.
    const answers = await deadline(
      Promise.resolve().then(() => this.ports.resolve(host, abort.signal)),
      this.dnsTimeoutMs, 'egress_dns_timeout', () => abort.abort(),
    ).catch(asEgressError('egress_dns_failed')).finally(() => abort.abort());
    if (!Array.isArray(answers) || !answers.length || answers.some(answer => typeof answer !== 'string' || answer.includes('[') || answer.includes(']') || !isPublicAddress(answer))) throw new EgressError('egress_dns_not_public');
    return answers;
  }

  private async fetchExchange(url: string, headers: Record<string, string>, body: Uint8Array): Promise<WireResponse> {
    if (!this.ports.fetch) throw new EgressError('egress_configuration_invalid');
    const abort = new AbortController();
    let response: Response | undefined, reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const close = () => {
      abort.abort();
      // Never await cancellation: a misbehaving peer cannot extend the caller's deadline.
      try { (reader ? reader.cancel() : response?.body?.cancel())?.catch(() => {}); } catch {}
    };
    const work = (async () => {
      response = await this.ports.fetch!(url, { method: 'POST', headers, body, redirect: 'manual', signal: abort.signal });
      // A fetch implementation may ignore abort and return after the deadline.
      if (abort.signal.aborted) { close(); throw new EgressError('egress_request_timeout'); }
      reader = response.body?.getReader();
      return readFetchResponse(response, reader);
    })().catch(asEgressError('egress_connection_failed'));
    try { return await deadline(work, this.requestTimeoutMs, 'egress_request_timeout', close); }
    finally { work.catch(() => {}); close(); }
  }

  private async exchange(pinned: string, tlsHost: string, request: Uint8Array): Promise<WireResponse> {
    const abort = new AbortController();
    let socket: EgressSocket | undefined;
    const close = () => { abort.abort(); try { socket?.close().catch(() => {}); } catch {} };
    const work = (async () => {
      const plain = await Promise.resolve()
        .then(() => this.ports.connect({ hostname: pinned, port: 443 }, { secureTransport: 'off', allowHalfOpen: false }))
        .catch(asEgressError('egress_connection_failed'));
      socket = plain;
      // A connection may resolve after the deadline. Close it before opening TLS or writing.
      if (abort.signal.aborted) { close(); throw new EgressError('egress_request_timeout'); }
      await plain.opened.catch(asEgressError('egress_connection_failed'));
      if (abort.signal.aborted) throw new EgressError('egress_request_timeout');
      const secure = await this.tls(plain, tlsHost, abort.signal).catch(asEgressError('egress_connection_failed'));
      await secure.send(request).catch(asEgressError('egress_connection_failed'));
      return readResponse(secure);
    })();
    try { return await deadline(work, this.requestTimeoutMs, 'egress_request_timeout', close); }
    finally { work.catch(() => {}); close(); }
  }
}
