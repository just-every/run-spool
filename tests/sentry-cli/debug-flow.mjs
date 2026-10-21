import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runCli} from './cli.mjs';

/** Native debug files, send-event and the endpoints Spool does not serve, as an unmodified client meets them. */
export async function debugFlow({origin, api, keys, dsn, temporary}) {
 const cli = (args, options = {}) => runCli(args, {origin, token: keys.deploy, ...options});
 // A genuine ELF/DWARF file compiled from a few checked-in lines of C, with a GNU build ID.
 const dir = resolve(temporary, 'native'); await mkdir(dir, {recursive: true});
 await writeFile(resolve(dir, 'app.c'), '#include <stdio.h>\nint add(int a, int b) { return a + b; }\nint main(void) { printf("%d\\n", add(1, 2)); return 0; }\n');
 execFileSync('gcc', ['-g', '-Wl,--build-id', '-o', resolve(dir, 'app'), resolve(dir, 'app.c')]);
 const check = await cli(['debug-files', 'check', resolve(dir, 'app')]);
 assert.equal(check.code, 0, check.output); assert.match(check.output, /Debug ID: [0-9a-f-]{36}/);

 const before = await api('/api/projects/web/sentry-uploads');
 const upload = await cli(['debug-files', 'upload', dir]);
 assert.notEqual(upload.code, 0, 'native debug files are refused until SDK-002 symbolication exists');
 assert.match(upload.output, /ERROR app[\s\S]*native debug files are not accepted yet[\s\S]*SDK-002[\s\S]*uploaded nothing/);
 assert.deepEqual(await api('/api/projects/web/sentry-uploads'), before, 'nothing was staged or stored');

 // bundle-sources is a local command: it needs no server and its output is a real source bundle.
 const bundled = await cli(['debug-files', 'bundle-sources', resolve(dir, 'app')]);
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
 const listed = await cli(['releases', 'list']);
 assert.equal(listed.code, 0, listed.output); assert.match(listed.output, /checkout@1\.0\.0/);
}
