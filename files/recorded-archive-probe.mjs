import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
const load=file=>import(pathToFileURL(resolve(file)));
const {handoffRuntime}=await load('tests/agent-handoff/runtime.mjs');
const {startTestWorker}=await load('tests/worker.mjs');
const {signIn}=await load('tests/auth.mjs');
const {archiveProjection}=await load('tests/archive.mjs');
const {beforeRelayPrivacy,rebuiltArchive}=await load('tests/fixtures/archive-before-relay-privacy.mjs');
let app,worker;
try{
 app=await handoffRuntime(15594);
 const snapshot=await app.archive();
 const text=await rebuiltArchive(snapshot.text,beforeRelayPrivacy);
 const historical=await archiveProjection(new Response(text));
 console.log(JSON.stringify({sourceMigrations:snapshot.manifest.migrations,sourceLedger:snapshot.manifest.migrationLedger,fixtureMigrations:historical.manifest.migrations,fixtureLedger:historical.manifest.migrationLedger,feedback:historical.manifest.tables.find(t=>t.name==='feedback')}));
 const response=await app.request('/api/restore','POST',text,{headers:{'X-Confirm-Restore':'yes'}});
 console.log(JSON.stringify({case:'recordedPreviousRelayPrivacyRealDev',status:response.status,body:await response.text()}));
}finally{await worker?.stop();await app?.close()}
