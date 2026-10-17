import { filterIds, type FilterId, type InboundPolicy } from './types.ts';
import { inboundMetadata, eventUrls } from './evidence.ts';
import { matchInbound } from './matcher.ts';
import { allowedInboundDomain } from './domains.ts';

export function isInboundFilteredReason(reason: string): boolean {
 return filterIds.some(id => reason === 'filtered:' + id);
}
export async function recentInboundCounts(db: D1Database, project: string, since = Date.now() - 24 * 60 * 60 * 1000): Promise<Record<FilterId, number>> {
 const rows = await db.prepare("SELECT reason,SUM(count) count FROM outcomes WHERE project=? AND window>=? AND reason LIKE 'filtered:%' GROUP BY reason").bind(project, since).all<{ reason: string; count: number }>();
 return Object.fromEntries(filterIds.map(id => [id, rows.results.find(row => row.reason === 'filtered:' + id)?.count ?? 0])) as Record<FilterId, number>;
}
export interface PreviewCursor { after: string; limit: number }
/** A keyset page over ALL retained events, rather than silently treating the
 * newest sample as the whole project. Transport IP is not persisted; report
 * unavailable evidence separately from an observed non-match. */
export async function previewInbound(db: D1Database, project: string, policy: InboundPolicy, cursor: PreviewCursor, serviceOrigin?: string) {
 const [page, total, origins] = await Promise.all([
  db.prepare('SELECT id,payload FROM events WHERE project=? AND id>? ORDER BY id LIMIT ?').bind(project, cursor.after, cursor.limit + 1).all<{ id: string; payload: string }>(),
  db.prepare('SELECT COUNT(*) count FROM events WHERE project=?').bind(project).first<{ count: number }>(),
  db.prepare('SELECT origin FROM browser_origins WHERE project=?').bind(project).all<{ origin: string }>(),
 ]);
 const counts = Object.fromEntries(filterIds.map(id => [id, { matches: 0, unavailable: 0, samples: [] as string[] }])) as Record<FilterId, { matches: number; unavailable: number; samples: string[] }>;
 const rows = page.results.slice(0, cursor.limit);
 for (const row of rows) {
  const event = JSON.parse(row.payload), metadata = inboundMetadata(event), urls = eventUrls(event);
  const decision = allowedInboundDomain(policy, metadata, origins.results.map(r => r.origin), serviceOrigin);
  const matched = matchInbound(event, policy, { ...metadata, domainAllowed: decision.allowed });
  for (const id of matched) { counts[id].matches++; if (counts[id].samples.length < 5) counts[id].samples.push(row.id); }
  // Headers/transport address are often absent from retained scrubbed evidence.
  if (policy.filters.ip_addresses.enabled) counts.ip_addresses.unavailable++;
  if (policy.filters.crawlers.enabled && !metadata.userAgent) counts.crawlers.unavailable++;
  if (policy.filters.legacy_browsers.enabled && !metadata.userAgent && !event.sentry?.contexts?.browser?.version) counts.legacy_browsers.unavailable++;
  if (policy.filters.allowed_domains.enabled && !metadata.origin && !metadata.referer) counts.allowed_domains.unavailable++;
  if (policy.filters.localhost.enabled && !matched.includes('localhost') && !urls.length && !metadata.origin && !metadata.referer) counts.localhost.unavailable++;
 }
 return { scanned: rows.length, retained: total?.count ?? 0, counts, next: page.results.length > cursor.limit ? rows[rows.length - 1].id : null,
  evidence: 'Retained payloads only; transport client IP is not retained. Missing evidence is reported as unavailable. Counts are for this page and candidate enabled filters.' };
}
