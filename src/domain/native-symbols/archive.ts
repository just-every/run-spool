import { hash } from '../privacy';
import { releaseIdentity } from '../releases/identity';
import { storedBuild } from '../releases/build';
import { parseProguard } from './proguard';

export const nativeSymbolTables = { native_symbols: ['project','release','build','format','payload','digest','created'] };
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
