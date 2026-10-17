import { browserNames, filterIds, type InboundPolicy, type PolicySnapshot } from './types.ts';
import { validIpRange } from './network.ts';
import { domainPattern } from './domains.ts';

export function defaultInboundPolicy(): InboundPolicy {
 return { version: 1, filters: {
  browser_extensions: { enabled: true }, legacy_browsers: { enabled: false, browsers: [] },
  localhost: { enabled: false }, crawlers: { enabled: true }, react_hydration: { enabled: false }, chunk_load: { enabled: false },
  ip_addresses: { enabled: false, values: [] }, messages: { enabled: false, values: [] },
  releases: { enabled: false, values: [] }, environments: { enabled: false, values: [] }, allowed_domains: { enabled: false, values: [] },
 } };
}
function shape(value: any, keys: readonly string[]) {
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) throw new Error('Invalid inbound policy fields');
}
export function validateInboundPolicy(value: unknown): InboundPolicy {
 const v = value as any; shape(v, ['version', 'filters']); if (v.version !== 1) throw new Error('Unsupported inbound policy version');
 shape(v.filters, filterIds);
 for (const id of filterIds) {
  const f = v.filters[id], list = ['ip_addresses', 'messages', 'releases', 'environments', 'allowed_domains'].includes(id);
  shape(f, list ? ['enabled', 'values'] : id === 'legacy_browsers' ? ['enabled', 'browsers'] : ['enabled']);
  if (typeof f.enabled !== 'boolean') throw new Error('Filter enabled must be boolean');
  if (list) {
   if (!Array.isArray(f.values) || f.values.length > 100 || new Set(f.values).size !== f.values.length) throw new Error('Each filter allows at most 100 distinct values');
   for (const entry of f.values) {
    if (typeof entry !== 'string' || !entry.length || entry.length > 200 || entry.trim() !== entry || /[\u0000-\u001f\u007f]/.test(entry)) throw new Error('Invalid filter value');
    if (id === 'ip_addresses' && !validIpRange(entry)) throw new Error('Invalid IP address or CIDR');
    if (id === 'allowed_domains' && domainPattern(entry) !== entry) throw new Error('Use a lowercase exact domain or *.domain, without scheme, port or path');
   }
   if (id === 'allowed_domains' && f.enabled && f.values.length === 0) throw new Error('Configure allowed domains before enabling the filter');
  }
  if (id === 'legacy_browsers') {
   if (!Array.isArray(f.browsers) || f.browsers.length > browserNames.length || new Set(f.browsers.map((r: any) => r?.name)).size !== f.browsers.length) throw new Error('Configure each named browser at most once');
   for (const rule of f.browsers) {
    shape(rule, ['name', 'maxVersion']);
    if (!browserNames.includes(rule.name) || typeof rule.maxVersion !== 'string' || !/^\d{1,6}(\.\d{1,6}){0,3}$/.test(rule.maxVersion)) throw new Error('Invalid legacy browser or maximum version');
   }
  }
 }
 if (JSON.stringify(v).length > 65536) throw new Error('Inbound policy exceeds 64 KiB');
 return structuredClone(v) as InboundPolicy;
}
export async function readInboundPolicy(db: D1Database, project: string): Promise<PolicySnapshot> {
 const row = await db.prepare('SELECT revision,policy FROM inbound_filter_policies WHERE project=?').bind(project).first<{ revision: number; policy: string }>();
 return row ? { revision: row.revision, policy: validateInboundPolicy(JSON.parse(row.policy)) } : { revision: 0, policy: defaultInboundPolicy() };
}
/** Put this in the SAME admission batch, before event/outcome mutations.
 * A CHECK failure rolls back intake if an owner changed the policy after lookup.
 * Revision zero is the deterministic default when no row has been configured. */
export function inboundPolicyFence(db: D1Database, project: string, revision: number): D1PreparedStatement {
 return db.prepare('INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN COALESCE((SELECT revision FROM inbound_filter_policies WHERE project=?),0)=? THEN 1 ELSE 0 END').bind(project, revision);
}
