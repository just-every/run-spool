import assert from 'node:assert/strict';
import {admissionRuntime} from './admission-runtime.mjs';
import {emailSignIn, testOwner, testSetupToken} from './auth.mjs';
import {legacyMailRows} from './legacy-mail.mjs';
import {assertAuditAppendOnly} from './audit-state.mjs';

// The mail provider is the network edge; native auth, successor admission,
// audit and product persistence run in the emitted application with real D1.
export async function governanceStepUp() {
 const app = await admissionRuntime({}, {hostedMail: true});
 const call = (path, value, cookie) => app.call(path, value, cookie ? {Cookie: cookie} : {});
 const json = async (path, value, cookie, status = 200) => {
  const response = await call(path, value, cookie);
  assert.equal(response.status, status, path);
  return response.json();
 };
 const snapshot = async ({authAttempts = false} = {}) => {
  const {results: tables} = await app.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all();
  const selected = tables.filter(({name}) => !authAttempts || name !== 'oa_limits');
  const rows = await app.DB.batch(selected.map(({name}) => app.DB.prepare(`SELECT * FROM "${name}" ORDER BY rowid`)));
  return Object.fromEntries(selected.map(({name}, index) => [name, rows[index].results]));
 };
 const refuse = async (path, value, cookie, status, error, options) => {
  const before = await snapshot(options);
  const response = await call(path, value, cookie);
  assert.equal(response.status, status, path);
  assert.equal((await response.json()).error, error);
  assert.equal(response.headers.get('set-cookie'), null, 'a refusal creates no session');
  assertAuditAppendOnly(await snapshot(options), before, 'refusal preserves product, successor and native authority');
 };
 const facts = async cookie => (await json('/api/audit/export?format=json', undefined, cookie)).rows;
 const successorDoor = '/api/owner/erasure/successor';
 const successor = {email: testOwner.replace('owner', 'synthetic-spool-110'), displayName: 'Synthetic successor'};
 const destination = '/settings';
 try {
  const bootstrap = await call('/auth/bootstrap', {token: testSetupToken, displayName: 'Synthetic owner'});
  assert.equal(bootstrap.status, 303);
  const cookie = bootstrap.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie, 'bootstrap issues the native session used throughout the journey');
  await bootstrap.arrayBuffer();
  const session = await json('/auth/session', undefined, cookie);
  assert.equal(session.kind, 'native');
  assert.equal(session.operator.email, testOwner);
  assert.equal(session.operator.role, 'owner');
  assert.equal((await app.DB.prepare('SELECT source_token_id FROM oa_sessions WHERE id=?').bind(session.id).first()).source_token_id, null, 'bootstrap has no email sign-in proof');
  assert.deepEqual((await app.DB.prepare('SELECT * FROM oa_step_up_challenges').all()).results, []);

  // Protect populated evidence as well as the not-yet-created successor.
  const project = await json('/api/projects', {id: 'synthetic-spool-110', name: 'Synthetic step-up evidence'}, cookie, 201);
  await json('/api/projects/' + project.id + '/releases', {name: 'synthetic-spool-1', build: 'web'}, cookie, 201);
  const captured = await app.call('/api/ingest/' + project.id, {version: 1, eventId: 'synthetic-spool-110', release: 'synthetic-spool-1', build: 'web', environment: 'production', type: 'SyntheticSpoolError', message: 'synthetic-spool-110', frames: [{file: 'https://synthetic-spool.example/app.js', function: 'capture', line: 12, column: 0}], breadcrumbs: []}, {Authorization: 'Bearer ' + project.ingestKey});
  assert.equal(captured.status, 201);
  const capturedIssue = (await captured.json()).issue;
  const issuesDoor = '/api/projects/' + project.id + '/issues';
  const retainedIssues = await json(issuesDoor, undefined, cookie);
  assert.ok(retainedIssues.some(row => row.id === capturedIssue), 'the protected product evidence is present');
  await refuse(successorDoor, successor, cookie, 403, 'step_up_required');
  assert.equal(await app.DB.prepare('SELECT * FROM spool_owner_successor').first(), null);
  let rows = (await facts(cookie)).filter(row => row.action === 'owner.successor');
  assert.deepEqual(rows.map(row => [row.source, row.actor_kind, row.outcome, row.status]), [['request', 'owner', 'denied', 403]]);
  const ownerAlias = rows[0].actor_label;
  console.log('PROBE GOV-001 native refusal: bootstrap cookie and successor POST -> step_up_required, no successor or product mutation, owner denial audit');

  const previousIds = new Set((await legacyMailRows(app.origin)).map(row => row.id));
  const requested = await call('/auth/step-up', {action: 'owner:transfer', returnTo: destination}, cookie);
  assert.equal(requested.status, 202);
  assert.deepEqual(await requested.json(), {status: 'accepted'});
  assert.equal(requested.headers.get('set-cookie'), null);
  const delivered = (await legacyMailRows(app.origin)).filter(row => !previousIds.has(row.id));
  assert.equal(delivered.length, 1, 'one native challenge is delivered');
  const message = JSON.parse(delivered[0].message);
  assert.deepEqual(message.to, [testOwner], 'step-up goes to the signed-in owner');
  const token = (message.text ?? '').match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];
  assert.ok(token, 'the native email contains its challenge');
  await refuse(successorDoor, successor, cookie, 403, 'step_up_required');

  const otherCookie = await emailSignIn(app.origin, testOwner);
  const otherSession = await json('/auth/session', undefined, otherCookie);
  assert.equal(otherSession.kind, 'native');
  assert.notEqual(otherSession.id, session.id);
  await refuse('/auth/confirm', {token}, otherCookie, 400, 'invalid_or_expired', {authAttempts: true});
  await refuse(successorDoor, successor, cookie, 403, 'step_up_required');
  console.log('PROBE GOV-001 session binding: another native session confirms the challenge -> invalid_or_expired; requesting session remains unstepped');

  const preview = await call('/auth/confirm?token=' + token, undefined, cookie);
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get('set-cookie'), null);
  await preview.arrayBuffer();
  const sessionsBefore = (await snapshot()).oa_sessions;
  const confirmationIds = new Set((await facts(cookie)).map(row => row.id));
  const confirmed = await call('/auth/confirm', {token}, cookie);
  assert.equal(confirmed.status, 303);
  assert.equal(confirmed.headers.get('location'), destination);
  assert.equal(confirmed.headers.get('set-cookie'), null, 'step-up does not replace or mint a session cookie');
  await confirmed.arrayBuffer();
  assert.deepEqual((await snapshot()).oa_sessions, sessionsBefore, 'the same native sessions survive confirmation unchanged');
  assert.deepEqual(await json('/auth/session', undefined, cookie), session);
  const confirmedFacts = (await facts(cookie)).filter(row => row.action === 'auth.confirm' && !confirmationIds.has(row.id));
  assert.deepEqual(confirmedFacts.map(row => [row.source, row.actor_kind, row.actor_label, row.outcome, row.status]),
   [['request', 'owner', ownerAlias, 'succeeded', 303]], 'the step-up confirmation itself records the current owner without relying on another sign-in');
  await refuse('/auth/confirm', {token}, cookie, 400, 'invalid_or_expired', {authAttempts: true});
  console.log('PROBE GOV-001 confirmation and replay: requesting session confirms -> settings redirect with no replacement cookie; replay -> invalid_or_expired');

  await json(successorDoor, successor, cookie, 202);
  const afterInvite = await snapshot();
  assert.equal(afterInvite.spool_owner_successor.length, 1, 'exactly one successor intention exists');
  assert.equal(afterInvite.spool_owner_successor[0].session_id, session.id);
  const invited = afterInvite.oa_operators.filter(row => row.email === successor.email);
  assert.equal(invited.length, 1);
  assert.equal(invited[0].status, 'invited');
  const invitations = afterInvite.oa_tokens.filter(row => row.kind === 'invite');
  assert.equal(invitations.length, 1, 'exactly one native invitation was issued');
  assert.equal(invitations[0].issuer_id, session.operator.id);
  assert.equal(invitations[0].operator_id, invited[0].id);
  const invitationMail = (await legacyMailRows(app.origin)).map(row => JSON.parse(row.message)).filter(message => message.to?.includes(successor.email));
  assert.equal(invitationMail.length, 1, 'the one allowed invitation reaches its intended successor');
  assert.match(invitationMail[0].text, /\/auth\/confirm\?token=[A-Za-z0-9_-]+/);
  assert.deepEqual(await json(issuesDoor, undefined, cookie), retainedIssues, 'inviting a successor preserves the populated issue history');
  rows = await facts(cookie);
  const allowed = rows.filter(row => row.action === 'owner.successor' && row.source === 'request' && row.outcome === 'accepted');
  assert.equal(allowed.length, 1);
  assert.equal(allowed[0].actor_kind, 'owner');
  assert.equal(allowed[0].actor_label, ownerAlias, 'allowed and refused successor requests retain the same truthful actor');
  const confirmationFacts = rows.filter(row => row.action === 'auth.confirm' && row.source === 'request');
  assert.ok(confirmationFacts.some(row => row.outcome === 'succeeded' && row.actor_label === ownerAlias));
  assert.ok(confirmationFacts.filter(row => row.outcome === 'invalid').length >= 2, 'foreign-session confirmation and replay have truthful refusal facts');
  console.log('PROBE GOV-001 allowed invitation: original stepped-up cookie and successor POST -> one invited successor and one owner-attributed accepted fact');

  // A still-unused challenge cannot revive the same session after revocation.
  const beforeRevokedChallenge = new Set((await legacyMailRows(app.origin)).map(row => row.id));
  await json('/auth/step-up', {action: 'owner:transfer', returnTo: destination}, cookie, 202);
  const pending = (await legacyMailRows(app.origin)).find(row => !beforeRevokedChallenge.has(row.id));
  const revokedToken = JSON.parse(pending.message).text.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];
  assert.ok(revokedToken);
  const revoked = await call('/auth/session/revoke', {sessionId: session.id}, otherCookie);
  assert.equal(revoked.status, 204); await revoked.arrayBuffer();
  // Unauthenticated refusals are sampled, so observe this door before the
  // other revoked-session probes can occupy the sample.
  await refuse(successorDoor, {...successor, email: testOwner.replace('owner', 'synthetic-spool-111')}, cookie, 401, 'Owner session required');
  await refuse('/auth/session', undefined, cookie, 401, 'unauthenticated');
  await refuse('/auth/confirm', {token: revokedToken}, cookie, 400, 'invalid_or_expired', {authAttempts: true});
  const final = await snapshot();
  assert.deepEqual(final.spool_owner_successor, afterInvite.spool_owner_successor);
  assert.deepEqual(final.oa_tokens, afterInvite.oa_tokens, 'revoked authority creates no additional invitation');
  rows = (await facts(otherCookie)).filter(row => row.action === 'owner.successor' && row.status === 401);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].actor_kind, 'anonymous', 'a revoked cookie is not attributed as an admitted owner');
  assert.equal(rows[0].outcome, 'denied');
  console.log('PROBE GOV-001 revocation: native session revoke then session, pending challenge and successor doors -> 401, invalid_or_expired and 401, no replacement invitation');
  console.log('GOV-001 native owner-successor step-up journey passed; enterprise providers and broader privileged operations remain unqualified.');
 } finally {await app.close();}
}
