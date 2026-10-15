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
export async function openGate(context, origin) {
 const response = await context.request.post(origin + '/__dev/key', { data: { key: gate.key } });
 assert.equal(response.status(), 204, 'the key opens local admission');
}
export const authBindings = origin => ({ AUTH_ORIGIN: origin, AUTH_LOCAL: 'true', OWNER_EMAIL: testOwner, RER_DEV_KEY: testDevKey,
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
