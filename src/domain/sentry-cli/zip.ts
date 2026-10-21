/** A bounded reader for the stored or deflated ZIP archives sentry-cli builds for artifact bundles.
 * Encrypted, multi-disk and ZIP64 archives are refused; every entry's inflated size is checked against its
 * declared size and the caller's limit while it is read, never trusted from the header. */
export class ZipError extends Error {}
const u16 = (view: DataView, at: number) => view.getUint16(at, true);
const u32 = (view: DataView, at: number) => view.getUint32(at, true);
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
 for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
 return value >>> 0;
});
function crc32(bytes: Uint8Array): number {
 let crc = 0xffffffff;
 for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255]!;
 return (crc ^ 0xffffffff) >>> 0;
}

async function inflate(data: Uint8Array, expected: number, limit: number): Promise<Uint8Array> {
 const reader = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
 const out = new Uint8Array(expected); let size = 0;
 for (;;) {
  const { done, value } = await reader.read(); if (done) break;
  size += value.byteLength;
  if (size > expected || size > limit) { await reader.cancel(); throw new ZipError('entry inflates past its declared size'); }
  out.set(value, size - value.byteLength);
 }
 if (size !== expected) throw new ZipError('entry size does not match its header');
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
 if (directory + directorySize !== end || end + 22 + u16(view, end + 20) !== bytes.byteLength || u16(view, end + 8) !== count) throw new ZipError('central directory is outside the archive');
 const entries: ZipEntry[] = [], names = new Set<string>(); let at = directory, inflated = 0;
 for (let index = 0; index < count; index++) {
  if (at + 46 > bytes.byteLength || u32(view, at) !== 0x02014b50) throw new ZipError('central directory is damaged');
  const flags = u16(view, at + 8), method = u16(view, at + 10), crc = u32(view, at + 16), compressed = u32(view, at + 20), size = u32(view, at + 24);
  const nameLength = u16(view, at + 28), extraLength = u16(view, at + 30), commentLength = u16(view, at + 32), local = u32(view, at + 42);
  const type = (u32(view, at + 38) >>> 16) & 0xf000;
  const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(at + 46, at + 46 + nameLength));
  at += 46 + nameLength + extraLength + commentLength;
  if (at > end) throw new ZipError('central directory is damaged');
  // Validate every central-directory entry, including directories that are not returned to the caller.
  // Missing Unix type bits are common in ZIPs; an explicit type may only be a regular file or directory.
  if (type !== 0 && type !== 0x8000 && type !== 0x4000) throw new ZipError('unsupported entry type');
  const path = name.replaceAll('\\', '/');
  if (!path || path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.split('/').some(part => part === '..') || /[\u0000-\u001f\\]/.test(name)) throw new ZipError('unsafe entry name');
  if (flags & 1) throw new ZipError('encrypted entries are not supported');
  if (compressed === 0xffffffff || size === 0xffffffff) throw new ZipError('ZIP64 entries are not supported');
  if (names.has(name)) throw new ZipError('duplicate entry name');
  names.add(name);
  if (method !== 0 && method !== 8) throw new ZipError(`entry compression method ${method} is not supported`);
  inflated += size;
  if (inflated > limits.entryBytes) throw new ZipError(`archive expands beyond ${limits.entryBytes} bytes`);
  let cached: Promise<Uint8Array> | undefined;
  const read = async () => {
   if (local + 30 > bytes.byteLength || u32(view, local) !== 0x04034b50) throw new ZipError('local header is damaged');
   const start = local + 30 + u16(view, local + 26) + u16(view, local + 28);
   if (start + compressed > directory) throw new ZipError('entry data is outside the archive');
   if (u16(view, local + 6) !== flags || u16(view, local + 8) !== method) throw new ZipError('local header does not match its directory');
   const localName = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(local + 30, local + 30 + u16(view, local + 26)));
   if (localName !== name) throw new ZipError('local entry name does not match its directory');
   if (!(flags & 8) && (u32(view, local + 14) !== crc || u32(view, local + 18) !== compressed || u32(view, local + 22) !== size)) throw new ZipError('local entry size or checksum does not match its directory');
   const data = bytes.subarray(start, start + compressed);
   if (method === 0 && compressed !== size) throw new ZipError('entry size does not match its header');
   const result = method === 0 ? data : await inflate(data, size, limits.entryBytes);
   if (crc32(result) !== crc) throw new ZipError('entry checksum does not match its header');
   return result;
  };
  // Directories are also data-bearing ZIP entries and must pass validation. Retain them
  // here even though ordinary manifests only refer to files.
  entries.push({ name, size, read: () => cached ??= read() });
 }
 if (at !== end) throw new ZipError('central directory entry count does not match');
 return entries;
}
