import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { startTestWorker } from './worker.mjs';
import { freePort } from './admission-runtime.mjs';
import { signIn } from './auth.mjs';

const eventId = () => randomUUID().replaceAll('-', '');
const envelope = (items, header = {}) => JSON.stringify(header) + '\n' + items.map(value => {
 const body = typeof value === 'string' ? value : JSON.stringify(value);
 return JSON.stringify({ type: 'event', length: Buffer.byteLength(body) }) + '\n' + body;
}).join('\n');
const count = (rows, reason) => rows.filter(row => row.reason === reason).reduce((sum, row) => sum + row.count, 0);

// Constructed envelopes qualify conversion isolation at current transport bounds;
// the unmodified SDK journey remains the separate SDK reconciliation proof.
export async function sentryInvalidEventFlow({ req, json, worker }) {
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
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
 const worker = await startTestWorker(await freePort());
 try {
  const { origin } = worker, cookie = await signIn(origin);
  const req = (path, method = 'GET', body, headers = {}) => fetch(origin + path, { method, headers: {
   Origin: origin, Cookie: cookie, ...body !== undefined ? { 'Content-Type': 'application/json' } : {}, ...headers,
  }, ...body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {} });
  const json = async (...args) => { const response = await req(...args); assert.ok(response.ok, `${args[0]}: HTTP ${response.status}`); return response.json(); };
  await sentryInvalidEventFlow({ req, json, worker });
  console.log('Sentry invalid-event HTTP journey passed.');
 } finally { await worker.stop(); }
}
