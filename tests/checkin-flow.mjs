import {untippedIconButtons} from './navigation.mjs';
// [SDK-024] Sentry cron check-ins routed to an Uptime heartbeat, through the real Worker, intake, owner API and UI.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';
import AxeBuilder from '@axe-core/playwright';
import { alertRuntime } from './alerts/runtime.mjs';
import { archiveProjection } from './archive.mjs';
import { browserSignIn } from './auth.mjs';
import { followErasure } from './project-erasure/follow.mjs';
import { startTestWorker } from './worker.mjs';
import { signIn } from './auth.mjs';
import { parseEnvelope } from '../src/domain/sentry/wire.ts';

const require = createRequire(import.meta.url);
const connected = 'synthetic-spool-nightly', unconnected = 'synthetic-spool-unconnected', ui = 'synthetic-spool-ui';
const heartbeat = 'https://uptime.synthetic-spool.example/api/heartbeats/synthetic-spool-monitor-1/url/syntheticspooltoken0001';
const capabilityPart = heartbeat.split('/').at(-1);
const release = 'synthetic-spool-checkin@1.0.0';
const pause = ms => new Promise(done => setTimeout(done, ms));
const envelope = (items, header = {}) => [JSON.stringify(header), ...items.flatMap(({ type, payload }) => { const body = typeof payload === 'string' ? payload : JSON.stringify(payload); return [JSON.stringify({ type, length: Buffer.byteLength(body) }), body]; })].join('\n') + '\n';
const checkIn = (slug, status, extra = {}) => ({ type: 'check_in', payload: { check_in_id: crypto.randomUUID().replaceAll('-', ''), monitor_slug: slug, status, ...extra } });
const event = id => ({ type: 'event', payload: { event_id: id, release, environment: 'compatibility', platform: 'node', exception: { values: [{ type: 'Error', value: 'synthetic companion error' }] } } });

