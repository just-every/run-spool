// Builds dist/ from src/ and the shared capture core in ../../src/domain, then (with --pack) packs the tarball.
// The output depends only on the sources and the pinned esbuild/TypeScript, so the same commit packs the same bytes.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = dirname(fileURLToPath(import.meta.url)), dist = join(root, 'dist'), types = join(root, 'build/types/packages/sdk/src');
await rm(dist, { recursive: true, force: true });
await rm(join(root, 'build'), { recursive: true, force: true });
const sdkVersion=JSON.parse(await readFile(join(root,'package.json'),'utf8')).version;
const common = { bundle: true, format: 'esm', target: 'es2022', legalComments: 'eof', write: true, logLevel: 'warning', define: {__SPOOL_SDK_VERSION__:JSON.stringify(sdkVersion)} };
await build({ ...common, entryPoints: { browser: 'src/browser.ts', worker: 'src/worker.ts', tunnel: 'src/tunnel.ts', next: 'src/next.ts' }, absWorkingDir: root, outdir: dist, platform: 'neutral', minify: true });
await build({ ...common, entryPoints: { node: 'src/node.ts' }, absWorkingDir: root, outdir: dist, platform: 'node', minify: true });
// The source-map tools parse bundles; their two parser libraries are bundled so the package has no dependencies.
await build({ ...common, entryPoints: { vite: 'src/sourcemaps/plugin.mjs', webpack: 'src/sourcemaps/webpack.mjs', esbuild: 'src/sourcemaps/esbuild.mjs', sourcemaps: 'src/sourcemaps/bin.mjs', setup: 'src/setup/bin.mjs' }, absWorkingDir: root, outdir: dist, platform: 'node', minify: true, splitting: true, chunkNames: 'shared-[hash]' });

const tsc = resolve(root, '../../node_modules/typescript/bin/tsc');
execFileSync(process.execPath, [tsc, '-p', join(root, 'tsconfig.json')], { stdio: 'inherit' });
for (const name of ['browser.d.ts', 'node.d.ts', 'worker.d.ts', 'tunnel.d.ts', 'next.d.ts', 'types.d.ts', 'sessions.d.ts']) {
  const text = await readFile(join(types, name), 'utf8');
  if (/from '\.\.\//.test(text)) throw new Error(`${name} exposes a type from outside the package`);
  await writeFile(join(dist, name), text.replace(/(['"])(\.\/[^'"]+)\.ts\1/g, '$1$2.js$1'));
}
for(const name of ['vite','webpack','esbuild'])await copyFile(join(root, `src/${name}.d.ts`), join(dist, `${name}.d.ts`));
await copyFile(join(root, '../../LICENSE'), join(root, 'LICENSE'));
await rm(join(root, 'build'), { recursive: true, force: true });

const browser = await readFile(join(dist, 'browser.js'));
console.log(JSON.stringify({ browserBytes: browser.length, browserGzipBytes: gzipSync(browser, { level: 9 }).length }));
if (process.argv.includes('--pack')) {
  const out = join(root, 'build');
  await mkdir(out, { recursive: true });
  const [packed] = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', out], { cwd: root, encoding: 'utf8' }));
  console.log(JSON.stringify({ tarball: join(out, packed.filename), shasum: packed.shasum, files: packed.files.length, size: packed.size }));
}
