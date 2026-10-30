import {createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
import {legacyMailRows} from './legacy-mail.mjs';
export const testOwner = 'owner@spool.test';
export const testSetupToken = 'synthetic-test-spool-setup-token-ordinary-owner-claim';
// Local admission answers only a request holding the checkout's RER_DEV_KEY. Tests that start
// the real rer commands point `gate.key` at the key rer setup wrote; in-process runtimes get this one.
export const testDevKey = 'spool-test-dev-key-abcdefghijklmnopqrstuvwxyz0123456789';
export const gate = { key: testDevKey };
// Trade the key for the gate cookie in a browser context, as the RER_OPEN page does (works without JavaScript).
export async function openGate(context, origin, key = gate.key) {
 const response = await context.request.post(origin + '/__dev/key', { data: { key } });
 assert.equal(response.status(), 204, 'the key opens local admission');
}
export const authBindings = origin => ({ AUTH_ORIGIN: origin, AUTH_LOCAL: 'true', OWNER_EMAIL: testOwner, RER_DEV_KEY: testDevKey,
 ALERT_DESTINATION_HASH_KEY: Buffer.alloc(32,45).toString('base64'),
 SESSION_SECRET: 'synthetic-test-spool-session-secret-at-least-32-characters', SETUP_TOKEN: testSetupToken,
 MAIL_PROVIDER: 'development', MAIL_FROM: 'auth@localhost.test' });
export async function signIn(origin, { bootstrap = true, returnTo = '/', form = false, emailLink = false, sessionSecret = authBindings(origin).SESSION_SECRET } = {}) {
 try {
 const post = (path, body) => fetch(origin + path, { method:'POST', redirect:'manual', headers:{Origin:origin,'Content-Type':'application/json'}, body:JSON.stringify(body) });
 if(bootstrap){const response=await post('/auth/bootstrap',{token:testSetupToken,displayName:'Test owner'});assert.ok([303,409].includes(response.status),'real first owner bootstrap or preservation');await response.body?.cancel();}
 if(emailLink){
  assert.equal((await post('/auth/magic-link',{email:testOwner,returnTo})).status,202);
  const row=(await legacyMailRows(origin))[0];assert.ok(row);
  const token=row.message.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];assert.ok(token);
  const confirmed=await post('/auth/confirm',{token});assert.equal(confirmed.status,303);
  return confirmed.headers.get('set-cookie').split(';')[0];
 }
 const response=await fetch(origin+'/auth/local/cli-session',{method:'POST',redirect:'manual',headers:{Origin:origin,'content-type':'application/json','x-rer-local-cli':createHmac('sha256',sessionSecret).update('local-cli\0sign-in').digest('hex')},body:JSON.stringify({returnTo})});
 assert.equal(response.status,303,'real local owner admission');
 const cookies=response.headers.getSetCookie();const cookie=cookies.map(value=>value.split(';')[0]).join('; ');assert.ok(cookie);await response.body?.cancel();
 return cookie;
 } catch { throw new Error('Owner sign-in journey failed; private auth details withheld'); }
}
export async function browserSignIn(page,origin,email=testOwner) {
 try {
 const cookie=await signIn(origin,{bootstrap:false});const separator=cookie.indexOf('=');
 await page.context().addCookies([{name:cookie.slice(0,separator),value:cookie.slice(separator+1),url:origin}]);await page.goto(origin+'/');
 } catch { throw new Error('Browser sign-in journey failed; private auth details withheld'); }
}

export async function assertSignInForm(page, expectedReturnTo='/setup') {
 const link=page.getByRole('link',{name:'Continue as owner',exact:true});
 const target=new URL(await link.getAttribute('href'),page.url());assert.equal(target.pathname,'/auth/dev/enter');assert.equal(target.searchParams.get('returnTo'),expectedReturnTo);
}

// The development sender is the only edge read here. Acceptance and sessions use
// the public native auth doors; no fixture writes an operator, token or session.
export async function confirmEmailLink(origin, email, {previousIds = []} = {}) {
 try {
  const previous = new Set(previousIds);
  const row = (await legacyMailRows(origin)).find(row => {
   if (previous.has(row.id)) return false;
   const message = JSON.parse(row.message);
   return message.to?.includes(email) && /\/auth\/confirm\?token=/.test(message.text ?? '');
  });
  assert.ok(row, 'the native sender delivers a fresh confirmation to this person');
  const token = JSON.parse(row.message).text.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];
  assert.ok(token, 'the message has a native confirmation');
  const preview = await fetch(origin + '/auth/confirm?token=' + token, {redirect:'manual'});
  assert.equal(preview.status, 200, 'native link preview is non-consuming');
  assert.equal(preview.headers.get('set-cookie'), null);
  await preview.body?.cancel();
  const response = await fetch(origin + '/auth/confirm', {method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token})});
  assert.equal(response.status, 303, 'native confirmation accepts the email proof');
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie, 'native confirmation issues the person session');
  await response.body?.cancel();
  const session = await fetch(origin + '/auth/session', {headers:{Cookie:cookie}});
  assert.equal(session.status, 200);
  const current = await session.json();
  assert.equal(current.operator.email, email);
  assert.equal(current.operator.status, 'active');
  assert.equal(current.kind, 'native');
  return cookie;
 } catch { throw new Error('Native email confirmation journey failed; private auth details withheld'); }
}

export async function emailSignIn(origin, email, {returnTo = '/'} = {}) {
 const previousIds = (await legacyMailRows(origin)).map(row => row.id);
 const response = await fetch(origin + '/auth/magic-link', {method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,returnTo})});
 assert.equal(response.status, 202, 'the native magic-link door accepts the sign-in request');
 await response.body?.cancel();
 return confirmEmailLink(origin, email, {previousIds});
}

export async function inviteMember(owner, origin, input) {
 const organization = '/api/organization';
 const previousIds = (await legacyMailRows(origin)).map(row => row.id);
 const response = await (owner.request ?? owner.req)(organization + '/invites', 'POST', input);
 assert.equal(response.status, 202);
 await response.body?.cancel();
 const pending = (await owner.json(organization)).members.find(row => row.email === input.email);
 assert.ok(pending);
 assert.equal(pending.operatorStatus, 'invited');
 const cookie = await confirmEmailLink(origin, input.email, {previousIds});
 const member = (await owner.json(organization)).members.find(row => row.id === pending.id);
 assert.equal(member.operatorStatus, 'active');
 return {cookie, member};
}
