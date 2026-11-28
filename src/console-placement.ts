import { WorkerEntrypoint } from 'cloudflare:workers';

const locations = ['wnam', 'enam', 'weur', 'eeur', 'apac', 'oc'] as const;
type Location = typeof locations[number];
type Placement = { region: string; options?: DurableObjectNamespaceGetDurableObjectOptions };

const placements = new WeakMap<D1Database, Placement>();

function isLocation(value: string): value is Location {
 return locations.some(location => location === value);
}

export class SpoolConsolePlacement extends WorkerEntrypoint<{DB:D1Database}> {
 async discover(): Promise<string> {
  // The direct binding queries the primary even when D1 read replication is enabled.
  const { meta } = await this.env.DB.prepare('SELECT 1').run();
  // Miniflare and the demo's SQLite store have no geographic placement.
  return meta.served_by_region?.trim().toLowerCase() || 'local';
 }
}

function consoleInstance(role: string, region: string) {
 // New names leave objects created before D1 placement and objects for a prior region behind.
 return `${role}:d1:${region}`;
}

export function consoleInstanceMatches(instance: string | undefined, role: string): boolean {
 const prefix = consoleInstance(role, '');
 return !!instance && instance.length > prefix.length && instance.startsWith(prefix);
}

export async function placedConsole(ns: DurableObjectNamespace, db: D1Database, role: string, discover: () => Promise<string>): Promise<DurableObjectStub> {
 let placement = placements.get(db);
 if (placement === undefined) {
  // Keep the resolved value only. A pending D1 request belongs to its own Worker invocation.
  const region = await discover();
  placement = { region, options: isLocation(region) ? { locationHint: region } : undefined };
  placements.set(db, placement);
 }
 return ns.getByName(consoleInstance(role, placement.region), placement.options);
}
