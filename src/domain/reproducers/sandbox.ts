import { TraceMap } from '@jridgewell/trace-mapping';
import { hash } from '../privacy';
import { sourceMapFile } from '../source-map-path';

// The one declared defect class so far: a JavaScript exception whose first
// frame maps, through a stored source map, to an ES module source the map
// carries. Everything else is recorded as unsupported with its reason.
export const DEFECT_CLASS = 'js-exception-mapped-frame';
export const RUNNER_PROTOCOL = 1;
// What every run of every reproducer gets: a separate workerd process with no
// network service, no bindings, an empty process environment, no filesystem
// access and a wall-clock kill. The runner refuses a job that asks for more.
export const SANDBOX = { runtime: 'workerd', compatibilityDate: '2026-09-08', compatibilityFlags: [] as string[], network: 'none', bindings: 'none', processEnvironment: 'empty', filesystem: 'none', wallClockMs: 10000 };
export const RUN_TOKEN_MS = 15 * 60_000;
const MODULE_BYTES = 1024 * 1024;
const modulePattern = /^[A-Za-z0-9._@+-]+(?:\/[A-Za-z0-9._@+-]+)*$/;

// Source paths become sandbox module names: scheme and leading ./ ../ removed,
// so relative imports between the map's own sources still resolve.
export function moduleName(source: string): string | null {
 const parts = source.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*\/?/i, '').split('/').filter(part => part && part !== '.');
 while (parts[0] === '..') parts.shift();
 const name = parts.join('/');
 return name && !parts.includes('..') && modulePattern.test(name) && /\.m?js$/.test(name) && !name.startsWith('spool-') ? name : null;
}
export type SourceModule = { name: string; original: string; source: string; sha256: string; bytes: number };
// Every ES module source the map carries, named for the sandbox. The original
// path is the same normalized file the mapped frame shows.
export async function mapModules(payload: string): Promise<SourceModule[]> {
 const map = JSON.parse(payload), traced = new TraceMap(map), modules: SourceModule[] = [], seen = new Set<string>();
 for (const [index, resolved] of traced.resolvedSources.entries()) {
  const source = map.sourcesContent?.[index], name = moduleName(String(resolved ?? ''));
  if (typeof source !== 'string' || !name || seen.has(name)) continue;
  seen.add(name);
  modules.push({ name, original: sourceMapFile(String(resolved)), source, sha256: await hash(source), bytes: new TextEncoder().encode(source).length });
 }
 if (modules.reduce((total, row) => total + row.bytes, 0) > MODULE_BYTES) throw new Error('module_budget');
 return modules;
}
export const recorded = (modules: SourceModule[]) => modules.map(({ name, original, sha256, bytes }) => ({ name, original, sha256, bytes }));
