import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runCli} from './cli.mjs';
import {deflateRawSync, gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {archiveProjection} from '../archive.mjs';

/** Compare durable product rows and transient upload state through owner reads.
 * Audit facts are allowed: refusals and archive reads must remain observable. */
export async function boundaryState({api, req}) {
 const {data} = await archiveProjection(await req('/api/archive'));
 const rows = Object.fromEntries(Object.entries(data).filter(([table]) => table !== 'audit')
  .map(([table, records]) => [table, records.map(row => JSON.stringify(row)).sort()]));
 const uploads = {};
 for (const project of ['web', 'other']) {
  const inventory = await api(`/api/projects/${project}/erasure`);
  uploads[project] = {
   releases: await api(`/api/projects/${project}/releases`),
   stored: await api(`/api/projects/${project}/sentry-uploads`),
   chunks: inventory.deleted.sentry_upload_chunks ?? 0,
   assemblies: inventory.deleted.sentry_assemblies ?? 0,
  };
 }
 return {rows, uploads};
}

/** An ingest, agent (read-only), revoked, foreign-project or unknown token reaches no Sentry door's storage. */
export async function denialFlow({origin, api, req, keys, temporary}) {
 const before = await boundaryState({api, req});
 await authorityFlow({origin, req, keys});
 const dist = resolve(temporary, 'denied-dist'); await mkdir(dist, {recursive: true});
 await writeFile(resolve(dist, 'a.js'), 'console.log(1)\n//# sourceMappingURL=a.js.map\n');
 await writeFile(resolve(dist, 'a.js.map'), JSON.stringify({version: 3, file: 'a.js', sources: ['a.ts'], sourcesContent: ['x'], names: [], mappings: 'AAAA'}));
 const cases = {ingest: [keys.ingest, 'web'], agent: [keys.agent, 'web'], revoked: [keys.revoked, 'web'], 'foreign project': [keys.other, 'web'], unknown: ['0'.repeat(64), 'web']};
 for (const [label, [token, project]] of Object.entries(cases)) {
  for (const args of [['releases', 'new', 'denied@1.0.0'], ['releases', 'finalize', 'denied@1.0.0'], ['releases', 'deploys', 'denied@1.0.0', 'new', '-e', 'production'], ['sourcemaps', 'upload', '--release', 'denied@1.0.0', dist]]) {
   const result = await runCli(args, {origin, token, project});
   assert.notEqual(result.code, 0, `${label}: ${args.slice(0, 2).join(' ')} is refused`);
   assert.match(result.output, /\b(401|403)\b|Invalid|scope|required|Release not found/i, `${label}: the client output names the refusal`);
  }
 }
 for (const project of ['web', 'other']) {
  assert.deepEqual(await api(`/api/projects/${project}/releases`), [], `${project}: no release was stored`);
  const stored = await api(`/api/projects/${project}/sentry-uploads`);
  assert.deepEqual(stored, {artifacts: [], assemblies: [], builds: []}, `${project}: no map or assembly was stored`);
 }
 assert.deepEqual(await boundaryState({api, req}), before, 'denied clients preserve all product rows, deploys, receipts and staged chunks');
}

/** API-002: valid writes against populated state, with and without the owner's cookie.
 * A staged bundle is assembled afterwards to prove its original bytes survived. */
export async function populatedDenialFlow({origin, api, req, keys}) {
 const root = '/api/0/organizations/acme', version = 'synthetic-spool-1';
 const bundle = (debug, file) => bundleZip([
  {name: 'manifest.json', text: JSON.stringify({files: {'map.json': {type: 'source_map', url: '~/map.json', headers: {'debug-id': debug}}}})},
  {name: 'map.json', text: JSON.stringify({version: 3, sources: [file], sourcesContent: ['synthetic-spool-1'], names: [], mappings: 'AAAA'})},
 ]);
 const first = bundle('33333333-3333-4333-8333-333333333333', 'first.ts');
 const staged = bundle('44444444-4444-4444-8444-444444444444', 'staged.ts');
 const checksum = bytes => createHash('sha1').update(bytes).digest('hex');
 const chunks = bytes => { const body = new FormData(); body.append('file_gzip', new Blob([gzipSync(bytes)]), checksum(bytes)); return body; };
 const assemble = bytes => ({checksum: checksum(bytes), chunks: [checksum(bytes)], projects: ['web'], version, dist: 'boundary'});
 const send = (request, token, method, path, body) => request(path, method, body, {Authorization: 'Bearer ' + token, Connection: 'close'});
 const bearer = (path, method, body, headers) => fetch(origin + path, {method, headers, body: body instanceof FormData ? body : JSON.stringify(body)});
 const jsonRequest = (path, method, body, headers) => bearer(path, method, body, {...(body instanceof FormData ? {} : {'Content-Type': 'application/json'}), ...headers});
 for (const bytes of [first, staged]) {
  const response = await send(jsonRequest, keys.deploy, 'POST', root + '/chunk-upload/', chunks(bytes));
  assert.equal(response.status, 200, 'deploy authority stages real bytes'); await response.body?.cancel();
  if (bytes === first) {
   const response = await send(jsonRequest, keys.deploy, 'POST', root + '/artifactbundle/assemble/', assemble(bytes));
   assert.equal(response.status, 200); assert.equal((await response.json()).state, 'ok', 'deploy authority stores the first map and receipt');
  }
 }
 const before = await boundaryState({api, req});
 assert.ok(before.uploads.web.releases.some(row => row.name === version));
 assert.ok(before.uploads.web.stored.artifacts.some(row => row.release === version));
 assert.ok(before.uploads.web.stored.assemblies.some(row => row.state === 'ok'));
 assert.equal(before.uploads.web.chunks, 1, 'the denied requests have live staging to protect');
 assert.ok(before.rows.sentry_deploys.length > 0, 'the denied requests have a deployment to protect');

 const writes = [
  ['POST', root + '/releases/', () => ({version: 'synthetic-spool-2', projects: ['web']})],
  ['POST', '/api/0/projects/acme/web/releases/', () => ({version: 'synthetic-spool-2'})],
  ['PUT', root + '/releases/' + version + '/', () => ({dateReleased: '2026-01-01T00:00:00.000Z', url: 'https://example.test/changed', commits: [{id: 'a'.repeat(40), message: 'synthetic-spool-2'}]})],
  ['POST', root + '/releases/' + version + '/deploys/', () => ({environment: 'production', name: 'synthetic-spool-2'})],
  ['POST', root + '/chunk-upload/', () => chunks(Buffer.from('synthetic-spool-3'))],
  ['POST', root + '/artifactbundle/assemble/', () => assemble(staged)],
  ['POST', '/api/0/projects/acme/web/files/difs/assemble/', () => ({[checksum(staged)]: {name: 'synthetic-spool-1', chunks: [checksum(staged)]}})],
 ];
 for (const [context, request] of [['bearer only', jsonRequest], ['owner cookie and Origin', req]]) {
  for (const [method, path, input] of writes) {
   const response = await send(request, keys.agent, method, path, input());
   assert.equal(response.status, 403, `${context}: read-only ${method} ${path}`);
   assert.match((await response.json()).error, /agent|read.only/i, 'the refusal identifies the limited authority');
   assert.deepEqual(await boundaryState({api, req}), before, `${context}: ${method} ${path} changes no product or upload state`);
  }
  console.log(`PROBE API-002 acceptance-4: ${context}; seven served mutation doors=403; populated release, deploy, artifact, assembly and staged-chunk state unchanged`);
 }
 const completed = await send(jsonRequest, keys.deploy, 'POST', root + '/artifactbundle/assemble/', assemble(staged));
 assert.equal(completed.status, 200); assert.equal((await completed.json()).state, 'ok', 'the permitted assembly still consumes the original staged bytes');
 const after = await boundaryState({api, req});
 assert.equal(after.uploads.web.chunks, 0);
 assert.equal(after.uploads.web.stored.artifacts.length, before.uploads.web.stored.artifacts.length + 1);
 const map = after.rows.artifacts.map(row => JSON.parse(row)).find(row => row.debug === '44444444-4444-4444-8444-444444444444');
 assert.deepEqual(JSON.parse(map.payload).sources, ['staged.ts'], 'the staged source map survived denied writes intact');
}

// A real stored ZIP, including CRCs and Unix external attributes, sent through chunk upload and assembly.
function bundleZip(entries) {
 const crc32 = bytes => { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; };
 const locals = [], directory = []; let offset = 0;
 for (const {name, text = '', mode = 0o100644, method = 0, declared} of entries) {
  const filename = Buffer.from(name), bytes = Buffer.from(text), data = method === 8 ? deflateRawSync(bytes) : bytes, size = declared ?? bytes.length, crc = crc32(bytes), local = Buffer.alloc(30), central = Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(size, 22); local.writeUInt16LE(filename.length, 26);
  central.writeUInt32LE(0x02014b50); central.writeUInt16LE(0x0314, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(method, 10); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(size, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE((mode << 16) >>> 0, 38); central.writeUInt32LE(offset, 42);
  locals.push(local, filename, data); directory.push(central, filename); offset += local.length + filename.length + data.length;
 }
 const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(Buffer.concat(directory).length, 12); end.writeUInt32LE(offset, 16);
 return Buffer.concat([...locals, ...directory, end]);
}

/** Hostile metadata is refused before a valid map or its release can be stored, even after an earlier valid entry. */
export async function hostileBundleFlow({origin, api}) {
 const {createHash} = await import('node:crypto'), {gzipSync} = await import('node:zlib');
 await api('/api/projects', 'POST', {id: 'hostile', name: 'Hostile bundle refusals'});
 const token = (await api('/api/projects/hostile/keys', 'POST', {kind: 'deploy'})).key;
 const headers = {Authorization: 'Bearer ' + token}, root = origin + '/api/0/organizations/acme';
 const map = JSON.stringify({version: 3, sources: ['a.ts'], sourcesContent: ['x'], names: [], mappings: 'AAAA'});
 const cases = [
  ['symlink', 'map.json', 0o120777], ['drive absolute', 'C:/map.json'], ['traversal directory', 'map.json', undefined, '../'],
  ['drive relative', 'C:map.json'], ['UNC', '\\\\server\\map.json'], ['mixed traversal directory', 'map.json', undefined, 'safe\\../'],
  ['backslash', 'safe\\map.json'], ['FIFO', 'map.json', 0o010644], ['symlink directory', 'map.json', undefined, 'link/', 0o120777],
  ['parent traversal', '../map.json'], ['absolute', '/map.json'], ['duplicate', 'first.json'], ['control name', 'bad\u0000map.json'],
  ['deflate underdeclared', 'map.json', undefined, undefined, undefined, {method: 8, declared: Buffer.byteLength(map) - 1}],
  ['deflate overdeclared', 'map.json', undefined, undefined, undefined, {method: 8, declared: Buffer.byteLength(map) + 1}],
  ['stored mismatch', 'map.json', undefined, undefined, undefined, {declared: Buffer.byteLength(map) + 1}],
  ['false declaration over 4 MiB', 'map.json', undefined, undefined, undefined, {method: 8, declared: 4194305}],
 ];
 for (const [label, name, mode, directory, directoryMode = 0o040755, dataOptions] of cases) {
  const info = {type: 'source_map', url: '~/map.json', headers: {'debug-id': '11111111-1111-4111-8111-111111111111'}};
  const bytes = bundleZip([
   {name: 'manifest.json', text: JSON.stringify({files: {'first.json': info, [name]: {...info, headers: {'debug-id': '22222222-2222-4222-8222-222222222222'}}}})},
   {name: 'first.json', text: map},
   ...directory ? [{name: directory, mode: directoryMode}] : [], {name, mode, text: map, ...dataOptions},
  ]);
  const checksum = createHash('sha1').update(bytes).digest('hex'), form = new FormData();
  form.append('file_gzip', new Blob([gzipSync(bytes)]), checksum);
  assert.equal((await fetch(root + '/chunk-upload/', {method: 'POST', headers, body: form})).status, 200, label + ': staged');
  assert.equal((await api('/api/projects/hostile/erasure')).deleted.sentry_upload_chunks, 1, label + ': positive staging before refusal');
  const request = {checksum, chunks: [checksum], projects: ['hostile'], version: 'hostile@1.0.0'};
  const response = await fetch(root + '/artifactbundle/assemble/', {method: 'POST', headers: {...headers, 'Content-Type': 'application/json'}, body: JSON.stringify(request)});
  assert.equal(response.status, 200, label + ': Sentry assembly protocol response');
  const result = await response.json(); assert.equal(result.state, 'error', label); assert.match(result.detail, dataOptions ? /artifact bundle is unreadable: entry (inflates past its declared size|size does not match its header)/ : /artifact bundle is unreadable: (unsupported entry type|unsafe entry name|duplicate entry name)/, label); assert.match(result.detail, /\[malformed_bundle\]/, label);
  assert.equal(JSON.stringify(result).includes(token), false, label + ': no token in response');
  assert.deepEqual((await api('/api/projects/hostile/sentry-uploads')).artifacts, [], label + ': no artifact, including the earlier valid map');
  assert.deepEqual(await api('/api/projects/hostile/releases'), [], label + ': no release');
  const inventory = await api('/api/projects/hostile/erasure');
  assert.equal(inventory.deleted.sentry_upload_chunks ?? 0, 0, label + ': staged bytes discarded');
  const retry = await fetch(root + '/artifactbundle/assemble/', {method: 'POST', headers: {...headers, 'Content-Type': 'application/json'}, body: JSON.stringify(request)});
  assert.equal(retry.status, 200); assert.equal((await retry.json()).state, 'not_found', label + ': no successful assembly receipt');
  console.log(`ZIP refusal: ${label}; upload=200 assemble=200/error; artifacts=0 releases=0 staged-chunks=0`);
 }
}

/** All implemented method/path pairs authorize before reading bodies, including unsupported-path refusal. */
export async function authorityFlow({origin, req, keys}) {
 const doors = [
  ['GET', '/organizations/acme/chunk-upload/'], ['POST', '/organizations/acme/chunk-upload/'],
  ['POST', '/organizations/acme/artifactbundle/assemble/'], ['POST', '/projects/acme/web/files/difs/assemble/'],
  ['POST', '/organizations/acme/releases/'], ['POST', '/projects/acme/web/releases/'],
  ['GET', '/organizations/acme/releases/'], ['GET', '/projects/acme/web/releases/'],
  ['GET', '/organizations/acme/releases/denied/'], ['PUT', '/organizations/acme/releases/denied/'],
  ['GET', '/organizations/acme/releases/denied/deploys/'], ['POST', '/organizations/acme/releases/denied/deploys/'],
  ['GET', '/organizations/acme/repos/'], ['GET', '/organizations/acme/releases/denied/previous-with-commits/'],
  ['POST', '/organizations/acme/unsupported/'],
 ];
 // Auth refuses before consuming a POST body. The local HTTP/1 listener closes that
 // connection; do not let undici pool it for the next independent denial probe.
 const requests = [
  ['bearer only', (path, method, body, headers) => fetch(origin + path, {method, headers: {'Content-Type': 'application/json', Connection: 'close', ...headers}, ...body ? {body: JSON.stringify(body)} : {}})],
  ['owner cookie and Origin', (path, method, body, headers) => req(path, method, body, {Connection: 'close', ...headers})],
 ];
 for (const [context, request] of requests) {
 for (const [label, token, expected] of [['ingest', keys.ingest, 401], ['agent', keys.agent, 403], ['revoked', keys.revoked, 401], ['unknown', '0'.repeat(64), 401], ['absent', null, 401], ['malformed', 'invalid token', 401]]) {
  for (const [method, path] of doors) {
   const response = await request('/api/0' + path, method, method === 'GET' ? undefined : {}, token === null ? {} : {Authorization: 'Bearer ' + token});
   assert.equal(response.status, expected, `${label}: ${method} ${path}`);
   const text = await response.text(); assert.ok(!token || !text.includes(token), label + ': no token in refusal');
  }
  console.log(`Sentry authority: ${context}; ${label}; ${doors.length} doors=${expected}`);
 }
 for (const [method, path] of doors.filter(([, path]) => path.includes('/projects/'))) {
  const response = await request('/api/0' + path, method, method === 'GET' ? undefined : {}, {Authorization: 'Bearer ' + keys.other});
  assert.equal(response.status, 403, 'cross-project path: ' + path); await response.body?.cancel();
 }
 for (const path of ['/organizations/acme/releases/', '/organizations/acme/artifactbundle/assemble/']) {
  const response = await request('/api/0' + path, 'POST', {projects: ['web']}, {Authorization: 'Bearer ' + keys.other});
  assert.equal(response.status, 403, 'cross-project body: ' + path); await response.body?.cancel();
 }
 console.log(`Sentry authority: ${context}; cross-project; 5 project-bearing doors=403`);
 }
}
