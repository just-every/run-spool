// Released browser-extension qualification at the same locally served production boundary as tunnel-flow.
// No browser request interception, custom blocking rules, or patched SDK or extension code is used here.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const wait = ms => new Promise(done => setTimeout(done, ms));

async function releasedExtension(temporary) {
  const pin = JSON.parse(await readFile('tests/fixtures/adblock/ubol-release.json', 'utf8'));
  const archive = resolve(temporary, 'blocker.zip'), directory = resolve(temporary, 'blocker');
  // An optional local cache still has to match the released archive, including its full privacy ruleset.
  const bytes = process.env.SPOOL_ADBLOCK_ARCHIVE
    ? await readFile(process.env.SPOOL_ADBLOCK_ARCHIVE)
    : await (async () => {
      const response = await fetch(pin.archive, { signal: AbortSignal.timeout(90_000) });
      assert.equal(response.status, 200, 'released ad-blocker archive must be downloadable');
      return Buffer.from(await response.arrayBuffer());
    })();
  assert.equal(bytes.length, pin.bytes, 'released ad-blocker archive length');
  assert.equal(digest(bytes), pin.sha256, 'released ad-blocker archive checksum');
  await writeFile(archive, bytes);
  const entries = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n');
  assert.ok(entries.every(entry => !entry.startsWith('/') && !entry.split('/').includes('..')), 'archive stays inside its disposable extension directory');
  await mkdir(directory);
  execFileSync('unzip', ['-q', archive, '-d', directory]);
  for (const [path, checksum] of [[pin.privacyList.path, pin.privacyList.sha256], [pin.privacyList.metadataPath, pin.privacyList.metadataSha256]]) {
    assert.equal(digest(await readFile(resolve(directory, path))), checksum, 'released privacy list and its metadata remain unchanged');
  }
  const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, pin.version, 'the installed extension is the pinned release');
  const rules = JSON.parse(await readFile(resolve(directory, pin.privacyList.path), 'utf8'));
  const list = JSON.parse(await readFile(resolve(directory, pin.privacyList.metadataPath), 'utf8')).find(row => row.id === pin.privacyList.id);
  assert.ok(list?.enabled && list.rules.total > 0, 'the release includes the standard privacy list enabled by default');
  return { pin, directory, rules, list };
}

