import type { Context } from 'hono';
import { canonical, hash } from '../privacy';
import { validateMap } from '../artifacts';
import { sourceMapMetadata } from '../sentry/map-metadata';
import { deployBatch } from '../sentry/deploy';
import type { CliAuthority } from './auth';
import { mapByteLimit } from './limits';

export type FileResult = { file: string; status: 'stored' | 'unchanged' | 'refused'; code?: string; reason?: string };
const s = (db: D1Database, sql: string, ...args: unknown[]) => db.prepare(sql).bind(...args);
const refused = (file: string, code: string, reason: string): FileResult => ({ file, status: 'refused', code, reason });

/** The existing flat-map validator and its limits decide what is stored; this names why a map was not. */
function describe(message: string): { code: string; reason: string } {
 if (/Unsupported map/.test(message)) return { code: 'unsupported_map', reason: 'not a flat Source Map V3 within 100 sources and 10,000 names (indexed maps and larger maps await SRC-004 capacity)' };
 if (/exceeds 256 KiB/.test(message)) return { code: 'too_large', reason: 'larger than the 256 KiB a stored map may be today (SRC-004 capacity is not implemented yet)' };
 if (/parser budget/.test(message)) return { code: 'too_large', reason: 'beyond the stored-map parser budget (SRC-004 capacity is not implemented yet)' };
 if (/identity mismatch|debug metadata|debug ID|debugId/.test(message)) return { code: 'identity_mismatch', reason: 'its embedded debug ID does not match the debug ID the bundle names' };
 return { code: 'malformed_map', reason: message.replace(/\s+/g, ' ').slice(0, 160) };
}

/** Stores one source map under its release, dist and debug ID. A repeat of the same bytes changes nothing;
 * different bytes for the same identity are refused, never overwritten. */
export async function storeMap(c: Context, who: CliAuthority, input: { file: string; bytes: Uint8Array; debugId: string; release: string; build: string }): Promise<FileResult> {
 const { file } = input, db = c.env.DB as D1Database;
 if (input.bytes.byteLength > mapByteLimit) return refused(file, 'too_large', `${input.bytes.byteLength} bytes; at most 256 KiB of map are stored today (SRC-004 capacity is not implemented yet)`);
 let payload: string;
 try {
  const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(input.bytes));
  const metadata = sourceMapMetadata(parsed, input.debugId);
  if (Object.hasOwn(parsed, 'sections')) return refused(file, 'unsupported_map', 'an indexed (sections) map; indexed maps await SRC-004 capacity');
  payload = validateMap(JSON.parse(canonical(metadata.map)));
 } catch (error) {
  if (error instanceof SyntaxError || error instanceof TypeError) return refused(file, 'malformed_map', 'not valid UTF-8 JSON');
  const { code, reason } = describe(String((error as Error).message));
  return refused(file, code, reason);
 }
 const digest = await hash(payload), { project, auth } = who, debug = input.debugId;
 const existing = await s(db, 'SELECT digest FROM artifacts WHERE project=? AND release=? AND build=? AND debug=?', project, input.release, input.build, debug).first<{ digest: string }>();
 if (existing) {
  await deployBatch(c, auth, []);
  return existing.digest === digest ? { file, status: 'unchanged' } : refused(file, 'identity_conflict', 'a different map is already stored for this release, dist and debug ID');
 }
 const time = Date.now();
 try {
  await deployBatch(c, auth, [
   s(db, 'INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM releases WHERE project=? AND name=?) AND EXISTS(SELECT 1 FROM release_builds WHERE project=? AND release=? AND build=? AND registered=1) THEN 1 ELSE 0 END', project, input.release, project, input.release, input.build),
   s(db, 'INSERT INTO artifacts(project,release,build,debug,payload,digest,created,occurrence) VALUES(?,?,?,?,?,?,?,?)', project, input.release, input.build, debug, payload, digest, time, crypto.randomUUID()),
   s(db, 'INSERT INTO audit VALUES(?,?,?,?,?)', crypto.randomUUID(), project, 'artifact_uploaded', JSON.stringify({ release: input.release, build: input.build, debug, digest }), time),
   s(db, 'UPDATE release_metadata SET auto_created=0 WHERE project=? AND release=?', project, input.release),
  ]);
  return { file, status: 'stored' };
 } catch (error) {
  const message = String((error as Error).message);
  if (message.includes('artifact_budget')) return refused(file, 'storage_cap', 'this project already stores the 20 maps Spool keeps today (SRC-004 capacity is not implemented yet)');
  const retry = await s(db, 'SELECT digest FROM artifacts WHERE project=? AND release=? AND build=? AND debug=?', project, input.release, input.build, debug).first<{ digest: string }>();
  if (retry) return retry.digest === digest ? { file, status: 'unchanged' } : refused(file, 'identity_conflict', 'a different map is already stored for this release, dist and debug ID');
  throw error;
 }
}
