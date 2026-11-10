/** Bounded readers for the two native debug-file formats Bugsnag uploads: a Mach-O dSYM DWARF companion and an
 * Android NDK ELF shared object. They read identity only (Mach-O UUID, ELF build id, architecture); Spool does
 * not decode DWARF or symbol tables, so no file here ever yields a symbol or frame. */
export class DebugFileError extends Error { constructor(message: string, readonly status: 400 | 413 = 400) { super(message); } }

export const debugFileByteLimit = 786432; // base64 of this is exactly the 1 MiB stored-payload limit
export type DebugFile = { format: 'dsym' | 'ndk'; debugId: string; arch: string; bytes: Uint8Array };

const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
/** Mach-O UUIDs are lowercase hyphenated; ELF build ids lowercase hex. Event frames may carry either spelling. */
export function machoUuid(value: unknown): string | null {
 const compact = typeof value === 'string' ? value.replaceAll('-', '').toLowerCase() : '';
 return /^[0-9a-f]{32}$/.test(compact) ? `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}` : null;
}
export const buildId = (value: unknown): string | null => typeof value === 'string' && /^(?:[0-9a-f]{2}){8,64}$/.test(value.toLowerCase()) ? value.toLowerCase() : null;

const machoArch = (cpu: number) => ({ 0x0100000c: 'arm64', 0x0200000c: 'arm64_32', 0x01000007: 'x86_64', 7: 'i386', 12: 'arm' } as Record<number, string>)[cpu] ?? `cpu-${cpu.toString(16)}`;
function machoSlice(bytes: Uint8Array): DebugFile {
 if (bytes.length < 32) throw new DebugFileError('DWARF file is not a Mach-O image');
 const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), magic = view.getUint32(0, true);
 if (magic !== 0xfeedfacf && magic !== 0xfeedface) throw new DebugFileError('DWARF file is not a little-endian Mach-O image');
 const wide = magic === 0xfeedfacf, cpu = view.getUint32(4, true), kind = view.getUint32(12, true), count = view.getUint32(16, true), size = view.getUint32(20, true), start = wide ? 32 : 28;
 // MH_DSYM: a stripped executable or library in the archive is not debug info.
 if (kind !== 10) throw new DebugFileError('Mach-O image is not a dSYM debug companion (file type MH_DSYM); upload the .dSYM bundle, not the app binary');
 if (count > 1024 || start + size > bytes.length) throw new DebugFileError('Mach-O load commands are damaged');
 let at = start, uuid: Uint8Array | undefined, dwarf = false;
 for (let index = 0; index < count; index++) {
  if (at + 8 > start + size) throw new DebugFileError('Mach-O load commands are damaged');
  const command = view.getUint32(at, true), length = view.getUint32(at + 4, true);
  if (length < 8 || length % 4 || at + length > start + size) throw new DebugFileError('Mach-O load commands are damaged');
  if (command === 0x1b && length >= 24) uuid = bytes.subarray(at + 8, at + 24);
  if ((command === 0x19 || command === 0x1) && length >= 24 && new TextDecoder().decode(bytes.subarray(at + 8, at + 24)).replace(/\0.*$/s, '') === '__DWARF') dwarf = true;
  at += length;
 }
 if (!uuid) throw new DebugFileError('Mach-O image has no LC_UUID, so no UUID can identify it');
 if (!dwarf) throw new DebugFileError('Mach-O dSYM contains no DWARF segment');
 return { format: 'dsym', debugId: machoUuid(hex(uuid))!, arch: machoArch(cpu), bytes };
}
/** One DebugFile per architecture slice; a universal (fat) file yields one UUID per slice. */
export function parseMachO(bytes: Uint8Array): DebugFile[] {
 if (bytes.length >= 8 && bytes[0] === 0xca && bytes[1] === 0xfe && bytes[2] === 0xba && bytes[3] === 0xbe) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), count = view.getUint32(4, false);
  if (!count || count > 16 || 8 + count * 20 > bytes.length) throw new DebugFileError('Universal Mach-O header is damaged');
  return Array.from({ length: count }, (_, index) => {
   const offset = view.getUint32(16 + index * 20, false), size = view.getUint32(20 + index * 20, false);
   if (offset + size > bytes.length) throw new DebugFileError('Universal Mach-O slice is outside the file');
   return machoSlice(bytes.subarray(offset, offset + size));
  });
 }
 return [machoSlice(bytes)];
}

