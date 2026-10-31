import {freePort} from './admission-runtime.mjs';
import assert from 'node:assert/strict';
import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';

export async function demoJourney() {

// One flow through the real demo hook, native ingest and owner HTTP doors.
const app=await startTestWorker(await freePort(),{RER_DEMO:'1'});
try {
 const cookie=await signIn(app.origin);
 const request=path=>fetch(app.origin+path,{headers:{Cookie:cookie}});
 const response=await request('/app');
 assert.equal(response.status,200,'the signed-in demo app loads');
 await response.body?.cancel();
 let db=await app.db();
 const recent=()=>db.prepare("SELECT id,historical FROM events WHERE id LIKE 'cedar-live-%' ORDER BY id").all();
 assert.deepEqual((await recent()).results,[0,1,2].map(i=>({id:`cedar-live-${i}`,historical:0})), 'all three samples pass native admission');
 const facts=async()=>{
  const response=await request('/api/audit/export?format=json');assert.equal(response.status,200);
  return (await response.json()).rows.filter(row=>row.action==='capture.native');
 };
 const rows=await facts(),committed=rows.filter(row=>row.source==='transaction');
 assert.equal(committed.length,3,'each admitted sample commits its audit fact');
 assert.ok(rows.every(row=>row.actor_kind==='ingest'),'demo samples retain credential attribution');
 assert.equal(new Set(rows.map(row=>row.actor_label)).size,1,'all samples name the same demo ingest actor');
 assert.ok(rows.every(row=>row.project_label===committed[0].project_label&&row.project_label),'all facts name the demo project');
 assert.deepEqual(rows.filter(row=>row.source==='request').map(row=>row.status),[201,201,201]);
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM credentials WHERE kind='ingest'").first()).n,0,'temporary grant is removed');
 await app.restart();db=await app.db();
 const repeated=await request('/app');assert.equal(repeated.status,200);await repeated.body?.cancel();
 assert.equal((await recent()).results.length,3);
 assert.equal((await facts()).filter(row=>row.source==='transaction').length,3,'restart never seeds duplicate captures');
 console.log('Demo capture: app 200; 3 recent events; 3 attributed transaction facts; restart unchanged');
} finally {await app.stop();}

}
