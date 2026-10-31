import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { archiveProjection } from './archive.mjs';

// Constructed envelopes qualify the shared description-only abuse boundary,
// not the widget, native devices, contact, attachments or provider delivery.
export async function feedbackAbuseFlow({ req, json }) {
 const project = await json('/api/projects', 'POST', { id: 'synthetic-spool-feedback-bound', name: 'Mixed feedback admission' });
 const other = await json('/api/projects', 'POST', { id: 'synthetic-spool-feedback-isolated', name: 'Independent feedback admission' });
 const root = '/api/projects/' + project.id, otherRoot = '/api/projects/' + other.id;
 const dsn = new URL(project.dsn), otherDsn = new URL(other.dsn);
 const endpoint = (target, key = target.username) => `/api${target.pathname}/envelope/?sentry_version=7&sentry_key=${key}`;
 const envelope = items => '{}\n' + items.map(([type, value]) => JSON.stringify({ type }) + '\n' + JSON.stringify(value)).join('\n') + '\n';
 const send = (items, target = dsn, key = target.username) => req(endpoint(target, key), 'POST', envelope(items), { Cookie: '', Origin: '' });
 const id = n => n.toString(16).padStart(32, '0');
 const forms = ['event', 'feedback', 'user_report'];
 const report = (form, n) => [form, form === 'user_report'
  ? { event_id: id(n), comments: 'synthetic-spool-' + n }
  : { event_id: id(n), type: 'feedback', contexts: { feedback: { message: 'synthetic-spool-' + n } } }];
 const identity = ([form, value]) => form === 'user_report' ? 'user-report-' + value.event_id : value.event_id;
 const counters = async path => (await json(path + '/outcomes')).rows;
 const count = (rows, reason) => rows.find(row => row.reason === reason)?.count ?? 0;
 const inbox = () => json(root + '/feedback?limit=100');
 const revoked = await json(root + '/keys', 'POST', { kind: 'ingest' });
 await json(root + '/keys/' + revoked.hash, 'DELETE');
 const corpus = Array.from({ length: 60 }, (_, n) => report(forms[n % forms.length], n + 1));
 const retries = corpus.slice(0, 3);

 // Reserve a real bucket window before starting, rather than depending on the
 // time of day at which CI happens to reach this public-door journey.
 const remaining = 60000 - Date.now() % 60000;
 if (remaining < 30000) await new Promise(resolve => setTimeout(resolve, remaining + 100));
 const filled = await send([...retries, ...retries, ...corpus.slice(3)]);
 assert.equal(filled.status, 200);
 const receipts = (await filled.json()).feedback;
 assert.deepEqual(receipts.map(row => [row.id, row.outcome]), [
  ...retries.map(item => [identity(item), 'accepted']),
  ...retries.map(item => [identity(item), 'duplicate']),
  ...corpus.slice(3).map(item => [identity(item), 'accepted']),
 ], 'duplicates before exhaustion leave room for all 60 distinct mixed-format reports');
 const retained = await inbox();
 assert.equal(retained.total, 60);
 assert.equal(retained.next, null);
 const expected = corpus.map(item => ({ id: identity(item), message: 'synthetic-spool-' + Number.parseInt(item[1].event_id, 16),
  eventId: item[0] === 'user_report' ? item[1].event_id : null, issueId: null,
  association: item[0] === 'user_report' ? 'event_unavailable' : 'standalone' }));
 const byId = rows => rows.sort((a, b) => a.id.localeCompare(b.id));
 assert.deepEqual(byId(retained.items.map(({ received, ...row }) => row)), byId(expected), 'owner reads retain every expected identity and description');
 assert.equal(count(await counters(root), 'feedback_accepted'), 60);

 for (const item of retries) {
  const response = await send([item]);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).feedback.map(row => [row.id, row.outcome]), [[identity(item), 'duplicate']]);
  assert.equal(response.headers.get('Retry-After'), null, 'an exact retry is still successful at exhaustion');
 }
 const refused = async items => {
  const response = await send(items);
  assert.equal(response.status, 429);
  assert.equal((await response.json()).reason, 'feedback_rate_limited');
  assert.equal(response.headers.get('X-Sentry-Error'), 'feedback_rate_limited');
  assert.match(response.headers.get('Retry-After'), /^[1-9][0-9]*$/);
  assert.ok(Number(response.headers.get('Retry-After')) <= 60, 'feedback backoff is bounded by one minute');
  assert.deepEqual(await inbox(), retained, 'each refusal preserves every retained report');
 };
 for (let n = 0; n < forms.length; n++) {
  await refused([report(forms[n], 100 + n)]);
  assert.equal(count(await counters(root), 'feedback_rate_limited'), n + 1, 'each modern or legacy refusal adds exactly one attributed unit');
 }

 // Feedback is first on the wire; its admission refusal must not lose the error.
 const error = { event_id: id(200), message: 'synthetic-spool-companion-error' };
 const mixed = [report('feedback', 201), ['event', error]];
 await refused(mixed);
 const issues = await json(root + '/issues');
 assert.equal(issues.length, 1); assert.equal(issues[0].count, 1);
 const eventPath = root + '/issues/' + issues[0].id + '/events';
 const events = (await json(eventPath)).rows;
 assert.equal(events.length, 1);
 assert.equal(events[0].id, error.event_id);
 const occurrence = events[0].occurrence;
 assert.equal(count(await counters(root), 'accepted'), 1);
 await refused(mixed);
 assert.deepEqual((await json(eventPath)).rows, events, 'replaying a refused mixed envelope retains the single original occurrence');
 assert.equal((await json(eventPath)).rows[0].occurrence, occurrence);
 assert.equal((await json(root + '/issues'))[0].count, 1);
 const after = await counters(root);
 assert.equal(count(after, 'accepted'), 1, 'a retried companion error consumes no second accepted-error unit');
 assert.equal(count(after, 'feedback_accepted'), 60);
 assert.equal(count(after, 'feedback_duplicate'), 6);
 assert.equal(count(after, 'feedback_rate_limited'), 5);

 const independent = report('feedback', 300), independentResponse = await send([independent], otherDsn);
 assert.equal(independentResponse.status, 200);
 assert.equal((await independentResponse.json()).feedback[0].outcome, 'accepted');
 assert.deepEqual((await json(otherRoot + '/feedback')).items.map(row => [row.id, row.message]), [[identity(independent), 'synthetic-spool-300']]);
 assert.equal(count(await counters(otherRoot), 'feedback_accepted'), 1, 'another project has its own feedback allowance');

 const beforeDenied = await counters(root), otherBeforeDenied = await counters(otherRoot);
 const unknown = createHash('sha256').update('synthetic-spool-0').digest('hex');
 for (const [key, reason] of [[unknown, 'invalid_ingest_key'], ['synthetic-spool-invalid', 'invalid_sentry_auth'], [other.ingestKey, 'invalid_ingest_key'], [revoked.key, 'invalid_ingest_key']]) {
  for (let n = 0; n < forms.length; n++) {
   const response = await send([report(forms[n], 400 + n), ['event', { ...error, event_id: id(500 + n) }]], dsn, key);
   assert.equal(response.status, 401);
   assert.equal((await response.json()).reason, reason);
   assert.equal(response.headers.get('Retry-After'), null);
  }
 }
 assert.deepEqual(await counters(root), beforeDenied, 'invalid, foreign and revoked credentials attribute no project counters');
 assert.deepEqual(await counters(otherRoot), otherBeforeDenied, 'a foreign grant cannot attribute counters to its own project through this alias');
 assert.deepEqual(await inbox(), retained);
 assert.deepEqual((await json(eventPath)).rows, events);
 const archive = await archiveProjection(await req('/api/archive'));
 assert.deepEqual(byId(archive.data.feedback.filter(row => row.project === project.id).map(row => ({ id: row.id, message: row.message, eventId: row.event_id }))),
  byId(expected.map(({ id, message, eventId }) => ({ id, message, eventId }))), 'archive custody matches the accepted mixed corpus without refused reports');
 console.log('PROBE SDK-004 acceptance-3: anonymous mixed Sentry intake -> 60 exact retained reports; all three forms 429 with Retry-After; retries consume no slots; isolated project accepts; invalid, foreign and revoked grants attribute nothing; mixed error retains one occurrence and accepted unit');
}
