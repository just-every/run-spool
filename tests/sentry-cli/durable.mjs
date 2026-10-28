import assert from 'node:assert/strict';
import {archiveProjection} from '../archive.mjs';
import {followErasure} from '../project-erasure/follow.mjs';
import {startTestWorker} from '../worker.mjs';
import {signIn} from '../auth.mjs';

const client = (origin, cookie) => {
 const req = (path, method = 'GET', body, headers = {}) => fetch(origin + path, {method, headers: {Origin: origin, Cookie: cookie, ...body ? {'Content-Type': typeof body === 'string' ? 'application/x-ndjson' : 'application/json'} : {}, ...headers}, ...body ? {body: typeof body === 'string' ? body : JSON.stringify(body)} : {}});
 const json = async (...args) => { const response = await req(...args); assert.ok(response.ok, `${args[0]} ${response.status}`); return response.json(); };
 return {req, json};
};

/** The CLI's release and deploy records archive and restore inert; staging never leaves the installation; erasure removes all of it. */
export async function durableFlow({origin, api, req, keys}) {
 // Stage one chunk and leave it unassembled, so the erasure below has staging to remove.
 const bytes = Buffer.from('staged and never assembled'), {createHash} = await import('node:crypto'), {gzipSync} = await import('node:zlib');
 const data = new FormData(); data.append('file_gzip', new Blob([gzipSync(bytes)]), createHash('sha1').update(bytes).digest('hex'));
 assert.equal((await fetch(`${origin}/api/0/organizations/acme/chunk-upload/`, {method: 'POST', headers: {Authorization: 'Bearer ' + keys.chunks}, body: data})).status, 200);

 const archive = await archiveProjection(await req('/api/archive'));
 const exported = archive.data;
 const cap=await api('/api/projects/chunks/artifact-storage');
 assert.equal(exported.artifact_storage_settings.find(row=>row.project==='chunks').artifact_storage_cap,cap.artifact_storage_cap,'[SRC-004] byte cap is archived');
 assert.ok(!('sentry_upload_chunks' in exported) && !('sentry_assemblies' in exported), 'staging and receipts are not archived');
 const finalized = exported.sentry_releases.find(row => row.project === 'web' && row.release === 'checkout@1.0.0');
 assert.ok(finalized?.released, 'the finalization time is archived');
 assert.equal(exported.sentry_deploys.filter(row => row.project === 'web').length, 2, 'both reported deploys are archived');
 assert.ok(exported.artifacts.some(row => row.project === 'web'));
 assert.ok(exported.release_commits.some(row => row.project === 'web' && row.release === 'checkout@1.0.0'));
 for (const key of Object.values(keys)) assert.ok(!archive.text.includes(key), 'no project token travels in the archive');

 const target = await startTestWorker(15612);
 try {
  const restored = client(target.origin, await signIn(target.origin,{choosePolicy:false}));
  assert.equal((await restored.req('/api/restore', 'POST', archive.text, {'x-confirm-restore': 'yes'})).status, 200);
  const rows = await restored.json('/api/projects/web/releases'), original = (await api('/api/projects/web/releases')).find(row => row.name === 'checkout@1.0.0');
  const copy = rows.find(row => row.name === 'checkout@1.0.0');
  assert.deepEqual([copy.finalized, copy.commit_count, copy.cli_deploys, copy.seq, copy.first_seen], [original.finalized, original.commit_count, original.cli_deploys, original.seq, original.first_seen], 'the release restores with its CLI records and original identity');
  assert.equal((await restored.json('/api/projects/chunks/artifact-storage')).artifact_storage_cap,cap.artifact_storage_cap,'[SRC-004] byte cap survives restore');
  const uploads = await restored.json('/api/projects/web/sentry-uploads');
  assert.deepEqual(uploads.artifacts.map(row => row.digest).sort(), (await api('/api/projects/web/sentry-uploads')).artifacts.map(row => row.digest).sort());
  assert.deepEqual(uploads.assemblies, [], 'receipts do not restore');
  assert.deepEqual(await restored.json('/api/projects/web/keys'), [], 'a restore creates no project grants');
  const refused = await fetch(`${target.origin}/api/0/organizations/acme/releases/`, {method: 'POST', headers: {Authorization: 'Bearer ' + keys.deploy, 'Content-Type': 'application/json'}, body: JSON.stringify({version: 'after-restore@1.0.0', projects: ['web']})});
  assert.equal(refused.status, 401, 'the old deploy key is not active in the restored installation');
 } finally { await target.stop(); }

 // Erasure removes the staged chunk, receipts, maps, release records and deploys with their project.
 const small = await api('/api/projects/chunks/erasure');
 assert.ok(small.deleted.sentry_upload_chunks > 0 && small.deleted.sentry_assemblies > 0 && small.deleted.artifacts > 0, 'the preview counts staging, receipts and maps');
 await followErasure(api, await api('/api/projects/chunks/erasure', 'POST', {confirm: 'chunks', planHash: small.planHash}));
 const large = await api('/api/projects/web/erasure');
 assert.ok(large.deleted.sentry_releases > 0 && large.deleted.sentry_deploys > 0, 'the preview counts the CLI release and deploy records');
 await followErasure(api, await api('/api/projects/web/erasure', 'POST', {confirm: 'web', planHash: large.planHash}));
 const after = (await archiveProjection(await req('/api/archive'))).data;
 for (const table of ['artifact_storage_settings','sentry_releases', 'sentry_deploys', 'artifacts']) assert.ok(after[table].every(row => !['web', 'chunks'].includes(row.project)), `${table}: erased projects leave no row`);
}
