import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { Script } from 'node:vm';
import { build } from 'esbuild';
import { frames } from '../src/domain/capture.ts';

const run = promisify(execFile);

// Use the documented deploy-key command and capture door with a generated stack.
export async function stampGroupingFlow({ json, origin }) {
 const dir = await mkdtemp(resolve(tmpdir(), 'spool-stamp-'));
 try {
  const project = await json('/api/projects', 'POST', { id: 'stamping', name: 'Northwind Checkout' });
  const root = '/api/projects/' + project.id;
  const deploy = await json(root + '/keys', 'POST', { kind: 'deploy' });
  const path = resolve(dir, 'checkout.js'), file = 'https://northwind.example/checkout.js';
  const source = 'function checkout() { throw new TypeError("Missing shipping address"); } checkout();';
  const emitted = await build({ stdin: { contents: source, sourcefile: 'src/checkout.js' }, outfile: path, minify: true, sourcemap: 'external', write: false });
  const reset = () => Promise.all(emitted.outputFiles.map(output => writeFile(output.path, output.contents)));
  const release = (name, build) => json(root + '/releases', 'POST', { name, build });
  const upload = (release, build) => run(process.execPath, ['packages/sdk/src/sourcemaps/bin.mjs',
   '--endpoint', origin, '--project', project.id, '--release', release, '--build', build,
   '--key-env', 'SPOOL_TEST_STAMP_DEPLOY_KEY', path], { env: { ...process.env, SPOOL_TEST_STAMP_DEPLOY_KEY: deploy.key } });
  const capture = async (eventId, release, build) => {
   const context = {};
   const script = new Script(await readFile(path, 'utf8'), { filename: file });
   let stack, message;
   try { script.runInNewContext(context); } catch (error) { stack = error.stack; message = error.message; }
   const reported = frames(stack).find(frame => frame.file === file);
   const debugId = Object.values(context._sentryDebugIds ?? {})[0];
   const frame = { ...reported, ...debugId ? { debugId } : {} };
   const receipt = await json('/api/ingest/' + project.id, 'POST', {
    version: 1, eventId, release, build, environment: 'production', type: 'TypeError', message, frames: [frame],
   }, { Cookie: '', Authorization: 'Bearer ' + project.ingestKey });
   assert.equal(receipt.outcome, 'accepted');
   return { ...receipt, frame };
  };

  await reset();
  await release('r42', 'checkout-42');
  const before = await capture('before-stamp', 'r42', 'checkout-42');
  await upload('r42', 'checkout-42');
  const stamped = await capture('after-stamp', 'r42', 'checkout-42');
  assert.equal(stamped.frame.line, before.frame.line + 1, 'the documented stamper really moves the generated frame');
  assert.equal(stamped.frame.column, before.frame.column);
  assert.equal(stamped.frame.function, before.frame.function);
  assert.ok(stamped.diagnostic[0].original, 'the stamped occurrence maps to original source');
  assert.equal(stamped.issue, before.issue, 'adding a map to the same bundle keeps the original issue');

  const packetPath = root + '/issues/' + before.issue + '/packet';
  const packet = await json(packetPath);
  assert.equal(packet.issue.count, 2);
  assert.deepEqual(packet.events.map(row => row.originalGrouping.basis), [before.basis, before.basis]);
  await json(root + '/issues/' + before.issue, 'PATCH', { state: 'resolved', resolution: 'current', revision: packet.issue.revision });
  await reset();
  await writeFile(path, (await readFile(path, 'utf8')) + '\n// checkout release 43');
  await upload('r43', 'checkout-43');
  const later = await capture('later-release', 'r43', 'checkout-43');
  assert.notEqual(later.frame.debugId, stamped.frame.debugId);
  assert.equal(later.issue, before.issue, 'the same location in a newly stamped release still regresses');
  assert.equal((await json(packetPath)).issue.state, 'open');
  assert.ok((await json(root + '/alerts')).some(alert => alert.kind === 'regression'));
 } finally { await rm(dir, { recursive: true, force: true }); }
}
