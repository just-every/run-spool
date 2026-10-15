import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queuedExit=await queuedEntrypoint(import.meta.url);if(queuedExit!==null)process.exit(queuedExit);
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {handoffRuntime} from './agent-handoff/runtime.mjs';
import {canary} from './project-erasure/fixture.mjs';
import {plantCap} from './project-erasure/plant.mjs';
import {scanDatabase,scanText} from './project-erasure/scan.mjs';

// Keep the full retained-event cap independent of the archive-fence journey:
// its 10,000-row pre-erasure archive need not be imported again for every fence.
const port=await new Promise((accept,reject)=>{const server=createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const {port}=server.address();server.close(()=>accept(port));});});
let app;
try {
 app=await handoffRuntime(port);const cap=await plantCap(app),needles=[cap.project,canary.CAP];
 const before=scanDatabase(app.checkout.root,[canary.CAP]);
 assert.ok(before.found.length,'the retained-event cap contains its canary');
 const preview=await app.json(`/api/projects/${cap.project}/erasure`);assert.equal(preview.deleted.events,10000);
 assert.deepEqual(scanText(JSON.stringify(preview),needles),[],'the preview carries counts only');
 const started=Date.now(),receipt=await app.json(`/api/projects/${cap.project}/erasure`,'POST',{confirm:cap.project,planHash:preview.planHash}),ms=Date.now()-started;
 assert.equal(receipt.phase,'complete');assert.equal(receipt.deleted.events,10000);
 assert.ok(ms<300_000&&receipt.seconds<300,'erasure at the retained-event cap completes within 300 seconds');
 assert.deepEqual(scanText(JSON.stringify(receipt),needles),[],'the receipt carries counts and times only');
 assert.deepEqual(scanDatabase(app.checkout.root,needles).found,[],'the cap project and canary are erased from D1');
 assert.deepEqual(scanText((await app.archive()).text,needles),[],'the cap project and canary are absent from a fresh archive');
 console.log('Project erasure retained-event cap passed: '+JSON.stringify({events:10000,requestMs:ms,receiptSeconds:receipt.seconds}));
} finally {await app?.close();}
