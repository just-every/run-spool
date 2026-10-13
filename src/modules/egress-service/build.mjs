import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const modules = fileURLToPath(new URL('../', import.meta.url));
const here = fileURLToPath(new URL('./', import.meta.url));

/** The source graph from one entry: types stripped, nothing else rewritten except `.ts` specifiers
 * when `rename` is set. Only relative and `cloudflare:` imports are allowed. Keys are paths under modules/. */
export async function workerModules(entry, { rename = false } = {}) {
  const out = {};
  async function visit(path) {
    const name = relative(modules, path).replaceAll('\\', '/');
    const key = rename ? name.replace(/\.ts$/, '.js') : name;
    if (out[key]) return;
    if (path.endsWith('.wasm')) { out[key] = await readFile(path); return; }
    let contents = path.endsWith('.ts') ? stripTypeScriptTypes(await readFile(path, 'utf8')) : await readFile(path, 'utf8');
    out[key] = contents;
    for (const match of contents.matchAll(/^(?:import|export)\s+(?:[^\n;]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)) {
      const specifier = match[1];
      if (specifier.startsWith('cloudflare:')) continue;
      if (!specifier.startsWith('.')) throw new Error(`Nonportable egress dependency: ${specifier}`);
      await visit(join(dirname(path), specifier));
    }
    if (rename) out[key] = contents.replace(/(['"])(\.{1,2}\/[^'"]+)\.ts\1/g, '$1$2.js$1');
  }
  await visit(entry);
  return out;
}

/** Writes the deploy-kit product layout: dist/server (no_bundle ESM, Wrangler rules), an empty
 * dist/client and an empty migrations/core. Deploy with deploy-kit owner-cli and this directory as --product. */
export async function buildEgressWorker(product = here) {
  const server = join(product, 'dist/server');
  await rm(join(product, 'dist'), { recursive: true, force: true });
  const files = await workerModules(join(here, 'worker.ts'), { rename: true });
  for (const [name, contents] of Object.entries(files)) {
    if (name.endsWith('.wasm') && WebAssembly.Module.exports(new WebAssembly.Module(contents)).some(e => e.name === 'test_root')) throw new Error('test roots forbidden in deployable egress');
    await mkdir(dirname(join(server, name)), { recursive: true });
    await writeFile(join(server, name), contents);
  }
  await writeFile(join(server, 'wrangler.json'), JSON.stringify({
    name: 'egress-service', main: 'egress-service/worker.js', compatibility_date: '2026-09-08',
    no_bundle: true, rules: [{ type: 'ESModule', globs: ['**/*.js', '**/*.mjs'] }],
  }, null, 2) + '\n');
  await mkdir(join(product, 'dist/client'), { recursive: true });
  await mkdir(join(product, 'migrations/core'), { recursive: true });
  return { server, main: 'egress-service/worker.js', modules: Object.keys(files).sort() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(await buildEgressWorker()));
