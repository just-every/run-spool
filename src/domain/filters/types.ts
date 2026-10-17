import type { Envelope } from '../privacy.ts';

export const filterIds = ['browser_extensions', 'legacy_browsers', 'localhost', 'crawlers', 'react_hydration', 'chunk_load', 'ip_addresses', 'messages', 'releases', 'environments', 'allowed_domains'] as const;
export type FilterId = typeof filterIds[number];
export const browserNames = ['chrome', 'firefox', 'safari', 'edge', 'ie', 'opera', 'samsung'] as const;
export type BrowserName = typeof browserNames[number];
export interface Toggle { enabled: boolean }
export interface ListFilter extends Toggle { values: string[] }
export interface LegacyBrowserRule { name: BrowserName; maxVersion: string }
export interface InboundPolicy {
 version: 1;
 filters: {
  browser_extensions: Toggle;
  legacy_browsers: Toggle & { browsers: LegacyBrowserRule[] };
  localhost: Toggle;
  crawlers: Toggle;
  react_hydration: Toggle;
  chunk_load: Toggle;
  ip_addresses: ListFilter;
  messages: ListFilter;
  releases: ListFilter;
  environments: ListFilter;
  allowed_domains: ListFilter;
 };
}
// The intersection admits richer standard Sentry evidence without requiring a
// second native event representation. The intake normalizer owns its validation.
export type InboundEvent = Envelope;
export interface InboundMetadata {
 // Trusted transport metadata, not X-Forwarded-For supplied by a caller.
 clientIp?: string; userAgent?: string; origin?: string; referer?: string;
 // Pass the transport domain decision so the matcher honours legacy exact origins.
 domainAllowed?: boolean;
}
export interface PolicySnapshot { revision: number; policy: InboundPolicy }
export const defaultOnFilters: FilterId[] = ['browser_extensions', 'crawlers'];
export const filterLabels: Record<FilterId, string> = {
 browser_extensions: 'Browser extensions', legacy_browsers: 'Legacy browsers', localhost: 'Localhost and loopback',
 crawlers: 'Known web crawlers', react_hydration: 'React hydration errors', chunk_load: 'Chunk and dynamic import failures',
 ip_addresses: 'Client IP addresses and CIDRs', messages: 'Error message patterns', releases: 'Releases',
 environments: 'Environments', allowed_domains: 'Allowed browser domains',
};
