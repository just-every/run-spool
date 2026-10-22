import { emitClientReport } from './client-report-sdk.mjs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { archiveProjection } from './archive.mjs';
import { startTestWorker } from './worker.mjs';
import { freePort } from './admission-runtime.mjs';
import { signIn } from './auth.mjs';

async function repairDiscardProof({ req, json }) {
 const project = await json('/api/projects', 'POST', { id: 'repair-reports', name: 'Repair capture gaps' });
 const root = '/api/projects/repair-reports', old = 'repair-old', fixed = 'repair-fixed';
 await json(`${root}/releases`, 'POST', { name: old, build: 'build-old' });
 const event = (eventId, release, build, type) => ({ version: 1, eventId, release, build, environment: 'test', type, message: type,
  frames: [{ file: 'app.js', line: 1, column: 0, function: type }], breadcrumbs: [] });
 const admitted = await json('/api/ingest/repair-reports', 'POST', event('repair-original', old, 'build-old', 'TypeError'), { Cookie: '', Authorization: `Bearer ${project.ingestKey}` });
 let repair = await json(`${root}/repairs`, 'POST', { issue: admitted.issue, link: 'https://example.test/pull/1', note: 'Exercise SDK loss evidence' });
 await json(`${root}/releases`, 'POST', { name: fixed, build: 'build-fixed' });
 await json('/api/ingest/repair-reports', 'POST', event('repair-other', fixed, 'build-fixed', 'RangeError'), { Cookie: '', Authorization: `Bearer ${project.ingestKey}` });
 await json(`${root}/artifacts`, 'POST', { release: fixed, build: 'build-fixed', debugId: 'repair-report-map', map: {
  version: 3, sources: ['source.js'], sourcesContent: ['throw new Error()'], names: [], mappings: 'AAAA',
 } });
 repair = await json(`${root}/repairs/${repair.id}/facts`, 'POST', { revision: repair.revision, fact: 'deployed', release: fixed });
 repair = await json(`${root}/repairs/${repair.id}/facts`, 'POST', { revision: repair.revision, fact: 'exercised', note: 'Exercised affected flow' });
 assert.equal(repair.observation.verdict, 'no_recurrence_after_exercise');
 const dsn = new URL(project.dsn), path = `/api${dsn.pathname}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 const send = category => req(path, 'POST', '{}\n{"type":"client_report"}\n' + JSON.stringify({ timestamp: Date.now() / 1000,
  discarded_events: [{ reason: 'network_error', category, quantity: 200 }],
 }), { Cookie: '' });
 const read = async () => (await json(`${root}/repairs?issue=${admitted.issue}`)).repairs.find(row => row.id === repair.id);
 assert.equal((await send('transaction')).status, 200);
 assert.equal((await read()).observation.verdict, 'no_recurrence_after_exercise', 'discarded transactions do not establish error capture loss');
 assert.equal((await send('error')).status, 200);
 const observed = (await read()).observation;
 assert.equal(observed.verdict, 'inconclusive', 'known SDK error losses prevent a healthy repair verdict');
 assert.ok(observed.reasons.some(row => row.code === 'windowed_loss'));
 assert.deepEqual(observed.evidence.loss, [{ reason: 'client_discarded:error:network_error', count: 200 }]);
}

export async function clientReportFlow({ req, json, origin }) {
 const project = await json('/api/projects', 'POST', { id: 'client-reports', name: 'SDK discard reports' });
 const other = await json('/api/projects', 'POST', { id: 'client-reports-other', name: 'Other SDK reports' });
 const root = '/api/projects/client-reports', dsn = new URL(project.dsn);
 const path = `/api${dsn.pathname}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 const envelope = items => '{}\n' + items.map(([type, value]) => {
  const body = typeof value === 'string' ? value : JSON.stringify(value);
  return JSON.stringify({ type, length: Buffer.byteLength(body) }) + '\n' + body;
 }).join('\n');
 const report = discarded_events => ({ timestamp: Date.now() / 1000, discarded_events, extra: 'PRIVATE_REPORT_TEXT@example.test' });
 const send = (items, headers = {}) => req(path, 'POST', envelope(items), { Cookie: '', ...headers });
 const outcomes = () => json(`${root}/outcomes`);
 const count = (rows, reason) => rows.find(row => row.reason === reason)?.count ?? 0;
 const discardRows = rows => rows.filter(row => row.reason.startsWith('client_discarded:') || row.reason === 'client_report_invalid');
 const first = report([
  { reason: 'sample_rate', category: 'error', quantity: 130 },
  { reason: 'sample_rate', category: 'error', quantity: 4 },
  { reason: 'future_sdk_reason', category: 'future_category', quantity: 2 },
  { reason: 'network_error', category: 'transaction', quantity: 5 },
 ]);
 const received = await send([['client_report', first]]);
 assert.equal(received.status, 200);
 assert.deepEqual((await received.json()).clientReports, { received: 1, invalid: 0, discarded: {
  'client_discarded:error:sample_rate': 134,
  'client_discarded:future_category:future_sdk_reason': 2,
  'client_discarded:transaction:network_error': 5,
 } });
 assert.deepEqual(await json(`${root}/issues`), [], 'report quantities never create issues');
 assert.deepEqual(await json(`${root}/alerts`), [], 'report quantities never create alerts');
 assert.deepEqual(await json(`${root}/releases`), [], 'report-only intake needs no release');
 assert.equal(count((await outcomes()).rows, 'accepted'), 0, 'SDK losses are not accepted error volume');
 await emitClientReport(project.dsn);
 assert.equal(count((await outcomes()).rows, 'client_discarded:error:before_send'),3,'real unmodified Node SDK emits its discarded events through normal flush');
 assert.equal(count((await outcomes()).rows, 'accepted'),0);

 const beforeDenied = discardRows((await outcomes()).rows);
 const agent = await json(`${root}/keys`, 'POST', { kind: 'agent' });
 const deploy = await json(`${root}/keys`, 'POST', { kind: 'deploy' });
 for (const key of ['invalid-key', other.ingestKey, agent.key, deploy.key]) {
  const denied = await req(path.replace(dsn.username, key), 'POST', envelope([['client_report', first]]), { Cookie: '' });
  assert.ok([401, 403].includes(denied.status), 'only the exact project ingest grant admits a report');
 }
 assert.equal((await send([['client_report', first]], { Origin: 'https://forbidden.example' })).status, 403);
 assert.deepEqual(discardRows((await outcomes()).rows), beforeDenied, 'denied requests add no SDK loss quantities');
 const browser = 'https://reports.example';
 await json(`${root}/browser-origins`, 'POST', { origin: browser });
 const browserResponse = await send([['client_report', report([{ reason: 'queue_overflow', category: 'error', quantity: 1 }])]], { Origin: browser });
 assert.equal(browserResponse.status, 200); assert.equal(browserResponse.headers.get('access-control-allow-origin'), browser);

 await json(`${root}/releases`, 'POST', { name: 'sdk-reports@1.0.0', build: 'reports-build' });
 const event = { event_id: 'a1'.repeat(16), release: 'sdk-reports@1.0.0', dist: 'reports-build', message: 'SDK report companion error' };
 const mixed = await send([
  ['client_report', report([{ reason: 'before_send', category: 'error', quantity: 160 }])],
  ['client_report', report([{ reason: 'must_not_persist', category: 'error', quantity: 9 }, { reason: 'sample_rate', category: 'error', quantity: -1 }])],
  ['event', event],
 ]);
 assert.equal(mixed.status, 200);
 const receipt = await mixed.json();
 assert.equal(receipt.id, event.event_id); assert.equal(receipt.clientReports.invalid, 1);
 assert.deepEqual(receipt.dropped, { client_report_invalid: 1 });
 const issue = (await json(`${root}/issues`))[0];
 assert.equal(issue.count, 1); assert.equal((await json(`${root}/alerts`)).length, 1);
 const afterMixed = (await outcomes()).rows;
 assert.equal(count(afterMixed, 'accepted'), 1);
 assert.equal(count(afterMixed, 'client_discarded:error:before_send'), 163);
 assert.equal(count(afterMixed, 'client_discarded:error:must_not_persist'), 0, 'one malformed report contributes none of its partial rows');

 // sentry-go sends the report timestamp as RFC 3339 text; other SDKs send Unix seconds.
 const textStamped = await send([['client_report', { ...report([{ reason: 'rfc3339_text', category: 'error', quantity: 3 }]), timestamp: '2026-10-22T12:47:05.132012+10:00' }]]);
 assert.equal(textStamped.status, 200);
 assert.equal((await textStamped.json()).clientReports.received, 1);
 assert.equal(count((await outcomes()).rows, 'client_discarded:error:rfc3339_text'), 3);
 const invalidReports = [
  ...['yesterday', '2026-10-22 12:47:05', '2026-13-45T99:00:00Z'].map(timestamp => ({ ...report([{ reason: 'sample_rate', category: 'error', quantity: 1 }]), timestamp })),
  ...[0, 1.5, '4', Number.MAX_SAFE_INTEGER + 1].map(quantity => report([{ reason: 'sample_rate', category: 'error', quantity }])),
  report([{ reason: 'person@example.test', category: 'error', quantity: 1 }]),
  report([{ reason: 'sample_rate\n', category: 'error', quantity: 1 }]),
  report([{ reason: 'sample_rate', category: 'private category text', quantity: 1 }]),
  report([{ reason: 'ghp_' + 'a'.repeat(20), category: 'error', quantity: 1 }]),
  { timestamp: 123, discarded_events: {} },
  '{invalid json',
 ];
 const invalidResponse = await send(invalidReports.map(value => ['client_report', value]));
 assert.equal(invalidResponse.status, 200);
 assert.equal((await invalidResponse.json()).clientReports.invalid, invalidReports.length);
 const beforeFraming = discardRows((await outcomes()).rows);
 assert.equal((await req(path, 'POST', envelope([['client_report', first]]) + '\n{"type":"client_report","length":100}\n{}', { Cookie: '' })).status, 400);
 assert.deepEqual(discardRows((await outcomes()).rows), beforeFraming, 'bad trailing framing prevents all report persistence');
 assert.equal((await json(`${root}/issues`))[0].count, 1);
 assert.equal((await json(`${root}/alerts`)).length, 1);
 const final = (await outcomes()).rows;
 assert.equal(count(final, 'client_report_invalid'), 1 + invalidReports.length);
 assert.equal(count(final, 'accepted'), 1, 'only the companion error is accepted volume');
 assert.equal(count(final, 'sentry_unsupported_client_report'), 0);

 const snapshot = await archiveProjection(await req('/api/archive'));
 assert.ok(!snapshot.text.includes('PRIVATE_REPORT_TEXT@example.test'));
 assert.ok(!snapshot.text.includes('must_not_persist'));
 const destination = await startTestWorker(await freePort());
 try {
  const cookie = await signIn(destination.origin);
  const request = (url, options = {}) => fetch(destination.origin + url, { ...options, headers: { Origin: destination.origin, Cookie: cookie, ...options.headers } });
  const restored = await request('/api/restore', { method: 'POST', body: snapshot.text, headers: { 'Content-Type': 'application/x-ndjson', 'X-Confirm-Restore': 'yes' } });
  assert.equal(restored.status, 200, 'existing outcomes custody restores SDK discard quantities: ' + await restored.clone().text());
  assert.deepEqual(discardRows((await (await request(`${root}/outcomes`)).json()).rows), discardRows(final));
 } finally { await destination.stop(); }
 const ingest = (await json(`${root}/keys`)).find(row => row.kind === 'ingest');
 await json(`${root}/keys/${ingest.hash}`, 'DELETE');
 assert.equal((await send([['client_report', first]])).status, 401);
 assert.deepEqual(discardRows((await outcomes()).rows), discardRows(final), 'revoked ingest cannot change SDK quantities');
 await repairDiscardProof({ req, json, origin });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
 const worker = await startTestWorker(await freePort());
 try {
  const { origin } = worker, cookie = await signIn(origin);
  const req = (path, method = 'GET', body, headers = {}) => fetch(origin + path, { method, headers: {
   Origin: origin, Cookie: cookie, ...body ? { 'Content-Type': 'application/json' } : {}, ...headers,
  }, ...body ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {} });
  const json = async (...args) => { const response = await req(...args); assert.ok(response.ok, `${args[0]}: HTTP ${response.status}`); return response.json(); };
  await clientReportFlow({ req, json, origin });
  console.log('SDK client report HTTP journey passed.');
 } finally { await worker.stop(); }
}
