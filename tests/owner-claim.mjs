import assert from 'node:assert/strict';
import {generateKeyPairSync, randomUUID, sign} from 'node:crypto';
import {admissionRuntime, freePort} from './admission-runtime.mjs';
import {testOwner, testSetupToken, signIn} from './auth.mjs';

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
async function snapshot(app, excludeClaim = false) {
 const {results: tables} = await app.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all();
 const rows = await app.DB.batch(tables.filter(({name}) => !excludeClaim || name !== 'oc_owner_claims').map(({name}) => app.DB.prepare(`SELECT * FROM "${name}" ORDER BY rowid`)));
 return JSON.stringify(rows.map(row => row.results));
}
let app;
try {
 app = await admissionRuntime(bindings, {port});
 const empty = await snapshot(app);
 assert.equal((await app.call('/auth/owner-claim')).status, 200);
 assert.ok(await snapshot(app) === empty, 'confirmation performs no durable mutation');
 const invalid = [
  {token: claim({}, wrongKey)}, {token: claim({aud: 'https://other.example.test'})},
  {token: claim({iss: 'https://other.example.test'})}, {token: claim({email: 'other@example.test'})},
  {token: claim({installationId: randomUUID()})}, {token: claim({exp: Math.floor(Date.now() / 1000) - 1})},
 ];
 for (const body of invalid) {
  const response = await app.call('/auth/owner-claim', body);
  assert.equal(response.status, 403); assert.equal(response.headers.get('set-cookie'), null);
  assert.ok(await snapshot(app) === empty, 'invalid signed claim never writes auth or product state');
 }
 const foreign = await app.call('/auth/owner-claim', {token: claim()}, {Origin: 'https://attacker.example.test'});
 assert.equal(foreign.status, 403); assert.equal(foreign.headers.get('set-cookie'), null);
 assert.ok(await snapshot(app) === empty, 'invalid request origin never writes');
 const accepted = await app.call('/auth/owner-claim', {token: claim(), displayName: 'Spool owner'});
 assert.equal(accepted.status, 303);
 const cookie = accepted.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
 assert.equal((await app.call('/api/projects', undefined, {Cookie: cookie})).status, 200);
 const claimed = await snapshot(app);
 await app.restart();
 assert.equal((await app.call('/api/projects', undefined, {Cookie: cookie})).status, 200, 'native admission survives restart');
 const second = await app.call('/auth/owner-claim', {token: claim(), displayName: 'Second owner'});
 assert.equal(second.status, 409); assert.equal(second.headers.get('set-cookie'), null);
 assert.ok(await snapshot(app) === claimed, 'a second signed claim leaves all durable state unchanged');
 assert.equal((await app.call('/auth/bootstrap', {token: testSetupToken, displayName: 'Second owner'})).status, 409);
 await app.close(); app = null;

 // An applied installation receives the additive claim ledger without losing owner or evidence.
 app = await admissionRuntime(bindings, {port, deferClaimMigration: true});
 const existingCookie = await signIn(origin);
 assert.equal((await app.call('/api/projects', {id: 'preserved', name: 'Existing evidence'}, {Cookie: existingCookie})).status, 201);
 const previous = await snapshot(app, true);
 await app.applyClaimMigration();
 assert.ok(await snapshot(app, true) === previous, 'additive migration preserves every existing row');
 const refused = await app.call('/auth/owner-claim', {token: claim()});
 assert.equal(refused.status, 409); assert.equal(refused.headers.get('set-cookie'), null);
 assert.ok(await snapshot(app, true) === previous, 'refusal preserves installed data');
 assert.equal((await app.call('/api/projects', undefined, {Cookie: existingCookie})).status, 200, 'existing owner session remains valid');
 console.log('OWNER CLAIM passed: invalid signature/audience/issuer/email/installation/expiry/origin, native first claim, durable second refusal, additive existing-owner migration.');
} finally {await app?.close();}
