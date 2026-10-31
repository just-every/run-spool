import { absentDist } from '../src/domain/releases/build.ts';
import { loaderUpgrade } from './loader-upgrade.mjs';
// [SDK-023] Replace a site's loader tag, exercising the official SDK over the real Worker.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { startTestWorker } from './worker.mjs';
import { archiveProjection } from './archive.mjs';
import { signIn, browserSignIn } from './auth.mjs';
import { followErasure } from './project-erasure/follow.mjs';
import { hash } from '../src/domain/privacy.ts';

export async function loaderFlow({ browser, origin, request, cookie, applicationOrigin, dsns }) {
 const project = await request('/api/projects', 'POST', { id: 'synthetic-spool-loader', name: 'Checkout browser loader' });
 await request(`/api/projects/${project.id}/browser-origins`, 'POST', { origin: applicationOrigin });
 const key = new URL(project.dsn).username, keyHash = await hash(key), keyPath = `/api/projects/${project.id}/keys/${keyHash}/loader`;
 let current = await request(keyPath);
 const defaults = current.settings;
 const fixture = { key, project, origin, settings: current.settings };
 dsns.loader = fixture;
 const scriptPath = `/sdk/${key}.min.js`;
 const script = await fetch(origin + scriptPath);
 assert.equal(script.status, 200, 'Spool serves this active key loader');
 const body = await script.text();
 assert.ok(body.includes(project.dsn), 'the loader carries this public DSN');
 const other = await request('/api/projects', 'POST', { id: 'synthetic-spool-loader-other', name: 'Other project' });
 assert.ok(!body.includes(other.ingestKey), 'no other key enters the loader');
 const allIssues = () => request(`/api/projects/${project.id}/issues`);
 const occurrences = async () => (await allIssues()).reduce((n, issue) => n + issue.count, 0);
 const waitForCount = async expected => {
  for (let n = 0; n < 100; n++) { if (await occurrences() === expected) return; await new Promise(resolve => setTimeout(resolve, 50)); }
  assert.equal(await occurrences(), expected, 'each loader/direct capture is one occurrence');
 };
 await mkdir('.artifacts/sdk023', { recursive: true });
 let count = 0; const releaseLess = new Set();
 for (const width of [1440]) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } }), page = await context.newPage();
  const external = []; await context.route('**/*', async route => { if (![origin, applicationOrigin].includes(new URL(route.request().url()).origin)) { external.push(route.request().url()); await route.abort(); } else await route.continue(); });
  const bundles = []; page.on('request', req => { if (new URL(req.url()).pathname === '/spool-sentry-sdk.js') bundles.push(req.url()); });
  await page.goto(applicationOrigin + '/loader?mode=lazy');
  assert.equal(bundles.length, 0, 'default lazy loader requests no SDK before a capture');
  assert.equal(await page.evaluate(() => window.Sentry.__spoolLoader), true);
  await page.evaluate(() => window.Sentry.addBreadcrumb({ message: 'synthetic-spool-1' }));
  assert.equal(bundles.length, 0, 'non-capture stub calls remain buffered');
  await page.getByRole('button', { name: 'Capture checkout error', exact: true }).click();
  await page.waitForFunction(() => window.Sentry.getClient?.());
  await page.evaluate(() => window.Sentry.flush(10000));
  await waitForCount(++count); assert.equal(bundles.length, 1, 'the first capture loads one local SDK bundle');
  const group = (await allIssues()).find(issue => issue.title.includes('synthetic-spool-checkout'));
  assert.ok(group);
  // A separate page exercises the real pre-load uncaught-error listener.
  await page.goto(applicationOrigin + '/loader?mode=lazy');
  await page.getByRole('button', { name: 'Throw checkout error', exact: true }).click();
  await page.waitForFunction(() => window.Sentry.getClient?.()); await page.evaluate(() => window.Sentry.flush(10000));
  await waitForCount(++count);
  const owner = await context.newPage(); await browserSignIn(owner, origin);
  await owner.goto(`${origin}/projects/${project.id}/issues/${group.id}`);
  await owner.getByRole('heading', { name: /synthetic-spool-checkout/ }).first().waitFor();
  const occurrence = owner.locator('article.exception h3').filter({hasText:'synthetic-spool-checkout'}).first(); await occurrence.waitFor(); await occurrence.scrollIntoViewIfNeeded();
  await owner.screenshot({ path: `.artifacts/sdk023/loader-error-${width}.png`, fullPage: false });
  // Eager opt-out and both callbacks see a client initialized for the same DSN.
  await page.goto(applicationOrigin + '/loader?mode=eager');
  await page.waitForFunction(() => window.loaderReady === 1 && window.hookReady === 1);
  assert.equal(await page.evaluate(() => window.callbackDsn), project.dsn);
  assert.equal(await page.evaluate(() => window.hookDsn), project.dsn);
  await page.evaluate(() => { window.Sentry.onLoad(() => window.lateReady = (window.lateReady ?? 0) + 1); });
  assert.equal(await page.evaluate(() => window.lateReady), 1, 'onLoad after initialization runs immediately once');
  // Force loading works without a capture, with the same initialized callbacks.
  await page.goto(applicationOrigin + '/loader?mode=lazy'); await page.evaluate(() => window.Sentry.forceLoad());
  await page.waitForFunction(() => window.loaderReady === 1); assert.equal(await page.evaluate(() => window.callbackDsn), project.dsn);
  // Loaded and directly bundled SDKs capture the same Error at the same app source location.
  const directBefore = (await allIssues()).find(issue => issue.id === group.id).count;
  await page.goto(applicationOrigin + '/loader?mode=direct');
  await page.waitForFunction(() => window.Sentry?.getClient?.());
  await page.getByRole('button', { name: 'Capture checkout error', exact: true }).click();
  await page.evaluate(() => window.Sentry.flush(10000)); await waitForCount(++count);
  const grouped = (await allIssues()).find(issue => issue.id === group.id);
  assert.equal(grouped.count, directBefore + 1, 'direct and loader errors group together with one new occurrence');
  const events = await request(`/api/projects/${project.id}/issues/${group.id}/events`);
  for (const event of events.rows) {
   const detail = await request(`/api/projects/${project.id}/issues/${group.id}/events/${event.id}?occurrence=${event.occurrence}`);
   assert.equal(detail.event.release, releaseLess.has(event.id) ? '' : 'synthetic-spool-loader@1'); assert.equal(detail.event.build, releaseLess.has(event.id) ? absentDist : 'synthetic-spool-1');
  }
  // Maintainer changes the existing key settings through the actual dialog.
  await owner.goto(`${origin}/projects/${project.id}/settings`);
  await owner.getByRole('button', { name: 'Details: Project key', exact: true }).first().click();
  const dialog = owner.getByRole('dialog').filter({ has: owner.getByRole('heading', { name: 'Project key', exact: true }) });
  await dialog.getByLabel('Enable feedback widget', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Save loader settings', exact: true }).click();
  await dialog.getByRole('status').filter({ hasText: 'Loader settings saved.' }).waitFor();
  current = await request(keyPath); assert.equal(current.settings.feedback, true);
  await dialog.getByLabel('Public capture key for script tag', { exact: true }).fill(key);
  await dialog.locator('pre').filter({hasText:scriptPath}).waitFor();
  assert.equal(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'key settings has no horizontal overflow');
  const axe = await new AxeBuilder({ page: owner }).analyze();
  assert.deepEqual(axe.violations.filter(v => ['serious', 'critical'].includes(v.impact)), [], 'key settings has no serious Axe finding');
  const icons = await owner.locator('button').evaluateAll(buttons => buttons.filter(b => b.getClientRects().length && !b.textContent.trim()).map(b => b.getAttribute('aria-label')));
  assert.deepEqual(icons, [], 'no icon-only control on the touched settings screen');
  await owner.screenshot({ path: `.artifacts/sdk023/key-settings-${width}.png`, fullPage: false });
  await dialog.evaluate(element => { element.scrollTop = 0; });
  await owner.screenshot({ path: `.artifacts/sdk023/key-settings-top-${width}.png`, fullPage: false });
  await page.goto(applicationOrigin + '/loader?mode=lazy'); await page.waitForFunction(() => window.Sentry.getClient?.());
  assert.ok(await page.evaluate(() => window.Sentry.getClient().getIntegrationByName('Feedback')), 'changed key settings enable the official feedback integration on reload');
  // Feedback has been explicitly enabled; turn it off for next width's lazy-default proof.
  current = await request(keyPath); await request(keyPath, 'PUT', { revision: current.revision, settings: { ...current.settings, feedback: false } });
  // With no release supplied, the loader still creates and counts an ordinary occurrence.
  const priorEvents = new Set((await request(`/api/projects/${project.id}/issues/${group.id}/events`)).rows.map(row => row.id));
  await page.goto(applicationOrigin + '/loader?mode=no-release');
  await page.getByRole('button', { name: 'Capture checkout error', exact: true }).click(); await page.waitForFunction(() => window.Sentry.getClient?.()); await page.evaluate(() => window.Sentry.flush(10000)); await waitForCount(++count);
  const noRelease = (await request(`/api/projects/${project.id}/issues/${group.id}/events`)).rows.filter(row => !priorEvents.has(row.id));
  assert.equal(noRelease.length, 1, 'one release-less loader occurrence joins the same issue');
  for (const row of noRelease) {
   const detail = await request(`/api/projects/${project.id}/issues/${group.id}/events/${row.id}?occurrence=${row.occurrence}`);
   assert.equal(detail.event.release, ''); assert.equal(detail.event.build, absentDist); releaseLess.add(row.id);
  }
  assert.deepEqual(external, [], 'the loader and its optional integrations make no CDN or provider request');
  await owner.close(); await context.close();
 }
 // All per-key optional settings reach the shipped SDK; rates are explicitly chosen by the maintainer.
 current = await request(keyPath);
 const selected = { ...current.settings, tracesSampleRate: 0.2, replaysSessionSampleRate: 0.1, replaysOnErrorSampleRate: 1 };
 await request(keyPath, 'PUT', { revision: current.revision, settings: selected });
 const optionsContext = await browser.newContext(), optionsPage = await optionsContext.newPage();
 await optionsPage.goto(applicationOrigin + '/loader?mode=lazy'); await optionsPage.waitForFunction(() => window.Sentry.getClient?.());
 const actual = await optionsPage.evaluate(() => { const client = Sentry.getClient(), options = client.getOptions(); return { tracesSampleRate: options.tracesSampleRate, replaysSessionSampleRate: options.replaysSessionSampleRate, replaysOnErrorSampleRate: options.replaysOnErrorSampleRate, tracing: !!client.getIntegrationByName('BrowserTracing'), replay: !!client.getIntegrationByName('Replay') }; });
 assert.deepEqual(actual, { tracesSampleRate: selected.tracesSampleRate, replaysSessionSampleRate: selected.replaysSessionSampleRate, replaysOnErrorSampleRate: selected.replaysOnErrorSampleRate, tracing: true, replay: true }, 'per-key tracing and replay options configure the official integrations');
 await optionsPage.evaluate(async () => { await Sentry.getReplay().stop(); await Sentry.close(10000); }); await optionsContext.close();
 const releases = await request(`/api/projects/${project.id}/releases`); assert.ok(releases.some(r => r.auto_created === 1));
 const usage = await request(`/api/projects/${project.id}/outcomes`); assert.equal(usage.rows.find(r => r.reason === 'accepted').count, count, 'every loader and direct event is counted exactly once');
 const disabled = await request(keyPath); await request(keyPath, 'PUT', { revision: disabled.revision, settings: { ...disabled.settings, enabled: false } });
 const refused = async path => { const response = await fetch(origin + path); return { status: response.status, type: response.headers.get('content-type'), body: await response.text() }; };
 const unknown = await refused('/sdk/' + 'a'.repeat(64) + '.min.js');
 assert.deepEqual(await refused(scriptPath), unknown, 'disabled and unknown keys give the same script-free response');
 await request(`/api/projects/${project.id}/keys/${keyHash}`, 'DELETE');
 assert.deepEqual(await refused(scriptPath), unknown, 'revoked and unknown keys give the same script-free response');
 assert.equal(unknown.status, 404); assert.ok(!unknown.body.includes(project.dsn));
 // Custody uses the actual archive and erasure doors. No grant is exported.
 const archived = await archiveProjection(await fetch(origin + '/api/archive', { headers: { Cookie: cookie, Origin: origin } }));
 const archive = archived.text;
 assert.ok(archived.data.loader_settings.some(row => row.key_hash === keyHash)); assert.ok(!archive.includes(key), 'raw ingest key is absent from archive');
 let destination;
 try {
  destination = await startTestWorker(15523); const destinationCookie = await signIn(destination.origin);
  const headers = { Origin: destination.origin, Cookie: destinationCookie };
  const restored = await fetch(destination.origin + '/api/restore', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/x-ndjson', 'X-Confirm-Restore': 'yes' }, body: archive });
  assert.equal(restored.status, 200, 'private archive restores through the owner door'); await restored.body.cancel();
  const roundtrip = await archiveProjection(await fetch(destination.origin + '/api/archive', { headers }));
  assert.deepEqual(roundtrip.data.loader_settings, archived.data.loader_settings, 'archive restores every key setting without restoring credentials');
  const keys = await fetch(destination.origin + `/api/projects/${project.id}/keys`, { headers }); assert.deepEqual(await keys.json(), []);
  const inactive = await fetch(destination.origin + scriptPath); assert.equal(inactive.status, 404); await inactive.body.cancel();
 } finally { await destination?.stop(); }
 const preview = await request(`/api/projects/${project.id}/erasure`);
 const receipt = await followErasure(request, await request(`/api/projects/${project.id}/erasure`, 'POST', { confirm: project.id, planHash: preview.planHash }));
 assert.equal(receipt.phase, 'complete');
 const after = await fetch(origin + '/api/archive', { headers: { Cookie: cookie, Origin: origin } });
 assert.ok(!(await after.text()).includes(keyHash), 'project erasure removes the key settings');
 await loaderUpgrade({browser,applicationOrigin,dsns,defaults});
 console.log(JSON.stringify({ clause: 'SDK-023', captures: count, widths: [1440], icons: 'no icon-only control on the touched screen', loader: '/sdk/<public-key>.min.js', custody: 'archive excludes key; erasure removes settings' }));
 return { archive, project, keyHash, settings: disabled.settings };
}
