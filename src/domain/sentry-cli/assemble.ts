import type { Context } from 'hono';
import { storedBuild, absentDist } from '../releases/build';
import { deployBatch } from '../sentry/deploy';
import { auditCommit } from '../audit/context';
import type { CliAuthority } from './auth';
import { cliError } from './errors';
import { readBundle, type Bundle } from './bundle';
import { joinChunks, missingChunks } from './chunks';
import { chunkSize, maxFileSize } from './limits';
import { sha1Hex } from './base64';
import { storeMap, type FileResult } from './maps';
import { registerBuildStatement, registrationStatements, releaseName } from './release';
import { ZipError } from './zip';
import { artifactNameKey, normalizeArtifactName, siblingName } from './names';
import { CliRefusal } from './errors';

const s = (db: D1Database, sql: string, ...args: unknown[]) => db.prepare(sql).bind(...args);
const hex40 = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
const reply = (c: Context, state: string, extra: Record<string, unknown> = {}) => c.json({ state, missingChunks: [], ...extra });

/** A bundle-level failure reads back to the client exactly as per-file ones do: `error` with one line per cause. */
function failure(results: FileResult[]): string {
 const bad = results.filter(result => result.status === 'refused');
 return `${bad.length} of ${results.length} source maps were not stored:\n${bad.map(result => `  ${result.file}: ${result.reason} [${result.code}]`).join('\n')}`;
}

async function storeBundle(c: Context, who: CliAuthority, bundle: Bundle, release: string | null, dist: string | null): Promise<{ results: FileResult[]; release: string | null }> {
 const maps = bundle.files.filter(file => file.type === 'source_map');
 const results: FileResult[] = [];
 if (!release) return { release, results: maps.map(file => ({ file: file.url, status: 'refused', code: 'release_required', reason: 'Spool keeps source maps under a release; pass --release (or set SENTRY_RELEASE) so the upload names one' })) };
 const db = c.env.DB as D1Database, { project, auth } = who, time = Date.now();
 const build = dist === null ? absentDist : dist;
 await deployBatch(c, auth, [...registrationStatements(db, project, release, build, time), registerBuildStatement(db, project, release, build), auditCommit(db)]);
 let inflated = 0;
 const byMap = new Map<string, string>();
 for (const file of bundle.files) {
  const reference = file.type === 'minified_source' ? file.headers['sourcemap'] : undefined, minified = normalizeArtifactName(file.url);
  const target = reference && minified ? siblingName(file.url, reference) : null;
  if (target && minified) byMap.set(target, minified);
 }
 for (const file of maps) {
  // A debug ID names the map; without one, the minified file that points at it names it by URL (release/dist mode).
  let debugId = file.headers['debug-id'];
  if (!debugId) {
   const minified = byMap.get(normalizeArtifactName(file.url) ?? '');
   if (!minified) { results.push({ file: file.url, status: 'refused', code: 'unmatched_map', reason: 'the map has no debug ID and no uploaded script names it in its sourcemap header, so Spool cannot say which file it maps' }); continue; }
   debugId = await artifactNameKey(minified);
  }
  if (inflated + file.entry.size > 64 * 1024 * 1024) { results.push({ file: file.url, status: 'refused', code: 'bundle_budget', reason: 'the bundle holds more than 64 MiB of maps; upload it in smaller bundles' }); continue; }
  let bytes: Uint8Array;
  try { bytes = await file.entry.read(); } catch (error) {
   results.push({ file: file.url, status: 'refused', code: file.entry.size > 4 * 1024 * 1024 ? 'too_large' : 'malformed_bundle', reason: error instanceof ZipError ? error.message : 'unreadable' });
   continue;
  }
  inflated += bytes.byteLength;
  results.push(await storeMap(c, who, { file: file.url, bytes, debugId, release, build }));
 }
 return { release, results };
}

/** POST /artifactbundle/assemble/. Chunks come first through /chunk-upload/; once every chunk named here is
 * staged, the bundle is joined, its SHA-1 checked against `checksum`, and its source maps stored one by one. */
export async function assembleArtifactBundle(c: Context, who: CliAuthority, body: any): Promise<Response> {
 const db = c.env.DB as D1Database, { project, auth } = who;
 const wanted: unknown = body?.chunks;
 if (!hex40(body?.checksum) || !Array.isArray(wanted) || !wanted.length || wanted.length > Math.ceil(maxFileSize / chunkSize) + 1 || !wanted.every(hex40)) return cliError(c, 400, 'Expected checksum and the SHA-1 chunk list of a bundle of at most ' + maxFileSize + ' bytes.');
 let release: string | null = null, dist: string | null = null;
 try {
  if (body.version !== undefined && body.version !== null && body.version !== '') release = releaseName(body.version);
  if (body.dist !== undefined && body.dist !== null && body.dist !== '') dist = storedBuild(body.dist);
 } catch (error) { return cliError(c, 400, error instanceof CliRefusal ? error.detail : 'Invalid dist: use 1 to 100 letters, digits and . _ : -'); }
 const done = await s(db, "SELECT 1 FROM sentry_assemblies WHERE project=? AND kind='artifact_bundle' AND checksum=? AND state='ok'", project, body.checksum).first();
 if (done) { await deployBatch(c, auth, []); return reply(c, 'ok'); }
 const missing = await missingChunks(db, project, wanted);
 if (missing.length) return reply(c, 'not_found', { missingChunks: missing });
 const record = async (state: 'ok' | 'error', detail: string | null) => {
  await deployBatch(c, auth, [
   s(db, 'DELETE FROM sentry_upload_chunks WHERE project=? AND sha1 IN (SELECT value FROM json_each(?))', project, JSON.stringify(wanted)),
   s(db, "INSERT INTO sentry_assemblies(project,kind,checksum,state,detail,created) VALUES(?,'artifact_bundle',?,?,?,?) ON CONFLICT(project,kind,checksum) DO UPDATE SET state=excluded.state,detail=excluded.detail,created=excluded.created", project, body.checksum, state, detail, Date.now()),
   auditCommit(db),
  ]);
  return state === 'ok' ? reply(c, 'ok') : reply(c, 'error', { detail });
 };
 const bytes = await joinChunks(db, project, wanted, maxFileSize);
 if (!bytes) return record('error', `The chunks join to more than the ${maxFileSize}-byte bundle limit this server accepts.`);
 if (await sha1Hex(bytes) !== body.checksum) return record('error', 'The assembled bundle does not match its checksum; upload it again.');
 let bundle: Bundle;
 try { bundle = await readBundle(bytes); } catch (error) { return record('error', error instanceof ZipError ? `The artifact bundle is unreadable: ${error.message}.` : 'The artifact bundle is unreadable.'); }
 if (release && bundle.release && bundle.release !== release || dist !== null && bundle.dist !== null && bundle.dist !== dist) return record('error', 'The bundle manifest names a different release or dist than the request.');
 try {
  const effectiveDist = dist ?? (bundle.dist ? storedBuild(bundle.dist) : null);
  const { results } = await storeBundle(c, who, bundle, release ?? (bundle.release ? releaseName(bundle.release) : null), effectiveDist);
  return results.some(result => result.status === 'refused') ? record('error', failure(results)) : record('ok', null);
 } catch (error) {
  if (error instanceof CliRefusal) return record('error', error.detail);
  throw error;
 }
}
