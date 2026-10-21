/** A bounded reader for the stored or deflated ZIP archives sentry-cli builds for artifact bundles.
 * Encrypted, multi-disk and ZIP64 archives are refused; every entry's inflated size is checked against its
 * declared size and the caller's limit while it is read, never trusted from the header. */
export class ZipError extends Error {}
const u16 = (view: DataView, at: number) => view.getUint16(at, true);
const u32 = (view: DataView, at: number) => view.getUint32(at, true);

async function inflate(data: Uint8Array, expected: number, limit: number): Promise<Uint8Array> {
 const reader = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
 const parts: Uint8Array[] = []; let size = 0;
 for (;;) {
  const { done, value } = await reader.read(); if (done) break;
  size += value.byteLength;
  if (size > expected || size > limit) { await reader.cancel(); throw new ZipError('entry inflates past its declared size'); }
  parts.push(value);
 }
 if (size !== expected) throw new ZipError('entry size does not match its header');
 const out = new Uint8Array(size); let offset = 0;
 for (const part of parts) { out.set(part, offset); offset += part.byteLength; }
 return out;
}

export type ZipEntry = { name: string; size: number; read: () => Promise<Uint8Array> };
export function listZip(bytes: Uint8Array, limits: { entries: number; entryBytes: number }): ZipEntry[] {
 const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
 let end = -1;
 for (let at = bytes.byteLength - 22; at >= Math.max(0, bytes.byteLength - 22 - 65535); at--) if (u32(view, at) === 0x06054b50) { end = at; break; }
 if (end < 0) throw new ZipError('not a ZIP archive');
 const count = u16(view, end + 10), directorySize = u32(view, end + 12), directory = u32(view, end + 16);
 if (u16(view, end + 4) !== 0 || u16(view, end + 6) !== 0 || count === 0xffff || directory === 0xffffffff) throw new ZipError('multi-disk and ZIP64 archives are not supported');
 if (count > limits.entries) throw new ZipError(`archive holds ${count} entries; at most ${limits.entries} are accepted`);
 if (directory + directorySize > bytes.byteLength) throw new ZipError('central directory is outside the archive');
 const entries: ZipEntry[] = [], names = new Set<string>(); let at = directory;
 for (let index = 0; index < count; index++) {
  if (at + 46 > bytes.byteLength || u32(view, at) !== 0x02014b50) throw new ZipError('central directory is damaged');
  const flags = u16(view, at + 8), method = u16(view, at + 10), compressed = u32(view, at + 20), size = u32(view, at + 24);
  const nameLength = u16(view, at + 28), extraLength = u16(view, at + 30), commentLength = u16(view, at + 32), local = u32(view, at + 42);
  const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(at + 46, at + 46 + nameLength));
  at += 46 + nameLength + extraLength + commentLength;
  if (name.endsWith('/')) continue;
  if (flags & 1) throw new ZipError('encrypted entries are not supported');
  if (compressed === 0xffffffff || size === 0xffffffff) throw new ZipError('ZIP64 entries are not supported');
  if (!name || name.startsWith('/') || name.split('/').some(part => part === '..') || /[\u0000-\u001f\\]/.test(name)) throw new ZipError('unsafe entry name');
  if (names.has(name)) throw new ZipError('duplicate entry name');
  names.add(name);
  if (method !== 0 && method !== 8) throw new ZipError(`entry compression method ${method} is not supported`);
  if (size > limits.entryBytes) { entries.push({ name, size, read: async () => { throw new ZipError(`entry is ${size} bytes; at most ${limits.entryBytes} are read`); } }); continue; }
  entries.push({ name, size, read: async () => {
   if (local + 30 > bytes.byteLength || u32(view, local) !== 0x04034b50) throw new ZipError('local header is damaged');
   const start = local + 30 + u16(view, local + 26) + u16(view, local + 28);
   if (start + compressed > bytes.byteLength) throw new ZipError('entry data is outside the archive');
   const data = bytes.subarray(start, start + compressed);
   if (method === 0) { if (compressed !== size) throw new ZipError('entry size does not match its header'); return data; }
   return inflate(data, size, limits.entryBytes);
  } });
 }
 return entries;
}
