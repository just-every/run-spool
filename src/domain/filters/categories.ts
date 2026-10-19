import { ingestBatch, outcomeStatement, type IngestScope } from '../admission';
import { legacyBrowserMetadata } from './browser';
import { knownCrawler } from './crawlers';
import { ipInRange, loopbackHost } from './network';
import { wildcardMatch } from './matcher';
import { filterIds, type FilterId } from './types';

export const categoryFilterCoverage = {
 errors: 'All enabled filters use available error and transport evidence.',
 feedback: 'Origin/Referer, client IP, crawler, legacy browser and localhost checks using available transport/browser/request evidence; release/environment when supplied. Error text, extension frames, hydration and chunk rules do not apply to feedback descriptions.',
 client_report: 'Origin/Referer, client IP, crawler, legacy browser and localhost transport checks. Error fields, release and environment are unavailable. Filtered reports do not contribute SDK-discard quantities; reported discards describe client loss, never accepted events.',
 historical: 'Only retained error payloads are previewable. Client IP is not retained; missing transport fields and feedback/client-report history are unavailable.',
};
export interface CategoryFields { release?: string; environment?: string; browser?: unknown; urls?: string[] }
/** Non-error categories have no error stack or message. Evaluate only fields
 * actually available on this item and the trusted request transport. */
export async function filterCategory(c: any, scope: IngestScope, fields: CategoryFields = {}): Promise<FilterId[]> {
 const f = scope.policy.filters, matches = new Set<FilterId>();
 const ip = c.req.header('cf-connecting-ip'), ua = c.req.header('user-agent') ?? '';
 const add = (id: FilterId, match: boolean) => { if (f[id].enabled && match) matches.add(id); };
 add('ip_addresses', !!ip && f.ip_addresses.values.some(range => ipInRange(ip, range)));
 add('crawlers', knownCrawler(ua));
 add('legacy_browsers', legacyBrowserMetadata(ua, f.legacy_browsers.browsers, fields.browser));
 add('localhost', !!ip && loopbackHost(ip) || [...(fields.urls ?? []), c.req.header('origin'), c.req.header('referer')].some(value => { if (!value) return false;
  try { return loopbackHost(new URL(value).hostname); } catch { return false; }
 }));
 add('releases', fields.release !== undefined && f.releases.values.some(pattern => wildcardMatch(fields.release!, pattern)));
 add('environments', fields.environment !== undefined && f.environments.values.some(pattern => wildcardMatch(fields.environment!, pattern)));
 const ids = filterIds.filter(id => matches.has(id));
 if (ids.length) await ingestBatch(c, scope, [outcomeStatement(c.env.DB, scope.project, 'filtered'), ...ids.map(id => outcomeStatement(c.env.DB, scope.project, 'filtered:' + id))]);
 return ids;
}
