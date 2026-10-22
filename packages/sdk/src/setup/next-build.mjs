// Written into the reviewed setup patch. The existing uploader remains the only upload path.
export const nextConfig = `// Spool: emit private maps for the production browser build.
export default { productionBrowserSourceMaps: true };
`;

export const nextBuild = `import { spawnSync, spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
const require = createRequire(import.meta.url);
const required = ['SPOOL_ENDPOINT', 'SPOOL_PROJECT', 'NEXT_PUBLIC_SPOOL_RELEASE', 'SPOOL_BUILD', 'SPOOL_DEPLOY_KEY'];
for (const name of required) if (!process.env[name]) throw new Error(name + ' must be set for the Spool production build');
process.env.NEXT_PUBLIC_SPOOL_BUILD = process.env.SPOOL_BUILD;
const build = spawnSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build', '--webpack'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const bundles = [];
async function collect(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (path.endsWith('.js.map')) bundles.push(path.slice(0, -4));
  }
}
// Application routes are uploaded; Next's shared framework/runtime chunks are not application source.
await collect('.next/static/chunks/app');
const uploader = join(dirname(require.resolve('@just-every/spool/package.json')), 'dist/sourcemaps.js');
const upload = spawn(process.execPath, [uploader, '--endpoint', process.env.SPOOL_ENDPOINT,
  '--project', process.env.SPOOL_PROJECT, '--release', process.env.NEXT_PUBLIC_SPOOL_RELEASE,
  '--build', process.env.SPOOL_BUILD, '--key-env', 'SPOOL_DEPLOY_KEY', ...bundles], { stdio: 'inherit' });
upload.once('error', error => { console.error(error.message); process.exitCode = 1; });
upload.once('exit', code => { process.exitCode = code ?? 1; });
`;
