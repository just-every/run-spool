// [SDK-004] The unmodified SDK and the queued loader stub request Spool's own hosted dialog.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { browserSignIn } from './auth.mjs';
import { archiveProjection } from './archive.mjs';
import { hash } from '../src/domain/privacy.ts';
export async function reportDialogFlow({ browser, origin, cookie, request, applicationOrigin, dsns }) {
 const project = await request('/api/projects', 'POST', { id: 'synthetic-spool-dialog', name: 'Checkout crash reports' });
 await request(`/api/projects/${project.id}/browser-origins`, 'POST', { origin: applicationOrigin });
 dsns.dialog = project.dsn;
 const key = new URL(project.dsn).username, root = `/api/projects/${project.id}`, alias = new URL(project.dsn).pathname;
 dsns.loader = { origin, key, project };
 const name = 'synthetic-spool-name-' + crypto.randomUUID(), email = 'synthetic-spool-' + crypto.randomUUID() + '@example.test';
 const dialogPath = (dsn = project.dsn, eventId = 'a'.repeat(32)) => '/api/embed/error-page/?' + new URLSearchParams({ dsn, eventId });
 const inspect = async (page, name, width, scope) => {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${name} ${width}: no overflow`);
  const axe = new AxeBuilder({ page }); if (scope) axe.include(scope);
  assert.deepEqual((await axe.analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact)), [], `${name} ${width}: no serious Axe finding`);
  assert.deepEqual(await page.locator('button').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length && !n.textContent.trim()).map(n => n.getAttribute('aria-label'))), [], 'no icon-only control on the touched screen');
  await page.screenshot({ path: `.artifacts/sdk004/${name}-${width}.png` });
 };
 await mkdir('.artifacts/sdk004', { recursive: true });
 const rows = [];
 for (const width of [1440, 390]) for (const mode of ['browser', 'loader']) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } }), page = await context.newPage();
  try {
   // A real SDK capture supplies the occurrence. The queued stub is called before its bundle loads.
   await page.goto(applicationOrigin + (mode === 'browser' ? '/?target=dialog' : '/loader?mode=direct'));
   await page.waitForFunction(() => window.__SDK_READY__ || window.Sentry?.getClient?.());
   await page.getByRole('button', { name: mode === 'browser' ? 'Throw checkout exception' : 'Capture checkout error', exact: true }).click();
   await page.waitForFunction(() => (window.__SPOOL_RESPONSES__?.some(r => r.type === 'event' && r.status === 200)) || window.Sentry?.lastEventId?.());
   const eventId = await page.evaluate(async () => { if (window.Sentry) { await Sentry.flush(10000); return Sentry.lastEventId(); } return undefined; });
   let event;
   for (let i = 0; i < 100 && !event; i++) {
    for (const issue of await request(root + '/issues')) {
     const packet = await request(root + `/issues/${issue.id}/packet`);
     event = packet.events.find(e => mode === 'loader' ? e.id === eventId : !rows.some(r => r.eventId === e.id));
     if (event) { event = { ...event, issueId: issue.id }; break; }
    }
    if (!event) await new Promise(done => setTimeout(done, 50));
   }
   assert.ok(event, 'the SDK error is retained before its report');
   if (mode === 'loader') await page.goto(applicationOrigin + '/loader?mode=lazy');
   await page.getByRole('button', { name: mode === 'browser' ? 'Throw checkout exception' : 'Capture checkout error', exact: true }).focus();
   const requested = page.waitForResponse(response => new URL(response.url()).pathname === '/api/embed/error-page/');
   await page.evaluate(({ eventId, name, email, mode }) => {
    const options = { eventId, user: { name, email }, onClose: () => { window.dialogClosed = (window.dialogClosed ?? 0) + 1; } };
    if (mode === 'loader') { window.wasQueued = !!window.Sentry.__spoolLoader; window.Sentry.showReportDialog(options); }
    else window.openReportDialog(options);
   }, { eventId: event.id, name, email, mode });
   const loaded = await requested; assert.equal(loaded.status(), 200); assert.ok(! (await loaded.text()).includes(email));
   if (mode === 'loader') assert.equal(await page.evaluate(() => window.wasQueued), true);
   const dialog = page.getByRole('dialog', { name: 'Tell us what happened' }), description = dialog.getByLabel('Description', { exact: true });
   await dialog.waitFor(); await description.fill(''); await dialog.getByRole('button', { name: 'Send report', exact: true }).click(); await dialog.getByRole('alert').waitFor();
   const message = `Checkout kept spinning after payment on ${width === 1440 ? 'my laptop' : 'my phone'}. ${mode === 'loader' ? 'Refreshing showed an empty basket.' : 'I could not tell whether the order went through.'}`;
   await description.fill(message); await dialog.getByRole('button', { name: 'Send report', exact: true }).click();
   await dialog.getByRole('alert').filter({ hasText: 'Consent' }).waitFor();
   await inspect(page, `${mode}-dialog`, width, '.spool-report-dialog');
   await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Send report', exact: true }).click();
   await dialog.getByRole('status').waitFor();
   await inspect(page, `${mode}-sent`, width, '.spool-report-dialog');
   await dialog.getByRole('button', { name: 'Close report', exact: true }).click();
   await page.waitForFunction(() => window.dialogClosed === 1);
   assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'BUTTON', 'closing returns focus to the application');
   const feedback = await request(root + '/feedback');
   const report = feedback.items.find(r => r.message === message);
   assert.equal(report?.eventId, event.id); assert.equal(report?.issueId, event.issueId); assert.equal(report?.association, 'attached');
   rows.push({ ...report, eventId: event.id });
   const owner = await context.newPage(); await browserSignIn(owner, origin); await owner.goto(`${origin}/projects/${project.id}/issues/${event.issueId}`);
   await owner.getByText(message, { exact: true }).waitFor();
   const panel = owner.getByRole('region', { name: 'Issue feedback', exact: true });
   await panel.scrollIntoViewIfNeeded(); await inspect(owner, `${mode}-issue-feedback`, width, '[aria-label="Issue feedback"]');
   for (const canary of [name, email]) {
    assert.ok(!(await owner.content()).includes(canary));
    assert.ok(!JSON.stringify([feedback, await request(root + `/issues/${event.issueId}/packet`)]).includes(canary));
   }
  } finally { await context.close(); }
 }
 const exportNow = async () => archiveProjection(await fetch(origin + '/api/archive', { headers: { Cookie: cookie, Origin: origin } }));
 const snapshot = await exportNow(); for (const canary of [name, email]) assert.ok(!snapshot.text.includes(canary), 'dialog options have no stored custody');
 const send = (comments, headers = {}) => fetch(origin + `/api${alias}/envelope/?sentry_key=${key}&sentry_version=7`, { method: 'POST', headers: { 'Content-Type': 'application/x-sentry-envelope', ...headers }, body: '{}\n{"type":"user_report"}\n' + JSON.stringify({ event_id: crypto.randomUUID().replaceAll('-', ''), comments }) + '\n' });
 assert.equal((await send('x'.repeat(1001))).status, 413, 'the shared intake refuses an over-limit description');
 assert.equal((await send('forbidden', { Origin: 'https://forbidden.synthetic-spool.example' })).status, 403);
 // A separate project makes the per-minute bound independent of the earlier reports.
 const bounded = await request('/api/projects', 'POST', { id: 'synthetic-spool-dialog-bound', name: 'Bounded feedback' });
 await request(`/api/projects/${bounded.id}/browser-origins`, 'POST', { origin: applicationOrigin });
 const boundDsn = new URL(bounded.dsn), boundEndpoint = `${origin}/api${boundDsn.pathname}/envelope/?sentry_key=${boundDsn.username}&sentry_version=7`;
 const reports = Array.from({ length: 60 }, () => '{"type":"user_report"}\n' + JSON.stringify({ event_id: crypto.randomUUID().replaceAll('-', ''), comments: 'synthetic-spool-bound-report' }));
 assert.equal((await fetch(boundEndpoint, { method: 'POST', body: '{}\n' + reports.join('\n') + '\n' })).status, 200);
 const errorContext = await browser.newContext(), errorPage = await errorContext.newPage();
 try {
  dsns.dialog = bounded.dsn; await errorPage.goto(applicationOrigin + '/?target=dialog'); await errorPage.waitForFunction(() => window.__SDK_READY__);
  await errorPage.evaluate(() => window.openReportDialog({ eventId: 'b'.repeat(32) }));
  const dialog = errorPage.getByRole('dialog'); await dialog.getByLabel('Description', { exact: true }).fill('synthetic-spool-bound-refusal'); await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Send report', exact: true }).click(); await dialog.getByRole('alert').filter({ hasText: 'Too many reports' }).waitFor();
  await errorPage.keyboard.press('Escape'); assert.equal(await dialog.count(), 0);
  await request(`/api/projects/${bounded.id}/browser-origins`, 'DELETE', { origin: applicationOrigin });
  await errorPage.evaluate(() => window.openReportDialog({ eventId: 'c'.repeat(32) }));
  const failed = errorPage.getByRole('dialog'); await failed.getByLabel('Description', { exact: true }).fill('synthetic-spool-send-failure'); await failed.getByRole('checkbox').check();
  await failed.getByRole('button', { name: 'Send report', exact: true }).click(); await failed.getByRole('alert').filter({ hasText: 'could not be sent' }).waitFor();
  await failed.getByRole('button', { name: 'Close report', exact: true }).click();
  assert.equal((await request(`/api/projects/${bounded.id}/feedback`)).total, 60, 'refusals create no report');
  const boundOutcomes = await request(`/api/projects/${bounded.id}/outcomes`);
  assert.equal(boundOutcomes.rows.find(r => r.reason === 'feedback_rate_limited').count, 1);
 } finally { dsns.dialog = project.dsn; await errorContext.close(); }
 const refusal = async (path, method = 'GET') => { const r = await fetch(origin + path, { method }); return { status: r.status, body: await r.text(), cache: r.headers.get('cache-control'), cors: r.headers.get('access-control-allow-origin'), nosniff: r.headers.get('x-content-type-options') }; };
 const unknownDsn = new URL(project.dsn); unknownDsn.username = 'a'.repeat(64);
 const unknown = await refusal(dialogPath(unknownDsn.href)); assert.equal(unknown.status, 404); assert.equal(unknown.body, '');
 const keyPath = root + `/keys/${await hash(key)}/loader`, loader = await request(keyPath);
 await request(keyPath, 'PUT', { revision: loader.revision, settings: { ...loader.settings, enabled: false } });
 assert.deepEqual(await refusal(dialogPath()), unknown, 'disabled and unknown keys answer identically');
 await request(keyPath, 'PUT', { revision: loader.revision + 1, settings: loader.settings });
 for (const path of [dialogPath() + '&dsn=' + encodeURIComponent(project.dsn), dialogPath(project.dsn, 'bad'), dialogPath(project.dsn.replace(alias, '/999999'))]) assert.deepEqual(await refusal(path), unknown);
 assert.deepEqual(await refusal(dialogPath(), 'POST'), unknown);
 const head = await fetch(origin + dialogPath(), { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
 await request(root + `/keys/${await hash(key)}`, 'DELETE'); assert.deepEqual(await refusal(dialogPath()), unknown, 'revoked and unknown keys answer identically');
 await request(root + '/feedback/' + rows[0].id, 'DELETE');
 assert.ok(!(await request(root + '/feedback')).items.some(r => r.id === rows[0].id));
 assert.ok(!(await exportNow()).text.includes(rows[0].message), 'withdrawal removes the report from the next export');
 const outcomes = await request(root + '/outcomes');
 assert.ok(outcomes.rows.some(r => r.reason === 'feedback_oversized' && r.count === 1));
 assert.ok(outcomes.rows.some(r => r.reason === 'filtered:allowed_domains' && r.count === 1));
}
