import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = process.cwd(), packet = dirname(fileURLToPath(import.meta.url));
const {expect} = createRequire(resolve(root, 'package.json'))('@playwright/test');
const {startTestWorker} = await import(pathToFileURL(resolve(root, 'tests/worker.mjs')));
const {signIn} = await import(pathToFileURL(resolve(root, 'tests/auth.mjs')));
const {launchBrowser} = await import(pathToFileURL(resolve(root, 'tests/browser-launch.mjs')));
const {ownerRequest} = await import(pathToFileURL(resolve(root, 'tests/sentry-cli/owner-request.mjs')));
const head = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {encoding: 'utf8'}).trim();
const result = {head, tree, qualification: 'Synthetic local owner journey through the emitted Worker; assertions at 1440, visual captures at 1440 and 390.', checks: [], captures: []};
const privateValues = [];
let app, browser, failure;
try {
 await mkdir(resolve(packet, 'browser-proof-framed'), {recursive: true});
 app = await startTestWorker(15494);
 const origin = app.origin, cookie = await signIn(origin); privateValues.push(cookie, cookie.split('=').slice(1).join('='));
 const api = async (path, method = 'GET', body) => {
  const response = await ownerRequest(origin + path, {method, headers: {Cookie: cookie, Origin: origin, ...(body ? {'Content-Type': 'application/json'} : {})}, ...(body ? {body: JSON.stringify(body)} : {})});
  assert.ok(response.ok, `${method} ${path}: HTTP ${response.status}`);
  return response.json();
 };
 const project = await api('/api/projects', 'POST', {id: 'design-proof', name: 'Spool design proof'});
 privateValues.push(project.ingestKey, project.dsn);
 browser = await launchBrowser();
 const context = await browser.newContext({viewport: {width: 1440, height: 900}});
 await context.addCookies([{name: cookie.split('=')[0], value: cookie.slice(cookie.indexOf('=') + 1), url: origin}]);
 const page = await context.newPage(); page.setDefaultTimeout(15000);
 const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
 const capture = async (scenario, anchor) => {
  // Phone is visual proof only. Functional assertions run at 1440.
  for (const width of [1440, 390]) {
   await page.setViewportSize({width, height: 900});
   if (anchor) {
    await page.locator(anchor).evaluate(element => element.scrollIntoView({block: 'start'}));
    await page.evaluate(() => window.scrollBy(0, -90));
   } else await page.evaluate(() => window.scrollTo(0, 0));
   await page.evaluate(async () => { await document.fonts.ready; });
   const file = `browser-proof-framed/${scenario}-${width}.png`, path = resolve(packet, file);
   await page.screenshot({path, fullPage: false, mask: [page.locator('.secret-key, [data-secret], input[type="password"], pre[aria-label="SDK init"], pre[aria-label="Browser helper init"], pre[aria-label="Sentry DSN"]')]});
   const bytes = await readFile(path);
   result.captures.push({scenario, width, height: 900, file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')});
  }
  await page.setViewportSize({width: 1440, height: 900});
 };
 await page.goto(origin + '/projects/design-proof/capture');
 await page.getByLabel('Project ingest key', {exact: true}).fill(project.ingestKey);
 const sent = page.waitForResponse(response => new URL(response.url()).pathname === '/api/ingest/design-proof' && response.request().method() === 'POST');
 await page.getByRole('button', {name: 'Send the test error again', exact: true}).click();
 const sentResponse = await sent, initial = await sentResponse.json(); assert.equal(initial.outcome, 'accepted');
 const sample = sentResponse.request().postDataJSON();
 await expect(page.locator('#test-capture [role="status"]')).toContainText('New alert raised for the test error.');
 result.checks.push('Capture sends the real shared sample and names its new alert.');
 await capture('capture-result', '#test-capture');
 const companion = await fetch(origin + '/api/ingest/design-proof', {method: 'POST', headers: {Origin: origin, Authorization: 'Bearer ' + project.ingestKey, 'Content-Type': 'application/json'}, body: JSON.stringify({...sample, eventId: crypto.randomUUID(), type: 'TypeError', message: 'Unassigned filter example'})});
 assert.equal(companion.status, 201); const other = await companion.json(); assert.notEqual(other.issue, initial.issue);
 const issue = (await api('/api/projects/design-proof/issues')).find(row => row.id === initial.issue);
 const issuePath = '/projects/design-proof/issues/' + initial.issue;
 await page.goto(origin + issuePath);
 const assignment = page.getByRole('combobox', {name: 'Assign to', exact: true});
 await expect(assignment).toBeEnabled();
 const member = (await api('/api/projects/design-proof/assignment-members')).members[0];
 await assignment.selectOption(member.id);
 const [assigned] = await Promise.all([page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/assignment') && response.request().method() === 'PATCH'), page.getByRole('button', {name: 'Assign', exact: true}).click()]);
 assert.equal(assigned.status(), 200);
 await expect(assignment).toHaveValue(member.id);
 result.checks.push('Assign to saves an actual project member through the issue header.');
 await page.getByRole('button', {name: 'Details: Suppression policies', exact: true}).click();
 const policies = page.getByRole('dialog', {name: 'Suppression policies', exact: true});
 await expect(policies.getByRole('button', {name: 'Add suppression policy', exact: true})).toBeEnabled();
 await expect(policies.getByLabel('Match value', {exact: true})).toHaveValue(/[a-f0-9]{64}/);
 await policies.getByRole('button', {name: 'Add suppression policy', exact: true}).click();
 await expect(policies.getByRole('button', {name: 'Disable policy', exact: true})).toBeVisible();
 assert.equal((await api('/api/projects/design-proof/operator-state')).policies.length, 1);
 await capture('suppression-policy', 'dialog[open]');
 await policies.getByRole('button', {name: 'Disable policy', exact: true}).click();
 await expect(policies.getByRole('button', {name: 'Enable policy', exact: true})).toBeVisible();
 await page.keyboard.press('Escape');
 result.checks.push('A saved suppression policy remains visible and can be disabled through the rendered dialog.');

 await page.getByRole('link', {name: 'All issues', exact: true}).click();
 const rows = page.locator('.issue-table tbody tr'), row = rows.filter({hasText: issue.title});
 await expect(rows).toHaveCount(2); await expect(row).toContainText(member.name); await expect(row).toContainText('New');
 await capture('issues-list');
 await page.locator('.issue-filter-panel > summary').click();
 const status = page.getByRole('combobox', {name: 'Status', exact: true});
 assert.deepEqual(new Set(await status.locator('option').allTextContents()), new Set(['All statuses', 'New', 'Open', 'Resolved', 'Ignored']));
 const filtered = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).searchParams.get('assignee') === 'me');
 await page.getByRole('combobox', {name: 'Assignee', exact: true}).selectOption('me');
 assert.equal((await filtered).status(), 200); await expect(rows).toHaveCount(1); await expect(row).toContainText(member.name);
 result.checks.push('One status vocabulary and Assigned to me filter preserve the assigned row and exclude the unassigned issue.');
 await capture('issues-filters');
 await page.locator('.issue-filter-panel > summary').click();
 await row.getByRole('link', {name: issue.title, exact: true}).click();
 await expect(page.getByRole('button', {name: 'Comment', exact: true})).toBeVisible();
 await expect(page.getByRole('button', {name: 'Resolve', exact: true})).toBeVisible();
 await capture('issue-header');
 await page.getByRole('button', {name: 'Resolve', exact: true}).click();
 await expect(page.getByRole('combobox', {name: 'Resolution', exact: true})).toHaveValue('plain');
 result.checks.push('Resolve opens the plain reopening preset; it does not resolve on opening.');
 await capture('resolution-preset', '.resolve-issue');
 await page.getByRole('button', {name: 'Confirm resolve', exact: true}).click();
 await expect(page.locator('.issue-status .state-chip')).toHaveText('Resolved');
 await page.getByLabel('Project ingest key', {exact: true}).fill(project.ingestKey);
 await capture('resolved-sample', '.resolved-test');
 const repeated = page.waitForResponse(response => new URL(response.url()).pathname === '/api/ingest/design-proof' && response.request().method() === 'POST');
 await page.getByRole('button', {name: 'Send the test error again', exact: true}).click();
 assert.equal((await (await repeated).json()).issue, initial.issue);
 await expect(page.locator('.issue-status')).toContainText('Regressed');
 result.checks.push('Sending the resolved sample again returns to the same issue and shows Regressed.');
 await capture('regressed-sample');
 await page.goto(origin + '/projects/design-proof/capture');
 await page.getByLabel('Project ingest key', {exact: true}).fill('synthetic-spool-invalid');
 const refused = page.waitForResponse(response => new URL(response.url()).pathname === '/api/ingest/design-proof' && response.request().method() === 'POST');
 await page.getByRole('button', {name: 'Send the test error again', exact: true}).click();
 assert.equal((await (await refused).json()).reason, 'invalid_ingest_key');
 await expect(page.getByRole('link', {name: 'Create a new key', exact: true})).toBeVisible();
 await expect(page.getByRole('button', {name: 'Retry exact event', exact: true})).toHaveCount(0);
 assert.equal((await api('/api/projects/design-proof/issues')).find(row => row.id === initial.issue).count, 2);
 assert.equal((await api('/api/projects/design-proof/issues')).length, 2);
 assert.equal((await api('/api/projects/design-proof/issues')).find(row => row.id === other.issue).count, 1);
 result.checks.push('An invalid key names recovery, offers no exact-event retry, and changes neither issue count nor occurrence count.');
 await capture('invalid-key', '#test-capture');
 assert.deepEqual(pageErrors, []); result.checks.push('No browser page errors.');
} catch (error) { failure = error; }
finally {
 try { await browser?.close(); } catch (error) { failure ??= error; }
 try { await app?.stop(); } catch (error) { failure ??= error; }
}
if (failure) {
 let message = String(failure.stack ?? failure);
 for (const value of privateValues) if (typeof value === 'string' && value.length > 5) message = message.replaceAll(value, '[redacted]');
 message = message.replace(/https?:\/\/\S+/g, '[local URL omitted]').replace(/[a-f0-9]{64}/gi, '[long value omitted]');
 result.failure = message; result.ok = false;
} else result.ok = true;
result.utc = new Date().toISOString();
await writeFile(resolve(packet, 'browser-proof.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ok: result.ok, head, captures: result.captures.length, checks: result.checks.length, ...(result.failure ? {failure: result.failure} : {})}));
process.exitCode = failure ? 1 : 0;
