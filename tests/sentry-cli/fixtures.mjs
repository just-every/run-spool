import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {build} from 'esbuild';

export const fixtureAuthor = {name: process.env.GIT_AUTHOR_NAME ?? 'Dev One', email: process.env.GIT_AUTHOR_EMAIL ?? 'dev@example.test'};

/** A real git history, so `releases set-commits` reads commits from the checkout as it does in CI. */
export function gitHistory(dir, messages) {
 const git = (...args) => execFileSync('git', args, {cwd: dir, encoding: 'utf8', env: {...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null'}}).trim();
 git('init', '-q', '-b', 'main'); git('config', 'user.email', 'dev@example.test'); git('config', 'user.name', 'Dev One');
 git('remote', 'add', 'origin', 'https://git.example.test/acme/checkout.git');
 const shas = [];
 messages.forEach((message, index) => { execFileSync('sh', ['-c', `echo ${index} > file${index}`], {cwd: dir}); git('add', '-A'); git('commit', '-q', '-m', message); shas.push(git('rev-parse', 'HEAD')); });
 return shas;
}

/** Bundles a Node program with esbuild and the unmodified @sentry/node SDK left external, with a map beside it. */
export async function buildApp(dir, {name, release, dist, source, sdkPath}) {
 await mkdir(resolve(dir, 'src'), {recursive: true});
 const entry = resolve(dir, 'src', name + '.mjs');
 await writeFile(entry, `import * as Sentry from ${JSON.stringify(sdkPath)};\nSentry.init({dsn:process.env.DSN,release:${JSON.stringify(release)},dist:${JSON.stringify(dist)},environment:'ci',defaultIntegrations:false});\n${source}\nawait Sentry.flush(5000);\n`);
 const outfile = resolve(dir, 'dist', name + '.mjs');
 await build({entryPoints: [entry], outfile, bundle: true, format: 'esm', platform: 'node', sourcemap: true, minify: true, external: [sdkPath], logLevel: 'silent'});
 return {name, entry, outfile, line: source.split('\n').findIndex(line => line.includes('address.city')) + 3};
}

/** A syntactically valid flat Source Map V3 that is incompressible, so its stored size is its real size. */
export function flatMap(file, bytes, sourcePath = `src/${file}.ts`) {
 return JSON.stringify({version: 3, file: `${file}.js`, sources: [sourcePath], sourcesContent: [randomBytes(Math.ceil(bytes * 3 / 4)).toString('base64').slice(0, bytes)], names: [], mappings: 'AAAA'});
}
export async function writeScript(dir, name, map) {
 await mkdir(dirname(resolve(dir, name)), {recursive: true});
 await writeFile(resolve(dir, name + '.js'), `console.log(${JSON.stringify(name)});\n//# sourceMappingURL=${name}.js.map\n`);
 await writeFile(resolve(dir, name + '.js.map'), map);
}
