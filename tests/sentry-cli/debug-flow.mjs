import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runCli} from './cli.mjs';
import {boundaryState, populatedDenialFlow} from './denials.mjs';

/** Native debug files, send-event and the endpoints Spool does not serve, as an unmodified client meets them. */
export async function debugFlow({origin, api, req, keys, dsn, temporary}) {
 const cli = (args, options = {}) => runCli(args, {origin, token: keys.deploy, ...options});
 // Genuine compiler debug information: ELF/DWARF with a GNU build ID on Linux,
 // or the compiler's dSYM/DWARF on macOS (whose linker does not accept --build-id).
 const dir = resolve(temporary, 'native'); await mkdir(dir, {recursive: true});
 await writeFile(resolve(dir, 'app.c'), '#include <stdio.h>\nint add(int a, int b) { return a + b; }\nint main(void) { printf("%d\\n", add(1, 2)); return 0; }\n');
 execFileSync('gcc', ['-g', ...process.platform === 'darwin' ? [] : ['-Wl,--build-id'], '-o', resolve(dir, 'app'), resolve(dir, 'app.c')]);
 const debugFile = process.platform === 'darwin' ? resolve(dir, 'app.dSYM/Contents/Resources/DWARF/app') : resolve(dir, 'app');
 const check = await cli(['debug-files', 'check', debugFile]);
 assert.equal(check.code, 0, check.output); assert.match(check.output, /Debug ID: [0-9a-f-]{36}/);

 const before = await api('/api/projects/web/sentry-uploads');
 const beforeNative = await boundaryState({api, req});
 const upload = await cli(['debug-files', 'upload', dir]);
 assert.notEqual(upload.code, 0, 'native debug files are refused until SDK-002 symbolication exists');
 assert.match(upload.output, /ERROR app[\s\S]*native debug files are not accepted yet[\s\S]*SDK-002[\s\S]*uploaded nothing/);
 assert.deepEqual(await api('/api/projects/web/sentry-uploads'), before, 'nothing was staged or stored');
 assert.deepEqual(await boundaryState({api, req}), beforeNative, 'native debug refusal also preserves releases, deploys and staged chunks');

 // bundle-sources is a local command: it needs no server and its output is a real source bundle.
 const bundled = await cli(['debug-files', 'bundle-sources', '--output', dir, debugFile]);
 assert.equal(bundled.code, 0, bundled.output);
 assert.ok((await stat(resolve(dir, 'app.src.zip'))).size > 0);

 // send-event uses the project's DSN, not the deploy key.
 const sent = await cli(['send-event', '-m', 'sent by sentry-cli', '-l', 'error', '-r', 'cli@1.0.0'], {env: {SENTRY_DSN: dsn}});
 assert.equal(sent.code, 0, sent.output);
 const issue = (await api('/api/projects/web/issues')).find(row => row.title.includes('sent by sentry-cli'));
 assert.ok(issue, 'the event sent by sentry-cli is an issue');

 // Anything not served is named, never an empty success.
 for (const args of [['projects', 'list'], ['organizations', 'list']]) {
  const unsupported = await cli(args);
  assert.notEqual(unsupported.code, 0, args.join(' '));
  assert.match(unsupported.output, /Spool does not serve GET \/api\/0\/\S+ for Sentry clients \(SRC-003\)/);
 }
 const beforeUnsupported = await boundaryState({api, req});
 for (const [method, path, body] of [
  ['GET', '/api/0/organizations/acme/projects/'],
  ['POST', '/api/0/organizations/acme/unsupported/', {name: 'synthetic-spool-1'}],
 ]) {
  const response = await fetch(origin + path, {method, headers: {Authorization: 'Bearer ' + keys.deploy, ...body ? {'Content-Type': 'application/json'} : {}}, ...body ? {body: JSON.stringify(body)} : {}});
  assert.equal(response.status, 501, 'an authenticated unsupported endpoint is never a silent success');
  const result = await response.json();
  assert.ok(result.detail.includes(`Spool does not serve ${method} ${path} for Sentry clients (SRC-003)`));
  assert.equal(result.error, result.detail);
  for (const token of Object.values(keys)) assert.equal(JSON.stringify(result).includes(token), false, 'the named error exposes no credential');
  assert.deepEqual(await boundaryState({api, req}), beforeUnsupported, `${method} ${path}: unsupported endpoints preserve product and upload state`);
  console.log(`PROBE API-002 acceptance-3: ${method} ${path} with deploy authority -> 501 naming the method and path; product and upload state unchanged`);
 }
 const listed = await cli(['releases', 'list']);
 assert.equal(listed.code, 0, listed.output); assert.match(listed.output, /checkout@1\.0\.0/);
 await populatedDenialFlow({origin, api, req, keys});
}
