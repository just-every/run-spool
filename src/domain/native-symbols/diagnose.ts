import type { Envelope, Frame } from '../privacy';
import { parseProguard, retrace } from './proguard';

export const isJava = (event: { sentry?: { platform?: string } }) => ['java', 'android'].includes(event.sentry?.platform ?? '');
export function createNativeDiagnoser(db: D1Database, project: string) {
 const lookups = new Map<string, Promise<any>>();
 return async (event: Envelope, frames: Frame[]) => {
  const key = JSON.stringify([event.release, event.build]);
  if (!lookups.has(key)) lookups.set(key, db.prepare('SELECT payload,digest FROM native_symbols WHERE project=? AND release=? AND build=? AND format=?').bind(project, event.release, event.build, 'proguard').first<any>().then(row => {
   if (!row) return null;
   try { return { digest: row.digest, mapping: parseProguard(row.payload) }; } catch { return { digest: row.digest, mapping: null }; }
  }));
  const row = await lookups.get(key);
  if (!row) {
   const elsewhere = await db.prepare('SELECT 1 FROM native_symbols WHERE project=? AND release=? LIMIT 1').bind(project, event.release).first();
   return frames.map(generated => ({ generated, status: elsewhere ? 'native_symbol_identity_mismatch' : 'missing_native_symbols' }));
  }
  return frames.map(generated => ({ generated, ...row.mapping ? retrace(row.mapping, generated.function, generated.line) : { status: 'invalid_native_symbols' }, artifactDigest: row.digest }));
 };
}
