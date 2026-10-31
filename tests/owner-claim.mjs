import {devCredentials} from './dev-credentials.mjs';
import {ownerEditor} from './owner-editor.mjs';
import {managedSignIn} from './managed-sign-in.mjs';
import assert from 'node:assert/strict';
import {assertAuditAppendOnly} from './audit-state.mjs';
import {createHash, generateKeyPairSync, randomUUID, sign} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {admissionRuntime, freePort} from './admission-runtime.mjs';
import {testOwner, testSetupToken, signIn} from './auth.mjs';
import {teamFlow} from './team-flow.mjs';

// Only the issuer is a test network edge. Admission uses the real emitted Worker and D1.
const issuer = 'https://claim-issuer.example.test', installationId = randomUUID();
const {privateKey, publicKey} = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
const wrongKey = generateKeyPairSync('ec', {namedCurve: 'prime256v1'}).privateKey;
const port = await freePort(), origin = `http://127.0.0.1:${port}`;
const bindings = {RER_OWNER_CLAIM_ISSUER: issuer, RER_OWNER_CLAIM_INSTALLATION_ID: installationId,
 RER_OWNER_CLAIM_APP_ORIGIN: origin, RER_OWNER_CLAIM_PUBLIC_KEYS: JSON.stringify({admission: publicKey.export({format: 'jwk'})})};
