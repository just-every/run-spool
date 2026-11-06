import {chooseLocalAgentPolicy} from './agent-door/local-policy.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {admissionRuntime} from './admission-runtime.mjs';
import {managementEdge} from './editor-management-edge.mjs';
import {signIn} from './auth.mjs';
import {launchBrowser} from './browser-launch.mjs';
import {editorNavigation} from './editor-navigation.mjs';

const edge = await managementEdge();
let app, browser;
try {
 // An ordinary owner installation has no optional editor configuration.
 app = await admissionRuntime();
 assert.equal((await app.call('/api/editor/config')).status, 403);
 const localOwner = await signIn(app.origin);
 const absent = await app.call('/api/editor/config', undefined, {Cookie: localOwner});
 assert.equal(absent.status, 200); assert.equal((await absent.json()).config, null);
 browser = await launchBrowser();
 const ordinary = await browser.newContext();
 try {
  await ordinary.addCookies([{name: localOwner.split('=')[0], value: localOwner.split('=')[1], url: app.origin}]);
  const page = await ordinary.newPage(), errors = [];
  page.on('pageerror', () => errors.push('pageerror'));
  page.on('console', message => {if (message.type() === 'error') errors.push('console error')});
  const checked = page.waitForResponse(response => response.url().endsWith('/api/editor/config'));
  await page.goto(app.origin + '/setup'); await checked;
  await page.waitForFunction(() => !document.querySelector('form button').disabled);
  assert.equal(await page.locator('[data-rer-editor]').count(), 0);
  assert.deepEqual(errors, [], 'an unconfigured optional editor produces no browser errors');
 } finally {await ordinary.close()}
 await app.close(); app = await admissionRuntime({RER_INSTALLATION_ID: 'partial-config'});
 const partialOwner = await signIn(app.origin);
 assert.equal((await app.call('/api/editor/config', undefined, {Cookie: partialOwner})).status, 503, 'partial configuration remains a real error');
 await app.close();
 app = await admissionRuntime({RER_MANAGEMENT_ORIGIN: edge.origin, RER_INSTALLATION_ID: 'spool-editor-acceptance'});
 edge.state.allowed = app.origin;
 const anonymous = await app.call('/api/editor/config');
 assert.equal(anonymous.status, 403, 'anonymous config requests are refused');
 const refusedConfig = async response => {
  const refusal = await response.json();
  assert.equal(typeof refusal.error, 'string');
  assert.equal('config' in refusal, false, 'refusal discloses no editor configuration');
  assert.equal('expiresAt' in refusal, false, 'refusal discloses no editor expiry');
 };
 await refusedConfig(anonymous);
 const cookie = await signIn(app.origin);await chooseLocalAgentPolicy(app.origin,cookie);
 const requestedAt = Date.now();
 const config = await app.call('/api/editor/config', undefined, {Cookie: cookie});
 assert.equal(config.status, 200); assert.match(config.headers.get('cache-control'), /no-store/);
 assert.match(config.headers.get('cache-control'), /private/);
 assert.match(config.headers.get('vary'), /Cookie/i);
 const grant = await config.json(); assert.equal(grant.config.managementOrigin, edge.origin);
 assert.equal(grant.config.installationId, 'spool-editor-acceptance');
 assert.ok(grant.expiresAt > requestedAt && grant.expiresAt <= Date.now() + 30_000, 'native owner receives a current short-lived editor configuration');
 assert.equal((await app.call('/api/projects', {id: 'editor-scope', name: 'Editor scope'}, {Cookie: cookie})).status, 201);
 const projectResponse = await app.call('/api/projects', {id: 'synthetic-spool-1', name: 'Synthetic editor evidence'}, {Cookie: cookie});
 assert.equal(projectResponse.status, 201);
 const project = await projectResponse.json();
 assert.equal((await app.call('/api/projects/synthetic-spool-1/releases', {name: 'editor-release', build: 'editor-build'}, {Cookie: cookie})).status, 201);
 const captured = await app.call('/api/ingest/synthetic-spool-1', {
  version: 1, eventId: 'synthetic-spool-1', release: 'editor-release', build: 'editor-build', environment: 'production',
  type: 'TypeError', message: 'Synthetic editor authority evidence',
  frames: [{file: 'https://example.test/editor.js', line: 1, column: 0, function: 'editorAuthority'}],
 }, {Authorization: `Bearer ${project.ingestKey}`});
 assert.equal(captured.status, 201);
 const accepted = await captured.json();
 assert.equal(accepted.outcome, 'accepted');
 const agentGrant = await (await app.call('/api/projects/synthetic-spool-1/keys', {kind: 'agent'}, {Cookie: cookie})).json();
 const readIssues = async headers => {
  const response = await app.call('/api/projects/synthetic-spool-1/issues', undefined, headers);
  assert.equal(response.status, 200, 'the current authority reads the captured issue');
  const issues = await response.json();
  assert.equal(issues.length, 1);
  assert.equal(issues[0].id, accepted.issue);
  assert.equal(issues[0].title, 'TypeError: Synthetic editor authority evidence');
  assert.equal(issues[0].count, 1);
  return issues;
 };
 const ownerIssues = await readIssues({Cookie: cookie});
 const projectIssues = await readIssues({Authorization: `Bearer ${agentGrant.key}`});
 assert.equal(projectIssues[0].id, ownerIssues[0].id, 'the live project read grant receives the captured owner issue');
 const projectConfig = await app.call('/api/editor/config', undefined, {Authorization: `Bearer ${agentGrant.key}`});
 assert.equal(projectConfig.status, 403, 'project read grants receive no editor authority');
 await refusedConfig(projectConfig);
 const mixedConfig = await app.call('/api/editor/config', undefined, {Authorization: `Bearer ${agentGrant.key}`, Cookie: cookie});
 assert.equal(mixedConfig.status, 403, 'a coincident owner cookie cannot expand project-grant editor authority');
 await refusedConfig(mixedConfig);
 assert.equal((await app.call('/api/projects/synthetic-spool-1/issues', undefined, {Authorization: `Bearer ${agentGrant.key}`})).status, 200, 'the refused editor request leaves the project read grant usable');
 assert.deepEqual(await readIssues({Authorization: `Bearer ${agentGrant.key}`}), projectIssues, 'editor refusals preserve the captured issue and project read authority');
 const ownerConfig = await app.call('/api/editor/config', undefined, {Cookie: cookie});
 assert.equal(ownerConfig.status, 200, 'native owner access still works after editor refusals');
 assert.deepEqual((await ownerConfig.json()).config, grant.config);
 assert.equal((await app.call('/api/editor/config', {}, {Cookie: cookie})).status, 405);
 const document = await app.call('/', undefined, {Cookie: cookie});
 assert.ok(document.headers.get('content-security-policy').includes(`frame-ancestors 'self' ${edge.origin}`));
 assert.ok(document.headers.get('content-security-policy').includes(`frame-src 'self' ${edge.origin}`));
 const evidence = resolve(process.env.SPOOL_EDITOR_EVIDENCE ?? '.artifacts/wave-b');
 await mkdir(evidence, {recursive: true});
 for (const width of [1440, 390]) {
  const context = await browser.newContext({viewport: {width, height: 900}});
  try {
   const signedIn = await signIn(app.origin), [name, value] = signedIn.split('=');
   await context.addCookies([{name, value, url: app.origin, httpOnly: true, sameSite: 'Lax'}]);
   const page = await context.newPage(); await page.goto(app.origin);
   await page.locator('.project-picker').waitFor();
   await page.waitForURL('**/projects/editor-scope/issues');
   const host = page.locator('[data-rer-editor]'); await host.waitFor();
   await page.waitForFunction(() => document.querySelector('[data-rer-editor]')?.getAttribute('data-connection') === 'connected');
   await host.getByRole('button', {name: 'Open Run Edit Run'}).click();
   const frame = host.locator('iframe'); await frame.waitFor({state: 'visible'});
   const bounds = await frame.boundingBox(); assert.equal(Math.round(bounds.width), width); assert.ok(bounds.x >= 0 && bounds.y >= 0);
   assert.equal(new URL(await frame.getAttribute('src')).pathname, '/editor', 'native widget uses the production editor route');
   await page.waitForFunction(() => document.querySelector('[data-rer-editor]')?.shadowRoot?.querySelector('iframe')?.style.clipPath.startsWith('path('));
   const management = frame.contentFrame();
   await management.getByRole('heading', {name: 'Local management test edge'}).waitFor({state: 'visible'});
   const panel = await management.getByRole('region', {name: 'Local management test edge'}).boundingBox();
   assert.ok(panel.width > 0 && panel.height > 0 && panel.x >= 0 && panel.y >= 0 && panel.x + panel.width <= width && panel.y + panel.height <= 900, 'exposed management content fits the viewport');
   // An ordinary click must reach the revealed iframe region, without force or a CSS override.
   await management.getByRole('button', {name: 'Read page heading'}).click();
   await management.locator('output[data-status="captured"]').waitFor();
   await page.screenshot({path: resolve(evidence, `editor-${width}.png`)});
   await editorNavigation(page, frame);
   const handle = await frame.elementHandle();
   await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/editor/config')), page.evaluate(() => window.dispatchEvent(new Event('focus')))]);
   assert.ok(await handle.evaluate(node => node.isConnected), 'equivalent focus refresh preserves the open iframe');
   // Returning from a missing route starts the issue search again. Let that
   // authenticated read render its action before revoking the session.
   await page.getByRole('button', {name: 'Set up capture', exact: true}).waitFor({state: 'visible'});
   assert.equal((await app.call('/auth/signout', {}, {Cookie: signedIn})).status, 204);
   // Keep the floating editor open while exercising the host's keyboard action.
   await page.getByRole('button', {name: 'Set up capture', exact: true}).press('Enter');
   await page.waitForFunction(() => !document.querySelector('[data-rer-editor]'));
   assert.equal(new URL(page.url()).pathname, '/projects/editor-scope/capture', 'native API auth loss removes the editor without a document reload');
   await page.evaluate(() => window.dispatchEvent(new Event('focus')));
   const revokedConfig = await app.call('/api/editor/config', undefined, {Cookie: signedIn});
   assert.equal(revokedConfig.status, 403, 'revoked native session loses config authority');
   await refusedConfig(revokedConfig);
   assert.equal((await app.call('/api/editor/config', undefined, {Cookie: cookie})).status, 200, 'revoking the current browser session preserves a different native owner session');
  } finally {await context.close();}
 }
 // The browser also enforces the management service's frame-ancestors refusal.
 edge.state.denied = true;
 const context = await browser.newContext();
 try {
  const signedIn = await signIn(app.origin), [name, value] = signedIn.split('=');
  await context.addCookies([{name, value, url: app.origin, httpOnly: true, sameSite: 'Lax'}]);
  const page = await context.newPage(); const violations = [];
  page.on('console', message => {if (/frame-ancestors|framing/i.test(message.text())) violations.push(message.type());});
  await page.goto(app.origin); await page.locator('[data-rer-editor]').waitFor();
  await page.waitForFunction(() => document.querySelector('[data-rer-editor]')?.getAttribute('data-connection') === 'timeout', undefined, {timeout: 20_000});
  assert.ok(violations.length, 'browser blocked management framing');
 } finally {await context.close();}
 console.log('OWNER EDITOR passed: unconfigured owner has no editor or console errors; partial config fails; anonymous and live project-grant refusal with preserved captured evidence, native owner config and CSP, 1440 and 390 revealed interactive iframe, live preview and undo after same-leaf and missing-route history navigation, focus preservation, logout revocation, management CSP refusal.');
} finally {await browser?.close(); await app?.close(); await edge.close();}
