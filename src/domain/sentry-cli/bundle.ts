import { listZip, ZipError, type ZipEntry } from './zip';
import { bundleFileLimit, manifestLimit, mapByteLimit } from './limits';

export type BundleFile = { path: string; url: string; type: string; headers: Record<string, string>; entry: ZipEntry };
export type Bundle = { release: string | null; dist: string | null; files: BundleFile[] };

const text = (value: unknown) => typeof value === 'string' ? value : null;
/** The artifact bundle sentry-cli assembles: manifest.json naming each file's URL, type and headers
 * (`debug-id`, `sourcemap`), plus the files themselves. Nothing here is stored; callers decide per file. */
export async function readBundle(bytes: Uint8Array): Promise<Bundle> {
 const entries = listZip(bytes, { entries: bundleFileLimit + 1, entryBytes: mapByteLimit });
 const byName = new Map(entries.map(entry => [entry.name, entry]));
 const manifestEntry = byName.get('manifest.json');
 if (!manifestEntry) throw new ZipError('the bundle has no manifest.json');
 if (manifestEntry.size > manifestLimit) throw new ZipError('manifest.json is too large');
 let manifest: any;
 try { manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await manifestEntry.read())); } catch { throw new ZipError('manifest.json is not valid JSON'); }
 if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || !manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) throw new ZipError('manifest.json has no files');
 const files: BundleFile[] = [];
 for (const [path, info] of Object.entries<any>(manifest.files)) {
  const entry = byName.get(path);
  if (!entry) throw new ZipError(`manifest names ${path}, which is not in the bundle`);
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries<any>(info?.headers ?? {})) if (typeof value === 'string') headers[key.toLowerCase()] = value;
  files.push({ path, url: text(info?.url) ?? path, type: text(info?.type) ?? 'unknown', headers, entry });
 }
 if (files.length > bundleFileLimit) throw new ZipError(`the bundle names ${files.length} files; at most ${bundleFileLimit} are accepted per bundle`);
 return { release: text(manifest.release), dist: text(manifest.dist), files };
}