function claim(changes = {}, key = privateKey) {
 const now = Math.floor(Date.now() / 1000), encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
 const input = encode({alg: 'ES256', typ: 'rer-owner-claim+jwt', kid: 'admission'}) + '.' + encode({
  v: 1, iss: issuer, aud: origin, installationId, email: testOwner, jti: randomUUID(), iat: now, exp: now + 240, ...changes,
 });
 return input + '.' + sign('sha256', Buffer.from(input), {key, dsaEncoding: 'ieee-p1363'}).toString('base64url');
}
// An RER-signed import grant under the same key ring (the platform's Business export grant).
function grant(action, namespace, bytes, changes = {}, key = privateKey) {
 const now = Math.floor(Date.now() / 1000), encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
 const input = encode({alg: 'ES256', typ: 'rer-import-grant+jwt', kid: 'admission'}) + '.' + encode({
  v: 1, iss: issuer, aud: origin, installationId, email: testOwner, jti: randomUUID(), iat: now, exp: now + 300,
  action, namespace, maxBytes: bytes.length, maxChunks: 1, maxRecords: 500, ...changes,
 });
 return input + '.' + sign('sha256', Buffer.from(input), {key, dsaEncoding: 'ieee-p1363'}).toString('base64url');
}
// Read each answer whole so the next request never races a half-read connection.
const statusOf = async pending => {const response = await pending; await response.arrayBuffer(); return response.status;};
const doorRows = async app => (await app.DB.prepare('SELECT installation_id,enabled FROM ik_door_settings ORDER BY rowid').all()).results;
const doorEnabled = async (app, cookie) => {
 const response = await app.call('/api/imports/business', undefined, {Cookie: cookie});
 assert.equal(response.status, 200);
 return (await response.json()).enabled;
};
async function snapshot(app, excludeClaim = false) {
 const {results: tables} = await app.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all();
 const selected=tables.filter(({name}) => !excludeClaim || name !== 'oc_owner_claims');
 const rows = await app.DB.batch(selected.map(({name}) => app.DB.prepare(`SELECT * FROM "${name}" ORDER BY rowid`)));
 return Object.fromEntries(selected.map(({name},index)=>[name,rows[index].results]));
}
const unchangedClaim=(actual,expected,message)=>assertAuditAppendOnly(actual,expected,message,['spool_audit_events','audit_actor_links']);
let app;
try {
 app = await admissionRuntime(bindings, {port});
 const empty = await snapshot(app);
 assert.equal((await app.call('/auth/owner-claim')).status, 200);
 unchangedClaim(await snapshot(app),empty,'confirmation changes no auth or product state');
 const invalid = [
  {token: claim({}, wrongKey)}, {token: claim({aud: 'https://other.example.test'})},
  {token: claim({iss: 'https://other.example.test'})}, {token: claim({email: 'other@example.test'})},
  {token: claim({installationId: randomUUID()})}, {token: claim({exp: Math.floor(Date.now() / 1000) - 1})},
 ];
 for (const body of invalid) {
  const response = await app.call('/auth/owner-claim', body);
  assert.equal(response.status, 403); assert.equal(response.headers.get('set-cookie'), null);
  unchangedClaim(await snapshot(app),empty,'invalid signed claim changes no auth or product state');
 }
 const foreign = await app.call('/auth/owner-claim', {token: claim()}, {Origin: 'https://attacker.example.test'});
 assert.equal(foreign.status, 403); assert.equal(foreign.headers.get('set-cookie'), null);
 unchangedClaim(await snapshot(app),empty,'invalid request origin changes no auth or product state');
 const accepted = await app.call('/auth/owner-claim', {token: claim(), displayName: 'Spool owner'});
 assert.equal(accepted.status, 303);
 const cookie = accepted.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
 assert.equal((await app.call('/api/projects', undefined, {Cookie: cookie})).status, 200);
 // Without RER_IMPORT_DOOR the first claim leaves the Business door off, as self-host rer deploy does.
 assert.equal(await doorEnabled(app, cookie), false, 'without RER_IMPORT_DOOR the first claim leaves the door off');
 const claimed = await snapshot(app);
 await app.restart();
 assert.equal((await app.call('/api/projects', undefined, {Cookie: cookie})).status, 200, 'native admission survives restart');
 const second = await app.call('/auth/owner-claim', {token: claim(), displayName: 'Second owner'});
 assert.equal(second.status, 409); assert.equal(second.headers.get('set-cookie'), null);
 unchangedClaim(await snapshot(app),claimed,'a second signed claim leaves auth and product state unchanged');
 assert.equal((await app.call('/auth/bootstrap', {token: testSetupToken, displayName: 'Second owner'})).status, 409);
 await app.close(); app = null;

 // An applied installation receives the additive claim ledger without losing owner or evidence.
 app = await admissionRuntime(bindings, {port, deferClaimMigration: true});
 const existingCookie = await signIn(origin);
 assert.equal((await app.call('/api/projects', {id: 'preserved', name: 'Existing evidence'}, {Cookie: existingCookie})).status, 201);
 const previous = await snapshot(app, true);
 await app.applyClaimMigration();
 assert.deepEqual(await snapshot(app,true),previous,'additive migration preserves every existing row');
 const refused = await app.call('/auth/owner-claim', {token: claim()});
 assert.equal(refused.status, 409); assert.equal(refused.headers.get('set-cookie'), null);
 unchangedClaim(await snapshot(app,true),previous,'refusal preserves installed data');
 assert.equal((await app.call('/api/projects', undefined, {Cookie: existingCookie})).status, 200, 'existing owner session remains valid');
 await app.close(); app = null;

 // A Business-provisioned install (RER_IMPORT_DOOR=on with RER's trust, bootstrap claim mode):
 // the owner's first claim opens the door; nothing before it, a refused claim or a later claim does.
 app = await admissionRuntime({...bindings, RER_IMPORT_DOOR: 'on'}, {port});
 const bundle = await readFile(new URL('./fixtures/sentry/organization.json', import.meta.url));
 const digest = value => createHash('sha256').update(value).digest('hex');
 const upload = {name: 'sentry-export.json', bundleSha256: digest(bundle), totalBytes: bundle.length, totalChunks: 1,
  index: 0, chunkSha256: digest(bundle), base64: bundle.toString('base64')};
 const door = (action, body, token) => app.call(`/api/rer/import/${action}`, body, {Authorization: `Bearer ${token}`});
 assert.equal(await statusOf(app.call('/auth/owner-claim')), 200);
 assert.equal(await statusOf(app.call('/auth/bootstrap', {token: 'not-the-setup-token', displayName: 'Someone else'})), 403);
 assert.equal(await statusOf(app.call('/auth/owner-claim', {token: claim({email: 'other@example.test'})})), 403);
 assert.deepEqual(await doorRows(app), [], 'before the first claim, and after refused claims, the door has no settings');
 assert.equal(await statusOf(door('uploads', {}, grant('uploads', 'sentry', bundle))), 404, 'no door before the owner exists');
 const first = await app.call('/auth/bootstrap', {token: testSetupToken, displayName: 'Business owner'});
 assert.equal(first.status, 303); await first.arrayBuffer();
 const ownerCookie = first.headers.get('set-cookie')?.split(';')[0]; assert.ok(ownerCookie);
 assert.deepEqual(await doorRows(app), [{installation_id: installationId, enabled: 1}], 'the first claim opens the door under RER\'s installation id');
 assert.equal(await doorEnabled(app, ownerCookie), true);
 // RER-signed grants for this install reach the door in its `sentry` namespace and land as a preview.
 const uploaded = await door('uploads', upload, grant('uploads', 'sentry', bundle));
 assert.equal(uploaded.status, 200);
 const {uploadId} = await uploaded.json();
 const preview = await door('plan', {uploadId}, grant('plan', 'sentry', bundle));
 assert.equal(preview.status, 200);
 assert.match((await preview.json()).fingerprint, /^[a-f0-9]{64}$/);
 for (const [token, why] of [[grant('status', 'sentry', bundle, {installationId: randomUUID()}), 'another installation'],
  [grant('status', 'sentry', bundle, {}, wrongKey), 'another key']]) {
  const refused = await door('status', {uploadId}, token);
  assert.equal(refused.status, 403, `a grant for ${why} is refused`);
  assert.equal((await refused.json()).error, 'invalid_grant');
 }
 const later = [() => app.call('/auth/owner-claim', {token: claim(), displayName: 'Later owner'}),
  () => app.call('/auth/bootstrap', {token: testSetupToken, displayName: 'Later owner'})];
 for (const attempt of later) assert.equal(await statusOf(attempt()), 409);
 assert.equal(await doorEnabled(app, ownerCookie), true, 'a later claim leaves the door as it was');
 // The owner's own switch still turns it off and on; neither a later claim nor a new sign-in reopens it.
 const settings = enabled => app.call('/api/imports/business', {enabled}, {Cookie: ownerCookie});
 assert.equal(await statusOf(settings(false)), 200);
 for (const attempt of later) assert.equal(await statusOf(attempt()), 409);
 assert.ok(await signIn(app.origin, {bootstrap: false}));
 assert.equal(await doorEnabled(app, ownerCookie), false, 'a door the owner turned off stays off');
 assert.equal(await statusOf(door('uploads', {}, grant('uploads', 'sentry', bundle))), 404);
 assert.equal(await statusOf(settings(true)), 200);
 assert.equal(await doorEnabled(app, ownerCookie), true);
 console.log('OWNER CLAIM passed: invalid signature/audience/issuer/email/installation/expiry/origin, native first claim, durable second refusal, additive existing-owner migration, Business door opened by the first claim only with RER_IMPORT_DOOR=on and kept under the owner\'s switch.');
} finally {await app?.close();}

await teamFlow();

await managedSignIn();

await ownerEditor();

await devCredentials();
