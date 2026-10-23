import assert from 'node:assert/strict';
import {readFile, rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildApp, flatMap, writeScript} from './fixtures.mjs';
import {runCli} from './cli.mjs';
import {runNode, sdkPath} from './sdk.mjs';

const source = `function charge(account){
  return account.address.city;
}
try{charge({})}catch(e){Sentry.captureException(e)}`;

/** The retained event the unmodified SDK sent for a release and dist, wherever it was grouped. */
async function eventFor(api, release, build) {
 for (const issue of (await api('/api/projects/web/issues')).filter(row => row.title.includes('city'))) {
  const event = (await api(`/api/projects/web/issues/${issue.id}/packet`)).events.find(entry => entry.release.name === release && entry.build === build);
  if (event) return event;
 }
 return null;
}
/** Capture a real failure from a built app and check the frame is original. */
async function capture({api, dsn, app, release, build}) {
 await runNode(app.outfile, {DSN: dsn});
 const event = await eventFor(api, release, build);
 assert.ok(event, `${release}: the built app's failure was captured`);
 const frame = event.atAdmission.find(entry => entry.status === 'mapped');
 assert.ok(frame, `${release}: a frame was mapped (${JSON.stringify(event.atAdmission.map(entry => entry.status))})`);
 assert.deepEqual([frame.original.file, frame.original.line, frame.original.function], [`src/${app.name}.mjs`, app.line, 'charge'], `${release}: the frame is the original source`);
 return frame;
}

export async function mapFlow({origin, api, keys, dsn, temporary}) {
 const cli = (args, options = {}) => runCli(args, {origin, token: keys.deploy, ...options});
 const stored = async () => (await api('/api/projects/web/sentry-uploads')).artifacts;

 // Debug-ID mode: inject, upload, run the built app with the unmodified SDK.
 const injected = resolve(temporary, 'injected'), release = 'checkout@2.0.0', dist = 'web-1';
 const app = await buildApp(injected, {name: 'checkout', release, dist, source, sdkPath});
 const dir = resolve(injected, 'dist');
 const inject = await cli(['sourcemaps', 'inject', dir]); assert.equal(inject.code, 0, inject.output);
 const injectedMap = JSON.parse(await readFile(app.outfile + '.map', 'utf8')), debugId = injectedMap.debug_id ?? injectedMap.debugId;
 assert.match(debugId, /^[0-9a-f-]{36}$/);
 const upload = await cli(['sourcemaps', 'upload', '--release', release, '--dist', dist, dir]);
 assert.equal(upload.code, 0, upload.output); assert.match(upload.output, /Source Map Upload Report/);
 let artifacts = await stored();
 assert.deepEqual(artifacts.map(row => [row.release, row.build, row.debug]), [[release, dist, debugId]]);
 assert.ok(find(await api('/api/projects/web/releases'), release), 'the upload registered its release');
 await capture({api, dsn, app, release, build: dist});

 const again = await cli(['sourcemaps', 'upload', '--release', release, '--dist', dist, dir]);
 assert.equal(again.code, 0, again.output);
 const afterRepeat = await stored();
 assert.deepEqual(afterRepeat.map(row => [row.debug, row.digest, row.created]), artifacts.map(row => [row.debug, row.digest, row.created]), 'a repeat upload is idempotent');

 // Release/dist mode: nothing injected, so the map is named by the URL of the script that points at it.
 const plain = resolve(temporary, 'plain'), plainRelease = 'checkout@3.0.0';
 const plainApp = await buildApp(plain, {name: 'storefront', release: plainRelease, dist: 'web-2', source, sdkPath});
 // A Node frame names its file by absolute path, so the upload's URL prefix is that directory.
 const plainUpload = await cli(['sourcemaps', 'upload', '--release', plainRelease, '--dist', 'web-2', '--url-prefix', '~' + resolve(plain, 'dist'), resolve(plain, 'dist')]);
 assert.equal(plainUpload.code, 0, plainUpload.output);
 artifacts = await stored();
 assert.equal(artifacts.filter(row => row.release === plainRelease && row.debug.startsWith('url:')).length, 1, 'the release/dist map is stored under its URL identity');
 await capture({api, dsn, app: plainApp, release: plainRelease, build: 'web-2'});

 // A different dist of the same release does not borrow another dist's map (ERR-005 identity).
 const wrongDist = resolve(temporary, 'wrong-dist');
 const wrongApp = await buildApp(wrongDist, {name: 'storefront', release: plainRelease, dist: 'web-3', source, sdkPath});
 await runNode(wrongApp.outfile, {DSN: dsn});
 const unmapped = await eventFor(api, plainRelease, 'web-3');
 assert.ok(unmapped && unmapped.atAdmission.every(entry => entry.status !== 'mapped'), 'an unregistered dist maps nothing');

 // A failed file is named in the client's own output and fails the build; the files that fit are still stored.
 const mixed = resolve(temporary, 'mixed'), mixedRelease = 'mixed@1.0.0';
 await writeScript(mixed, 'small', flatMap('small', 2000)); await writeScript(mixed, 'large', flatMap('large', 1100000));
 assert.equal((await cli(['sourcemaps', 'inject', mixed])).code, 0);
 const refused = await cli(['sourcemaps', 'upload', '--release', mixedRelease, '--dist', 'd1', mixed]);
 assert.notEqual(refused.code, 0, 'a refused map fails the client command');
 assert.match(refused.output, /1 of 2 source maps were not stored[\s\S]*large\.js\.map[\s\S]*\[too_large\]/);
 assert.equal((await stored()).filter(row => row.release === mixedRelease).length, 1, 'the map that fit is stored');
 const receipts = (await api('/api/projects/web/sentry-uploads')).assemblies;
 assert.ok(receipts.some(row => row.state === 'error' && /large\.js\.map/.test(row.detail)), 'the owner sees the same reason');
 await rm(mixed, {recursive: true, force: true});
}
const find = (rows, name) => rows.find(row => row.name === name);
