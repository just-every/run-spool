import type { Json } from '../modules/import-kit/src/types';
import { sentryTargets } from '../domain/sentry-import/targets';
import { diagnose } from '../domain/artifacts';
import type { Envelope } from '../domain/privacy';

/** One seed run, with bounded native import batches and fixed source maps. */
export async function historySeed(db: D1Database, project: string) {
 const existing = await db.prepare('SELECT id FROM events WHERE project=?').bind(project).all<{ id: string }>();
 const ids = new Set(existing.results.map(row => row.id));
 const diagnostics = new Map<string, Promise<any[]>>();
 let pending: D1PreparedStatement[] = [];
 const flush = async () => {
  if (!pending.length) return;
  await db.batch(pending);
  pending = [];
 };
 return {
  contains: (id: string) => ids.has(id),
  diagnose(event: Envelope) {
   const key = JSON.stringify([event.release, event.build, event.environment, event.language, event.frames]);
   if (!diagnostics.has(key)) diagnostics.set(key, diagnose(db, project, event));
   return diagnostics.get(key)!;
  },
  async add(native: Record<string, Json>) {
   const id = String(native.id);
   if (ids.has(id)) return;
   const statements = sentryTargets.write({ destination: 'spool-owner', targetKind: 'event',
    targetId: JSON.stringify([project, id]), revision: 'demo-v1', value: { native, source: null } });
   pending.push(...statements.map(({ sql, params }) => db.prepare(sql).bind(...params ?? [])));
   ids.add(id);
   if (pending.length >= 80) await flush();
  },
  flush,
 };
}
