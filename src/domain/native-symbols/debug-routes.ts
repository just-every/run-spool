import type { Context } from 'hono';
import { authorizeDeploy, deployBatch } from '../sentry/deploy';
import { ownerProjectRouter } from '../owner-router';
import { hash } from '../privacy';
import { toBase64 } from '../sentry-cli/base64';
import { DebugFileError } from './debug-formats';
import { readDebugUpload, type Upload } from './debug-upload';

export const nativeSymbolicationStatus = {
 status: 'unsupported',
 reason: 'Spool stores this file by its Mach-O UUID or ELF build id, but does not yet read Mach-O/DWARF or ELF symbols, so it resolves no native frame. No original frame is claimed from it.',
};
type Auth = Extract<Awaited<ReturnType<typeof authorizeDeploy>>, { actor: string }>;
const summary = (rows: { debugId: string; arch: string; name: string; digest: string; bytes: number }[]) => rows.map(({ debugId, arch, name, digest, bytes }) => ({ debugId, arch, name, digest, bytes }));

/** Bugsnag dSYM and NDK uploads: one immutable row per Mach-O UUID or ELF build id, idempotent on identical bytes. */
export async function uploadDebugFiles(c: Context, project: string, auth: Auth): Promise<Response> {
 let upload: Upload;
 try { upload = await readDebugUpload(c.req.raw); }
 catch (error) { if (error instanceof DebugFileError) return c.json({ error: error.message }, error.status); throw error; }
 const db = c.env.DB as D1Database, seen = new Map<string, string>();
 const rows = await Promise.all(upload.files.map(async file => { const payload = toBase64(file.bytes); return { ...file, payload, digest: await hash(payload) }; }));
 for (const row of rows) {
  if (seen.has(row.debugId) && seen.get(row.debugId) !== row.digest) return c.json({ error: `Native debug file identity conflicts: ${row.debugId}` }, 409);
  seen.set(row.debugId, row.digest);
 }
 const unique = [...new Map(rows.map(row => [row.debugId, row])).values()];
 const body = (status: number) => c.json({ format: upload.format, files: summary(unique.map(row => ({ ...row, bytes: row.bytes.length }))), symbolication: nativeSymbolicationStatus }, status as 200);
 const read = async () => (await db.prepare('SELECT debug_id,digest FROM native_debug_files WHERE project=? AND format=? AND debug_id IN (SELECT value FROM json_each(?))').bind(project, upload.format, JSON.stringify(unique.map(row => row.debugId))).all<{ debug_id: string; digest: string }>()).results;
 const settle = async (current: Auth) => {
  const stored = new Map((await read()).map(row => [row.debug_id, row.digest]));
  const conflict = unique.find(row => stored.has(row.debugId) && stored.get(row.debugId) !== row.digest);
  if (conflict) { await deployBatch(c, current, []); return c.json({ error: `Native debug file identity conflicts: ${conflict.debugId}` }, 409); }
  return { fresh: unique.filter(row => !stored.has(row.debugId)) };
 };
 const first = await settle(auth);
 if (first instanceof Response) return first;
 if (!first.fresh.length) { await deployBatch(c, auth, []); return body(200); }
 try {
  await deployBatch(c, auth, [
   db.prepare('INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM projects WHERE id=?) AND NOT EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase<>?) THEN 1 ELSE 0 END').bind(project, 'complete'),
   ...first.fresh.flatMap(row => [
    db.prepare('INSERT INTO native_debug_files(project,format,debug_id,arch,name,payload,digest,created) VALUES(?,?,?,?,?,?,?,?)').bind(project, upload.format, row.debugId, row.arch, row.name, row.payload, row.digest, Date.now()),
    db.prepare('INSERT INTO audit VALUES(?,?,?,?,?)').bind(crypto.randomUUID(), project, 'native_debug_files_uploaded', JSON.stringify({ format: upload.format, debugId: row.debugId, digest: row.digest }), Date.now()),
   ]),
  ]);
  return body(201);
 } catch (error) {
  const current = await authorizeDeploy(c, project);
  if ('response' in current) return current.response;
  const retry = await settle(current);
  if (retry instanceof Response) return retry;
  if (!retry.fresh.length) { await deployBatch(c, current, []); return body(200); }
  if (String(error).includes('artifact_storage_cap')) return c.json({ error: 'Native debug files exceed the project artifact storage cap' }, 429);
  throw error;
 }
}

export const nativeDebugFileRoutes = ownerProjectRouter();
nativeDebugFileRoutes.get('/', async c => {
 const rows = await c.env.DB.prepare('SELECT format,debug_id,arch,name,digest,length(payload) stored,substr(payload,-2) tail,created FROM native_debug_files WHERE project=? ORDER BY format,debug_id').bind(c.req.param('project')!).all<any>();
 return c.json(rows.results.map(row => ({ format: row.format, debugId: row.debug_id, arch: row.arch, name: row.name, digest: row.digest, bytes: row.stored * 3 / 4 - (row.tail.endsWith('==') ? 2 : row.tail.endsWith('=') ? 1 : 0), created: row.created })));
});
