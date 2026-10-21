import type { Context } from 'hono';
import { auditCommit } from '../audit/context';
import { deployBatch } from '../sentry/deploy';
import type { CliAuthority } from './auth';
import { cliError } from './errors';
import { chunkSize, chunksPerRequest, maxRequestSize, stagedLifetime, stagedLimit } from './limits';
import { fromBase64, sha1Hex, toBase64 } from './base64';

const s = (db: D1Database, sql: string, ...args: unknown[]) => db.prepare(sql).bind(...args);

async function gunzip(data: Uint8Array): Promise<Uint8Array | null> {
 const reader = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
 const parts: Uint8Array[] = []; let size = 0;
 try {
  for (;;) {
   const { done, value } = await reader.read(); if (done) break;
   size += value.byteLength;
   if (size > chunkSize) { await reader.cancel(); return null; }
   parts.push(value);
  }
 } catch { return null; }
 const out = new Uint8Array(size); let offset = 0;
 for (const part of parts) { out.set(part, offset); offset += part.byteLength; }
 return out;
}

/** POST /chunk-upload/: each `file_gzip` part is one gzip-compressed chunk named by the SHA-1 of its bytes.
 * A chunk whose bytes do not hash to its name, or inflate past the advertised chunk size, stores nothing. */
export async function receiveChunks(c: Context, who: CliAuthority): Promise<Response> {
 const length = Number(c.req.header('content-length') ?? NaN);
 if (!Number.isFinite(length) || length > maxRequestSize) return cliError(c, 413, `A chunk request is at most ${maxRequestSize} bytes; send at most the chunks per request the options endpoint advertises.`);
 if (!/^multipart\/form-data/i.test(c.req.header('content-type') ?? '')) return cliError(c, 400, 'Chunks are uploaded as multipart/form-data.');
 let form: FormData;
 try { form = await c.req.formData(); } catch { return cliError(c, 400, 'The chunk upload body could not be read.'); }
 const db = c.env.DB as D1Database, rows: { sha1: string; data: string; size: number }[] = [];
 for (const [name, value] of form.entries()) {
  if (rows.length >= chunksPerRequest) return cliError(c, 400, `At most ${chunksPerRequest} chunks are accepted per request, as the options endpoint advertises.`);
  if (name !== 'file_gzip' || typeof value === 'string') return cliError(c, 400, 'Only gzip-compressed file_gzip chunks are accepted.');
  const sha1 = value.name;
  if (!/^[0-9a-f]{40}$/.test(sha1)) return cliError(c, 400, 'A chunk is named by the SHA-1 of its bytes.');
  const bytes = await gunzip(new Uint8Array(await value.arrayBuffer()));
  if (!bytes) return cliError(c, 400, `Chunk ${sha1} is not gzip data or is larger than the advertised ${chunkSize}-byte chunk size.`);
  if (await sha1Hex(bytes) !== sha1) return cliError(c, 400, `Chunk ${sha1} does not match its checksum.`);
  rows.push({ sha1, data: toBase64(bytes), size: bytes.byteLength });
 }
 if (!rows.length) return cliError(c, 400, 'No chunks were sent.');
 const time = Date.now();
 const staged = await s(db, 'SELECT COALESCE(SUM(size),0) bytes FROM sentry_upload_chunks WHERE project=? AND created>=?', who.project, time - stagedLifetime).first<{ bytes: number }>();
 if ((staged?.bytes ?? 0) + rows.reduce((sum, row) => sum + row.size, 0) > stagedLimit) return cliError(c, 429, `At most ${stagedLimit} bytes of unassembled chunks are held per project; finish or retry the current upload.`);
 await deployBatch(c, who.auth, [
  s(db, 'DELETE FROM sentry_upload_chunks WHERE created<?', time - stagedLifetime),
  ...rows.map(row => s(db, 'INSERT INTO sentry_upload_chunks(project,sha1,size,data,created) VALUES(?,?,?,?,?) ON CONFLICT(project,sha1) DO NOTHING', who.project, row.sha1, row.size, row.data, time)),
  auditCommit(db),
 ]);
 return c.json({});
}

export async function missingChunks(db: D1Database, project: string, wanted: string[]): Promise<string[]> {
 const present = new Set((await s(db, 'SELECT sha1 FROM sentry_upload_chunks WHERE project=? AND created>=? AND sha1 IN (SELECT value FROM json_each(?))', project, Date.now() - stagedLifetime, JSON.stringify(wanted)).all<{ sha1: string }>()).results.map(row => row.sha1));
 return wanted.filter(sha1 => !present.has(sha1));
}

/** The staged chunks in order, read one at a time so no query returns the whole file. */
export async function joinChunks(db: D1Database, project: string, wanted: string[], limit: number): Promise<Uint8Array | null> {
 const parts: Uint8Array[] = []; let size = 0;
 for (const sha1 of wanted) {
  const row = await s(db, 'SELECT data FROM sentry_upload_chunks WHERE project=? AND sha1=?', project, sha1).first<{ data: string }>();
  if (!row) return null;
  const bytes = fromBase64(row.data); size += bytes.byteLength;
  if (size > limit) return null;
  parts.push(bytes);
 }
 const out = new Uint8Array(size); let offset = 0;
 for (const part of parts) { out.set(part, offset); offset += part.byteLength; }
 return out;
}
