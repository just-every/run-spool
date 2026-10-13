import { WorkerEntrypoint } from 'cloudflare:workers';
import type { WireRequest, WireResponse } from '../integrations/core/types.ts';
import { ownershipPolicy } from './ownership.ts';
import { serviceGrant } from './grants.ts';
import { destinationPolicy, destinationAllowed, EgressError } from './policy.ts';
import { EgressTransport, type EgressOptions, type EgressPorts } from './transport.ts';

export interface EgressEnv { EGRESS_ALLOWED_HOSTS?: string; EGRESS_GRANTS?: string; EGRESS_OWNED_ZONES?: string; EGRESS_WORKERS_SUFFIX?: string }
/** Set by the caller's service binding configuration (its owner's deploy declaration), never by caller code. */
export interface EgressProps { allowedHosts?: readonly string[] }

/** The only public RPC methods are `send` and `fetch` (404). Ports stay in this closure: an
 * instance field or extra method would be reachable through the binding. */
export function createEgressEntrypoint(makePorts: (env: EgressEnv) => EgressPorts, limits: Omit<EgressOptions, 'policy' | 'ownership'>, grant?: string) {
  return class EgressService extends WorkerEntrypoint<EgressEnv, EgressProps> {
    fetch(): Response { return new Response(null, { status: 404 }); }
    async send(wire: WireRequest): Promise<WireResponse> {
      const policy = destinationPolicy(this.env.EGRESS_ALLOWED_HOSTS, this.ctx.props);
      if (grant !== undefined) {
        const allowed = serviceGrant(this.env.EGRESS_GRANTS, grant);
        // Apply this independently so optional caller props can only narrow it further.
        let host: string;
        try { host = new URL(wire.url).hostname.toLowerCase(); } catch { throw new EgressError('egress_destination_refused'); }
        if (!destinationAllowed(host, { service: allowed, caller: null })) throw new EgressError('egress_destination_not_allowed');
      }
      return new EgressTransport(makePorts(this.env), { ...limits, policy, ownership: ownershipPolicy(this.env.EGRESS_OWNED_ZONES, this.env.EGRESS_WORKERS_SUFFIX) }).send(wire);
    }
  };
}
