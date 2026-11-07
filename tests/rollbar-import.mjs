import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { admissionRuntime } from './admission-runtime.mjs';
import { signIn } from './auth.mjs';
import { archiveProjection } from './archive.mjs';
import { startTestWorker } from './worker.mjs';
import { rollbarImportCli, rollbarDoorClient } from '../scripts/rollbar-import.mjs';
// MIG-003: a Rollbar project with resolved and reactivated items, through the owner import door.
const worker = await admissionRuntime({}, { port: 15595, hostedMail: true }), { origin } = worker;
const scratch = await mkdtemp(join(tmpdir(), 'spool-rollbar-import-'));
try {
  let cookie = await signIn(origin, { emailLink: true });
  const req = (path, method = 'GET', value, headers = {}) => fetch(origin + path, { method, headers: { Origin: origin, Cookie: cookie, ...value ? { 'Content-Type': 'application/json' } : {}, ...headers }, ...value ? { body: typeof value === 'string' ? value : JSON.stringify(value) } : {} });
  const json = async (path, method, value, headers) => { const response = await req(path, method, value, headers); assert.ok(response.ok, `${method ?? 'GET'} ${path}: HTTP ${response.status}`); return response.json(); };
  const cli = (...args) => { process.env.SPOOL_TEST_SESSION = cookie; return rollbarImportCli([args[0], '--endpoint', origin, '--session-env', 'SPOOL_TEST_SESSION', ...args.slice(1)]); };
  const native = await json('/api/projects', 'POST', { id: 'native', name: 'Untouched native project' }), beforeProjects = await json('/api/projects');
  const fixture = new URL('./fixtures/rollbar/project.json', import.meta.url), bytes = await readFile(fixture), source = JSON.parse(bytes);
  const archiveBefore = await archiveProjection(await req('/api/archive'));

  // Dry run: counts by kind and every deploy, rule and comment named, with no native write.
  const planned = await cli('dry-run', '--file', fixture.pathname);
  assert.equal(planned.namespace, 'rollbar-project:web-app');
  assert.equal(planned.counts.rejected, 0);
  assert.deepEqual(planned.counts.byKind, { manifest: 1, projects: 1, releases: 2, items: 3, instances: 16, deploys: 3, rules: 2, comments: 1 }, 'every collection is counted');
  assert.equal(planned.counts.effects, 22, 'more effects than one door batch, so apply must resume');
  assert.ok(planned.counts.unmapped >= 7, 'three deploys, two rules and a comment are named, not silently dropped');
  assert.ok(!JSON.stringify(planned).includes('IMPORT_SECRET') && !JSON.stringify(planned).includes('PRIVATE_'));
  assert.deepEqual((await archiveProjection(await req('/api/archive'))).data, archiveBefore.data, 'planning writes nothing native');
  assert.deepEqual(await json('/api/projects'), beforeProjects);
  const applyArgs = ['--project', 'web-app', '--plan', planned.planId, '--fingerprint', planned.fingerprint];
  const wrong = (planned.fingerprint[0] === '0' ? '1' : '0') + planned.fingerprint.slice(1);
  await assert.rejects(cli('apply', '--project', 'web-app', '--plan', planned.planId, '--fingerprint', wrong), error => /HTTP 403/.test(error.message), 'an unreviewed fingerprint is refused');
  assert.deepEqual(await json('/api/projects'), beforeProjects);
  // A bundle for another project cannot ride this project's namespace.
  const other = JSON.parse(bytes); other.project.slug = 'other-app';
  const otherFile = join(scratch, 'other.json'); await writeFile(otherFile, JSON.stringify(other), { mode: 0o600 });
  const door = rollbarDoorClient({ endpoint: origin, cookie, project: 'web-app' });
  await assert.rejects(door.plan(await readFile(otherFile)), error => /HTTP 4\d\d/.test(error.message), 'a bundle under the wrong namespace is refused');

  // Interruption: one bounded batch applies, then the owner returns in a new session and resumes the same job.
  const first = await door.call('apply', { planId: planned.planId, reviewedFingerprint: planned.fingerprint });
  assert.equal(first.job.state, 'applying'); assert.ok(first.job.checkpoint > 0 && first.job.checkpoint < first.job.total, 'the first batch is partial');
  cookie = await signIn(origin, { bootstrap: false, emailLink: true });
  const resumed = await cli('apply', ...applyArgs);
  assert.equal(resumed.job.state, 'completed'); assert.equal(resumed.job.id, first.job.id, 'resume continues the interrupted job');
  assert.equal((await cli('apply', ...applyArgs)).job.id, first.job.id, 'repeating a completed apply answers the same job');
  const report = await cli('reconcile', '--project', 'web-app', '--plan', planned.planId);
  assert.equal(report.ok, true); assert.deepEqual(report.counts.byKind, { project: 1, release: 2, issue: 3, event: 16 });
  const imported = (await json('/api/projects')).find(project => !beforeProjects.some(before => before.id === project.id));
  assert.deepEqual(report.projectIds, [imported.id]);
  assert.equal(imported.name, 'Imported web app');

  // Resolved and reactivated items keep their states; counts, stacks, deploys and rules compare with the export.
  const issues = await json(`/api/projects/${imported.id}/issues`), byTitle = title => issues.find(issue => issue.title.startsWith(title));
  assert.equal(issues.length, 3);
  assert.equal(byTitle('TypeError').state, 'resolved'); assert.equal(byTitle('RangeError').state, 'open', 'a reactivated item is open'); assert.equal(byTitle('KeyError').state, 'suppressed');
  assert.deepEqual(issues.map(issue => issue.count).sort((a, b) => a - b), [2, 2, 12]);
  assert.ok(!JSON.stringify(issues).includes('IMPORT_SECRET'));
  const compared = await cli('compare', '--project', 'web-app', '--plan', planned.planId, '--file', fixture.pathname);
  assert.equal(compared.ok, true, JSON.stringify(compared.rows.filter(row => row.status === 'differs')));
  const row = aspect => compared.rows.find(r => r.aspect === aspect);
  assert.deepEqual([row('items').source, row('items').imported, row('items').status], [3, 3, 'match']);
  assert.deepEqual([row('occurrences').source, row('occurrences').imported, row('occurrences').status], [16, 16, 'match']);
  assert.equal(row('occurrences').exportedOfClaimed.claimedByRollbar, 45, 'occurrences Rollbar counts but did not export are named');
  assert.equal(row('stacks').status, 'match'); assert.equal(row('deploys').source, 3); assert.equal(row('deploys').imported, 2); assert.equal(row('deploys').status, 'explained');
  assert.equal(row('rules').source, 2); assert.equal(row('rules').imported, 0); assert.equal(row('rules').status, 'explained');
  // The comparison fails when an imported stack differs from its source.
  const tampered = JSON.parse(bytes); tampered.collections.find(c => c.kind === 'instances').pages[0].response.result.instances[2].data.body.trace.frames[0].lineno = 99;
  const tamperedFile = join(scratch, 'tampered.json'); await writeFile(tamperedFile, JSON.stringify(tampered));
  const mismatch = await cli('compare', '--project', 'web-app', '--plan', planned.planId, '--file', tamperedFile);
  assert.equal(mismatch.ok, false); assert.equal(mismatch.rows.find(r => r.aspect === 'stacks').differences.length, 1);
  // Source identity and conversion losses are visible in the owner's evidence.
  const regressed = byTitle('RangeError'), packet = await json(`/api/projects/${imported.id}/issues/${regressed.id}/packet`);
  assert.equal(packet.events.length, 2); assert.ok(packet.events.every(entry => entry.historical === true));
  assert.deepEqual(packet.events.map(entry => entry.event.eventId).sort(), ['bbbbbbbbbbbb4bbb8bbbbbbbbbbbbbb1', 'bbbbbbbbbbbb4bbb8bbbbbbbbbbbbbb2'], 'Rollbar occurrence uuids are the event identities');
  assert.ok(!JSON.stringify(packet).includes('PRIVATE_') && !JSON.stringify(packet).includes('IMPORT_SECRET'), 'person, request, custom data and code context stay out');
  const status = await cli('status', '--project', 'web-app', '--plan', planned.planId);
  assert.equal(status.undo.available, true);
  // Imported history causes no outbound work: no keys, alerts or alert rules.
  assert.equal((await json(`/api/projects/${imported.id}/keys`)).length, 0, 'imported projects have no credentials');
  assert.equal((await json(`/api/projects/${imported.id}/alerts`)).length, 0, 'historical occurrences and notification rules raise no alert');

  // Guarded undo: clean undo removes only the import; a native edit blocks a later one.
  assert.equal((await cli('undo', '--project', 'web-app', '--plan', planned.planId)).job.state, 'undone');
  assert.deepEqual(await json('/api/projects'), beforeProjects, 'undo removes only the imported graph');
  const second = join(scratch, 'project.json'); await writeFile(second, Buffer.concat([bytes, Buffer.from('\n')]), { mode: 0o600 });
  const secondPlan = await cli('dry-run', '--file', second);
  await cli('apply', '--project', 'web-app', '--plan', secondPlan.planId, '--fingerprint', secondPlan.fingerprint);
  const reimported = (await json('/api/projects')).find(project => !beforeProjects.some(before => before.id === project.id)), current = (await json(`/api/projects/${reimported.id}/issues`))[0];
  await json(`/api/projects/${reimported.id}/issues/${current.id}`, 'PATCH', { state: 'acknowledged', revision: current.revision });
  await assert.rejects(cli('undo', '--project', 'web-app', '--plan', secondPlan.planId), error => /HTTP 409/.test(error.message), 'guarded undo refuses to overwrite a native edit');
  assert.equal((await json(`/api/projects/${reimported.id}/issues`)).find(issue => issue.id === current.id).state, 'acknowledged', 'the native edit survives');

  // Replacement capture: the owner mints a key for the imported project and an unmodified Sentry SDK envelope lands as new live evidence beside the history.
  const key = await json(`/api/projects/${reimported.id}/keys`, 'POST', { kind: 'ingest' });
  const dsn = new URL(key.dsn), alias = dsn.pathname.slice(1);
  const liveEvent = { event_id: 'd'.repeat(32), release: 'web@1.2.0', environment: 'production', exception: { values: [{ type: 'TypeError', value: 'failed after cutover', stacktrace: { frames: [{ filename: 'https://app.example.test/app.js', lineno: 10, colno: 5, function: 'start' }] } }] } };
  const envelope = JSON.stringify({ event_id: liveEvent.event_id }) + '\n' + JSON.stringify({ type: 'event' }) + '\n' + JSON.stringify(liveEvent);
  const sent = await req(`/api/${alias}/envelope/?sentry_key=${key.key}&sentry_version=7`, 'POST', envelope, { Cookie: '' });
  assert.equal(sent.status, 200, 'the replacement DSN accepts a live event');
  const after = await json(`/api/projects/${reimported.id}/issues`);
  assert.equal(after.length, 4, 'the live failure is its own issue; imported history never merges with it');
  assert.deepEqual(after.map(issue => issue.count).sort((a, b) => a - b), [1, 2, 2, 12], 'imported counts are unchanged');
  const releases = await json(`/api/projects/${reimported.id}/releases`), list = Array.isArray(releases) ? releases : releases.releases;
  assert.deepEqual(list.map(release => release.name).sort(), ['web@1.0.0', 'web@1.1.0', 'web@1.2.0'], 'live release ordering continues after the imported releases');
  // The native archive carries the scrubbed history and its Rollbar identities, and restores without the private journal or any grant.
  const nativeArchive = await (await req('/api/archive')).arrayBuffer();
  const restored = await startTestWorker(15596);
  try {
    const restoredCookie = await signIn(restored.origin);
    const response = await fetch(restored.origin + '/api/restore', { method: 'POST', headers: { Origin: restored.origin, Cookie: restoredCookie, 'X-Confirm-Restore': 'yes', 'Content-Type': 'application/x-ndjson' }, body: nativeArchive });
    assert.equal(response.status, 200, 'a native archive restores imported Rollbar history');
    const restoredData = (await archiveProjection(await fetch(restored.origin + '/api/archive', { headers: { Cookie: restoredCookie } }))).data, archived = (await archiveProjection(new Response(nativeArchive))).data;
    assert.deepEqual(restoredData.issues, archived.issues); assert.deepEqual(restoredData.events, archived.events); assert.deepEqual(restoredData.sentry_import_targets, archived.sentry_import_targets);
    assert.ok(archived.events.filter(event => event.historical === 1).length === 16);
  } finally { await restored.stop(); }
  // Project erasure withdraws the project's private export bytes with it, and leaves unrelated projects alone.
  const heldBefore = await rollbarDoorClient({ endpoint: origin, cookie, project: 'web-app' }).call('uploads', { uploadId: secondPlan.uploadId });
  assert.equal(heldBefore.bundleSha256, createHash('sha256').update(await readFile(second)).digest('hex'), 'the exact private export bytes are held before erasure');
  const preview = await json(`/api/projects/${reimported.id}/erasure`);
  const erased = await req(`/api/projects/${reimported.id}/erasure`, 'POST', { confirm: reimported.id, planHash: preview.planHash });
  assert.equal(erased.status, 202, `erasure: HTTP ${erased.status}`);
  let receipt = await erased.json();
  for (let step = 0; step < 20 && receipt.phase !== 'complete'; step++) receipt = await json(`/api/erasures/${receipt.id}/resume`, 'POST');
  assert.equal(receipt.phase, 'complete', 'erasure completes through its resumable steps');
  assert.ok(!(await json('/api/projects')).some(project => project.id === reimported.id), 'the erased project is gone');
  const heldAfter = await rollbarDoorClient({ endpoint: origin, cookie, project: 'web-app' }).call('uploads', { uploadId: secondPlan.uploadId }).catch(error => ({ refused: error.status }));
  assert.ok(heldAfter.refused || (heldAfter.complete === false && heldAfter.received.length === 0), 'the private export bytes went with the project: ' + JSON.stringify(heldAfter));
  assert.equal((await req(`/api/projects/${native.id}/issues`)).status, 200, 'an unrelated project is untouched');
  console.log('Rollbar import passed through the import door: no-write plan with named conversion losses, reviewed apply, interrupted apply resumed by a new owner session, count, stack, deploy and rule comparison, inert history, guarded undo and live replacement capture. Synthetic export only.');
} finally { await worker.close(); await rm(scratch, { recursive: true, force: true }); delete process.env.SPOOL_TEST_SESSION; }
