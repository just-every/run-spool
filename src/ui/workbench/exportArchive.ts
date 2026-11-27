import { makePart, canonicalJson, sha256, type Item, type Manifest, type Part, type Row, type SchemaObject, type Table } from '../../modules/portability/index.mjs';
import { ArchiveVerifier, ContentVerifier } from '../../modules/portability/format.mjs';
import { base64, unbase64 } from '../../modules/portability/hash.mjs';
import { schemaIdentityOf } from '../../modules/portability/schema-identity.mjs';
import { compareReleases } from '../../domain/releases/order';
import { defaultReleasePolicy, validateReleasePolicy } from '../../domain/releases/policy';
import { archiveProgressHeader } from '../../domain/archive-progress';
import { ownerFetch } from './client';

type TableEntry = Table & { ordinal: number };
type SavedRow = { row: Row; rowid?: number };
type Begin = { id: string; manifest: Omit<Manifest, 'tables' | 'schema' | 'schemaObjects' | 'payloads' | 'partCount' | 'journal'>; audit: string };
const encoder = new TextEncoder();
const partBytes = 4 * 1024 * 1024;

async function readPage<T = null>(params: Record<string, string>, signal?: AbortSignal, onProgress?: () => void) {
 const path = '/api/archive?' + new URLSearchParams(params);
 const response = await ownerFetch(path, { signal, headers: { [archiveProgressHeader]: '2' } });
 if (!response.ok) {
  await response.body?.cancel();
  throw new Error('Archive request failed');
 }
 if (response.status === 204) return null as T;
 if (!response.body) throw new Error('Archive response body missing');
 const stream = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
  transform(chunk, writer) {
   if (chunk.some(byte => byte > 0x20)) onProgress?.();
   writer.enqueue(chunk);
  },
 }));
 return new Response(stream).json<T>();
}

async function allPages<T>(id: string, kind: 'schema' | 'rows', key: 'entries' | 'rows', signal: AbortSignal, progress: () => void, extra: Record<string, string> = {}) {
 const results: T[] = [];
 for (let after: number | null = 0; after !== null;) {
  const page: { rows?: T[]; entries?: T[]; next: number | null } =
   await readPage({ archive: kind, id, after: String(after), ...extra }, signal, progress);
  for (const item of page[key]!) results.push(item);
  if (page.next !== null && page.next <= after) throw new Error('Archive cursor did not advance');
  after = page.next;
 }
 return results;
}

function compareBytes(left: Uint8Array, right: Uint8Array) {
 for (let i = 0; i < Math.min(left.length, right.length); i++) if (left[i] !== right[i]) return left[i] - right[i];
 return left.length - right.length;
}
function compareCells(a: Row[string], b: Row[string]) {
 const key = (value: Row[string]) => value === null ? 0 : typeof value === 'number' ? 1 : typeof value === 'string' ? 2 : 3;
 const byType = key(a) - key(b);
 if (byType || a === b) return byType;
 if (typeof a === 'number' && typeof b === 'number') return a - b;
 if (typeof a === 'string' && typeof b === 'string') return compareBytes(encoder.encode(a), encoder.encode(b));
 if (a && b && typeof a === 'object' && typeof b === 'object') return compareBytes(unbase64(a.blob), unbase64(b.blob));
 return 0;
}

function orderRows(tables: Map<string, SavedRow[]>, table: Table) {
 const records = tables.get(table.name) ?? [];
 if (table.name === 'releases') {
  const key = (project: unknown, release: unknown) => JSON.stringify([project, release]);
  const seen = new Map((tables.get('release_metadata') ?? []).map(({ row }) => [key(row.project, row.release), row.first_seen]));
  const policies = new Map((tables.get('release_policies') ?? []).map(({ row }) => [row.project, validateReleasePolicy(JSON.parse(String(row.policy)))]));
  const describe = (row: Row) => ({ name: String(row.name), seq: Number(row.seq), created: Number(row.created), first_seen: seen.get(key(row.project, row.name)) as number | undefined });
  return records.sort(({ row: a }, { row: b }) =>
   compareCells(a.project, b.project) || compareReleases(describe(a), describe(b), (policies.get(a.project) ?? defaultReleasePolicy()).order));
 }
 const keys = table.columns.filter(column => column.pk).sort((a, b) => a.pk - b.pk);
 return records.sort((a, b) => {
  for (const { name } of keys) {
   const order = compareCells(a.row[name], b.row[name]);
   if (order) return order;
  }
  return (a.rowid ?? 0) - (b.rowid ?? 0);
 });
}