export async function checkInFlow({ browser }) {
 const temporary = await mkdtemp(resolve(tmpdir(), 'spool-checkin-')), wires = [], receiver = { status: 200, lateMs: 0 };
 let app, collector, destination, upgrade;
 try {
  // The receiver is a recorded double of Uptime's documented heartbeat door at the egress edge only.
  app = await alertRuntime({ url: 'http://127.0.0.1:1' }, { extraBindings: { CHECKIN_FORWARD_TIMEOUT_MS: '300' }, egressBridge: async wire => {
   wires.push(wire); if (receiver.lateMs) await pause(receiver.lateMs);
   return { status: receiver.status, headers: {}, body: '' };
  } });
  const { origin } = app, json = (path, method, body) => app.json(path, method, body), counts = async project => Object.fromEntries((await json(`/api/projects/${project}/outcomes`)).rows.map(row => [row.reason, row.count]));
  const project = await json('/api/projects', 'POST', { id: 'synthetic-spool-cron', name: 'Cron check-ins' }), id = project.id;
  const dsn = new URL(project.dsn), post = async (body, { query = `sentry_key=${dsn.username}&sentry_version=7`, headers = {}, alias = dsn.pathname.slice(1) } = {}) => {
   const response = await fetch(`${origin}/api/${alias}/envelope/?${query}`, { method: 'POST', headers: { 'content-type': 'application/x-sentry-envelope', ...headers }, body });
   return { status: response.status, body: await response.json() };
  };
  const route = `/api/projects/${id}/check-in-routes`;
  // Owner door: capability URL validated, masked on every read, owner-only.
  assert.equal((await fetch(origin + `${route}/${connected}`, { method: 'PUT', headers: { 'content-type': 'application/json', Origin: origin }, body: JSON.stringify({ url: heartbeat, enabled: true }) })).status, 401, 'connections need the owner session');
  for (const url of ['http://uptime.synthetic-spool.example/api/heartbeats/m/url/syntheticspooltoken0001', `${heartbeat}?x=1`, 'https://uptime.synthetic-spool.example/api/heartbeats/synthetic-spool-monitor-1', 'https://localhost/api/heartbeats/m/url/syntheticspooltoken0001'])
   assert.equal((await app.request(`${route}/${connected}`, 'PUT', { url, enabled: true })).status, 400, 'only an https Uptime capability URL is accepted');
  assert.deepEqual((await json(route)).connections, [], 'no connection means forwarding is off');
  const saved = await json(`${route}/${connected}`, 'PUT', { url: heartbeat, enabled: true });
  assert.equal(saved.connections[0].host, 'uptime.synthetic-spool.example'); assert.equal(saved.egress, true);
  const readAll = JSON.stringify([saved, await json(route)]); assert.ok(!readAll.includes(capabilityPart) && !readAll.includes('synthetic-spool-monitor-1'), 'the capability URL is never returned');

  // (i)+(ii) the identical unmodified Node SDK program against the reference collector and against Spool; only the DSN differs.
  const referenceItems = [];
  collector = createServer(async (req, res) => { const chunks = []; for await (const chunk of req) chunks.push(chunk); const raw = Buffer.concat(chunks); referenceItems.push(...parseEnvelope(req.headers['content-encoding'] === 'gzip' ? gunzipSync(raw) : raw).items); res.setHeader('content-type', 'application/json'); res.end('{}'); });
  await new Promise(done => collector.listen(0, '127.0.0.1', done));
  const program = resolve(temporary, 'monitor.mjs');
  await writeFile(program, `import * as Sentry from ${JSON.stringify(require.resolve('@sentry/node'))};
Sentry.init({dsn:process.env.FIXTURE_DSN,release:${JSON.stringify(release)},environment:'compatibility'});
const pause=ms=>new Promise(done=>setTimeout(done,ms));
await Sentry.withMonitor(${JSON.stringify(connected)},async()=>{await pause(200)});
try{await Sentry.withMonitor(${JSON.stringify(connected)},async()=>{await pause(200);try{null.synthetic}catch(error){Sentry.captureException(error);throw error}},{schedule:{type:'crontab',value:'0 2 * * *'},checkinMargin:5,maxRuntime:10,isolateTrace:true})}catch{}
await Sentry.withMonitor(${JSON.stringify(unconnected)},async()=>{await pause(200)});
await Sentry.flush(10000);await Sentry.close(10000);
`);
  const execute = target => new Promise((done, fail) => { const child = spawn(process.execPath, [program], { env: { ...process.env, FIXTURE_DSN: target }, stdio: 'ignore' }); child.once('error', fail); child.once('exit', code => code === 0 ? done() : fail(new Error(`Node SDK exited ${code}`))); });
  await execute(`http://reference@127.0.0.1:${collector.address().port}/1`);
  assert.deepEqual(referenceItems.filter(item => item.header.type === 'check_in').map(item => JSON.parse(Buffer.from(item.bytes)).status), ['in_progress', 'ok', 'in_progress', 'error', 'in_progress', 'ok'], 'the unmodified SDK sends start and finish check-ins');
  const sdkItem = referenceItems.filter(item => item.header.type === 'check_in').map(item => JSON.parse(Buffer.from(item.bytes))).find(item => item.monitor_config);
  assert.ok(sdkItem.contexts.trace.trace_id, 'the SDK stamps the check-in with its trace');
  const before = await counts(id), forwardedBefore = wires.length;
  await execute(project.dsn);
  const after = await counts(id), delta = reason => (after[reason] ?? 0) - (before[reason] ?? 0);
  assert.deepEqual(wires.slice(forwardedBefore).map(wire => new URL(wire.url).pathname.replace(/^.*\/url\/[^/]+/, '')), ['/start', '/success', '/start', '/fail'], 'the receiver sees start then success, then start then failure, in order');
  for (const wire of wires.slice(forwardedBefore)) { assert.ok(wire.url.startsWith(heartbeat + '/')); assert.equal(wire.body, '{}'); assert.deepEqual(Object.keys(wire.headers), ['content-type']); assert.ok(!JSON.stringify(wire).includes(connected) && !JSON.stringify(wire).includes('compatibility'), 'no Sentry field is forwarded'); }
  assert.equal(delta('check_in_routed'), 4); assert.equal(delta('check_in_unrouted'), 2, 'the unconnected monitor is counted unrouted');
  assert.equal(after.sentry_unsupported_check_in, undefined, 'check-ins are no longer counted as unsupported');
  assert.equal(delta('accepted'), 1, 'only the error is an accepted unit; check-ins create no occurrence');
  assert.equal(wires.slice(forwardedBefore).some(wire => /unconnected/.test(wire.url)), false, 'nothing is sent for an unconnected monitor');

  // (iii) the job's error and the truthful link (the shared trace id), through the API.
  const [issue] = await json(`/api/projects/${id}/issues`), packet = await json(`/api/projects/${id}/issues/${issue.id}/packet`), occurrence = packet.events[0];
  assert.equal(issue.count, 1);
  const detail = await json(`/api/projects/${id}/issues/${issue.id}/events/${occurrence.id}?occurrence=${occurrence.occurrence}`);
  assert.ok(detail.checkIns.length && detail.checkIns.every(row => row.monitor === connected) && detail.checkIns.some(row => row.status === 'error' && row.outcome === 'check_in_routed'), 'the occurrence names the check-in that shares its trace');
  assert.deepEqual((await app.db.prepare('SELECT DISTINCT trace_id FROM checkin_links WHERE project=? AND slug=? AND status=?').bind(id, connected, 'error').all()).results.map(row => row.trace_id), [detail.event.sentry.contexts.trace.trace_id], 'the link is the trace id the error and the check-in share');

  // (iv) refusals and failures: each creates no forward where it must not, and is counted; other items still arrive.
  const sent = () => wires.length, counted = () => counts(id);
  let c0 = await counted(), w0 = sent();
  let result = await post(envelope([checkIn(unconnected, 'ok'), event('a'.repeat(32))], { event_id: 'a'.repeat(32) }));
  assert.equal(result.status, 200); assert.deepEqual(result.body.checkIns, { check_in_unrouted: 1 }); assert.equal(result.body.id, 'a'.repeat(32), 'the same envelope’s error is unaffected');
  assert.equal(sent(), w0);
  await json(`${route}/${connected}`, 'PUT', { enabled: false });
  result = await post(envelope([checkIn(connected, 'ok')])); assert.deepEqual(result.body.checkIns, { check_in_disabled: 1 }); assert.equal(sent(), w0, 'a disabled connection sends nothing');
  await json(`${route}/${connected}`, 'PUT', { enabled: true });
  result = await post(envelope([checkIn(connected, 'ok')]), { headers: { 'x-fixture-unconfigured': 'egress' } }); assert.deepEqual(result.body.checkIns, { check_in_egress_unconfigured: 1 }); assert.equal(sent(), w0, 'without egress nothing is sent by any other path');
  result = await post(envelope([{ type: 'check_in', payload: { monitor_slug: connected, status: 'ok', check_in_id: 'b'.repeat(32), monitor_config: { schedule: { value: 'x'.repeat(110000) } } } }, checkIn(connected, 'in_progress')]));
  assert.deepEqual(result.body.checkIns, { check_in_item_too_large: 1, check_in_routed: 1 }, 'an oversized item is refused alone'); assert.equal(sent(), w0 + 1);
  result = await post(envelope([{ type: 'check_in', payload: { monitor_slug: 'not a slug', status: 'ok', check_in_id: 'c'.repeat(32) } }])); assert.deepEqual(result.body.checkIns, { check_in_invalid: 1 });
  receiver.status = 500; w0 = sent();
  result = await post(envelope([checkIn(connected, 'error'), event('d'.repeat(32))], { event_id: 'd'.repeat(32) })); assert.equal(result.status, 200); assert.deepEqual(result.body.checkIns, { check_in_forward_failed: 1 }); assert.equal(result.body.id, 'd'.repeat(32)); assert.equal(sent(), w0 + 1, 'one attempt, no retry');
  receiver.status = 200; receiver.lateMs = 1200;
  result = await post(envelope([checkIn(connected, 'ok'), event('e'.repeat(32))], { event_id: 'e'.repeat(32) })); assert.deepEqual(result.body.checkIns, { check_in_forward_failed: 1 }, 'a receiver that does not answer in time is a counted failure'); assert.equal(result.body.id, 'e'.repeat(32));
  receiver.lateMs = 0; await pause(1300);
  const filtered = await post(envelope([checkIn(connected, 'ok')]), { headers: { 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' } }); assert.deepEqual(filtered.body.checkIns, { check_in_refused: 1 }, 'an enabled inbound filter applies to check-ins');
  const foreign = await post(envelope([checkIn(connected, 'ok')]), { headers: { origin: 'https://not-allowed.synthetic-spool.example' } }); assert.equal(foreign.status, 403, 'a disallowed Origin is refused before acceptance');
  const revokedKey = await json(`/api/projects/${id}/keys`, 'POST', { kind: 'ingest' });
  await json(`/api/projects/${id}/keys/${revokedKey.hash}`, 'DELETE');
  const keyed = async key => post(envelope([checkIn(connected, 'ok')]), { query: `sentry_key=${key}&sentry_version=7` });
  const unknownStatus = await keyed('a'.repeat(32)), revokedStatus = await keyed(revokedKey.key);
  assert.deepEqual([unknownStatus.status, unknownStatus.body], [revokedStatus.status, revokedStatus.body], 'unknown and revoked keys answer identically'); assert.equal(unknownStatus.status, 401);
  const c1 = await counted(); assert.ok(c1.filtered > (c0.filtered ?? 0)); assert.ok((c1.rate_limited ?? 0) === (c0.rate_limited ?? 0));
  const forwardedAfterRefusals = wires.filter(wire => wire.url.startsWith(heartbeat)).length; assert.equal(forwardedAfterRefusals, wires.length);

  // The screens, at desktop and phone width.
  await mkdir('.artifacts/sdk024', { recursive: true });
  for (const width of [1440, 390]) {
   const context = await browser.newContext({ viewport: { width, height: 1000 } }), owner = await context.newPage();
   try {
    await browserSignIn(owner, origin);
    const check = async (name, scope, shot) => {
     assert.equal(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${name} at ${width}: no horizontal overflow`);
     assert.deepEqual((await (scope ? new AxeBuilder({ page: owner }).include(scope) : new AxeBuilder({ page: owner })).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact)), [], `${name} at ${width}: no serious Axe finding`);
     assert.deepEqual(await untippedIconButtons(owner), [], 'every icon-only control on the touched screen carries the shared tooltip');
     await shot.screenshot({ path: `.artifacts/sdk024/${name}-${width}.png` });
    };
    await owner.goto(`${origin}/projects/${id}/settings`);
    const panel = owner.getByRole('region', { name: 'Cron check-ins', exact: true });
    await panel.locator('code', { hasText: connected }).first().waitFor();
    await panel.getByLabel('Monitor slug', { exact: true }).fill(ui);
    await panel.getByLabel('Uptime heartbeat capability URL', { exact: true }).fill(heartbeat.replace('0001', '0002'));
    await panel.getByRole('button', { name: 'Connect monitor', exact: true }).click();
    await panel.getByRole('status').filter({ hasText: `Connected ${ui}.` }).waitFor();
    assert.ok(!(await owner.content()).includes('syntheticspooltoken000'), 'the capability URL is not rendered after save');
    await check('check-in-settings', undefined, panel);
    await panel.getByRole('button', { name: `Remove ${ui}`, exact: true }).click(); await panel.getByRole('status').filter({ hasText: `Removed ${ui}.` }).waitFor();
    await owner.goto(`${origin}/projects/${id}/capture`); await owner.getByText('Cron check-in forwarded to Uptime', { exact: false }).waitFor(); await owner.getByText('Cron check-in unrouted', { exact: false }).first().waitFor();
    await check('check-in-receipts', undefined, owner.locator('dl').filter({ hasText: 'Cron check-in' }).first());
    await owner.goto(`${origin}/projects/${id}/issues/${issue.id}`); await owner.getByRole('heading', { name: 'Cron check-ins on this trace', exact: true }).waitFor(); await owner.getByText(connected).first().waitFor();
    // The issue view's existing SDK-context blocks are not part of this change; the new section is what is checked here.
    await check('check-in-occurrence', '[aria-label="Cron check-ins on this trace"]', owner.getByRole('region', { name: 'Cron check-ins on this trace' }));
   } finally { await context.close(); }
  }

  // (v) custody: no capability URL in any archive; a restore carries no connection; erasure removes both tables.
  const archived = await archiveProjection(await fetch(origin + '/api/archive', { headers: { Cookie: app.cookie, Origin: origin } }));
  assert.ok(!archived.text.includes(capabilityPart) && !archived.text.includes('synthetic-spool-monitor-1'), 'no capability URL is exported'); assert.equal(archived.data.checkin_routes, undefined);
  try {
   destination = await startTestWorker(15523); const destinationCookie = await signIn(destination.origin), headers = { Origin: destination.origin, Cookie: destinationCookie };
   const restored = await fetch(destination.origin + '/api/restore', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/x-ndjson', 'X-Confirm-Restore': 'yes' }, body: archived.text });
   assert.equal(restored.status, 200); await restored.body.cancel();
   const routes = await (await fetch(destination.origin + route, { headers })).json(); assert.deepEqual(routes.connections, [], 'a restored project has no connection and sends nothing until the owner reconnects');
  } finally { await destination?.stop(); }
  const stored = table => app.db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE project=?`).bind(id).first().then(row => row.n);
  assert.ok(await stored('checkin_routes') > 0 && await stored('checkin_links') > 0);
  const preview = await json(`/api/projects/${id}/erasure`);
  assert.equal((await followErasure(app.json, await json(`/api/projects/${id}/erasure`, 'POST', { confirm: id, planHash: preview.planHash }))).phase, 'complete');
  assert.equal(await stored('checkin_routes'), 0); assert.equal(await stored('checkin_links'), 0);
  await app.close(); app = undefined;

  // A project that predates the migration upgrades with forwarding off and keeps working.
  upgrade = await startTestWorker(15525, {}, { deferMigration: '0069_checkin_routes.sql' });
  const upgradeCookie = await signIn(upgrade.origin), call = async (path, method = 'GET', body) => { const response = await fetch(upgrade.origin + path, { method, headers: { Origin: upgrade.origin, Cookie: upgradeCookie, 'content-type': 'application/json' }, ...body ? { body: JSON.stringify(body) } : {} }); assert.ok(response.ok, `${method} ${path}: ${response.status}`); return response.json(); };
  const old = await call('/api/projects', 'POST', { id: 'synthetic-spool-upgrade-cron', name: 'Existing project' }), oldDsn = new URL(old.dsn);
  const send = body => fetch(`${upgrade.origin}/api/${oldDsn.pathname.slice(1)}/envelope/?sentry_key=${oldDsn.username}&sentry_version=7`, { method: 'POST', body }).then(async response => ({ status: response.status, body: await response.json() }));
  assert.equal((await send(envelope([event('f'.repeat(32))], { event_id: 'f'.repeat(32) }))).status, 200);
  await upgrade.migrate('0069_checkin_routes.sql');
  assert.deepEqual((await call(`/api/projects/${old.id}/check-in-routes`)).connections, [], 'the upgraded project has forwarding off');
  assert.equal((await call(`/api/projects/${old.id}/issues`))[0].count, 1, 'the upgrade keeps the existing occurrence');
  assert.deepEqual((await send(envelope([checkIn(connected, 'ok'), event('1'.repeat(32))], { event_id: '1'.repeat(32) }))).body.checkIns, { check_in_unrouted: 1 }, 'the existing key keeps working and counts the check-in');
  console.log(JSON.stringify({ clause: 'SDK-024', widths: [1440, 390], routed: 4, unrouted: 2, receiver: 'recorded double of the documented Uptime heartbeat door', custody: 'not archived, restored inert, erased with the project' }));
 } finally { await app?.close(); await upgrade?.stop(); await new Promise(done => collector ? collector.close(done) : done()); await rm(temporary, { recursive: true, force: true }); }
}
