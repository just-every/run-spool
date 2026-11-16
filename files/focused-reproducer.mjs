// Run from the run-spool checkout after rer build. No product code is mocked.
// The sendHeaders pause exposes the real worker idle-close race on a selected socket.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {executionRuntime}=await import(pathToFileURL(resolve('tests/execution/runtime.mjs')));
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import diagnostics from 'node:diagnostics_channel';
diagnostics.channel('undici:client:sendHeaders').subscribe(({request,socket})=>{
 if(String(request.origin).includes('127.0.0.1:15479') && /\/api\/erasures\/[^/]+\/resume/.test(request.path)){
  console.log('continuation socket reused:',socket.bytesRead>0);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,6000);
 }
});
const state=await mkdtemp(join(tmpdir(),'spool-focused-'));
let app;
try {
 app=await executionRuntime(state,15479);
 await app.json('/api/projects','POST',{id:'socket-case',name:'Socket case'});
 const preview=await app.json('/api/projects/socket-case/erasure');
 const accepted=await app.json('/api/projects/socket-case/erasure','POST',{confirm:'socket-case',planHash:preview.planHash});
 console.log('accepted',accepted.phase);
 const answer=await app.json(`/api/erasures/${accepted.id}/resume`,'POST');
 console.log('resume',answer.phase);
} catch(error){console.error('FOCUSED',error.name,error.message,error.cause?.code,error.cause?.message);process.exitCode=1;}
finally{await app?.stop();await rm(state,{recursive:true,force:true});}
