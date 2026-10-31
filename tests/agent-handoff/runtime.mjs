import {startTestWorker} from '../worker.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {gate,testOwner,signIn} from '../auth.mjs';
import {archiveProjection} from '../archive.mjs';
// Most product journeys consume the same emitted build as CI. The public rer
// command lifecycle is retained by commands and the CLI erasure-fence journey.
export async function handoffRuntime(port=15543,{destinations:declared}={}) {
 const directory=await mkdtemp(resolve(tmpdir(),'spool-evidence-client-'));
 const destinations=declared??[{id:'handoff-mail',project:'a',label:'Mailbox',channel:'mail',recipient:'HANDOFF_ALERT_RECIPIENT@private.example'},{id:'handoff-webhook',project:'a',label:'Webhook',channel:'webhook',url:'https://webhook.example/HANDOFF_WEBHOOK_TARGET',key:Buffer.from('HANDOFF_SIGNING_SECRET_MATERIAL_PRIVATE').toString('base64')}];
 let worker,cookie;
 gate.key='spool-test-dev-key-abcdefghijklmnopqrstuvwxyz0123456789';
 async function start(){worker=await startTestWorker(port,{ALERT_PUBLIC_ORIGIN:'https://spool.example',ALERT_DESTINATIONS:JSON.stringify(destinations)});cookie=await signIn(worker.origin)}
 await start();
 const origin=worker.origin;
 const request=(path,method='GET',value,options={})=>fetch(origin+path,{method,redirect:'manual',headers:{Connection:'close',Origin:origin,...options.dev===false?{}:{'x-rer-dev-key':gate.key},...options.agent?{Authorization:'Bearer '+options.agent}:{Cookie:cookie},...value===undefined?{}:{'Content-Type':typeof value==='string'?'application/x-ndjson':'application/json'},...options.headers},...value===undefined?{}:{body:typeof value==='string'?value:JSON.stringify(value)}});
 const json=async(...args)=>{const response=await request(...args);assert.ok(response.ok,`${args[1]??'GET'} ${args[0]}: HTTP ${response.status}: ${response.ok?'':await response.text()}`);return response.json()};
 return {origin,checkout:{get root(){return worker.root}},get cookie(){return cookie},get devKey(){return gate.key},request,json,ordinarySession:()=>signIn(origin,{bootstrap:false}),archive:async()=>archiveProjection(await request('/api/archive')),
  async resetRestore(text,invalidText){await worker.stop();await start();if(invalidText){const before=await archiveProjection(await request('/api/archive'));assert.equal((await request('/api/restore','POST',invalidText,{headers:{'X-Confirm-Restore':'yes'}})).status,400);assert.deepEqual((await archiveProjection(await request('/api/archive'))).data,before.data)}await json('/api/restore','POST',text,{headers:{'X-Confirm-Restore':'yes'}});const tick=await worker.scheduled(Date.now());assert.equal(tick.status,200)},
  async close(){await worker.stop();await rm(directory,{recursive:true,force:true});return {children:'stopped',directory:'removed'}}};
}
