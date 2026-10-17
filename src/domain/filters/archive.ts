import { canonical, hash } from '../privacy.ts';
import { validateInboundPolicy } from './policy.ts';
import { filterIds } from './types.ts';

export const inboundFilterTables: Record<string, string[]> = {
 inbound_filter_policies: ['project', 'revision', 'policy', 'updated'],
};
export const inboundAuditKinds = ['inbound_filters_changed'];
export const inboundFilteredReasons = filterIds.map(id => 'filtered:' + id);
export const inboundFilterDefaults = (data: any) => ({ inbound_filter_policies: [], ...data });
function assert(value: unknown): asserts value { if (!value) throw new Error('Archive inbound filter integrity'); }
function fields(value: any, keys: string[]) {
 assert(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join() === [...keys].sort().join());
}
const integer = (value: unknown, min = 0) => Number.isSafeInteger(value) && (value as number) >= min;
/** Call alongside the main row validator, after erasure has removed anonymised
 * audit records. The parent validator must recognise these tables/audit kinds
 * and inboundFilteredReasons; this function does not discard any archive rows. */
export async function validateInboundFilterArchive(data: any): Promise<void> {
 assert(Array.isArray(data.inbound_filter_policies));
 const projects = new Set(data.projects.map((row: any) => row.id)), policies = new Map<string, any>();
 for (const row of data.inbound_filter_policies) {
  fields(row, inboundFilterTables.inbound_filter_policies);
  assert(projects.has(row.project) && !policies.has(row.project) && integer(row.revision, 1) && integer(row.updated));
  assert(typeof row.policy === 'string' && row.policy.length <= 65536);
  const policy = validateInboundPolicy(JSON.parse(row.policy)); policies.set(row.project, { ...row, parsed: policy });
 }
 const revisions = new Set<string>();
 for (const row of data.audit.filter((entry: any) => inboundAuditKinds.includes(entry.kind))) {
  assert(typeof row.id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(row.id) && integer(row.created));
  assert(typeof row.detail === 'string' && row.detail.length <= 66000);
  const detail = JSON.parse(row.detail); fields(detail, ['previousRevision', 'revision', 'policyDigest']);
  const current = policies.get(row.project), key = JSON.stringify([row.project, detail.revision]);
  assert(current && integer(detail.revision, 1) && detail.revision <= current.revision && detail.previousRevision === detail.revision - 1 && !revisions.has(key));
  assert(typeof detail.policyDigest==='string'&&/^[a-f0-9]{64}$/.test(detail.policyDigest)); revisions.add(key);
  if (detail.revision === current.revision) assert(detail.policyDigest === await hash(canonical(current.parsed)));
 }
}
