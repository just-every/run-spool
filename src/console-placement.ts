import { WorkerEntrypoint } from 'cloudflare:workers';

const locations = ['wnam', 'enam', 'weur', 'eeur', 'apac', 'oc'] as const;
type Location = typeof locations[number];
type Placement = Location | 'local';

const placements = new WeakMap<D1Database, Placement>();

function isLocation(value: string | undefined): value is Location {
 return locations.some(location => location === value);
}

export class SpoolConsolePlacement extends WorkerEntrypoint<{DB:D1Database}> {
 async discover(): Promise<Placement> {
  // The direct binding queries the primary even when D1 read replication is enabled.
  const { meta } = await this.env.DB.prepare('SELECT 1').run();
  const region = meta.served_by_region?.toLowerCase();
  if (meta.served_by_primary && isLocation(region)) return region;
  // Miniflare has no geographic placement. Hosted requests require primary metadata.
  if (meta.served_by === 'miniflare.db') return 'local';
  throw new Error('D1 did not report its primary region for console placement');
 }
}

function consoleInstance(role: string, placement: Placement) {
 // New names leave objects created before D1 placement and objects for a prior region behind.
 return `${role}:d1:${placement}`;
}

export function consoleInstanceMatches(instance: string | undefined, role: string): boolean {
 const placement = instance?.split(':').at(-1);
 return (placement === 'local' || isLocation(placement)) && instance === consoleInstance(role, placement);
}

export async function placedConsole(ns: DurableObjectNamespace, db: D1Database, role: string, discover: () => Promise<Placement>): Promise<DurableObjectStub> {
 let placement = placements.get(db);
 if (placement === undefined) {
  // Keep the resolved value only. A pending D1 request belongs to its own Worker invocation.
  placement = await discover();
  placements.set(db, placement);
 }
 return ns.getByName(consoleInstance(role, placement), placement === 'local' ? undefined : { locationHint: placement });
}
