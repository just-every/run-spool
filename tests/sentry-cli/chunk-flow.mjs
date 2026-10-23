import assert from 'node:assert/strict';
import {createServer, request as httpRequest} from 'node:http';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {flatMap, writeScript} from './fixtures.mjs';
import {runCli} from './cli.mjs';

/** Forwards to Spool under Spool's own Host, points the advertised chunk URL back at itself, and drops the connection
 * on the second chunk upload, as a network failure would. */
function interruptingProxy(target) {
 let uploads = 0, self = ''; const dropped = [], upstream = new URL(target);
 const server = createServer((request, response) => {
  if (request.method === 'POST' && /\/chunk-upload\/$/.test(request.url) && ++uploads === 2) { dropped.push(request.url); request.socket.destroy(); return; }
  const headers = Object.fromEntries(Object.entries(request.headers).filter(([name]) => name !== 'host'));
  const forward = httpRequest({host: upstream.hostname, port: upstream.port, path: request.url, method: request.method, headers}, answer => {
   const rewrite = request.method === 'GET' && /\/chunk-upload\/$/.test(request.url), parts = [];
   if (!rewrite) { response.writeHead(answer.statusCode, answer.headers); answer.pipe(response); return; }
   answer.on('data', part => parts.push(part));
   answer.on('end', () => { const body = Buffer.from(Buffer.concat(parts).toString().replaceAll(target, self)); response.writeHead(answer.statusCode, {...answer.headers, 'content-length': body.length}); response.end(body); });
  });
  forward.on('error', () => response.destroy());
  request.pipe(forward);
 });
 return new Promise(done => server.listen(0, '127.0.0.1', () => { self = `http://127.0.0.1:${server.address().port}`; done({origin: self, dropped, uploads: () => uploads, close: () => new Promise(r => server.close(r))}); }));
}

