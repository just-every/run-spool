/** Legacy marker Vector reads from `INTEGRATION_EGRESS_POLICY`; not a universal pinning claim.
 * Hybrid-route guarantees and the still-disabled adoption gate are documented in DESIGN.md. */
export const EGRESS_POLICY = 'public-dns-pinned-tls-v1';

/** Limits shared with NodePinnedTransport (modules/integrations/core/node-transport.ts). */
export const REQUEST_BODY_LIMIT = 1024 * 1024;
export const RESPONSE_BODY_LIMIT = 65536;
/** Node's default maximum HTTP header size; the response status line and headers share it. */
export const RESPONSE_HEAD_LIMIT = 16384;
export const DNS_TIMEOUT_MS = 15000;
export const REQUEST_TIMEOUT_MS = 15000;

/** The same names NodePinnedTransport refuses: the service writes them itself. */
export const FORBIDDEN_HEADER = /^(host|connection|transfer-encoding|content-length|proxy-authorization)$/i;

export const EGRESS_CODES = [
  'egress_request_invalid', 'egress_destination_refused', 'egress_destination_not_allowed',
  'egress_header_forbidden', 'egress_header_invalid', 'egress_request_too_large',
  'egress_configuration_invalid', 'egress_dns_failed', 'egress_dns_timeout', 'egress_dns_not_public',
  'egress_connection_failed', 'egress_request_timeout', 'egress_response_malformed',
  'egress_response_head_too_large', 'egress_response_too_large', 'egress_response_incomplete',
] as const;
export type EgressCode = typeof EGRESS_CODES[number];

/** Every failure carries only a fixed code: never a URL, address, header or response text. */
export class EgressError extends Error {
  readonly code: EgressCode;
  constructor(code: EgressCode) { super(code); this.name = 'EgressError'; this.code = code; }
}

const hostname = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Exact host names or `*.suffix` (any name below suffix, not suffix itself). */
export function parseHostPatterns(value: unknown): readonly string[] {
  if (!Array.isArray(value)) throw new EgressError('egress_configuration_invalid');
  return value.map(item => {
    const pattern = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (!hostname.test(pattern.startsWith('*.') ? pattern.slice(2) : pattern)) throw new EgressError('egress_configuration_invalid');
    return pattern;
  });
}

export function hostMatches(host: string, patterns: readonly string[]): boolean {
  return patterns.some(pattern => pattern.startsWith('*.') ? host.endsWith(pattern.slice(1)) : host === pattern);
}

/** Destination lists: the service's own (unset = any public host), narrowed by the caller binding's props. */
export interface DestinationPolicy { service: readonly string[] | null; caller: readonly string[] | null }

/** `EGRESS_ALLOWED_HOSTS` is comma- or whitespace-separated. Set but empty is refused, never "any". */
export function destinationPolicy(serviceHosts: string | undefined, props: unknown): DestinationPolicy {
  let service: readonly string[] | null = null;
  if (serviceHosts !== undefined) {
    const list = String(serviceHosts).split(/[\s,]+/).filter(Boolean);
    if (!list.length) throw new EgressError('egress_configuration_invalid');
    service = parseHostPatterns(list);
  }
  let caller: readonly string[] | null = null;
  if (props !== undefined && props !== null) {
    if (typeof props !== 'object' || Array.isArray(props)) throw new EgressError('egress_configuration_invalid');
    if (Object.keys(props).some(key => key !== 'allowedHosts')) throw new EgressError('egress_configuration_invalid');
    const granted = (props as { allowedHosts?: unknown }).allowedHosts;
    if (granted !== undefined) caller = parseHostPatterns(granted);
  }
  return { service, caller };
}

export function destinationAllowed(host: string, policy: DestinationPolicy): boolean {
  return (!policy.service || hostMatches(host, policy.service)) && (!policy.caller || hostMatches(host, policy.caller));
}
