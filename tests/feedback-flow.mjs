import assert from 'node:assert/strict';
import { archiveProjection } from './archive.mjs';
import { startTestWorker } from './worker.mjs';
import { freePort } from './admission-runtime.mjs';
import { signIn } from './auth.mjs';

async function restoreFeedback(before, after, expected) {
 const destination = await startTestWorker(await freePort());
 try {
  const cookie = await signIn(destination.origin);
  const request = (path, method = 'GET', text) => fetch(destination.origin + path, { method, headers: { Origin: destination.origin, Cookie: cookie,
   ...text ? { 'Content-Type': 'application/x-ndjson', 'X-Confirm-Restore': 'yes' } : {} }, ...text ? { body: text } : {} });
  const restored = await request('/api/restore', 'POST', after.text);
  assert.equal(restored.status, 200, 'populated feedback restores on an independent installation: '+await restored.clone().text());
  const inbox = await request('/api/projects/feedback-flow/feedback');
  assert.deepEqual((await inbox.json()).items, expected);
  const snapshot = await archiveProjection(await request('/api/archive'));
  const byIdentity = rows => [...rows].sort((a,b) => JSON.stringify([a.project,a.id]).localeCompare(JSON.stringify([b.project,b.id])));
  assert.deepEqual(byIdentity(snapshot.data.feedback), byIdentity(after.data.feedback), 'feedback identities, scrubbed text and exact occurrence association survive restore');
  const refused = await request('/api/restore', 'POST', before.text);
  assert.equal(refused.status, 400);
  assert.equal((await refused.json()).error, 'erasure_epoch', 'the transferred later withdrawal journal fences an older snapshot');
 } finally { await destination.stop(); }
}

