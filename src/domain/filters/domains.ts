import type { InboundMetadata, InboundPolicy } from './types.ts';

export function domainPattern(value: string): string | null {
 if (typeof value !== 'string' || value.length > 200) return null;
 const wildcard = value.startsWith('*.'), host = wildcard ? value.slice(2) : value;
 // URL canonicalization supplies IDNA; settings store its ASCII form explicitly.
 if (!host || /[\s/:?#@\\*]/.test(host) || host.endsWith('.')) return null;
 try {
  const parsed = new URL('https://' + host);
  if (parsed.hostname !== host.toLowerCase() || parsed.port || parsed.pathname !== '/' || !/^[a-z0-9.-]+$/.test(parsed.hostname)) return null;
  if (host.split('.').some(label => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) return null;
  if (wildcard && (!host.includes('.') || /^[0-9.]+$/.test(host))) return null;
  return (wildcard ? '*.' : '') + parsed.hostname;
 } catch { return null; }
}
function httpUrl(value: string, origin: boolean): URL | null {
 try {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (origin && value !== url.origin)) return null;
  return url;
 } catch { return null; }
}
function matches(host: string, pattern: string): boolean {
 // *.example.com covers subdomains, never the apex or suffix lookalikes.
 return pattern.startsWith('*.') ? host.endsWith(pattern.slice(1)) && host !== pattern.slice(2) : host === pattern;
}
export type DomainDecision = {
 allowed: boolean; status: 200 | 403; reason: 'origin_not_allowed' | 'referer_not_allowed' | null;
 cors: string | null; legacyOrigins: string[];
};
/** Both browser headers must pass when present. Without configured domains the
 * existing exact-Origin allowlist (including the installation origin) applies.
 * Native/server intake with neither browser header is unaffected. */
export function allowedInboundDomain(policy: InboundPolicy, metadata: InboundMetadata, legacyOrigins: readonly string[] = [], serviceOrigin?: string): DomainDecision {
 const configured = policy.filters.allowed_domains, legacyUsed: string[] = [];
 const refuse = (reason: 'origin_not_allowed' | 'referer_not_allowed'): DomainDecision => ({ allowed: false, status: 403, reason, cors: null, legacyOrigins: [] });
 for (const field of ['origin', 'referer'] as const) {
  const value = metadata[field]; if (value === undefined) continue;
  const url = httpUrl(value, field === 'origin'); if (!url) return refuse(field === 'origin' ? 'origin_not_allowed' : 'referer_not_allowed');
  if (url.origin === serviceOrigin) continue;
  if (legacyOrigins.includes(url.origin)) { legacyUsed.push(url.origin); continue; }
  if (configured.enabled && configured.values.some(pattern => matches(url.hostname.toLowerCase().replace(/\.$/, ''), pattern))) continue;
  // Preserve legacy Referer behaviour until the new allowed-domain filter is enabled.
  if (field === 'referer' && !configured.enabled) continue;
  return refuse(field === 'origin' ? 'origin_not_allowed' : 'referer_not_allowed');
 }
 return { allowed: true, status: 200, reason: null, cors: metadata.origin ?? null, legacyOrigins: [...new Set(legacyUsed)] };
}
export async function checkInboundDomains(db: D1Database, project: string, policy: InboundPolicy, metadata: InboundMetadata, serviceOrigin?: string): Promise<DomainDecision> {
 const rows = await db.prepare('SELECT origin FROM browser_origins WHERE project=?').bind(project).all<{ origin: string }>();
 return allowedInboundDomain(policy, metadata, rows.results.map(row => row.origin), serviceOrigin);
}
/** Intake must also fence exact legacy allowlist entries used by either header. */
export function inboundDomainFences(db: D1Database, project: string, decision: DomainDecision): D1PreparedStatement[] {
 return decision.legacyOrigins.map(origin => db.prepare('INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM browser_origins WHERE project=? AND origin=?) THEN 1 ELSE 0 END').bind(project, origin));
}
