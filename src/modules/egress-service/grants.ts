import { EgressError, parseHostPatterns, type DestinationPolicy } from './policy.ts';

/** Service-owned grants for named entrypoints. Request payloads never select a grant. */
export function serviceGrant(serialized: string | undefined, entrypoint: string): DestinationPolicy['caller'] {
  let rows: unknown;
  try { rows = JSON.parse(serialized ?? ''); } catch { throw new EgressError('egress_configuration_invalid'); }
  if (!Array.isArray(rows) || !rows.length) throw new EgressError('egress_configuration_invalid');
  const names = new Set<string>();
  let selected: readonly string[] | null | undefined;
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Object.keys(row).sort().join() !== 'allowedHosts,entrypoint'
      || typeof row.entrypoint !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(row.entrypoint) || names.has(row.entrypoint)) throw new EgressError('egress_configuration_invalid');
    names.add(row.entrypoint);
    const hosts = row.allowedHosts === null ? null : parseHostPatterns(row.allowedHosts);
    if (hosts && new Set(hosts).size !== hosts.length) throw new EgressError('egress_configuration_invalid');
    if (row.entrypoint === entrypoint) selected = hosts;
  }
  if (selected === undefined) throw new EgressError('egress_configuration_invalid');
  return selected;
}
