import { loaderOptions } from './options';
export const loaderTables = { loader_settings: ['project', 'key_hash', 'revision', 'settings', 'updated'] };
export const loaderDefaults = (data: any) => ({ loader_settings: [], ...data });
export function validateLoaderArchive(data: any) {
 const seen = new Set<string>();
 for (const row of data.loader_settings) {
  const key = row.project + ':' + row.key_hash;
  if (!/^[a-f0-9]{64}$/.test(row.key_hash) || !Number.isSafeInteger(row.revision) || row.revision < 1 || !Number.isSafeInteger(row.updated) || row.updated < 0 || seen.has(key)) throw new Error('Archive loader settings');
  loaderOptions(JSON.parse(row.settings)); seen.add(key);
 }
}