export async function chunkFlow({origin, api, keys, temporary}) {
 const base = '/api/projects/chunks', cli = (args, options = {}) => runCli(args, {origin, token: keys.chunks, project: 'chunks', ...options});
 const stored = async () => (await api(base + '/sentry-uploads')).artifacts;
 const options = await (await fetch(`${origin}/api/0/organizations/acme/chunk-upload/`, {headers: {Authorization: 'Bearer ' + keys.chunks}})).json();
 assert.equal(options.hashAlgorithm, 'sha1'); assert.ok(options.chunkSize > 0 && options.maxFileSize >= 16 * 1024 * 1024 && options.concurrency > 1);
 assert.ok(options.accept.includes('artifact_bundles'));

 // Twelve incompressible maps (about 3 MiB) make several chunks across more than one request, uploaded concurrently.
 const dir = resolve(temporary, 'chunked');
 for (let index = 0; index < 12; index++) await writeScript(dir, `part${index}`, flatMap(`part${index}`, 240000));
 assert.equal((await cli(['sourcemaps', 'inject', dir])).code, 0);
 const proxy = await interruptingProxy(origin);
 try {
  const interrupted = await cli(['sourcemaps', 'upload', '--release', 'chunked@1.0.0', '--dist', 'c1', dir], {origin: proxy.origin});
  assert.notEqual(interrupted.code, 0, 'the interrupted upload fails the client');
  assert.equal(proxy.dropped.length, 1, `uploads seen ${proxy.uploads()}: ${interrupted.output}`);
  assert.equal((await stored()).length, 0, 'an interrupted upload stores no map');
 } finally { await proxy.close(); }
 const resumed = await cli(['sourcemaps', 'upload', '--release', 'chunked@1.0.0', '--dist', 'c1', dir]);
 assert.equal(resumed.code, 0, resumed.output);
 assert.equal((await stored()).length, 12, 'the restarted upload completes with every map');
 const receipt = (await api(base + '/sentry-uploads')).assemblies;
 assert.ok(receipt.some(row => row.state === 'ok'), 'the assembly is recorded as complete');

 // [SRC-004] No lifetime count; a buyer-set byte cap refuses every next file by name.
 const more = resolve(temporary, 'more');
 for (let index = 0; index < 15; index++) await writeScript(more, `more${index}`, flatMap(`more${index}`, 3000));
 assert.equal((await cli(['sourcemaps', 'inject', more])).code, 0);
 const uncapped = await cli(['sourcemaps', 'upload', '--release', 'chunked@1.0.0', '--dist', 'c1', more]);
 assert.equal(uncapped.code,0,uncapped.output);
 assert.equal((await stored()).length,27,'more than 25 maps survive in one project');
 const storage=await api(base+'/artifact-storage');
 await api(base+'/artifact-storage','PUT',{revision:storage.revision,artifact_storage_cap:storage.bytes});
 const capped = await cli(['sourcemaps', 'upload', '--release', 'chunked@2.0.0', '--dist', 'c1', more]);
 assert.notEqual(capped.code, 0);
 assert.match(capped.output, /15 of 15 source maps were not stored[\s\S]*storage cap [0-9]+ bytes[\s\S]*\[storage_cap\]/);
 for(let index=0;index<15;index++)assert.ok(capped.output.includes(`more${index}.js.map`),'every refused map is named');
 assert.equal((await stored()).length,27,'the cap refuses uploads without deleting existing maps');

 // Integrity: a chunk that does not hash to its name, and an assembly whose checksum does not match, store nothing.
 const post = (path, body) => fetch(origin + '/api/0/organizations/acme' + path, {method: 'POST', headers: {Authorization: 'Bearer ' + keys.chunks, 'Content-Type': 'application/json'}, body: JSON.stringify(body)});
 const bytes = Buffer.from('not a bundle'), sha1 = createHash('sha1').update(bytes).digest('hex');
 const form = name => { const data = new FormData(); data.append('file_gzip', new Blob([gzipSync(bytes)]), name); return data; };
 const wrongName = await fetch(`${origin}/api/0/organizations/acme/chunk-upload/`, {method: 'POST', headers: {Authorization: 'Bearer ' + keys.chunks}, body: form('f'.repeat(40))});
 assert.equal(wrongName.status, 400); assert.match((await wrongName.json()).detail, /does not match its checksum/);
 assert.equal((await fetch(`${origin}/api/0/organizations/acme/chunk-upload/`, {method: 'POST', headers: {Authorization: 'Bearer ' + keys.chunks}, body: form(sha1)})).status, 200);
 const request = {checksum: 'a'.repeat(40), chunks: [sha1], projects: ['chunks'], version: 'integrity@1.0.0'};
 const mismatch = await (await post('/artifactbundle/assemble/', request)).json();
 assert.equal(mismatch.state, 'error'); assert.match(mismatch.detail, /does not match its checksum/);
 const unreadable = await (await post('/artifactbundle/assemble/', {...request, checksum: sha1})).json();
 assert.equal(unreadable.state, 'not_found', 'the failed assembly discarded its chunks, so the client must upload them again');
 assert.equal((await stored()).length, 27, 'integrity failures store nothing');
 assert.equal((await api(base + '/releases')).some(row => row.name === 'integrity@1.0.0'), false);
 const tooBig = Buffer.alloc(options.chunkSize + 1, 1), oversized = new FormData();
 oversized.append('file_gzip', new Blob([gzipSync(tooBig)]), createHash('sha1').update(tooBig).digest('hex'));
 const before = (await api(base + '/erasure')).deleted.sentry_upload_chunks ?? 0;
 const oversize = await fetch(`${origin}/api/0/organizations/acme/chunk-upload/`, {method: 'POST', headers: {Authorization: 'Bearer ' + keys.chunks}, body: oversized});
 assert.equal(oversize.status, 400); assert.match((await oversize.json()).detail, /larger than the advertised/);
 assert.equal((await api(base + '/erasure')).deleted.sentry_upload_chunks ?? 0, before, 'oversize chunk stores no bytes');
 assert.equal((await stored()).length, 27);
 assert.equal((await api(base + '/releases')).some(row => row.name === 'integrity@1.0.0'), false);
 console.log('Sentry integrity: wrong chunk checksum=400; wrong bundle checksum=200/error; missing chunk=200/not_found; oversize chunk=400; no added artifacts/releases/staging');

}
