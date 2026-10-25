import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queuedExit=await queuedEntrypoint(import.meta.url);if(queuedExit!==null)process.exit(queuedExit);
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {handoffRuntime} from './agent-handoff/runtime.mjs';
import {canary} from './project-erasure/fixture.mjs';
import {plantCap} from './project-erasure/plant.mjs';
import {followErasure} from './project-erasure/follow.mjs';
import {scanDatabase,scanText} from './project-erasure/scan.mjs';

// Keep the full retained-event cap independent of the archive-fence journey:
// its 10,000-row pre-erasure archive need not be imported again for every fence.
const port=await new Promise((accept,reject)=>{const server=createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const {port}=server.address();server.close(()=>accept(port));});});
let app;
try {
 app=await handoffRuntime(port);const cap=await plantCap(app),needles=[cap.project,canary.CAP];
 // Restore excludes retention_runs. Let the first real scheduled pass establish
 // that row before taking the erasure plan, so setup cannot invalidate its hash.
 const retentionDeadline=Date.now()+90_000;let retention;
 do {
  retention=(await app.json(`/api/projects/${cap.project}/retention-policy`)).lastRun;
  if(retention?.status==='complete'&&retention.remaining===0)break;
  await new Promise(resolve=>setTimeout(resolve,1000));
 } while(Date.now()<retentionDeadline);
 assert.ok(retention?.status==='complete'&&retention.remaining===0,'the restored cap fixture has completed its first scheduled retention pass: '+JSON.stringify(retention));
 const before=scanDatabase(app.checkout.root,[canary.CAP]);
 assert.ok(before.found.length,'the retained-event cap contains its canary');
 const preview=await app.json(`/api/projects/${cap.project}/erasure`);assert.equal(preview.deleted.events,10000);
 assert.deepEqual(scanText(JSON.stringify(preview),needles),[],'the preview carries counts only');
 const started=Date.now(),response=await app.request(`/api/projects/${cap.project}/erasure`,'POST',{confirm:cap.project,planHash:preview.planHash}),requestMs=Date.now()-started;
 assert.equal(response.status,202,`the full-cap erasure is accepted without waiting for deletion: ${await response.clone().text()}`);
 const accepted=await response.json();assert.equal(response.headers.get('location'),`/api/erasures/${accepted.id}`);
 assert.ok(requestMs<10_000,'acceptance responds promptly at the retained-event cap');
 assert.notEqual(accepted.phase,'complete');
 assert.deepEqual(accepted.deleted,{},'acceptance performs no destructive work');
 assert.equal((await app.json(`/api/erasures/${accepted.id}`)).id,accepted.id,'the accepted job has a public status resource');
 const receipt=await followErasure(app.json,accepted,started),ms=Date.now()-started;
 assert.equal(receipt.phase,'complete');assert.equal(receipt.deleted.events,10000);
 assert.ok(ms<300_000&&receipt.seconds<300,'erasure at the retained-event cap completes within 300 seconds');
 assert.deepEqual(scanText(JSON.stringify(receipt),needles),[],'the receipt carries counts and times only');
 assert.deepEqual(scanDatabase(app.checkout.root,needles).found,[],'the cap project and canary are erased from D1');
 assert.deepEqual(scanText((await app.archive()).text,needles),[],'the cap project and canary are absent from a fresh archive');
 console.log('Project erasure retained-event cap passed: '+JSON.stringify({events:10000,requestMs,completionMs:ms,receiptSeconds:receipt.seconds}));
} finally {await app?.close();}
