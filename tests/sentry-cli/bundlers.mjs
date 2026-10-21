import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build as esbuild} from 'esbuild';
import {build as vite} from 'vite';
import {rollup} from 'rollup';
import webpack from 'webpack';
import {sentryVitePlugin} from '@sentry/vite-plugin';
import {sentryEsbuildPlugin} from '@sentry/esbuild-plugin';
import {sentryRollupPlugin} from '@sentry/rollup-plugin';
import {sentryWebpackPlugin} from '@sentry/webpack-plugin';
import {sdkPath} from './sdk.mjs';

const program = `import * as Sentry from ${JSON.stringify(sdkPath)};
Sentry.init({dsn:process.env.DSN,release:process.env.REL,dist:process.env.DIST,environment:'ci',defaultIntegrations:false});
function charge(account){
  return account.address.city;
}
try{charge({})}catch(e){Sentry.captureException(e)}
await Sentry.flush(5000);
`;
export const originalLine = program.split('\n').findIndex(line => line.includes('address.city')) + 1;

/** Each factory is the released plugin with exactly the options a team's existing config already has: the
 * organization and project slugs, the auth token, and the Sentry URL (telemetry off keeps the build hermetic). */
const connection = ({origin, token}) => ({org: 'acme', project: 'web', authToken: token, url: origin, telemetry: false});
const external = new RegExp(sdkPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split('/build/')[0]);

export const bundlers = {
 async vite(root, options, release, dist) {
  await vite({configFile: false, root, logLevel: 'silent', plugins: [sentryVitePlugin({...connection(options), release: {name: release, dist}})],
   build: {outDir: resolve(root, 'out'), emptyOutDir: true, sourcemap: true, minify: true, lib: {entry: resolve(root, 'src/entry.mjs'), formats: ['es'], fileName: () => 'entry.mjs'}, rollupOptions: {external: [external]}}});
  return resolve(root, 'out/entry.mjs');
 },
 async esbuild(root, options, release, dist) {
  await esbuild({entryPoints: [resolve(root, 'src/entry.mjs')], bundle: true, format: 'esm', platform: 'node', outfile: resolve(root, 'out/entry.mjs'), sourcemap: true, minify: true, external: [sdkPath], logLevel: 'silent',
   plugins: [sentryEsbuildPlugin({...connection(options), release: {name: release, dist}})]});
  return resolve(root, 'out/entry.mjs');
 },
 async rollup(root, options, release, dist) {
  const bundle = await rollup({input: resolve(root, 'src/entry.mjs'), external: [external], plugins: [sentryRollupPlugin({...connection(options), release: {name: release, dist}})]});
  await bundle.write({dir: resolve(root, 'out'), format: 'es', sourcemap: true, entryFileNames: 'entry.mjs'}); await bundle.close();
  return resolve(root, 'out/entry.mjs');
 },
 async webpack(root, options, release, dist) {
  const stats = await new Promise((done, fail) => webpack({mode: 'production', context: root, entry: './src/entry.mjs', target: 'node', devtool: 'source-map', experiments: {outputModule: true},
   externals: [({request}, callback) => external.test(request) ? callback(null, 'module ' + request) : callback()],
   output: {path: resolve(root, 'out'), filename: 'entry.mjs', module: true, chunkFormat: 'module'},
   plugins: [sentryWebpackPlugin({...connection(options), release: {name: release, dist}})]}, (error, result) => error ? fail(error) : done(result)));
  if (stats.hasErrors()) throw new Error(stats.toString('errors-only'));
  return resolve(root, 'out/entry.mjs');
 },
};
export async function prepare(root) {
 await mkdir(resolve(root, 'src'), {recursive: true});
 await writeFile(resolve(root, 'src/entry.mjs'), program);
}
