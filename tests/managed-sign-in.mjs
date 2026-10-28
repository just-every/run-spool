import assert from 'node:assert/strict';
import {mkdir, readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {admissionRuntime} from './admission-runtime.mjs';
import {launchBrowser} from './browser-launch.mjs';
import {testOwner, testSetupToken} from './auth.mjs';
import {legacyMailRows} from './legacy-mail.mjs';

export async function managedSignIn() {

// Follow the published app contract against the production Worker. Only the
// mail provider is a network double; confirmation creates a real owner session.
const spec = JSON.parse(await readFile('management/integration/deployment-spec.json', 'utf8'));
const signIn = spec.surfaces.app.signIn;
const output = resolve(process.env.SPOOL_SIGNIN_SHOTS ?? '.artifacts/managed-sign-in');
await mkdir(output, {recursive:true});
let app, browser;
try {
 app = await admissionRuntime({}, {hostedMail:true, https:true});
 browser = await launchBrowser();
 const setup = await browser.newContext({ignoreHTTPSErrors:true});
 try {
  assert.equal((await setup.request.post(app.origin + '/auth/bootstrap', {
   headers:{Origin:app.origin}, data:{token:testSetupToken, displayName:'Spool owner'}, maxRedirects:0,
  })).status(), 303);
 } finally {await setup.close()}
 for (const width of [1440]) {
  const context = await browser.newContext({ignoreHTTPSErrors:true, javaScriptEnabled:false, viewport:{width, height:900}});
  try {
   const page = await context.newPage();
   const entry = new URL(signIn.path, app.origin);
   entry.searchParams.set('login_hint', testOwner);
   for (const path of ['/signin', '/sign-in']) for (const method of ['GET', 'HEAD']) {
    const response = await context.request.fetch(app.origin + path + '?login_hint=' + encodeURIComponent(testOwner), {method, maxRedirects:0});
    assert.equal(response.status(), 200, 'signed-out visitors keep the form');
    assert.equal(response.headers()['cache-control'], 'no-store');
    if (method === 'GET') assert.ok((await response.text()).includes('value="' + testOwner + '"'), 'both aliases preserve the login hint');
   }
   assert.equal((await page.goto(entry.href)).status(), 200);
   const email = page.getByRole('textbox', {name:'Owner email', exact:true});
   assert.equal(await email.inputValue(), testOwner, 'the declared sign-in page prefills the owner');
   assert.equal(await email.isEditable(), true);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
   await page.evaluate(() => document.fonts.ready);
   await page.screenshot({path:resolve(output, `sign-in-${width}.png`), fullPage:true});
   await page.getByRole('button', {name:'Send sign-in link', exact:true}).click();
   await page.getByRole('status').waitFor();
   const mail = (await legacyMailRows(app.origin))[0];
   assert.ok(mail, 'the submitted owner email reaches the mail provider');
   const message = JSON.parse(mail.message);
   assert.ok(message.to.includes(testOwner));
   const link = new URL(message.text.match(/https:\/\/[^\s]+\/auth\/confirm\?token=[A-Za-z0-9_-]+/)[0]);
   await page.goto(app.origin + link.pathname + link.search);
   await page.getByRole('button', {name:'Confirm', exact:true}).click();
   await page.waitForURL(app.origin + '/setup');
   assert.equal((await context.request.get(app.origin + '/api/projects')).status(), 200, 'confirmation signs in the native owner');
   for (const path of ['/signin', '/sign-in']) for (const method of ['GET', 'HEAD']) {
    const response = await context.request.fetch(app.origin + path + '?login_hint=' + encodeURIComponent(testOwner) + '&returnTo=https://foreign.example', {method, maxRedirects:0});
    assert.equal(response.status(), 303, 'signed-in owners go directly to the workspace');
    assert.equal(response.headers().location, '/app');
    assert.equal(response.headers()['cache-control'], 'no-store');
    assert.equal((await response.body()).length, 0, 'no sign-in form precedes the redirect');
   }
  } finally {await context.close()}
 }
 console.log('Managed Open app sign-in passed: declared path, owner email prefill, no-JS email delivery and native confirmation at 1440.');
} finally {await browser?.close(); await app?.close()}

}
