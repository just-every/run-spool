import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { startTestWorker } from './worker.mjs';
import { freePort } from './admission-runtime.mjs';
import { openGate, signIn } from './auth.mjs';
import { launchBrowser } from './browser-launch.mjs';

const eventId = () => randomUUID().replaceAll('-', '');
const envelope = (items, header = {}) => JSON.stringify(header) + '\n' + items.map(value => {
 const body = typeof value === 'string' ? value : JSON.stringify(value);
 return JSON.stringify({ type: 'event', length: Buffer.byteLength(body) }) + '\n' + body;
}).join('\n');
const count = (rows, reason) => rows.filter(row => row.reason === reason).reduce((sum, row) => sum + row.count, 0);

// Constructed envelopes qualify conversion isolation at current transport bounds;
// the unmodified SDK journey remains the separate SDK reconciliation proof.
export async function sentryInvalidEventFlow({ req, json, worker, cookie }) {
 const project = await json('/api/projects', 'POST', { id: 'invalid-events', name: 'Event conversion isolation' });
 const root = '/api/projects/' + project.id, dsn = new URL(project.dsn);
 const path = `/api${dsn.pathname}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 const store = path.replace('/envelope/', '/store/');
 const db = await worker.db();
 const policy = { version: 1, sensitiveFields: ['synthetic_spool_note'], safeFields: [], rules: [] };
 const preview = await json(root + '/scrubbing/preview', 'POST', { policy });
 await json(root + '/scrubbing', 'PUT', { revision: preview.revision, policy, token: preview.token });
 const makeEvent = () => ({ event_id: eventId(), release: 'synthetic-spool-conversion', dist: 'web',
  message: 'synthetic-spool-companion', user: { id: 'synthetic-spool-private-identity' },
  extra: { synthetic_spool_note: 'synthetic-spool-private-note' } });
 const frame = { filename: 'synthetic-spool-app.js', lineno: 1, colno: 1, function: 'checkout' };
 const cases = [
  ['malformed-json', () => 'not JSON', 'invalid_json'],
  ['invalid-event-id', () => ({ ...makeEvent(), event_id: 'synthetic-spool-invalid' }), 'invalid_event_id'],
  ['conflicting-debug-ids', () => ({ ...makeEvent(), stacktrace: { frames: [frame] }, debug_meta: { images: [
   { type: 'sourcemap', code_file: frame.filename, debug_id: 'synthetic-spool-1' },
   { type: 'sourcemap', code_file: frame.filename, debug_id: 'synthetic-spool-2' },
  ] } }), 'conflicting_debug_ids'],
  ['invalid-environment', () => ({ ...makeEvent(), environment: {} }), 'invalid_item'],
  ['invalid-build', () => ({ ...makeEvent(), dist: {} }), 'invalid_item'],
  ['invalid-frame-path', () => ({ ...makeEvent(), platform: 'python', stacktrace: { frames: [{ ...frame, filename: '\u0000' }] } }), 'invalid_item'],
 ];
 const send = (items, header = {}, headers = {}) => req(path, 'POST', envelope(items, header), { Cookie: '', ...headers });
 const outcomes = async () => (await json(root + '/outcomes')).rows;
 // Read actual durable product state, including the prepared privacy jobs that
 // archives intentionally exclude. Refusal accounting and its audit may change.
 const tables = ['events', 'issues', 'releases', 'release_builds', 'release_metadata', 'alerts',
  'event_identities', 'project_identity_keys', 'scrubbing_policies', 'scrubbing_changes',
  'event_grouping', 'grouping_routes', 'issue_short_ids', 'short_id_prefixes'];
 const state = async () => Object.fromEntries(await Promise.all(tables.map(async table => [table,
  (await db.prepare('SELECT * FROM ' + table + ' WHERE project=?').bind(project.id).all()).results.map(row => createHash('sha256').update(JSON.stringify(row)).digest('hex')).sort(),
 ])));
 const stable = await state();
 const refused = async (response, quantity = 1) => {
  assert.equal(response.status, 200, 'a framed invalid event does not refuse the envelope: ' + await response.clone().text());
  const result = await response.json();
  assert.deepEqual(result.dropped, { invalid_item: quantity });
  assert.deepEqual(result.refusedItems, [{ type: 'event', reason: 'invalid_item', quantity }]);
  assert.ok(!JSON.stringify(result).includes('synthetic-spool-private'), 'refusal never reflects rejected payload');
  return result;
 };
 let invalid = 0, accepted = 0;
 const accounting = async () => {
  const rows = await outcomes();
  assert.equal(count(rows, 'invalid_item'), invalid);
  assert.equal(count(rows, 'accepted'), accepted);
  assert.equal(count(rows, 'invalid'), 0, 'conversion failures remain item refusals');
  const usage = (await json('/api/organization/usage')).usage.filter(row => row.project === project.id);
  assert.equal(count(usage, 'invalid_item'), invalid, 'usage reconciles exact existing refusal units');
  assert.equal(count(usage, 'accepted'), accepted, 'only valid errors consume accepted units');
 };
 for (const [name, bad] of cases) {
  const result = await refused(await send([bad()])); invalid++;
  assert.equal(result.id, undefined);
  assert.deepEqual(await state(), stable, name + ' commits no identity, scrubbing or product jobs');
  await accounting();
 }
 // An envelope event identity must agree with its item identity, too.
 await refused(await send([makeEvent()], { event_id: eventId() })); invalid++;
 assert.deepEqual(await state(), stable, 'envelope identity disagreement commits no prepared jobs');
 await accounting();
 console.log('PROBE SDK-011 invalid-only: framed JSON and conversion failures -> typed event invalid_item; no identity, scrubbing, release, issue or alert writes; exact refusal usage');

 const validIds = [];
 for (const [name, bad] of cases) for (const position of ['before', 'after']) {
  const companions = [makeEvent(), makeEvent()]; validIds.push(...companions.map(event => event.event_id));
  const result = await refused(await send(position === 'before' ? [bad(), ...companions] : [...companions, bad()]));
  invalid++; accepted += companions.length;
  assert.equal(result.id, companions.at(-1).event_id, name + ' retains both companions ' + position);
  await accounting();
 }
 const surrounded = makeEvent();
 const combined = await refused(await send([cases[1][1](), surrounded, cases[2][1]()]), 2);
 invalid += 2; accepted++; validIds.push(surrounded.event_id);
 assert.equal(combined.id, surrounded.event_id, 'independent conversion failures surround one accepted error');
 await accounting();
 const issues = await json(root + '/issues');
 assert.equal(issues.length, 1); assert.equal(issues[0].count, accepted);
 const rows = (await db.prepare('SELECT id,occurrence,payload FROM events WHERE project=?').bind(project.id).all()).results;
 assert.deepEqual(rows.map(row => row.id).sort(), validIds.sort(), 'one occurrence for each valid error and no invalid event');
 assert.equal(new Set(rows.map(row => row.occurrence)).size, accepted);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM event_identities WHERE project=?').bind(project.id).first()).n, accepted);
 for (const row of rows) {
  assert.ok(!row.payload.includes('synthetic-spool-private'), 'valid companions still obey scrubbing and identity policy');
  assert.equal(JSON.parse(row.payload).sentry.extra.synthetic_spool_note, '[redacted]');
 }
 console.log(`PROBE SDK-011 order and accounting: each invalid kind before and after two valid companions -> accepted=${accepted}, invalid_item=${invalid}; one retained occurrence and accepted unit per valid error`);

 const populated = await state(), beforeFraming = await outcomes();
 const malformed = await req(path, 'POST', envelope([makeEvent()]) + '\n{"type":"event","length":100}\n{}', { Cookie: '' });
 assert.equal(malformed.status, 400); assert.equal((await malformed.json()).reason, 'invalid_item_framing');
 assert.deepEqual(await state(), populated); assert.deepEqual(await outcomes(), beforeFraming, 'framing refuses before attribution or admission');
 for (const [name, bad, reason] of cases) {
  const response = await req(store, 'POST', bad(), { Cookie: '' });
  assert.equal(response.status, 400, name + ' remains a whole store refusal');
  assert.equal((await response.json()).reason, reason);
  assert.deepEqual(await state(), populated);
 }
 const afterStore = await outcomes();
 assert.equal(count(afterStore, 'invalid'), cases.length, 'each legacy store refusal keeps its existing request outcome');
 assert.equal(count(afterStore, 'invalid_item'), invalid); assert.equal(count(afterStore, 'accepted'), accepted);
 const storeUsage = (await json('/api/organization/usage')).usage.filter(row => row.project === project.id);
 for (const reason of ['invalid', 'invalid_item', 'accepted']) assert.equal(count(storeUsage, reason), count(afterStore, reason));
 // A failure to persist the refusal must not be reported as item success.
 const beforeRefusalStorage = await outcomes();
 await db.prepare("CREATE TRIGGER synthetic_spool_invalid_outcome BEFORE INSERT ON outcomes WHEN NEW.project='invalid-events' AND NEW.reason='invalid_item' BEGIN SELECT RAISE(ABORT,'synthetic-spool-storage'); END").run();
 try {
  const response = await send([cases[1][1](), makeEvent()]);
  assert.equal(response.status, 503); assert.equal((await response.json()).reason, 'transaction_not_confirmed');
 } finally { await db.prepare('DROP TRIGGER synthetic_spool_invalid_outcome').run(); }
 assert.deepEqual(await state(), populated); assert.deepEqual(await outcomes(), beforeRefusalStorage);
 // The existing admission transaction also retains its storage-failure response.
 await db.prepare("CREATE TRIGGER synthetic_spool_event_storage BEFORE INSERT ON events WHEN NEW.project='invalid-events' BEGIN SELECT RAISE(ABORT,'synthetic-spool-storage'); END").run();
 const beforeStorage = await outcomes();
 try {
  const response = await send([makeEvent()]);
  assert.equal(response.status, 503); assert.equal((await response.json()).reason, 'transaction_not_confirmed');
 } finally { await db.prepare('DROP TRIGGER synthetic_spool_event_storage').run(); }
 assert.deepEqual(await state(), populated); assert.deepEqual(await outcomes(), beforeStorage);
 console.log('PROBE SDK-011 refusal boundaries: malformed framing and store -> whole request refused; refusal-accounting and event-storage faults -> 503 with no partial product writes');

 const other = await json('/api/projects', 'POST', { id: 'invalid-events-other', name: 'Other conversion project' });
 const beforeDenied = await outcomes();
 for (const key of ['synthetic-spool-invalid-key', other.ingestKey]) {
  const response = await req(path.replace(dsn.username, key), 'POST', envelope([cases[1][1](), makeEvent()]), { Cookie: '' });
  assert.equal(response.status, 401);
 }
 assert.deepEqual(await outcomes(), beforeDenied);
 const deniedOrigin = await send([cases[1][1](), makeEvent()], {}, { Origin: 'https://synthetic-spool-denied.example' });
 assert.equal(deniedOrigin.status, 403);
 assert.equal(count(await outcomes(), 'invalid_item'), invalid);
 assert.equal(count(await outcomes(), 'accepted'), accepted);
 const ingest = (await json(root + '/keys')).find(row => row.kind === 'ingest');
 await json(root + '/keys/' + ingest.hash, 'DELETE');
 const beforeRevoked = await outcomes();
 assert.equal((await send([cases[1][1](), makeEvent()])).status, 401);
 assert.deepEqual(await outcomes(), beforeRevoked); assert.deepEqual(await state(), populated);
 console.log('PROBE SDK-011 authority: invalid, foreign and revoked grants and denied origin -> no companions admitted or conversion refusals attributed');
 await sentryUnknownFrameFlow({ req, json, origin: worker.origin, cookie });
}

async function sentryUnknownFrameFlow({ req, json, origin, cookie }) {
 const project = await json('/api/projects', 'POST', { id: 'synthetic-spool-s7', name: 'Synthetic S7 capture' });
 const dsn = new URL(project.dsn), root = '/api/projects/' + project.id;
 const intake = `/api${dsn.pathname}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 const browserEvent = {
  platform: 'javascript', sdk: { name: 'sentry.javascript.browser', version: '11.14.0' },
 };
 const location = { function: 'checkout', lineno: 12, colno: 4, in_app: true };
 const send = async (frame, metadata = browserEvent) => {
  const id = eventId();
  const event = { ...metadata, event_id: id, exception: { values: [
   { type: 'TypeError', value: 'Synthetic checkout failure', stacktrace: { frames: [frame] } },
  ] } };
  const response = await req(intake, 'POST', envelope([event], { event_id: id }), { Cookie: '' });
  assert.equal(response.status, 200);
  return { id, receipt: await response.json() };
 };
 const capture = async (frame, metadata) => {
  const { id, receipt } = await send(frame, metadata);
  assert.equal(receipt.id, id, 'the intake receipt identifies the stored occurrence');
  return id;
 };
 const first = await capture({ ...location, filename: '' });
 const other = await capture({ ...location, filename: '', function: 'refund' });
 const equivalent = await capture({ ...location, abs_path: '' });
 const { receipt } = await send({ ...location, filename: '\u0000' });
 assert.deepEqual(receipt.dropped, { invalid_item: 1 }, 'a malformed JavaScript path still counts as a refusal');
 assert.equal(receipt.id, undefined);

 const issues = await json(root + '/issues');
 assert.deepEqual(issues.map(issue => issue.count).sort(), [1, 2], 'only equivalent failures group together');
 const [checkout, refund] = [2, 1].map(count => issues.find(issue => issue.count === count).id);
 const events = issue => root + '/issues/' + issue + '/events';
 const checkoutRows = (await json(events(checkout))).rows;
 assert.deepEqual(checkoutRows.map(row => row.id).sort(), [first, equivalent].sort());
 assert.deepEqual((await json(events(refund))).rows.map(row => row.id), [other]);
 const detail = async (issue, row, suffix = '') =>
  json(events(issue) + '/' + row.id + suffix + '?' + new URLSearchParams({ occurrence: row.occurrence, exception: '0' }));
 for (const row of checkoutRows) {
  const stored = await detail(checkout, row);
  assert.deepEqual(stored.event.sentry.exceptions[0].stacktrace.frames, [location]);
  assert.deepEqual(stored.event.frames, [], 'an unknown location never enters the admission map lookup');
  const mapped = await detail(checkout, row, '/mapped-frames');
  assert.deepEqual(mapped.rows, [{ exceptionIndex: 0, frameIndex: 0, status: 'missing_position',
   generated: { file: '<unlocated>', line: 12, column: 3, function: 'checkout' } }]);
 }

 const filename = '/HOME/synthetic-spool-user/checkout.py';
 const pythonPath = '/HOME/[user]/checkout.py';
 const javaScriptFrame = { ...location, platform: 'javascript', filename: '/HOME/cache/checkout.js' };
 const pythonFrame = { filename, function: 'checkout', lineno: 12 };
 for (const [frame, metadata, expected] of [
  [pythonFrame, { platform: 'python' }, pythonPath],
  [pythonFrame, { sdk: { name: 'sentry.python.django' } }, pythonPath],
  [{ ...location, filename, platform: 'python' }, browserEvent, pythonPath],
  [javaScriptFrame, { platform: 'python' }, javaScriptFrame.filename],
 ]) {
  const id = await capture(frame, metadata);
  const retained = await json(root + '/issues');
  const lists = await Promise.all(retained.map(async issue => ({ issue: issue.id, rows: (await json(events(issue.id))).rows })));
  const matching = lists.find(list => list.rows.some(row => row.id === id));
  assert.ok(matching, 'the path control is listed under its issue');
  const stored = await detail(matching.issue, matching.rows.find(row => row.id === id));
  assert.deepEqual(stored.event.sentry.exceptions[0].stacktrace.frames, [{ ...frame, filename: expected }]);
 }
 const outcomes = (await json(root + '/outcomes')).rows;
 assert.equal(count(outcomes, 'accepted'), 7);
 assert.equal(count(outcomes, 'invalid_item'), 1);

 const browser = await launchBrowser();
 try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await openGate(context, origin);
  await context.addCookies(cookie.split('; ').map(pair => ({
   name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1), url: origin,
  })));
  const page = await context.newPage();
  const query = new URLSearchParams({ occurrence: checkoutRows.find(row => row.id === first).occurrence });
  await page.goto(origin + '/projects/' + project.id + '/issues/' + checkout + '?' + query);
  await page.getByText('<unlocated>:12:4 · checkout', { exact: true }).waitFor();
 } finally { await browser.close(); }
 console.log('PROBE S7: empty and absent paths survive in issue API and UI, distinct functions group separately, malformed paths are refused, and platform path rules still apply.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
 const worker = await startTestWorker(await freePort());
 try {
  const { origin } = worker, cookie = await signIn(origin);
  const req = (path, method = 'GET', body, headers = {}) => fetch(origin + path, { method, headers: {
   Origin: origin, Cookie: cookie, ...body !== undefined ? { 'Content-Type': 'application/json' } : {}, ...headers,
  }, ...body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {} });
  const json = async (...args) => { const response = await req(...args); assert.ok(response.ok, `${args[0]}: HTTP ${response.status}`); return response.json(); };
  await sentryInvalidEventFlow({ req, json, worker, cookie });
  console.log('Sentry invalid-event HTTP journey passed.');
 } finally { await worker.stop(); }
}
