import { expect } from '@playwright/test';

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
    await expect(problem).toBeVisible();
    await expect(retry).toBeEnabled();

    const nextRequest = page.waitForRequest(url);
    await retry.click();
    await nextRequest;
    await expect(status).not.toBeEmpty();
    await cancel.click();
    await expect(retry).toBeEnabled();
    await expect(status).not.toBeEmpty();
  } finally {
    held.resolve();
    await page.unroute(url, hold);
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
