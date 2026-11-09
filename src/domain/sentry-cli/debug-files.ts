import type { Context } from 'hono';
import { auditCommit } from '../audit/context';
import { deployBatch } from '../sentry/deploy';
import type { CliAuthority } from './auth';
import { cliError } from './errors';
import { joinChunks, missingChunks } from './chunks';
import { sha1Hex } from './base64';
import { chunkSize, debugFileProjectLimit, maxFileSize } from './limits';

const s = (db: D1Database, sql: string, ...args: unknown[]) => db.prepare(sql).bind(...args);
const hex40 = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
type Kind = 'macho' | 'elf' | 'breakpad' | 'proguard';

/** What the bytes are, from the file itself: Mach-O (thin or universal; a dSYM's DWARF file), ELF (native debug
 * symbols and Flutter split-debug symbols), a Breakpad `MODULE` symbol file, or a ProGuard/R8 mapping. */
export function debugFileKind(bytes: Uint8Array): Kind | null {
 const word = bytes.length >= 4 ? ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0 : 0;
 if ([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca].includes(word)) return 'macho';
 if (word === 0x7f454c46) return 'elf';
 const head = new TextDecoder().decode(bytes.subarray(0, 8192));
 if (head.startsWith('MODULE ')) return 'breakpad';
 if (/^[\w.$<>/-]+ -> [\w.$<>/-]+:\s*$/m.test(head)) return 'proguard';
 return null;
}

const entry = (state: string, extra: Record<string, unknown> = {}) => ({ state, missingChunks: [], ...extra });

/** POST /projects/:org/:project/files/difs/assemble/. sentry-cli keys each debug file by the SHA-1 of its bytes and names
 * its debug ID and chunks; chunks arrive through /chunk-upload/. Once every chunk is staged the file is joined, checked
 * against its checksum and kept under the project and debug ID. The same bytes answer ok without another upload. */
export async function assembleDebugFiles(c: Context, who: CliAuthority, body: any): Promise<Response> {
 if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).length > 1000) return cliError(c, 400, 'Expected one entry per debug file, keyed by SHA-1 checksum.');
 const db = c.env.DB as D1Database, { project } = who, out: Record<string, unknown> = {};
 for (const [checksum, info] of Object.entries<any>(body)) {
  if (!hex40(checksum) || !info || typeof info !== 'object') return cliError(c, 400, 'Each debug file is keyed by its SHA-1 checksum.');
  const name = typeof info.name === 'string' ? info.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200) : checksum;
  const debugId = typeof info.debug_id === 'string' && /^[0-9A-Za-z-]{8,64}$/.test(info.debug_id) ? info.debug_id.toLowerCase() : null;
  const chunks: unknown = info.chunks;
  if (!debugId) { out[checksum] = entry('error', { detail: `${name}: the upload names no debug ID, so Spool cannot say which build the file belongs to.` }); continue; }
  const held = await s(db, 'SELECT kind,debug_id debugId,name,size,created FROM sentry_debug_files WHERE project=? AND sha1=?', project, checksum).first<{ kind: Kind; debugId: string; name: string; size: number; created: number }>();
  // `data.type` is Sentry's object class (exe, lib, dbg, rel, dump); the CLI refuses a reply naming any other word, and Spool reads no features yet (SDK-002).
  const view = (row: { kind: Kind; debugId: string; name: string; size: number; created: number }) => ({ id: checksum, uuid: row.debugId, debugId: row.debugId, objectName: row.name, cpuName: 'any', sha1: checksum, size: row.size, dateCreated: new Date(row.created).toISOString(), headers: {}, data: { type: 'dbg', features: [] } });
  if (held) { await deployBatch(c, who.auth, []); out[checksum] = entry('ok', { dif: view(held) }); continue; }
  if (!Array.isArray(chunks) || !chunks.length || chunks.length > Math.ceil(maxFileSize / chunkSize) + 1 || !chunks.every(hex40)) { out[checksum] = entry('error', { detail: `${name}: expected the SHA-1 chunk list of a file of at most ${maxFileSize} bytes.` }); continue; }
  const missing = await missingChunks(db, project, chunks);
  if (missing.length) { out[checksum] = { state: 'not_found', missingChunks: missing }; continue; }
  const bytes = await joinChunks(db, project, chunks, maxFileSize);
  const refuse = (detail: string) => deployBatch(c, who.auth, [s(db, 'DELETE FROM sentry_upload_chunks WHERE project=? AND sha1 IN (SELECT value FROM json_each(?))', project, JSON.stringify(chunks)), auditCommit(db)]).then(() => { out[checksum] = entry('error', { detail: `${name}: ${detail}` }); });
  if (!bytes) { await refuse(`the chunks join to more than the ${maxFileSize}-byte file this server accepts.`); continue; }
  if (await sha1Hex(bytes) !== checksum) { await refuse('the assembled file does not match its checksum; upload it again.'); continue; }
  const kind = debugFileKind(bytes);
  if (!kind) { await refuse('not a debug file Spool recognizes (a Mach-O dSYM, ELF/DWARF or Dart symbol file, Breakpad symbols or a ProGuard/R8 mapping).'); continue; }
  const stored = await s(db, 'SELECT COALESCE(SUM(size),0) bytes FROM sentry_debug_files WHERE project=?', project).first<{ bytes: number }>();
  if ((stored?.bytes ?? 0) + bytes.byteLength > debugFileProjectLimit) { await refuse(`this project keeps at most ${debugFileProjectLimit} bytes of native debug files; ${stored?.bytes ?? 0} are stored.`); continue; }
  const time = Date.now();
  await deployBatch(c, who.auth, [
   s(db, 'INSERT INTO sentry_debug_files(project,debug_id,kind,sha1,name,size,created) VALUES(?,?,?,?,?,?,?) ON CONFLICT(project,sha1) DO NOTHING', project, debugId, kind, checksum, name, bytes.byteLength, time),
   ...chunks.map((sha1, seq) => s(db, 'INSERT INTO sentry_debug_file_parts(project,sha1,seq,data) SELECT ?,?,?,data FROM sentry_upload_chunks WHERE project=? AND sha1=? ON CONFLICT(project,sha1,seq) DO NOTHING', project, checksum, seq, project, sha1)),
   s(db, 'DELETE FROM sentry_upload_chunks WHERE project=? AND sha1 IN (SELECT value FROM json_each(?))', project, JSON.stringify(chunks)),
   auditCommit(db),
  ]);
  out[checksum] = entry('ok', { dif: view({ kind, debugId, name, size: bytes.byteLength, created: time }) });
 }
 return c.json(out);
}
