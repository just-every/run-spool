import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {admissionRuntime} from './admission-runtime.mjs';
import {confirmEmailLink, signIn} from './auth.mjs';
import {legacyMailRows} from './legacy-mail.mjs';
import {launchBrowser} from './browser-launch.mjs';

const door = action => response => new URL(response.url()).pathname === '/api/operator/import/' + action;
const primary = page => page.locator('#content .primary-button');

/** Move in through the built page at 1440: the owner's dry run, exact review,
 * apply, Spool's own check and undo; a member who never reaches the import door;
 * the door's refusal and a plan that changed after review. The synthetic Sentry
 * export files are the only fake; the door, Worker and D1 are real. */
export async function moveInFlow(fixture) {
 const runtime = await admissionRuntime({}, {hostedMail: true}), {origin} = runtime;
 const scratch = await mkdtemp(join(tmpdir(), 'spool-move-in-'));
 let browser;
 try {
  const cookie = await signIn(origin, {emailLink: true});
  const json = async (path, method = 'GET', value, as = cookie) => {
   const response = await fetch(origin + path, {method, headers: {Origin: origin, Cookie: as, ...value ? {'Content-Type': 'application/json'} : {}}, ...value ? {body: JSON.stringify(value)} : {}});
   assert.ok(response.ok, `${method} ${path}: HTTP ${response.status}`);
   return response.json();
  };
  const bundle = JSON.parse(await readFile(fixture, 'utf8'));
  const exportFile = async (slug, change = value => value) => {
   const path = join(scratch, slug + '.json');
   await writeFile(path, JSON.stringify(change({...structuredClone(bundle), organization: {...bundle.organization, id: slug, slug}})), {mode: 0o600});
   return path;
  };
  browser = await launchBrowser();
  const pageFor = async session => {
   const context = await browser.newContext({viewport: {width: 1440, height: 900}}), split = session.indexOf('=');
   await context.addCookies([{name: session.slice(0, split), value: session.slice(split + 1), url: origin.replace('http:', 'https:'), secure: true}]);
   const page = await context.newPage();
   page.setDefaultTimeout(20000);
   return page;
  };

  // A member: the owner gate is decided in the page, so no import call is made and the member stays signed in.
  await json('/api/organization', 'POST', {id: 'synthetic-spool-22', name: 'synthetic-spool-22'});
  const email = ['synthetic-spool-22', 'example.test'].join('@'), previousIds = (await legacyMailRows(origin)).map(row => row.id);
  await json('/api/organization/invites', 'POST', {email, name: 'synthetic-spool-22', role: 'member', grants: []});
  const memberPage = await pageFor(await confirmEmailLink(origin, email, {previousIds})), memberCalls = [];
  memberPage.on('request', request => { if (/^\/api\/(imports|operator\/import)\//.test(new URL(request.url()).pathname)) memberCalls.push(request.url()); });
  await memberPage.goto(origin + '/move-in');
  await memberPage.locator('#content h1').waitFor();
  await memberPage.getByRole('navigation', {name: 'Workbench'}).waitFor();
  await memberPage.waitForLoadState('networkidle');
  assert.deepEqual(memberCalls, [], 'a member never calls the import door or its history');
  assert.equal(await primary(memberPage).count(), 0, 'a member has no import control');
  assert.equal(await memberPage.locator('nav a[href="/move-in"]').count(), 0, 'Move in is not in a member\'s navigation');
  assert.equal(await memberPage.locator('.workbench-shell').count(), 1, 'the member is still signed in to the workbench');

  // The owner: dry run, the exact review, apply exactly that plan, Spool's check, then undo.
  const page = await pageFor(cookie);
  await page.goto(origin + '/move-in');
  await page.locator('nav a[href="/move-in"][aria-current="page"]').waitFor();
  await page.locator('#content input[type=file]').waitFor({state: 'attached'});
  assert.equal(await primary(page).count(), 1, 'a first visit has one primary: the file control');
  await page.locator('#content input[type=file]').setInputFiles(fixture);
  const planned = page.waitForResponse(door('plan'));
  await primary(page).click();
  const plan = await (await planned).json();
  await page.locator('#content pre').waitFor();
  assert.equal((await page.locator('#content pre').textContent()).trim(), plan.fingerprint, 'the review shows the plan\'s exact fingerprint');
  assert.equal(await page.locator('#content').getByText(plan.fingerprint).count(), 1, 'and shows it once');
  assert.equal(await primary(page).count(), 1);
  assert.deepEqual(await json('/api/projects'), [], 'a dry run writes nothing');
  const applying = page.waitForResponse(door('apply')), reconciled = page.waitForResponse(door('reconcile'));
  await primary(page).click();
  assert.equal(JSON.parse((await applying).request().postData()).reviewedFingerprint, plan.fingerprint, 'Apply sends back the reviewed fingerprint');
  const report = await (await reconciled).json(), [project] = report.projectIds;
  assert.equal(report.ok, true);
  assert.deepEqual((await json('/api/projects')).map(row => row.id), [project]);
  const open = page.locator(`#content a.primary-button[href="/projects/${encodeURIComponent(project)}/issues"]`);
  await open.click();
  await page.waitForURL(`**/projects/${encodeURIComponent(project)}/issues`);
  await page.locator('nav a[href="/move-in"]').click();
  await page.locator('.move-in-band .danger-button').click();
  const undone = page.waitForResponse(async response => door('undo')(response) && (await response.json()).job?.state === 'undone');
  await page.locator('.move-in-confirm .danger-button').click();
  await undone;
  assert.deepEqual(await json('/api/projects'), [], 'undo removes what the import added');
  assert.equal((await json('/api/imports/business')).history[0].state, 'undone');

  // Refused: the door refuses a file over the record limit, the page offers another file and nothing is written.
  const over = await exportFile('synthetic-spool-23', value => { value.collections.find(row => row.kind === 'issues').pages[0].response = Array.from({length: 520}, (_, n) => ({...value.collections.find(row => row.kind === 'issues').pages[0].response[0], id: String(9000 + n)})); return value; });
  await page.locator('#content input[type=file]').setInputFiles(over);
  const refused = page.waitForResponse(door('plan'));
  await primary(page).click();
  assert.equal((await refused).status(), 413);
  await page.locator('#content [role=alert]').waitFor();
  assert.equal(await primary(page).count(), 1);
  assert.equal(await page.locator('#content label.primary-button input[type=file]').count(), 1, 'the one primary chooses another file');

  // Plan changed: a second tab plans the same file and discards it; Apply in the first tab writes nothing.
  const changed = await exportFile('synthetic-spool-24');
  await page.locator('#content input[type=file]').setInputFiles(changed);
  await primary(page).click();
  await page.locator('#content pre').waitFor();
  const second = await page.context().newPage();
  await second.goto(origin + '/move-in');
  await second.locator('#content input[type=file]').setInputFiles(changed);
  await primary(second).click();
  await second.locator('#content pre').waitFor();
  const discarded = second.waitForResponse(door('undo'));
  await second.locator('.move-in-band-side .text-button').click();
  assert.equal((await (await discarded).json()).state, 'cancelled');
  await second.close();
  const stale = page.waitForResponse(door('apply'));
  await primary(page).click();
  assert.equal((await stale).status(), 404);
  await page.locator('#content [role=alert]').waitFor();
  assert.equal(await page.locator('#content pre').count(), 0, 'the stale review is removed');
  assert.equal(await primary(page).evaluate(element => element.tagName), 'BUTTON', 'its one primary plans the file again');
  assert.deepEqual(await json('/api/projects'), [], 'nothing was written');
  console.log('Move in (1440): member gate without import calls, dry run, exact review, reviewed apply, reconcile, undo, door refusal and plan changed passed through the built page.');
 } finally {
  await browser?.close();
  await runtime.close();
  await rm(scratch, {recursive: true, force: true});
 }
}
