import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {archiveProjection} from '../archive.mjs';
import {runCli} from './cli.mjs';

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
 const upload = await cli(['debug-files', 'upload', dir]);
 assert.notEqual(upload.code, 0, 'native debug files are refused until SDK-002 symbolication exists');
 assert.match(upload.output, /ERROR app[\s\S]*native debug files are not accepted yet[\s\S]*SDK-002[\s\S]*uploaded nothing/);
 assert.deepEqual(await api('/api/projects/web/sentry-uploads'), before, 'nothing was staged or stored');

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

 // A supported mutating command must reject an unknown flag before changing stored evidence.
 const state = async () => ({product: (await archiveProjection(await req('/api/archive'))).data, uploads: await api('/api/projects/web/sentry-uploads')});
 const beforeFlag = await state(), flag = '--synthetic-spool-unsupported-flag', release = 'synthetic-spool-74';
 assert.ok(beforeFlag.product.events.length > 0 && beforeFlag.uploads.artifacts.length > 0, 'the refusal protects populated product and artifact state');
 const unsupportedFlag = await cli(['releases', 'new', release, flag]);
 assert.notEqual(unsupportedFlag.code, 0, 'an unsupported flag fails the released CLI');
 assert.ok(unsupportedFlag.output.includes(flag), 'the error names the literal unsupported flag');
 assert.match(unsupportedFlag.output, /error: unexpected argument/);
 assert.match(unsupportedFlag.output, /Usage: sentry-cli releases new <VERSION>/, 'the error names the command and its usage');
 assert.deepEqual(await state(), beforeFlag, 'an unsupported flag changes no product rows, artifact bytes or upload receipts');
 const valid = await cli(['releases', 'new', release]);
 assert.equal(valid.code, 0, valid.output);
 assert.ok((await api('/api/projects/web/releases')).some(row => row.name === release), 'the same command without the unknown flag stores its release');
 console.log(`PROBE SRC-003 acceptance-4: sentry-cli releases new ${release} ${flag} -> exit=${unsupportedFlag.code}; literal flag and command usage named; product and artifacts unchanged; valid command exit=${valid.code} and release stored`);
 const listed = await cli(['releases', 'list']);
 assert.equal(listed.code, 0, listed.output); assert.match(listed.output, /checkout@1\.0\.0/);
}
