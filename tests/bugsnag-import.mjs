import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { startTestWorker } from './worker.mjs';
import { signIn } from './auth.mjs';
import { archiveProjection } from './archive.mjs';
import { followErasure } from './project-erasure/follow.mjs';
import { sdkPath, runNode } from './sentry-cli/sdk.mjs';
import { runCli } from './sentry-cli/cli.mjs';
import { bugsnagImportCli } from '../scripts/bugsnag-import.mjs';

// MIG-004: a web and a mobile Bugsnag project in the Data Access API's documented
// response format, imported through the one owner import door. Synthetic export only.
const worker = await startTestWorker(15527), { origin } = worker;
const scratch = await mkdtemp(join(tmpdir(), 'spool-bugsnag-import-'));
try {
  const cookie = await signIn(origin);
  const req = (path, method = 'GET', value, headers = {}) => fetch(origin + path, { method, headers: { Origin: origin, Cookie: cookie, ...value ? { 'Content-Type': 'application/json' } : {}, ...headers }, ...value ? { body: JSON.stringify(value) } : {} });
  const json = async (path, method, value, headers) => { const response = await req(path, method, value, headers); assert.ok(response.ok, `${method ?? 'GET'} ${path}: HTTP ${response.status}`); return response.json(); };
  const cli = (...args) => { process.env.SPOOL_TEST_SESSION = cookie; return bugsnagImportCli([args[0], '--endpoint', origin, '--session-env', 'SPOOL_TEST_SESSION', ...args.slice(1)]); };
  const fixture = new URL('./fixtures/bugsnag/organization.json', import.meta.url), bytes = await readFile(fixture);
  const native = await json('/api/projects', 'POST', { id: 'native', name: 'Untouched native project' }), beforeProjects = await json('/api/projects');
  const archiveBefore = await archiveProjection(await req('/api/archive'));

  // A source that says it holds no sessions voids every rate, even where counts are present.
  const declared = JSON.parse(bytes); declared.omissions.push('Historical sessions are not available from this export.');
  const declaredFile = join(scratch, 'declared.json'); await writeFile(declaredFile, JSON.stringify(declared), { mode: 0o600 });
  const declaredPlan = await cli('dry-run', '--file', declaredFile);
  assert.ok(declaredPlan.vendor.stability.releases.every(row => row.sessions.crashFreeRate === null && row.sessions.reasonCode === 'historical_sessions_missing'));
  assert.equal((await json('/api/operator/import/undo', 'POST', { planId: declaredPlan.planId }, { 'X-Import-Source': declaredPlan.namespace })).state, 'cancelled');

  // Review: nothing is written; unmigratable artifacts are named; event and session denominators stay apart.
  let planned = await cli('dry-run', '--file', fixture.pathname);
  assert.equal(planned.namespace, 'bugsnag-org:fixture-org');
  assert.equal(planned.counts.rejected, 0);assert.equal(planned.counts.effects, 15);
  assert.deepEqual(await json('/api/projects'), beforeProjects, 'planning writes no native project');
  assert.deepEqual((await archiveProjection(await req('/api/archive'))).data, archiveBefore.data, 'planning mutates no native or journal data');
  const facts = planned.vendor;
  assert.deepEqual(facts.reconciliation.errors, { source: 4, imported: 4, rejected: 0 });
  assert.deepEqual(facts.reconciliation.events, { sourceTotal: 59, exported: 6, imported: 6, rejected: 0, unhandledImported: 4 });
  assert.deepEqual(facts.reconciliation.byError.map(row => [row.sourceTotal, row.imported, row.status]), [[40, 2, 'sampled'], [2, 2, 'reconciled'], [5, 0, 'sampled'], [12, 2, 'sampled']]);
  assert.deepEqual(facts.unmigratable.map(row => row.kind).sort(), ['collaborators', 'integrations', 'stability', 'symbols']);
  const rates = facts.stability.releases.map(row => [row.project, row.release, row.stage, row.sessions.total, row.sessions.crashFreeRate, row.sessions.reasonCode]);
  assert.deepEqual(rates, [['web-app', 'web@1.0.0', 'production', 1200, 98.5, null], ['web-app', 'web@1.1.0', 'production', 800, 99.5, null], ['web-app', 'web@1.1.0', 'staging', 50, 98, null], ['ios-app', '5.2.0', 'production', null, null, 'historical_sessions_missing']],
    'the mobile project exported no sessions: its gap is named and no crash-free rate is invented');
  assert.deepEqual(facts.stability.timeline.map(row => [row.project, row.stage, row.points, row.sessions.total, row.sessions.crashFreeRate]), [['web-app', 'production', 2, 2000, 98.9]], 'the documented stability response object reconciles with the production release rows (1200 + 800 sessions)');
  assert.ok(planned.reasonLabels.historical_sessions_missing);
  assert.deepEqual(facts.cutover.map(row => [row.project, row.surface, row.symbols.map(sym => [sym.type, sym.status, sym.command])]), [['web-app', 'web', [['sourcemap', 'repoint', 'spool-sourcemaps']]], ['ios-app', 'mobile', [['dsym', 'repoint', 'sentry-cli debug-files upload']]]], 'the review names where each symbol upload goes, native dSYM included');
  assert.ok(!JSON.stringify(planned).includes('Fixture User') && !JSON.stringify(planned.vendor).includes('user-1'), 'affected-user identities never reach the review');
  // Apply needs the reviewed fingerprint and is repeatable.
  let base = ['--organization', 'fixture-org', '--plan', planned.planId];
  const wrong = (planned.fingerprint[0] === '0' ? '1' : '0') + planned.fingerprint.slice(1);
  await assert.rejects(cli('apply', ...base, '--fingerprint', wrong), error => /HTTP 403/.test(error.message), 'an unreviewed fingerprint is refused');
  let { job } = await cli('apply', ...base, '--fingerprint', planned.fingerprint); assert.equal(job.state, 'completed');
  assert.equal((await cli('apply', ...base, '--fingerprint', planned.fingerprint)).job.id, job.id, 'repeating apply answers the same durable job');
  const report = await cli('reconcile', ...base);
  assert.equal(report.ok, true);assert.deepEqual(report.counts.byKind, { project: 2, release: 3, issue: 4, event: 6 });
  assert.deepEqual(report.vendor.reconciliation, facts.reconciliation, 'reconcile repeats the reviewed denominators');

  // What the owner sees in Spool matches the source: counts, states, releases, original stacks, no identities.
  const projects = await json('/api/projects'), imported = projects.filter(p => !beforeProjects.some(b => b.id === p.id));
  assert.equal(imported.length, 2);
  const issuesOf = async id => json(`/api/projects/${id}/issues`);
  const all = await Promise.all(imported.map(async p => ({ project: p.id, issues: await issuesOf(p.id) })));
  const issues = all.flatMap(row => row.issues.map(issue => ({ ...issue, project: row.project })));
  assert.deepEqual(issues.map(i => [i.title.split(':')[0], i.state, i.count]).sort(), [['NSInvalidArgumentException', 'open', 12], ['RangeError', 'suppressed', 5], ['ReferenceError', 'resolved', 2], ['TypeError', 'open', 40]]);
  const packetOf = async issue => json(`/api/projects/${issue.project}/issues/${issue.id}/packet`);
  const mobile = issues.find(i => i.title.startsWith('NSInvalid')), web = issues.find(i => i.title.startsWith('TypeError'));
  const mobilePacket = await packetOf(mobile);
  assert.equal(mobilePacket.events.length, 2);assert.ok(mobilePacket.events.every(e => e.historical === true));
  // Both exports of the iOS error show the same original native stack, whether the notifier sent snake_case fields or camelCase ones (errorClass, frameAddress, bundleVersion).
  for (const e of mobilePacket.events) {
    const exception = e.event.sentry.exceptions[0], crash = exception.stacktrace.frames.at(-1);
    assert.equal(exception.type, 'NSInvalidArgumentException', 'the exception type survives conversion');
    assert.deepEqual([crash.package, crash.function, crash.instruction_addr, crash.symbol_addr, crash.image_addr, crash.in_app], ['MyApp', '-[CheckoutController submitOrder:]', '0x100a3f1c4', '0x100a3f100', '0x100a00000', true], 'the original native stack shows exactly as the notifier sent it');
    assert.deepEqual([e.event.release, e.event.build, e.event.environment], ['5.2.0', '1142', 'production']);
  }
  const webPacket = await packetOf(web);
  for (const e of webPacket.events) assert.deepEqual(e.event.frames.map(f => [f.line, f.column]), [[1, 4820], [1, 901]], 'line and column coordinates survive whether the export typed them as numbers or digit strings');
  assert.ok(!JSON.stringify([webPacket, mobilePacket]).includes('Fixture User') && !JSON.stringify([webPacket, mobilePacket]).includes('user-1'));
  const webProject = web.project, mobileProject = mobile.project;
  assert.deepEqual((await json(`/api/projects/${webProject}/releases`)).map(r => [r.name, r.seq, r.build]), [['web@1.0.0', 1, '[sentry:no-dist]'], ['web@1.1.0', 2, '[sentry:no-dist]']], 'one release per version, ordered by first release time');
  for (const id of [webProject, mobileProject]) {
    assert.equal((await json(`/api/projects/${id}/keys`)).length, 0, 'imported projects have no credentials');
    assert.equal((await json(`/api/projects/${id}/alerts`)).length, 0, 'imported history sends no alerts');
  }

  // Undo removes exactly the imported graph; the same export then imports again as a fresh plan.
  assert.equal((await cli('undo', ...base)).job.state, 'undone');
  assert.deepEqual(await json('/api/projects'), beforeProjects, 'undo leaves the native projects as they were');
  planned = await cli('dry-run', '--file', fixture.pathname);
  base = ['--organization', 'fixture-org', '--plan', planned.planId];
  ({ job } = await cli('apply', ...base, '--fingerprint', planned.fingerprint)); assert.equal(job.state, 'completed');
  assert.deepEqual((await json('/api/projects')).map(p => p.id).sort(), projects.map(p => p.id).sort(), 'reimport restores the same native identities');

  // Cutover, web: Spool's own symbol upload and an unmodified Sentry SDK with only the DSN changed.
  const deploy = await json(`/api/projects/${webProject}/keys`, 'POST', { kind: 'deploy' }), ingest = await json(`/api/projects/${webProject}/keys`, 'POST', { kind: 'ingest' });
  const entry = join(scratch, 'checkout.mjs'), out = join(scratch, 'app.mjs');
  await writeFile(entry, `import * as Sentry from ${JSON.stringify(sdkPath)};\nSentry.init({dsn:process.env.DSN,release:'web@2.0.0',dist:'b1',environment:'production',defaultIntegrations:false});\nfunction renderCheckout(cart){\n  return cart.items.total;\n}\ntry{renderCheckout({})}catch(e){Sentry.captureException(e)}\nawait Sentry.flush(5000);\n`);
  await build({ entryPoints: [entry], outfile: out, bundle: true, platform: 'node', format: 'esm', minify: true, sourcemap: true, external: [sdkPath], logLevel: 'silent' });
  const uploaded = await new Promise((done, fail) => {
    const child = spawn(process.execPath, [resolve('packages/sdk/src/sourcemaps/bin.mjs'), '--endpoint', origin, '--project', webProject, '--release', 'web@2.0.0', '--build', 'b1', '--key-env', 'SPOOL_TEST_DEPLOY', out], { env: { ...process.env, SPOOL_TEST_DEPLOY: deploy.key }, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = ''; child.stdout.on('data', d => text += d); child.stderr.on('data', d => text += d);
    child.on('close', code => code === 0 ? done(JSON.parse(text)) : fail(new Error(text)));
  });
  assert.equal(uploaded.uploaded, 1, 'symbol CI repoints: the source map uploads to Spool with only a deploy key');
  await runNode(out, { DSN: ingest.dsn });
  const live = (await issuesOf(webProject)).find(i => i.title.includes('items') || i.title.includes('total') && i.id !== web.id);
  assert.ok(live, 'the unmodified SDK sends to Spool after only the DSN changed');
  const livePacket = await packetOf({ ...live, project: webProject });
  assert.equal(livePacket.events[0].historical, false);
  assert.ok(livePacket.events[0].currentLookup.some(frame => frame.status === 'mapped' && /checkout\.mjs$/.test(frame.original?.file ?? frame.original?.path ?? '')), 'the live error resolves to original source through the uploaded map');
  assert.deepEqual((await json(`/api/projects/${webProject}/releases`)).map(r => r.name), ['web@1.0.0', 'web@1.1.0', 'web@2.0.0']);

  // Cutover, mobile: a mobile SDK's native event under the imported release identity joins it, and its native stack shows.
  const mobileIngest = await json(`/api/projects/${mobileProject}/keys`, 'POST', { kind: 'ingest' }), alias = new URL(mobileIngest.dsn).pathname.slice(1);
  const nativeEvent = { event_id: 'c'.repeat(32), release: '5.2.0', dist: '1142', environment: 'production', platform: 'cocoa', exception: { values: [{ type: 'NSInvalidArgumentException', value: '-[NSNull length]: unrecognized selector', stacktrace: { frames: [
    { package: 'UIKitCore', function: '-[UIApplication sendAction:to:from:forEvent:]', instruction_addr: '0x1b2c3d4e5', image_addr: '0x1b2000000', in_app: false },
    { package: 'MyApp', function: '-[CheckoutController submitOrder:]', instruction_addr: '0x100a3f1c4', image_addr: '0x100a00000', in_app: true }] } }] } };
  const envelope = JSON.stringify({ event_id: nativeEvent.event_id }) + '\n' + JSON.stringify({ type: 'event' }) + '\n' + JSON.stringify(nativeEvent);
  const sent = await fetch(`${origin}/api/${alias}/envelope/?sentry_key=${mobileIngest.key}&sentry_version=7`, { method: 'POST', body: envelope });
  assert.equal(sent.status, 200, JSON.stringify(await sent.clone().json().catch(() => null)));
  const liveIssue = (await issuesOf(mobileProject)).find(i => i.id !== mobile.id);
  assert.ok(liveIssue, 'the repointed mobile capture is a live issue beside the imported history');
  const liveMobile = (await packetOf({ ...liveIssue, project: mobileProject })).events[0];
  assert.equal(liveMobile.historical, false);assert.deepEqual([liveMobile.event.release, liveMobile.event.build], ['5.2.0', '1142']);
  assert.equal(liveMobile.event.sentry.exceptions[0].stacktrace.frames.at(-1).instruction_addr, '0x100a3f1c4', 'the live native stack shows beside the imported one');
  assert.equal((await json(`/api/projects/${mobileProject}/releases`)).length, 1, 'the SDK reuses the imported release identity instead of duplicating it');

  // Cutover, mobile symbol CI: the unmodified sentry-cli uploads the build's native debug file with only the Spool URL, project and deploy key changed.
  const symbolDir = join(scratch, 'native'); await mkdir(symbolDir);
  await writeFile(join(symbolDir, 'app.c'), '#include <stdio.h>\nint add(int a, int b) { return a + b; }\nint main(void) { printf("%d\\n", add(1, 2)); return 0; }\n');
  execFileSync('gcc', ['-g', ...process.platform === 'darwin' ? [] : ['-Wl,--build-id'], '-o', join(symbolDir, 'app'), join(symbolDir, 'app.c')]);
  const mobileDeploy = await json(`/api/projects/${mobileProject}/keys`, 'POST', { kind: 'deploy' });
  const symbolUpload = await runCli(['debug-files', 'upload', symbolDir], { origin, token: mobileDeploy.key, project: mobileProject });
  assert.equal(symbolUpload.code, 0, symbolUpload.output);
  const debugFiles = (await json(`/api/projects/${mobileProject}/sentry-uploads`)).debugFiles;
  assert.ok(debugFiles.length > 0 && debugFiles.every(row => row.size > 0 && ['macho', 'elf'].includes(row.kind)), 'the mobile project keeps the native debug file its CI uploaded');
  assert.equal((await json(`/api/projects/${webProject}/sentry-uploads`)).debugFiles.length, 0, 'debug files belong to the project whose key uploaded them');

  // A native edit is never overwritten: undo stops on it and names why.
  const edited = (await issuesOf(webProject)).find(i => i.id === web.id);
  await json(`/api/projects/${webProject}/issues/${edited.id}`, 'PATCH', { state: 'acknowledged', revision: edited.revision });
  const blocked = await cli('status', ...base);
  assert.equal(blocked.undo.available, false);assert.ok(blocked.undo.blockers.some(row => row.reasonCode === 'native_edit_conflict'));
  await assert.rejects(cli('undo', ...base), error => /HTTP 409/.test(error.message), 'guarded undo refuses to overwrite a native edit');
  assert.equal((await issuesOf(webProject)).find(i => i.id === web.id).state, 'acknowledged', 'guarded undo preserves the native edit');

  // Resume: the stopped undo is one durable job, readable by any later request.
  assert.equal((await cli('status', ...base)).job.state, 'undoing', 'the stopped undo stays one durable job a new request can resume');

  // Erasure: erasing one imported project withdraws the private source custody of the bundle that named it.
  const projectPath = `/api/projects/${mobileProject}`, preview = await json(projectPath + '/erasure');
  assert.ok(preview.deleted.ik_door_uploads > 0, 'the preview counts the Bugsnag bundle custody for this project');
  const accepted = await json(projectPath + '/erasure', 'POST', { confirm: mobileProject, planHash: preview.planHash });
  await followErasure(async (path, method) => json(path, method), accepted);
  assert.equal((await json('/api/projects')).some(p => p.id === mobileProject), false);
  await assert.rejects(cli('status', ...base), error => error.status === 404, 'the erased project took the whole bundle lineage with it');
  assert.equal((await json('/api/imports/business')).history.some(row => row.planId === planned.planId), false, 'history keeps no readable copy of the erased source');
  console.log('MIG-004 Bugsnag import passed through the import door: review denominators and named session gap, reviewed apply, reconcile, native stack, symbol upload and SDK repoint, resume and erasure. Synthetic export only.');
} finally { await worker.stop(); await rm(scratch, { recursive: true, force: true }); delete process.env.SPOOL_TEST_SESSION; }
