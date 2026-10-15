import assert from 'node:assert/strict';
import { archiveProjection } from './archive.mjs';

// The real public ingest key fills the migration's real cap. No DB planting or
// lowered test-only limits: this is the failure a browser installation hits.
export async function exposureCapFlow({ json, req }) {
 const id = 'exposure-cap', path = `/api/projects/${id}`;
 const project = await json('/api/projects', 'POST', { id, name: 'Exposure capacity' });
 const release = { name: 'capacity-r1', build: 'capacity-build' };
 await json(`${path}/releases`, 'POST', release);
 const flows = Array.from({ length: 20 }, (_, n) => `flow-${String(n).padStart(2, '0')}`);
 const client = n => `capacity-client-${String(n).padStart(5, '0')}`;
 const send = async (n, reached = flows, capture = true) => {
  const response = await req(`/api/ingest/${id}/exposure`, 'POST', {
   version: 1, release: release.name, build: release.build, environment: 'production', client: client(n), flows: reached, capture,
  }, { Cookie: '', Authorization: `Bearer ${project.ingestKey}` });
  return { status: response.status, ...await response.json() };
 };
 // Keep the earliest two reports deterministic; the remaining fill is parallel.
 for (let n = 0; n < 2; n++) assert.equal((await send(n)).status, 201);
 for (let n = 2; n < 952; n += 4) {
  const reports = await Promise.all(Array.from({ length: Math.min(4, 952 - n) }, (_, i) => send(n + i)));
  assert.ok(reports.every(report => report.status === 201));
 }
 // 952 * 21 = 19,992 rows, then eight session-only identities reach 20,000.
 assert.ok((await Promise.all(Array.from({ length: 8 }, (_, i) => send(952 + i, [])))).every(report => report.status === 201));
 await new Promise(resolve => setTimeout(resolve, 10));
 const cutoff = Date.now();
 await new Promise(resolve => setTimeout(resolve, 10));
 // A full table still refreshes existing clients, preserving their first report
 // and the conservative capture=false observation across subsequent reports.
 for (const capture of [false, true]) {
  const refreshed = await send(0, flows, capture);
  assert.deepEqual([refreshed.status, refreshed.evicted], [201, 0]);
 }
 const rolled = await send(1000);
 assert.deepEqual([rolled.status, rolled.outcome, rolled.evicted], [201, 'accepted', 21]);
 const archive = await archiveProjection(await req('/api/archive'));
 const rows = archive.data.exposures.filter(row => row.project === id);
 assert.equal(rows.length, 20000);
 assert.ok(!rows.some(row => row.client === client(1)), 'oldest unrefreshed client is evicted');
 const refreshed = rows.filter(row => row.client === client(0));
 assert.equal(refreshed.length, 21);
 assert.ok(refreshed.every(row => row.first <= cutoff && row.last > cutoff && row.capture === 0 && row.reports === 3));
 assert.ok(archive.data.outcomes.some(row => row.project === id && row.reason === 'exposure_evicted' && row.count === 21));
 // last, not first, governs manual retention. The refreshed original client
 // and the new client survive, while all 19,958 older rows leave the archive.
 await json(`${path}/retention`, 'POST', { cutoff, apply: true });
 const retained = await archiveProjection(await req('/api/archive'));
 assert.equal(retained.data.exposures.filter(row => row.project === id).length, 42);
 assert.ok(retained.data.outcomes.some(row => row.project === id && row.reason === 'exposure_retention' && row.count === 19958));
 // Re-admission of an erased aggregate key must remain portable. The product journey's
 // archive roundtrip exercises these exact rows and their checkpoint journal.
 const readmitted = await send(1);
 assert.deepEqual([readmitted.status, readmitted.evicted], [201, 0]);
 console.log('Exposure capacity after fix: 20,000 retained rows; 21 oldest rows evicted and reported; retention frees 19,958 rows by last; full-cap refresh and re-admission accepted.');
}
