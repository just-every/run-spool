import type { TlsFactory } from '../rustls.ts';
import type { TrustedTransport } from '../../integrations/core/types.ts';
import { destinationPolicy } from '../policy.ts';
import { EgressTransport, type EgressSocket } from '../transport.ts';

export interface DevReceiver {
  /** Loopback port of a real TLS receiver whose certificate names this host. */
  port: number;
  /** Synthetic DNS answers. Default: one public address unique to this name; it is never dialled. */
  answers?: readonly string[];
}
export interface DevEgressOptions {
  /** Synthetic HTTPS names. Any other name fails resolution, as an unknown name would. */
  receivers: Record<string, DevReceiver>;
  tls: TlsFactory;
  /** Opens a socket to a loopback port, e.g. `nodeLoopbackSockets()` from ./node-socket.mjs. */
  openSocket(port: number): EgressSocket;
  allowedHosts?: readonly string[];
  requestTimeoutMs?: number;
}
export interface DevEgress extends TrustedTransport {
  /** Pinned addresses the double connected to, in order. */
  readonly connects: readonly string[];
  readonly resolutions: readonly string[];
}

/** For seeds' own tests only, never a deployable Worker. It is the service's EgressTransport with
 * test ports, so the refusal table, header rules, limits and HTTP/1.1 handling are the service's own. */
export function createDevEgress(options: DevEgressOptions): DevEgress {
  const names = Object.entries(options.receivers).map(([name, receiver], index) => ({
    name: name.toLowerCase(), port: receiver.port, answers: receiver.answers ?? [`93.184.216.${34 + index}`],
  }));
  const connects: string[] = [], resolutions: string[] = [];
  const transport = new EgressTransport({
    async resolve(hostname) {
      resolutions.push(hostname);
      const entry = names.find(item => item.name === hostname);
      if (!entry) throw new Error('unknown synthetic name');
      return entry.answers;
    },
    connect({ hostname }) {
      connects.push(hostname);
      const entry = names.find(item => item.answers.includes(hostname.replace(/^\[|\]$/g, '')));
      if (!entry) throw new Error('no loopback receiver for this address');
      return options.openSocket(entry.port);
    },
  }, {
    tls: options.tls,
    ownership: { zones: [], workersSuffix: 'dev-fixture.workers.dev' },
    policy: destinationPolicy(undefined, options.allowedHosts ? { allowedHosts: options.allowedHosts } : undefined),
    ...(options.requestTimeoutMs ? { requestTimeoutMs: options.requestTimeoutMs } : {}),
  });
  return { send: wire => transport.send(wire), connects, resolutions };
}
