import { scrub } from '../scrub';
import { listZip, ZipError } from '../sentry-cli/zip';
import { DebugFileError, debugFileByteLimit, ndkAbis, parseElf, parseMachO, type DebugFile } from './debug-formats';

export const debugUploadByteLimit = 8 * 1024 * 1024;
export type Upload = { format: 'dsym' | 'ndk'; files: (DebugFile & { name: string })[] };
const safeName = (value: unknown, label: string) => {
 if (typeof value !== 'string' || !value || value.length > 128 || /[\u0000-\u001f\u007f/\\]/.test(value) || scrub(value) !== value) throw new DebugFileError(`${label} is not a safe file name`);
 return value;
};

async function boundedBody(request: Request): Promise<Uint8Array> {
 const reader = request.body?.getReader(); if (!reader) throw new DebugFileError('Multipart upload body required');
 const chunks: Uint8Array[] = []; let size = 0;
 for (;;) {
  const part = await reader.read(); if (part.done) break;
  size += part.value.byteLength;
  if (size > debugUploadByteLimit) { await reader.cancel(); throw new DebugFileError(`Upload exceeds ${debugUploadByteLimit} bytes`, 413); }
  chunks.push(part.value);
 }
 const out = new Uint8Array(size); let at = 0; for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
 return out;
}

/** Read Bugsnag's documented multipart shapes: `dsym` (the zipped .dSYM bundle, `bugsnag-cli upload dsym`) or
 * `soSymbolFile` (an unstripped NDK shared object with its build id, `upload android-ndk`). Vendor project keys
 * and local paths (apiKey, projectRoot) are authentication or build-machine detail and are never stored. */
export async function readDebugUpload(request: Request): Promise<Upload> {
 let form: FormData;
 try { form = await new Response(await boundedBody(request) as BodyInit, { headers: { 'content-type': request.headers.get('content-type')! } }).formData(); }
 catch (error) { if (error instanceof DebugFileError) throw error; throw new DebugFileError('Malformed multipart upload'); }
 const fields = ['dsym', 'soSymbolFile'].filter(name => form.has(name));
 if (fields.length !== 1) throw new DebugFileError('Send exactly one of the multipart file fields dsym (zipped .dSYM bundle) or soSymbolFile (unstripped NDK .so)');
 const file = form.get(fields[0]!);
 if (file === null || typeof file === 'string') throw new DebugFileError(`Field ${fields[0]} must be a file`);
 const bytes = new Uint8Array(await file.arrayBuffer());
 if (fields[0] === 'dsym') return { format: 'dsym', files: await dsymFiles(bytes) };
 const library = parseElf(bytes), arch = form.get('arch');
 if (bytes.length > debugFileByteLimit) throw new DebugFileError(`${bytes.length} bytes exceeds the ${debugFileByteLimit}-byte debug file limit`, 413);
 if (arch !== null && (typeof arch !== 'string' || !ndkAbis.includes(arch))) throw new DebugFileError('arch must be an Android ABI name such as arm64-v8a');
 if (arch !== null && arch !== library.arch) throw new DebugFileError(`arch ${arch} does not match the ELF machine ${library.arch}`);
 const name = form.get('sharedObjectName') ?? file.name;
 return { format: 'ndk', files: [{ ...library, name: safeName(name, 'sharedObjectName') }] };
}

async function dsymFiles(zip: Uint8Array): Promise<Upload['files']> {
 let entries;
 try { entries = listZip(zip, { entries: 200, entryBytes: 32 * 1024 * 1024 }); }
 catch (error) { throw new DebugFileError(error instanceof ZipError ? `dSYM upload is not a usable ZIP archive: ${error.message}` : 'dSYM upload is not a ZIP archive'); }
 const dwarf = entries.filter(entry => !entry.name.endsWith('/') && /(?:^|\/)Contents\/Resources\/DWARF\/[^/]+$/.test(entry.name));
 if (!dwarf.length) throw new DebugFileError('dSYM archive has no Contents/Resources/DWARF/<binary> DWARF file');
 const files: Upload['files'] = [];
 for (const entry of dwarf) {
  const name = safeName(entry.name.slice(entry.name.lastIndexOf('/') + 1), 'DWARF file name');
  let bytes: Uint8Array;
  try { bytes = await entry.read(); } catch (error) { throw new DebugFileError(`dSYM upload is not a usable ZIP archive: ${(error as Error).message}`); }
  for (const slice of parseMachO(bytes)) {
   if (slice.bytes.length > debugFileByteLimit) throw new DebugFileError(`${name} (${slice.arch}) is ${slice.bytes.length} bytes; Spool stores at most ${debugFileByteLimit} bytes per debug file`, 413);
   files.push({ ...slice, name });
  }
 }
 return files;
}