const elfArch = (machine: number) => ({ 183: 'arm64-v8a', 40: 'armeabi-v7a', 62: 'x86_64', 3: 'x86', 243: 'riscv64' } as Record<number, string>)[machine];
/** An unstripped Android shared object: ET_DYN, GNU build id note, and a symbol table or DWARF to read later. */
export function parseElf(bytes: Uint8Array): DebugFile {
 if (bytes.length < 64 || bytes[0] !== 0x7f || bytes[1] !== 0x45 || bytes[2] !== 0x4c || bytes[3] !== 0x46) throw new DebugFileError('Shared object is not an ELF file');
 if (bytes[5] !== 1 || (bytes[4] !== 1 && bytes[4] !== 2)) throw new DebugFileError('Only little-endian 32-bit and 64-bit ELF shared objects are supported');
 const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), wide = bytes[4] === 2;
 const word = (at: number) => { if (!wide) return view.getUint32(at, true); if (view.getUint32(at + 4, true)) throw new DebugFileError('ELF offsets beyond 4 GiB are not supported'); return view.getUint32(at, true); };
 const type = view.getUint16(16, true), arch = elfArch(view.getUint16(18, true));
 if (type !== 3) throw new DebugFileError('ELF file is not a shared object (ET_DYN)');
 if (!arch) throw new DebugFileError('ELF machine type is not an Android ABI');
 const table = word(wide ? 40 : 32), entry = view.getUint16(wide ? 58 : 46, true), count = view.getUint16(wide ? 60 : 48, true), names = view.getUint16(wide ? 62 : 50, true);
 if (!table || !count || count > 256 || entry < (wide ? 64 : 40) || table + count * entry > bytes.length || names >= count) throw new DebugFileError('ELF section headers are missing or damaged');
 const section = (index: number) => ({ name: view.getUint32(table + index * entry, true), offset: word(table + index * entry + (wide ? 24 : 16)), size: word(table + index * entry + (wide ? 32 : 20)) });
 const strings = section(names);
 if (strings.offset + strings.size > bytes.length) throw new DebugFileError('ELF section names are damaged');
 const found = new Map<string, { offset: number; size: number }>();
 for (let index = 0; index < count; index++) {
  const header = section(index);
  if (header.name >= strings.size || header.offset + header.size > bytes.length) throw new DebugFileError('ELF section is outside the file');
  const from = strings.offset + header.name, end = bytes.indexOf(0, from);
  found.set(new TextDecoder().decode(bytes.subarray(from, end < 0 ? strings.offset + strings.size : end)), header);
 }
 const note = found.get('.note.gnu.build-id');
 if (!note || note.size < 16) throw new DebugFileError('ELF shared object has no GNU build id, so nothing can identify it; relink with -Wl,--build-id');
 const nameLength = view.getUint32(note.offset, true), descriptionLength = view.getUint32(note.offset + 4, true), kind = view.getUint32(note.offset + 8, true), descriptionAt = note.offset + 12 + Math.ceil(nameLength / 4) * 4;
 if (kind !== 3 || nameLength !== 4 || descriptionAt + descriptionLength > note.offset + note.size || descriptionLength < 8 || descriptionLength > 64) throw new DebugFileError('ELF GNU build id note is damaged');
 if (!found.has('.symtab') && !found.has('.debug_info')) throw new DebugFileError('ELF shared object is stripped (no .symtab or DWARF); upload the unstripped library');
 return { format: 'ndk', debugId: hex(bytes.subarray(descriptionAt, descriptionAt + descriptionLength)), arch, bytes };
}

/** Normalized NDK ABI names accepted in Bugsnag's `arch` field. */
export const ndkAbis = ['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86', 'riscv64'];
