import assert from 'node:assert/strict';
export const testOwner = 'owner@spool.test';
export const testSetupToken = 'test-spool-setup-token-ordinary-owner-claim';
// The local key gate: the outbox answers only a request holding the checkout's RER_DEV_KEY. Tests that start
// the real rer commands point `gate.key` at the key rer setup wrote; in-process runtimes get this one.
export const testDevKey = 'spool-test-dev-key-abcdefghijklmnopqrstuvwxyz0123456789';
export const gate = { key: testDevKey };
export const outboxFetch = (origin, path = '', init = {}) => fetch(origin + '/__dev/outbox' + path, { ...init, headers: { ...init.headers, 'x-rer-dev-key': gate.key } });
// Trade the key for the gate cookie in a browser context, as the RER_OPEN page does (works without JavaScript).
export async function openGate(context, origin) {
 const response = await context.request.post(origin + '/__dev/key', { data: { key: gate.key } });
 assert.equal(response.status(), 204, 'the key opens the outbox gate');
}
export const authBindings = origin => ({ AUTH_ORIGIN: origin, AUTH_LOCAL: 'true', OWNER_EMAIL: testOwner, RER_DEV_KEY: testDevKey,
 SESSION_SECRET: 'test-spool-session-secret-at-least-32-characters', SETUP_TOKEN: testSetupToken,
 MAIL_PROVIDER: 'development', MAIL_FROM: 'auth@localhost.test' });
export async function signIn(origin, { bootstrap = true, returnTo = '/', form = false } = {}) {
 try {
 const post = (path, body) => fetch(origin + path, { method:'POST', redirect:'manual', headers:{Origin:origin,'Content-Type':'application/json'}, body:JSON.stringify(body) });
 if(bootstrap){const response=await post('/auth/bootstrap',{token:testSetupToken,displayName:'Test owner'});assert.ok([303,409].includes(response.status),'real first owner bootstrap or preservation');await response.body?.cancel();}
 const priorHtml=await (await outboxFetch(origin)).text();
 const before=new Set([...priorHtml.matchAll(/\?message=([^"&]+)"/g)].map(match=>match[1]));
 const fields={email:testOwner,...returnTo===null?{}:{returnTo}};
 const sent=form?await fetch(origin+'/auth/magic-link',{method:'POST',redirect:'manual',headers:{Origin:origin,Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)}):await post('/auth/magic-link',fields);assert.equal(sent.status,202);assert.ok(sent.headers.get('content-type')?.startsWith('application/json'),'JSON auth clients retain the native response');await sent.body?.cancel();
 const listing=await (await outboxFetch(origin)).text();
 const id=[...listing.matchAll(/\?message=([^"&]+)"/g)].map(match=>match[1]).find(value=>!before.has(value));assert.ok(id,'ordinary message in development outbox');
 const html=await (await outboxFetch(origin,'?message='+id)).text();
 const link=/href="([^"\s]*\/auth\/confirm\?token=[^"\s]+)"/.exec(html)?.[1]?.replaceAll('&amp;','&');assert.ok(link,'ordinary confirmation link');
 const token=new URL(link,origin).searchParams.get('token');
 const confirmation=await fetch(link,{redirect:'manual'});assert.equal(confirmation.status,200);await confirmation.body?.cancel();
 const response=await post('/auth/confirm',{token});assert.equal(response.status,303,'real one-use confirmation');
 if(form){const {safeReturnTo}=await import('../src/modules/operator-auth/index.mjs');assert.equal(response.headers.get('location')===safeReturnTo(returnTo),true,'native form confirmation preserves valid destinations and its fallback for manually absent or unsafe input');}
 const cookie=response.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);await response.body?.cancel();
 const reused=await post('/auth/confirm',{token});assert.ok([400,401,403,410].includes(reused.status),'confirmation cannot be reused');await reused.body?.cancel();
 return cookie;
 } catch { throw new Error('Owner sign-in journey failed; private auth details withheld'); }
}
export async function browserSignIn(page,origin,email=testOwner) {
 try {
 await page.goto(origin+'/sign-in');await assertSignInForm(page);await page.getByLabel('Owner email',{exact:true}).fill(email);await page.getByRole('button',{name:'Send sign-in link',exact:true}).click();
 await openGate(page.context(),origin);await page.goto(origin+'/__dev/outbox');await page.locator('a[href*="?message="]').first().click();await page.locator('a[href*="/auth/confirm?"]').click();
 await page.locator('form[action="/auth/confirm"] button[type="submit"]').click();
 } catch { throw new Error('Browser sign-in journey failed; private auth details withheld'); }
}

export async function assertSignInForm(page, expectedReturnTo='/setup') {
 const valid=await page.locator('form').evaluateAll((forms, expected)=>forms.some(form=>{
  const action=new URL(form.action);return form.method.toLowerCase()==='post' && action.origin===location.origin && action.pathname==='/auth/magic-link' && form.querySelector('[name="returnTo"]')?.value===expected;
 }),expectedReturnTo);
 assert.equal(valid,true,'same-origin no-JavaScript sign-in form preserves the product destination');
}
