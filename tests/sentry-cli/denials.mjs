import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runCli} from './cli.mjs';

/** An ingest, agent (read-only), revoked, foreign-project or unknown token reaches no Sentry door's storage. */
export async function denialFlow({origin, api, keys, temporary}) {
 await authorityFlow({origin, keys});
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
  assert.deepEqual(stored, {artifacts: [], assemblies: []}, `${project}: no map or assembly was stored`);
 }
}

// A real stored ZIP, including CRCs and Unix external attributes, sent through chunk upload and assembly.
function bundleZip(entries) {
 const crc32 = bytes => { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; };
 const locals = [], directory = []; let offset = 0;
 for (const {name, text = '', mode = 0o100644} of entries) {
  const filename = Buffer.from(name), data = Buffer.from(text), crc = crc32(data), local = Buffer.alloc(30), central = Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
  central.writeUInt32LE(0x02014b50); central.writeUInt16LE(0x0314, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE((mode << 16) >>> 0, 38); central.writeUInt32LE(offset, 42);
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
 ];
 for (const [label, name, mode, directory, directoryMode = 0o040755] of cases) {
  const info = {type: 'source_map', url: '~/map.json', headers: {'debug-id': '11111111-1111-4111-8111-111111111111'}};
  const bytes = bundleZip([
   {name: 'manifest.json', text: JSON.stringify({files: {'first.json': info, [name]: info}})},
   {name: 'first.json', text: map},
   ...directory ? [{name: directory, mode: directoryMode}] : [], {name, mode, text: map},
  ]);
  const checksum = createHash('sha1').update(bytes).digest('hex'), form = new FormData();
  form.append('file_gzip', new Blob([gzipSync(bytes)]), checksum);
  assert.equal((await fetch(root + '/chunk-upload/', {method: 'POST', headers, body: form})).status, 200, label + ': staged');
  const request = {checksum, chunks: [checksum], projects: ['hostile'], version: 'hostile@1.0.0'};
  const response = await fetch(root + '/artifactbundle/assemble/', {method: 'POST', headers: {...headers, 'Content-Type': 'application/json'}, body: JSON.stringify(request)});
  assert.equal(response.status, 200, label + ': Sentry assembly protocol response');
  const result = await response.json(); assert.equal(result.state, 'error', label); assert.match(result.detail, /artifact bundle is unreadable: (unsupported entry type|unsafe entry name|duplicate entry name)/, label);
  assert.equal(JSON.stringify(result).includes(token), false, label + ': no token in response');
  assert.deepEqual((await api('/api/projects/hostile/sentry-uploads')).artifacts, [], label + ': no artifact, including the earlier valid map');
  assert.deepEqual(await api('/api/projects/hostile/releases'), [], label + ': no release');
  const inventory = await api('/api/projects/hostile/erasure');
  assert.equal(inventory.deleted.sentry_upload_chunks, 0, label + ': staged bytes discarded');
  const retry = await fetch(root + '/artifactbundle/assemble/', {method: 'POST', headers: {...headers, 'Content-Type': 'application/json'}, body: JSON.stringify(request)});
  assert.equal(retry.status, 200); assert.equal((await retry.json()).state, 'not_found', label + ': no successful assembly receipt');
  console.log(`ZIP refusal: ${label}; upload=200 assemble=200/error; artifacts=0 releases=0 staged-chunks=0`);
 }
}

/** All implemented method/path pairs authorize before reading bodies, including unsupported-path refusal. */
export async function authorityFlow({origin, keys}) {
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
 for (const [label, token, expected] of [['ingest', keys.ingest, 401], ['agent', keys.agent, 403], ['revoked', keys.revoked, 401], ['unknown', '0'.repeat(64), 401]]) {
  for (const [method, path] of doors) {
   const response = await fetch(origin + '/api/0' + path, {method, headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}, ...method === 'GET' ? {} : {body: '{}'}});
   assert.equal(response.status, expected, `${label}: ${method} ${path}`);
   const text = await response.text(); assert.ok(!text.includes(token), label + ': no token in refusal');
  }
  console.log(`Sentry authority: ${label}; ${doors.length} doors=${expected}`);
 }
 for (const [method, path] of doors.filter(([, path]) => path.includes('/projects/'))) {
  const response = await fetch(origin + '/api/0' + path, {method, headers: {Authorization: 'Bearer ' + keys.other, 'Content-Type': 'application/json'}, ...method === 'GET' ? {} : {body: '{}'}});
  assert.equal(response.status, 403, 'cross-project path: ' + path); await response.body?.cancel();
 }
 for (const path of ['/organizations/acme/releases/', '/organizations/acme/artifactbundle/assemble/']) {
  const response = await fetch(origin + '/api/0' + path, {method: 'POST', headers: {Authorization: 'Bearer ' + keys.other, 'Content-Type': 'application/json'}, body: JSON.stringify({projects: ['web']})});
  assert.equal(response.status, 403, 'cross-project body: ' + path); await response.body?.cancel();
 }
 console.log('Sentry authority: cross-project; 5 project-bearing doors=403');
}