async function archiveParts(tables: Table[], contents: Map<string, SavedRow[]>, audit: { name: string; bytes: Uint8Array }, signal: AbortSignal) {
 const parts: Part[] = [];
 let items: Item[] = [], size = 200;
 async function flush() {
  signal.throwIfAborted();
  if (items.length) parts.push(await makePart(parts.length, items));
  items = []; size = 200;
 }
 for (const table of tables) {
  const rows = orderRows(contents, table);
  if (rows.length !== table.count) throw new Error('Incomplete archive table');
  for (const [index, row] of rows.entries()) {
   const item: Item = { kind: 'row', table: table.name, index, ...row };
   const bytes = encoder.encode(canonicalJson(item)).length + 1;
   if (size + bytes > partBytes || items.length >= 1000) await flush();
   items.push(item);
   size += bytes;
  }
 }
 await flush();
 const payloadChunk = 1024 * 1024;
 for (let offset = 0; offset < audit.bytes.length || offset === 0; offset += payloadChunk) {
  items.push({ kind: 'payload', name: audit.name, offset, data: base64(audit.bytes.subarray(offset, offset + payloadChunk)) });
  await flush();
 }
 return parts;
}

export async function exportArchive(signal: AbortSignal, onProgress: () => void) {
 const { id, manifest: header, audit }: Begin = await readPage({ archive: 'start' }, signal, onProgress);
 let finished = false;
 try {
  const { journal } = await readPage<{ journal: string[] }>({ archive: 'capture', id }, signal, onProgress);
  const schema = await allPages<TableEntry | SchemaObject>(id, 'schema', 'entries', signal, onProgress);
  const schemaObjects: SchemaObject[] = [], tables: Table[] = [];
  const contents = new Map<string, SavedRow[]>();
  for (const entry of schema) {
   if (!('ordinal' in entry)) { schemaObjects.push(entry); continue; }
   const { ordinal, ...table } = entry;
   tables.push(table);
   if (table.count) contents.set(table.name, await allPages(id, 'rows', 'rows', signal, onProgress, { table: String(ordinal) }));
  }
  const facts = await allPages(id, 'rows', 'rows', signal, onProgress, { table: String(tables.length) });
  const auditBytes = encoder.encode(facts.map(fact => JSON.stringify(fact) + '\n').join(''));
  const parts = await archiveParts(tables, contents, { name: audit, bytes: auditBytes }, signal);
  const manifest: Manifest = {
   ...header, journal, tables, schemaObjects, schema: await schemaIdentityOf(tables, schemaObjects), partCount: parts.length,
   payloads: [{ name: audit, size: auditBytes.length, sha256: await sha256(auditBytes) }],
  };
  const content = new ContentVerifier(manifest), archive = new ArchiveVerifier(manifest);
  const lines = [canonicalJson(manifest)];
  for (const part of parts) {
   signal.throwIfAborted();
   archive.add(part);
   for (const item of part.items) content.add(item);
   lines.push(canonicalJson(part));
  }
  lines.push(canonicalJson({ kind: 'closing', partCount: parts.length, contentHash: content.digest(), archiveHash: archive.digest() }), '');
  await readPage({ archive: 'finish', id }, signal);
  finished = true;
  return { manifest, text: lines.join('\n') };
 } finally {
  if (!finished) void readPage({ archive: 'cancel', id }).catch(() => {});
 }
}
