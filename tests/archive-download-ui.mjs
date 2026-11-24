import { expect } from '@playwright/test';
import { once } from 'node:events';
import { createServer } from 'node:http';

async function proveRecovery(page, archive, url) {
  const start = archive.getByRole('button', { name: 'Download private archive', exact: true });
  const retry = archive.getByRole('button', { name: 'Retry archive download', exact: true });
  const cancel = archive.getByRole('button', { name: 'Cancel download', exact: true });
  const status = archive.getByRole('status');
  const problem = archive.getByRole('alert');
  const held = Promise.withResolvers();
  const hold = async route => {
    await held.promise;
    await route.abort().catch(() => {});
  };

  // Let the local app's real fetch stall at the browser's network edge.
  await page.clock.install();
  await page.route(url, hold);
  try {
    const firstRequest = page.waitForRequest(url);
    await start.click();
    await firstRequest;
    await expect(start).toBeDisabled();
    await expect(status).not.toBeEmpty();
    await expect(cancel).toBeEnabled();
    await page.clock.fastForward(120_000);
    await expect(cancel).toBeEnabled();
    await expect(problem).toBeHidden();
    await cancel.click();
    await expect(retry).toBeEnabled();
    await expect(status).not.toBeEmpty();
  } finally {
    held.resolve();
    await page.unroute(url, hold);
  }

  // Send real headers and part of the body, then hold the transfer open.
  const origin = new URL(url).origin;
  const transfer = Promise.withResolvers();
  const stalled = createServer(async (_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Access-Control-Allow-Origin': origin });
    response.write(' ');
    await transfer.promise;
    response.write('{');
  }).listen(0, '127.0.0.1');
  try {
    await once(stalled, 'listening');
    const stalledUrl = `http://127.0.0.1:${stalled.address().port}/archive`;
    await page.route(url, route => route.continue({ url: stalledUrl }), { times: 1 });
    const headers = page.waitForResponse(response => response.status() === 200 && [url, stalledUrl].includes(response.url()));
    await retry.click();
    await headers;
    await page.clock.fastForward(120_000);
    await expect(cancel).toBeEnabled();
    await expect(problem).toBeHidden();
    transfer.resolve();
    await expect(status).toContainText(/receiving/i);
    await page.clock.fastForward(120_000);
    await expect(problem).toBeVisible();
    await expect(retry).toBeEnabled();
  } finally {
    transfer.resolve();
    stalled.closeAllConnections();
    await new Promise(resolve => stalled.close(resolve));
  }

  await page.route(url, route => route.abort('failed'), { times: 1 });
  await retry.click();
  await expect(problem).toBeVisible();
  await expect(retry).toBeEnabled();
}

export async function downloadBrowserArchive(page, origin, { exerciseRecovery = false } = {}) {
  const archive = page.getByRole('heading', { name: 'Archive and restore', exact: true }).locator('..');
  if (exerciseRecovery) await proveRecovery(page, archive, `${origin}/api/archive`);
  const downloading = page.waitForEvent('download');
  await archive.getByRole('button', { name: exerciseRecovery ? 'Retry archive download' : 'Download private archive', exact: true }).click();
  const download = await downloading;
  await expect(archive.getByRole('button', { name: 'Download private archive', exact: true })).toBeEnabled();
  await expect(archive.getByRole('status')).not.toBeEmpty();
  return download;
}
