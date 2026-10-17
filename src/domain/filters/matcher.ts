import { filterIds, type FilterId, type InboundEvent, type InboundMetadata, type InboundPolicy } from './types.ts';
import { allowedInboundDomain } from './domains.ts';
import { eventUrls, inboundMetadata, messages } from './evidence.ts';
import { ipInRange, loopbackHost } from './network.ts';
import { legacyBrowser } from './browser.ts';
import { knownCrawler } from './crawlers.ts';

// Only '*' has special meaning. Literal segments are searched left to right;
// user input never becomes a regex and cannot cause regex backtracking.
export function wildcardMatch(value: string, pattern: string): boolean {
 const parts = pattern.split('*'); if (parts.length === 1) return value === pattern;
 let cursor = 0;
 if (parts[0]) { if (!value.startsWith(parts[0])) return false; cursor = parts[0].length; }
 for (let i = 1; i < parts.length - 1; i++) {
  if (!parts[i]) continue;
  const at = value.indexOf(parts[i], cursor); if (at < 0) return false; cursor = at + parts[i].length;
 }
 const tail = parts[parts.length - 1]; return !tail || value.endsWith(tail) && value.length - tail.length >= cursor;
}
function localUrl(value: string): boolean {
 try { return loopbackHost(new URL(value).hostname); } catch { return false; }
}
export function matchInbound(event: InboundEvent, policy: InboundPolicy, metadata: InboundMetadata = {}): FilterId[] {
 const f = policy.filters, meta = inboundMetadata(event, metadata), text = messages(event), urls = eventUrls(event), matches = new Set<FilterId>();
 const add = (id: FilterId, match: boolean) => { if (f[id].enabled && match) matches.add(id); };
 add('browser_extensions', urls.some(url => /^(?:chrome-extension|moz-extension|safari-extension|safari-web-extension|ms-browser-extension):\/\//i.test(url)) || text.some(value => /(?:chrome-extension|moz-extension|safari-extension|safari-web-extension|ms-browser-extension):\/\//i.test(value)));
 add('legacy_browsers', f.legacy_browsers.enabled && legacyBrowser(event, meta.userAgent ?? '', f.legacy_browsers.browsers));
 add('localhost', urls.some(localUrl) || [meta.origin, meta.referer].some(value => !!value && localUrl(value)) || !!meta.clientIp && loopbackHost(meta.clientIp));
 add('crawlers', !!meta.userAgent && knownCrawler(meta.userAgent));
 add('react_hydration', text.some(value => /hydration (?:failed|error|mismatch)|error (?:while|during) hydrat|(?:text content|server rendered HTML|initial UI) (?:did not|does not|doesn't) match|Minified React error #(?:418|419|421|422|423|425)\b/i.test(value)));
 add('chunk_load', text.some(value => /ChunkLoadError|Loading (?:CSS )?chunk [\s\S]*?failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Failed to load module script|Unable to preload CSS/i.test(value)));
 add('ip_addresses', !!meta.clientIp && f.ip_addresses.values.some(range => ipInRange(meta.clientIp!, range)));
 // Error patterns are case-insensitive; release/environment identity is exact-case.
 add('messages', f.messages.values.some(pattern => text.some(value => wildcardMatch(value.toLowerCase(), pattern.toLowerCase()))));
 add('releases', f.releases.values.some(pattern => wildcardMatch(event.release ?? '', pattern)));
 add('environments', f.environments.values.some(pattern => wildcardMatch(event.environment ?? '', pattern)));
 // The separate transport check adds legacy exact origins and the installation
 // origin. Intake should use its decision rather than this policy-only result.
 add('allowed_domains', f.allowed_domains.enabled && !(meta.domainAllowed ?? allowedInboundDomain(policy, meta).allowed));
 return filterIds.filter(id => matches.has(id));
}