export async function extensionFlow({ temporary, browser, nextOrigin, request }) {
  const { pin, directory, rules, list } = await releasedExtension(temporary);
  let context;
  const occurrences = async () => {
    const rows = []; let cursor;
    do {
      const page = await request('/api/projects/tunnel/occurrences' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
      rows.push(...page.rows); cursor = page.next;
      if (!cursor) assert.equal(rows.length, page.total, 'enumeration includes every retained occurrence');
    } while (cursor);
    return rows;
  };
  const ids = rows => rows.map(row => row.id).sort();
  const captured = (page, messages) => page.evaluate(messages => window.report(messages), messages);
  const open = async (owner, direct = false) => {
    const page = await owner.newPage();
    await page.goto(nextOrigin + (direct ? '?direct=1' : ''));
    await page.waitForFunction(() => typeof window.report === 'function');
    return page;
  };
  const settled = async expected => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const rows = await occurrences();
      if (rows.length >= expected) return rows;
      await wait(50);
    }
    assert.fail('browser captures did not reach the emitted Worker');
  };
  try {
    context = await chromium.launchPersistentContext(resolve(temporary, 'extension-profile'), {
      channel: 'chromium', headless: true, viewport: { width: 1440, height: 900 },
      ...(existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}),
      args: ['--no-sandbox', `--disable-extensions-except=${directory}`, `--load-extension=${directory}`],
    });
    let service;
    try { service = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15_000 }); }
    catch (cause) { throw new Error('Released ad-blocker extension did not load; extension qualification cannot be skipped (check browser extension policy)', { cause }); }
    const installed = await service.evaluate(() => ({ id: chrome.runtime.id, version: chrome.runtime.getManifest().version }));
    assert.equal(installed.version, pin.version, 'a real released extension service worker is running');
    let enabled;
    for (let attempt = 0; attempt < 100; attempt++) {
      enabled = await service.evaluate(() => chrome.declarativeNetRequest.getEnabledRulesets());
      if (enabled.includes(pin.privacyList.id)) break;
      await wait(50);
    }
    assert.ok(enabled.includes(pin.privacyList.id), 'standard EasyPrivacy list must be active in the extension');

    // Establish that this exact built app and direct SDK transport work without the extension.
    const before = await occurrences(), plain = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    let control;
    try { control = await captured(await open(plain, true), ['synthetic-spool-extension-control']); }
    finally { await plain.close(); }
    assert.equal(control.length, 1);
    let rows = await settled(before.length + 1);
    assert.deepEqual(ids(rows), [...ids(before), ...control].sort(), 'direct intake works without the extension, with exactly one occurrence');

    const direct = await open(context, true), refused = [];
    direct.on('requestfailed', request => { if (request.url().includes('/envelope/?sentry_')) refused.push({ url: request.url(), error: request.failure()?.errorText }); });
    const blockedIds = await captured(direct, ['synthetic-spool-extension-blocked']);
    assert.equal(blockedIds.length, 1);
    await wait(800);
    assert.ok(refused.some(row => row.error?.includes('ERR_BLOCKED_BY_CLIENT')), 'the installed extension refuses the SDK direct request');
    const matching = await service.evaluate(({ url, initiator }) => chrome.declarativeNetRequest.testMatchOutcome({ url, initiator, type: 'xmlhttprequest', requestMethod: 'post' }), { url: refused[0].url, initiator: nextOrigin });
    assert.ok(matching.matchedRules.some(match => match.rulesetId === pin.privacyList.id && rules.find(rule => rule.id === match.ruleId)?.action.type === 'block'), 'the active standard privacy list causes the direct refusal');
    assert.deepEqual(ids(await occurrences()), ids(rows), 'extension-blocked capture creates no occurrence');
    await direct.close();

    const page = await open(context), replies = [];
    page.on('response', response => { if (response.url() === nextOrigin + '/monitoring') replies.push(response.status()); });
    const messages = Array.from({ length: 6 }, (_, index) => `synthetic-spool-extension-error-${index + 1}`);
    const capturedIds = await captured(page, messages);
    assert.equal(capturedIds.length, messages.length, 'the bounded unmodified SDK program captures every error');
    assert.equal(new Set(capturedIds).size, messages.length, 'each capture has a distinct SDK event ID');
    assert.ok(capturedIds.every(id => /^[a-f0-9]{32}$/.test(id)), 'capture IDs come from the SDK');
    assert.equal(replies.length, messages.length, 'every browser envelope receives a tunnel response');
    assert.ok(replies.every(status => status === 200), 'every tunnel response succeeds with the extension active');
    const expected = [...ids(rows), ...capturedIds].sort();
    rows = await settled(expected.length);
    assert.deepEqual(ids(rows), expected, 'every captured event ID arrives exactly once through the installed Next.js tunnel');
    for (let index = 0; index < capturedIds.length; index++) assert.equal(rows.find(row => row.id === capturedIds[index])?.message, messages[index], 'each occurrence retains its matching browser error');
    assert.ok(blockedIds.every(id => !rows.some(row => row.id === id)), 'the blocked direct error remains absent');
    const issues = await request('/api/projects/tunnel/issues');
    assert.equal(issues.reduce((total, issue) => total + issue.count, 0), expected.length, 'issue occurrence quantities equal the complete captured inventory');
    console.log(JSON.stringify({ probe: 'SDK-021 acceptance 2', extension: { name: pin.name, version: installed.version, sha256: pin.sha256 }, privacyList: { id: list.id, version: pin.privacyList.version, sha256: pin.privacyList.sha256, rules: list.rules.total, enabled: true }, directControl: control.length, extensionRefusals: blockedIds.length, tunnelCaptured: capturedIds.length, tunnelOccurrences: capturedIds.length, eventIds: capturedIds, boundary: 'production Next.js build and start, installed Spool package, emitted Spool Worker', passed: true }));
    return { version: installed.version, list: pin.privacyList.version, captured: capturedIds.length };
  } finally { await context?.close(); }
}
