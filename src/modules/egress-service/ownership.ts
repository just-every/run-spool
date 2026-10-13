import { EgressError } from './policy.ts';

export interface OwnershipPolicy { zones: readonly string[]; workersSuffix: string }
const hostname = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Both inputs belong to the service deployment, never binding props or the send payload.
 * An explicit empty zone array is valid; an absent inventory is not. */
export function ownershipPolicy(zones: unknown, workersSuffix: unknown): OwnershipPolicy {
  let parsed: unknown;
  try { parsed = typeof zones === 'string' ? JSON.parse(zones) : null; } catch { throw new EgressError('egress_configuration_invalid'); }
  if (!Array.isArray(parsed) || parsed.length > 10000 || parsed.some(zone => typeof zone !== 'string' || zone.length > 253
    || !hostname.test(zone) || /^[\d.]+$/.test(zone)) || new Set(parsed).size !== parsed.length
    || typeof workersSuffix !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.workers\.dev$/.test(workersSuffix)) {
    throw new EgressError('egress_configuration_invalid');
  }
  return { zones: parsed, workersSuffix };
}

export function accountOwns(host: string, ownership: OwnershipPolicy): boolean {
  return [...ownership.zones, ownership.workersSuffix].some(suffix => host === suffix || host.endsWith(`.${suffix}`));
}
