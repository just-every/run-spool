import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

// Runs inside the existing Alerts journey, after setup has reviewed mail-v1.
export async function rulesUI(page, app, width) {
 const name = `Filtered rule ${width}`, base = '/api/projects/web/alerting';
 await page.getByRole('button', { name: 'Rules', exact: true }).click();
 const discard = page.getByRole('button', { name: 'Discard edit', exact: true });
 if (await discard.isVisible()) {
  page.once('dialog', dialog => dialog.accept());
  await discard.click();
 }
 await page.getByLabel('Rule name', { exact: true }).fill(name);
 await page.getByRole('combobox', { name: 'Destination', exact: true }).selectOption('mail-v1');
 for (const [label, checked] of [['New issue', true], ['Regression', true], ['Reactivation', true], ['Volume spike', true]]) {
  await page.getByRole('checkbox', { name: label, exact: true }).setChecked(checked);
 }
 await page.getByLabel('Enabled', { exact: true }).check();
 await page.getByLabel('Spike metric', { exact: true }).selectOption('users');
 await page.getByLabel('Complete window (minutes)', { exact: true }).fill('5');
 await page.getByLabel('Affected user threshold (more than)', { exact: true }).fill('2');
 const filters = page.locator('details.form-more').filter({ has: page.getByLabel('Environment', { exact: true }) });
 if (!await filters.evaluate(element => element.open)) await filters.locator('summary').click();
 await page.getByLabel('Environment', { exact: true }).fill('fixture');
 await page.getByLabel('Severity', { exact: true }).selectOption('error');
 await page.getByLabel('Release filter', { exact: true }).selectOption('none');
 await page.getByLabel('Allowed tag keys', { exact: true }).fill('tenant');
 await page.getByLabel('Tag tenant', { exact: true }).fill('acme');
 const create = page.getByRole('button', { name: 'Create rule', exact: true });
 assert.ok(await create.isDisabled(), 'An enabled draft requires a preview');
 async function previewRule() {
  const response = page.waitForResponse(reply => reply.url().endsWith(base + '/rules/preview') && reply.request().method() === 'POST');
  await page.getByRole('button', { name: 'Preview rule', exact: true }).click();
  const reply = await response;
  assert.ok(reply.ok(), `Rule preview failed (${reply.status()})`);
  const preview = await reply.json();
  const region = page.getByRole('region', { name: 'Rule preview', exact: true });
  await region.waitFor();
  assert.ok((await region.innerText()).includes(preview.owner));
  assert.ok((await region.innerText()).includes(preview.destination));
  return { preview, region, input: reply.request().postDataJSON() };
 }
 const refused = await previewRule();
 assert.ok(refused.preview.refusal, 'Dropped identity must refuse affected-user alerts');
 await refused.region.getByRole('alert').waitFor();
 assert.ok(await create.isDisabled(), 'A refused preview cannot enable a rule');
 assert.deepEqual(refused.input.config.filters, { environment: 'fixture', level: 'error', release: '', tags: { tenant: 'acme' } });
 await page.getByLabel('Spike metric', { exact: true }).selectOption('count');
 assert.equal(await page.getByRole('region', { name: 'Rule preview', exact: true }).count(), 0, 'A changed draft invalidates its preview');
 const accepted = await previewRule();
 assert.equal(accepted.preview.refusal, null);
 assert.ok(accepted.preview.token);
 await accepted.region.getByRole('status').waitFor();
 assert.ok(await create.isEnabled());
 await mkdir('.artifacts/alerts', { recursive: true });
 await page.screenshot({ path: `.artifacts/alerts/rules-preview-${width}.png`, fullPage: true });
 const savedResponse = page.waitForResponse(reply => reply.url().endsWith(base + '/rules') && reply.request().method() === 'POST');
 await create.click();
 const saved = await savedResponse;
 assert.ok(saved.ok(), `Filtered rule save failed (${saved.status()})`);
 assert.equal(saved.request().postDataJSON().previewToken, accepted.preview.token);
 await page.getByRole('button', { name: `Edit ${name}`, exact: true }).waitFor();
 let rule = (await app.json(base + '/rules')).find(row => row.name === name);
 assert.ok(rule);
 assert.equal(rule.enabled, 1);
 const config = typeof rule.config === 'string' ? JSON.parse(rule.config) : rule.config;
 assert.deepEqual(config, { metric: 'count', filters: { environment: 'fixture', level: 'error', release: '', tags: { tenant: 'acme' } }, tagKeys: ['tenant'] });
 // Editing must restore every filter, and disabled drafts remain saveable without a token.
 await page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
 assert.equal(await page.getByLabel('Environment', { exact: true }).inputValue(), 'fixture');
 assert.equal(await page.getByLabel('Severity', { exact: true }).inputValue(), 'error');
 assert.equal(await page.getByLabel('Release filter', { exact: true }).inputValue(), 'none');
 assert.equal(await page.getByLabel('Tag tenant', { exact: true }).inputValue(), 'acme');
 const save = page.getByRole('button', { name: 'Save rule', exact: true });
 assert.ok(await save.isDisabled());
 await page.getByLabel('Enabled', { exact: true }).uncheck();
 assert.ok(await save.isEnabled());
 const disabledResponse = page.waitForResponse(reply => reply.url().endsWith(base + '/rules/' + rule.id) && reply.request().method() === 'PUT');
 await save.click();
 const disabled = await disabledResponse;
 assert.ok(disabled.ok());
 assert.ok(!Object.hasOwn(disabled.request().postDataJSON(), 'previewToken'));
 rule = (await app.json(base + '/rules')).find(row => row.id === rule.id);
 assert.equal(rule.enabled, 0);
}