/** One feedback journey through Sentry transport, owner reads and withdrawal. */
export async function feedbackFlow({ req, json, origin }) {
 const project = await json('/api/projects', 'POST', { id: 'feedback-flow', name: 'Feedback flow' });
 const other = await json('/api/projects', 'POST', { id: 'feedback-other', name: 'Other feedback project' });
 const dsn = new URL(project.dsn), root = '/api/projects/feedback-flow';
 const path = `/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 const envelope = (type, value) => '{}\n' + JSON.stringify({ type }) + '\n' + JSON.stringify(value);
 const modern = (id, message, reference) => ({ event_id: id, type: 'feedback', contexts: { feedback: { message, ...reference ? { associated_event_id: reference } : {}, contact_email: 'FEEDBACK_PRIVATE_CONTACT@example.test', name: 'FEEDBACK_PRIVATE_NAME', url: 'https://example.test/FEEDBACK_PRIVATE_URL' } }, extra: { ignored: 'FEEDBACK_PRIVATE_EXTRA' } });
 const send = (type, value, headers = {}) => req(path, 'POST', envelope(type, value), { Cookie: '', ...headers });
 const errorId = '1'.repeat(32), foreignId = '2'.repeat(32), lateId = '3'.repeat(32);
 const error = id => ({ event_id: id, release: 'feedback-r1', dist: 'build', exception: { values: [{ type: 'Error', value: 'Checkout failed', stacktrace: { frames: [{ filename: 'checkout.js', lineno: 1, colno: 1, function: 'checkout' }] } }] } });
 await json(`${root}/releases`, 'POST', { name: 'feedback-r1', build: 'build' });
 await json('/api/projects/feedback-other/releases', 'POST', { name: 'feedback-r1', build: 'build' });
 assert.equal((await send('event', error(errorId))).status, 200);
 const otherDsn = new URL(other.dsn), foreignPath = `/api/${otherDsn.pathname.slice(1)}/envelope/?sentry_key=${otherDsn.username}&sentry_version=7`;
 assert.equal((await req(foreignPath, 'POST', envelope('event', error(foreignId)), { Cookie: '' })).status, 200);
 const issue = (await json(`${root}/issues`))[0], before = await json(`${root}/outcomes`), alerts = await json(`${root}/alerts`);
 const report = modern('4'.repeat(32), 'Checkout report canary token=FEEDBACK_PRIVATE_TOKEN', errorId);
 assert.equal((await send('event', report)).status, 200, 'modern captureFeedback uses an event item with type feedback');
 assert.equal((await send('event', report)).status, 200);
 assert.equal((await send('event', { ...report, contexts: { feedback: { ...report.contexts.feedback, contact_email: 'FEEDBACK_CHANGED_PRIVATE@example.test' } } })).status, 409, 'raw identity conflicts even when discarded fields differ');
 assert.equal((await send('feedback', modern('5'.repeat(32), 'Standalone report'))).status, 200);
 const legacy = { event_id: errorId, comments: 'Legacy crash modal report', email: 'FEEDBACK_PRIVATE_LEGACY@example.test', name: 'FEEDBACK_PRIVATE_LEGACY_NAME' };
 assert.equal((await send('user_report', legacy)).status, 200);
 assert.equal((await send('feedback', modern('6'.repeat(32), 'Other project reference', foreignId))).status, 200);
 assert.equal((await send('feedback', modern('7'.repeat(32), 'Event not retained yet', lateId))).status, 200);
 assert.equal((await send('event', error(lateId))).status, 200);
 const rows = await json(`${root}/feedback`), attached = await json(`${root}/feedback?issue=${issue.id}`);
 assert.equal(rows.items.length, 5);
 assert.equal(attached.items.length, 2);
 assert.equal(rows.items.find(row => row.id === report.event_id).eventId, errorId);
 assert.equal(rows.items.find(row => row.id === report.event_id).issueId, issue.id);
 assert.equal(rows.items.find(row => row.id === '5'.repeat(32)).association, 'standalone');
 for (const id of ['6'.repeat(32), '7'.repeat(32)]) {
  assert.equal(rows.items.find(row => row.id === id).association, 'event_unavailable');
  assert.equal(rows.items.find(row => row.id === id).issueId, null, 'foreign or later events cannot acquire an association');
 }
 const firstPage = await json(`${root}/feedback?limit=2`), nextPage = await json(`${root}/feedback?limit=2&cursor=${encodeURIComponent(firstPage.next)}`);
 assert.equal(firstPage.items.length, 2); assert.equal(nextPage.items.length, 2);
 assert.ok(nextPage.items.every(row => !firstPage.items.some(previous => previous.id === row.id)));
 assert.equal((await req(`${root}/feedback?issue=${issue.id}&cursor=${encodeURIComponent(firstPage.next)}`)).status, 400);
 for (const headers of [{ Cookie: '' }, { Cookie: '', Authorization: `Bearer ${project.ingestKey}` }, { Cookie: '', Authorization: `Bearer ${(await json(`${root}/keys`, 'POST', { kind: 'agent' })).key}` }]) {
  assert.ok([401, 403].includes((await req(`${root}/feedback`, 'GET', undefined, headers)).status));
  assert.ok([401, 403].includes((await req(`${root}/feedback/${report.event_id}`, 'DELETE', undefined, headers)).status));
 }
 assert.equal((await send('feedback', modern('8'.repeat(32), 'Forbidden browser'), { Origin: 'https://forbidden.example' })).status, 403);
 assert.equal((await req(path.replace(dsn.username, 'invalid-key'), 'POST', envelope('feedback', modern('8'.repeat(32), 'Wrong key')), { Cookie: '' })).status, 401);
 const browserOrigin = 'https://feedback.example'; await json(`${root}/browser-origins`, 'POST', { origin: browserOrigin });
 const browserReport = await send('feedback', modern('8'.repeat(32), 'Browser feedback'), { Origin: browserOrigin });
 assert.equal(browserReport.status, 200); assert.equal(browserReport.headers.get('access-control-allow-origin'), browserOrigin);
 const bad = await send('feedback', modern('9'.repeat(32), ''));
 assert.equal(bad.status, 422);
 assert.equal((await send('feedback', modern('9'.repeat(32), 'x'.repeat(1001)))).status, 413);
 const after = await json(`${root}/outcomes`), count = (value, reason) => value.rows.find(row => row.reason === reason)?.count ?? 0;
 assert.equal(count(after, 'accepted') - count(before, 'accepted'), 1, 'only the late error adds an accepted-error unit');
 assert.equal((await json(`${root}/alerts`)).length, alerts.length, 'feedback never makes an error alert');
 assert.equal((await json(`${root}/issues`))[0].count, issue.count + 1, 'feedback never increments error occurrences');
 const snapshot = await archiveProjection(await req('/api/archive'));
 for (const canary of ['FEEDBACK_PRIVATE_CONTACT', 'FEEDBACK_PRIVATE_NAME', 'FEEDBACK_PRIVATE_URL', 'FEEDBACK_PRIVATE_EXTRA', 'FEEDBACK_PRIVATE_TOKEN', 'FEEDBACK_PRIVATE_LEGACY', 'FEEDBACK_CHANGED_PRIVATE']) {
  assert.ok(!JSON.stringify(rows).includes(canary)); assert.ok(!snapshot.text.includes(canary), 'discarded/scrubbed feedback fields never enter archive custody');
 }
 assert.equal((await req(`${root}/feedback/${report.event_id}`, 'DELETE', undefined, { Origin: 'https://foreign.example' })).status, 403);
 assert.equal((await req(`/api/projects/feedback-other/feedback/${report.event_id}`, 'DELETE')).status, 404);
 await json(`${root}/feedback/${report.event_id}`, 'DELETE');
 assert.ok(!(await json(`${root}/feedback?issue=${issue.id}`)).items.some(row => row.id === report.event_id));
 assert.equal((await send('event', report)).status, 409, 'a withdrawn report cannot be recreated by an SDK retry');
 const withdrawn = await archiveProjection(await req('/api/archive'));
 assert.ok(!withdrawn.text.includes('Checkout report canary'));
 assert.ok(withdrawn.manifest.epoch > snapshot.manifest.epoch); assert.ok(withdrawn.manifest.journal.length > snapshot.manifest.journal.length);
 const audit = withdrawn.data.audit.filter(row => row.kind === 'feedback_withdrawn' && row.project === project.id);
 assert.deepEqual(audit.map(row => JSON.parse(row.detail)), [{ count: 1 }], 'withdrawal audit keeps no report ID or text');
 const older = await req('/api/restore', 'POST', snapshot.text, { 'X-Confirm-Restore': 'yes' });
 assert.equal(older.status, 400); assert.equal((await older.json()).error, 'erasure_epoch', 'withdrawal refuses an older archive on the same installation');
 await restoreFeedback(snapshot, withdrawn, (await json(`${root}/feedback`)).items);
 await new Promise(resolve => setTimeout(resolve, 5));
 await json(`${root}/retention`, 'POST', { cutoff: Date.now(), apply: true });
 assert.deepEqual((await json(`${root}/feedback`)).items, [], 'retention removes both linked and standalone descriptions');
 const retained = await archiveProjection(await req('/api/archive'));
 assert.ok(!retained.data.feedback.some(row => row.project === project.id));
 assert.equal((await send('event', error(errorId))).status, 200);
 assert.deepEqual((await json(`${root}/feedback?issue=${issue.id}`)).items, [], 'reused event IDs never resurrect feedback');
}
