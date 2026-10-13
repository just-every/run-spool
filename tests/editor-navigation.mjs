import assert from 'node:assert/strict';
import {workbenchLink} from './navigation.mjs';

/** Drive only public browser history and the management protocol's visible controls. */
export async function editorNavigation(page, frame) {
 const management = frame.contentFrame();
 const iframe = await frame.elementHandle();
 const initial = new URL(page.url());
 let preview = 0;
 async function editHeading() {
  await page.waitForFunction(() => document.querySelector('[data-rer-editor]')?.getAttribute('data-connection') === 'connected');
  await management.getByRole('button', {name: 'Read page heading'}).click();
  await management.locator('output[data-status="captured"]').waitFor();
  const before = await management.getByLabel('Preview text', {exact: true}).inputValue();
  const text = `${before} · preview ${++preview}`;
  await management.getByLabel('Preview text', {exact: true}).fill(text);
  await management.getByRole('button', {name: 'Preview text edit', exact: true}).click();
  await management.locator('output[data-status="applied"]').waitFor();
  assert.equal(await page.getByRole('heading', {level: 1}).first().innerText(), text, 'preview reaches the rendered native leaf');
  await management.getByRole('button', {name: 'Undo preview'}).click();
  await management.locator('output[data-status="undone"]').waitFor();
  assert.equal(await page.getByRole('heading', {level: 1}).first().innerText(), before, 'undo restores the native heading');
  assert.ok(await iframe.evaluate(node => node.isConnected), 'navigation retains the original mounted iframe');
 }
 const push = async href => {
  // TanStack's browser history observes this native API; no router internals or app routes are replaced.
  await page.evaluate(href => history.pushState(history.state, '', href), href);
  await page.waitForURL(url => url.href === new URL(href, initial).href);
 };
 await editHeading();
 await (await workbenchLink(page, 'Releases')).click();
 await editHeading();
 await page.goBack(); await editHeading();
 const search = new URL(initial); search.searchParams.set('editor-navigation', 'same-leaf');
 await push(search.href); await editHeading();
 search.hash = 'editor-history';
 await push(search.href); await editHeading();
 // Identical URL and history identity must still resume after onBeforeNavigate.
 await push(search.href); await editHeading();
 await page.goBack(); await editHeading();
 await page.goBack(); await editHeading();
 await page.goForward(); await editHeading();
 for (const path of ['/editor-missing-one', '/editor-missing-two']) {
  await push(path);
  await page.waitForFunction(() => !document.querySelector('.project-picker'));
  await editHeading();
 }
 await page.goBack(); await editHeading();
 await push(initial.href); await page.locator('.project-picker').waitFor(); await editHeading();
}
