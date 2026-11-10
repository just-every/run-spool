import { hash } from '../privacy';
import { releaseIdentity } from '../releases/identity';
import { storedBuild } from '../releases/build';
import { parseProguard } from './proguard';
import { scrub } from '../scrub';
import { fromBase64 } from '../sentry-cli/base64';
import { parseElf, parseMachO } from './debug-formats';

export const nativeSymbolTables = { native_symbols: ['project','release','build','format','payload','digest','created'] };
export const nativeDebugFileTables = { native_debug_files: ['project','format','debug_id','arch','name','payload','digest','created'] };
export async function validateNativeSymbols(data: any) {
 const seen = new Set<string>();
 for (const row of data.native_symbols) {
  releaseIdentity(row.release); storedBuild(row.build);
  const key = JSON.stringify([row.project, row.release, row.build, row.format]);
  if (seen.has(key) || row.format !== 'proguard' || !Number.isSafeInteger(row.created) || row.created < 0) throw new Error('Archive native symbol identity');
  seen.add(key); parseProguard(row.payload);
  if (await hash(row.payload) !== row.digest) throw new Error('Archive native symbol integrity');
  if (!data.releases.some((r: any) => r.project === row.project && r.name === row.release) || !data.release_builds.some((b: any) => b.project === row.project && b.release === row.release && b.build === row.build && b.registered === 1)) throw new Error('Archive native symbol release');
 }
}
export async function validateNativeDebugFiles(data: any) {
 const seen = new Set<string>();
 for (const row of data.native_debug_files) {
  const key = JSON.stringify([row.project, row.format, row.debug_id]);
  if (seen.has(key) || !['dsym', 'ndk'].includes(row.format) || !Number.isSafeInteger(row.created) || row.created < 0 || scrub(row.name) !== row.name || !row.name || /[\u0000-\u001f\u007f/\\]/.test(row.name)) throw new Error('Archive native debug file identity');
  seen.add(key);
  if (await hash(row.payload) !== row.digest) throw new Error('Archive native debug file integrity');
  // The stored bytes must still be the exact debug file their identity names.
  let identified;
  try { const bytes = fromBase64(row.payload); identified = row.format === 'dsym' ? parseMachO(bytes) : [parseElf(bytes)]; }
  catch { throw new Error('Archive native debug file content'); }
  if (identified.length !== 1 || identified[0]!.format !== row.format || identified[0]!.debugId !== row.debug_id || identified[0]!.arch !== row.arch) throw new Error('Archive native debug file identity');
 }
}
