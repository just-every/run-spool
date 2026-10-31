import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {archiveProjection} from '../archive.mjs';

/** Public JSON writes must refuse extra fields before changing already populated product state. */
export async function fieldRefusalFlow({origin, api, req, keys, db}) {
 const root = '/api/0/organizations/acme/releases', version = 'checkout@1.0.0';
 const issue = (await api('/api/projects/web/issues')).find(row => row.state === 'open' && row.short_id);
 assert.ok(issue, 'a populated open issue makes accidental commit resolution observable');
 // This credential has never deployed: a refused request must not allocate its deployment actor.
 const fresh = (await api('/api/projects/web/keys', 'POST', {kind: 'deploy'})).key;
 const pendingVersion = 'synthetic-spool-unfinalized', finalizedAt = '2026-01-02T00:00:00.000Z';
 const pendingPath = `${root}/${pendingVersion}/`;
 const pending = await fetch(origin + root + '/', {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + keys.deploy}, body: JSON.stringify({version: pendingVersion, projects: ['web']})});
 assert.equal(pending.status, 201);
 assert.equal((await pending.json()).dateReleased, null, 'the finalization target starts unfinalized');
 const bytes = Buffer.from('synthetic-spool-staged-field-refusal'), form = new FormData();
 form.append('file_gzip', new Blob([gzipSync(bytes)]), createHash('sha1').update(bytes).digest('hex'));
 const staged = await fetch(origin + '/api/0/organizations/acme/chunk-upload/', {method: 'POST', headers: {Authorization: 'Bearer ' + keys.deploy}, body: form});
 assert.equal(staged.status, 200); await staged.body?.cancel();
 const database = await db();
 const table = async name => (await database.prepare(`SELECT * FROM ${name}`).all()).results.map(row => JSON.stringify(row)).sort();
 const snapshot = async () => ({
  product: (await archiveProjection(await req('/api/archive'))).data,
  uploads: await api('/api/projects/web/sentry-uploads'),
  actors: await table('deployment_actors'), chunks: await table('sentry_upload_chunks'),
 });
 const before = await snapshot();
 assert.ok(before.product.release_metadata.length && before.product.release_commits.length && before.product.issue_resolutions.length, 'release metadata, commits and resolutions are populated');
 assert.ok(before.product.sentry_deploys.length && before.actors.length && before.uploads.artifacts.length && before.uploads.assemblies.length && before.chunks.length, 'deployment history, actors, artifacts, receipts and staged bytes are populated');
 const canary = 'synthetic-spool-private-field-value';
 const release = {
  projects: ['web'], url: 'https://example.test/field-refusal', dateStarted: '2026-01-01T00:00:00Z', dateReleased: '2026-01-02T00:00:00Z',
  commits: [{id: 'f'.repeat(40), message: `Fixes ${issue.short_id}`}],
 };
 const doors = [
  ['POST', root + '/', {version: 'synthetic-spool-org-create', ...release}, 'cli.release', '/api/0/organizations/:org/releases/'],
  ['POST', '/api/0/projects/acme/web/releases/', {version: 'synthetic-spool-project-create', ...release}, 'cli.release', '/api/0/projects/:org/:project/releases/'],
  ['PUT', `${root}/${version}/`, release, 'cli.release', '/api/0/organizations/:org/releases/:version/'],
  ['PUT', pendingPath, {projects: ['web'], dateReleased: finalizedAt}, 'cli.release', '/api/0/organizations/:org/releases/:version/'],
  ['POST', `${root}/${version}/deploys/`, {environment: 'field-refusal', name: 'synthetic-spool-deploy', url: 'https://example.test/deploy', dateStarted: '2026-01-01T00:00:00Z', dateFinished: '2026-01-02T00:00:00Z'}, 'cli.deploy', '/api/0/organizations/:org/releases/:version/deploys/'],
 ];
 const send = (method, path, body, token = keys.deploy) => fetch(origin + path, {
  method, headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token, Connection: 'close'}, body: JSON.stringify(body),
 });
 for (const [method, path, body, action, endpoint] of doors) {
  // Null and false are still supplied fields; long names cannot produce an unbounded diagnostic.
  for (const [field, value] of [['unsupportedField', canary], ['unsupportedNull', null], ['unsupportedFalse', false], ['long' + 'x'.repeat(1000), canary]]) {
   const sequence = (await database.prepare('SELECT COALESCE(MAX(sequence),0) n FROM spool_audit_events').first()).n;
   const response = await send(method, path, {...body, [field]: value}, fresh);
   assert.equal(response.status, 400, `${method} ${path}: unsupported field refused`);
   const result = await response.json();
   assert.equal(result.error, result.detail);
   assert.ok(result.detail.includes('Unsupported field') && result.detail.includes(field.slice(0, 64)), 'the field is named');
   assert.ok(result.detail.endsWith(`for ${method} ${endpoint}.`), 'the specific endpoint is named without reflecting route identifiers');
   assert.ok(result.detail.length < 650, 'the field diagnostic is bounded');
   assert.ok(!JSON.stringify(result).includes(canary), 'no field value is reflected');
   const facts = (await database.prepare('SELECT * FROM spool_audit_events WHERE sequence>? ORDER BY sequence').bind(sequence).all()).results;
   assert.equal(facts.length, 1, 'one safe HTTP refusal fact, no mutation fact');
   assert.deepEqual([facts[0].source, facts[0].action, facts[0].outcome, facts[0].status, facts[0].actor_kind], ['request', action, 'invalid', 400, 'deploy']);
   assert.ok(!JSON.stringify(facts).includes(canary) && !JSON.stringify(facts).includes(field), 'audit facts retain neither values nor field names');
   assert.deepEqual(await snapshot(), before, 'refusal preserves metadata, commits, resolutions, deployment actors and history, artifacts and upload state');
  }
  for (const [token, status] of [[keys.ingest, 401], [keys.agent, 403], [keys.revoked, 401], ['synthetic_spool_unknown', 401]]) {
   const response = await send(method, path, {...body, unsupportedField: canary}, token);
   assert.equal(response.status, status, 'authentication precedes field validation');
   assert.ok(!(await response.text()).includes('unsupportedField'), 'no validation detail before authentication');
  }
  const foreign = await send(method, path, {...body, projects: ['web'], unsupportedField: canary}, keys.other);
  assert.equal(foreign.status, 403, 'project scope precedes field validation, including deployment bodies');
  assert.ok(!(await foreign.text()).includes('unsupportedField'));
  console.log(`PROBE API-002 ${method} ${path}: extra fields -> 400, bounded named error, safe audit, unchanged populated state; auth first`);
 }
 // Both create aliases must also refuse an attempted change to an existing release.
 for (const [, path] of doors.slice(0, 2)) {
  const response = await send('POST', path, {...release, version, unsupportedField: canary});
  assert.equal(response.status, 400); await response.body?.cancel();
 }
 // An update cannot silently ignore a requested rename, either.
 const rename = await send('PUT', `${root}/${version}/`, {...release, version: 'synthetic-spool-rename'});
 assert.equal(rename.status, 400); assert.match((await rename.json()).detail, /Unsupported field "version"/);
 const refs = await send('PUT', `${root}/${version}/`, {refs: [{repository: 'synthetic-spool-repository', commit: 'e'.repeat(40)}]});
 assert.equal(refs.status, 501); assert.match((await refs.json()).detail, /Repository refs.*SRC-002/);
 const unsupported = await send('POST', '/api/0/organizations/acme/unsupported/', {});
 assert.equal(unsupported.status, 501); assert.ok((await unsupported.json()).detail.includes('POST /api/0/organizations/acme/unsupported/'));
 assert.deepEqual(await snapshot(), before, 'auth, project, refs and endpoint refusals preserve populated product state');
 console.log('PROBE API-002 refs and endpoint: named 501; read-only, revoked and foreign grants: auth refusal; no product changes');
 const stillPending = await send('GET', pendingPath);
 assert.equal(stillPending.status, 200);
 assert.equal((await stillPending.json()).dateReleased, null, 'refused finalization leaves the release unfinalized');
 for (const dateReleased of [finalizedAt, '2026-01-03T00:00:00Z']) {
  const valid = await send('PUT', pendingPath, {projects: ['web'], dateReleased});
  assert.equal(valid.status, 200, 'supported finalization and its retry succeed');
  assert.equal((await valid.json()).dateReleased, finalizedAt, 'the first successful finalization stands');
 }
 console.log('PROBE API-002 finalization: extra fields leave dateReleased=null; supported retry -> 200, first successful date retained');
}
