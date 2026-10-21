import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {bundlers, originalLine, prepare} from './bundlers.mjs';
import {runNode} from './sdk.mjs';

/** The released Sentry bundler plugins, unmodified, build an app; Spool holds their release, deploy and maps, and the
 * app's own failure maps to its original source. */
export async function pluginFlow({origin, api, keys, dsn, temporary}) {
 const release = 'bundlers@1.0.0', stored = async () => (await api('/api/projects/web/sentry-uploads')).artifacts;
 for (const [name, bundle] of Object.entries(bundlers)) {
  const root = resolve(temporary, 'bundler-' + name); await prepare(root);
  const before = (await stored()).length;
  const built = await bundle(root, {origin, token: keys.deploy}, release, name);
  const mine = (await stored()).filter(row => row.release === release && row.build === name);
  assert.equal(mine.length, 1, `${name}: the plugin uploaded its map (${(await stored()).length - before} new)`);
  assert.match(mine[0].debug, /^[0-9a-f-]{36}$/, `${name}: the map is stored under its injected debug ID`);
  await runNode(built, {DSN: dsn, REL: release, DIST: name});
  const events = [];
  for (const issue of await api('/api/projects/web/issues')) for (const entry of (await api(`/api/projects/web/issues/${issue.id}/packet`)).events) if (entry.release.name === release && entry.build === name) events.push(entry);
  assert.equal(events.length, 1, `${name}: the built app's failure was captured`);
  const frame = events[0].atAdmission.find(entry => entry.status === 'mapped');
  assert.ok(frame, `${name}: a frame is mapped (${JSON.stringify(events[0].atAdmission.map(entry => entry.status))})`);
  assert.deepEqual([frame.original.file.replace(/^.*\//, ''), frame.original.line, frame.original.function], ['entry.mjs', originalLine, 'charge'], `${name}: the frame is the original source`);
 }
 const row = (await api('/api/projects/web/releases')).find(entry => entry.name === release);
 assert.ok(row && row.auto_created === 0 && Number.isSafeInteger(row.finalized), 'the plugins registered and finalized one release');
 assert.equal((await api('/api/projects/web/releases')).filter(entry => entry.name === release).length, 1);
}
