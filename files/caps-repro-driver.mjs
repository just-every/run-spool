import assert from 'node:assert/strict';
import {startTestWorker} from '/workspace/run-spool/tests/worker.mjs';
import {signIn,testDevKey} from '/workspace/run-spool/tests/auth.mjs';
import {chooseLocalAgentPolicy} from '/workspace/run-spool/tests/agent-door/local-policy.mjs';
import {archiveProjection} from '/workspace/run-spool/tests/archive.mjs';
import {event} from '/workspace/run-spool/tests/agent-handoff/packet.mjs';
import {capArchive,capProof} from '/workspace/run-spool/tests/agent-handoff/caps.mjs';
let worker,cookie;
const origin='http://127.0.0.1:15545';
const request=(path,method='GET',body,options={})=>fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,'x-rer-dev-key':testDevKey,...options.agent?{Authorization:'Bearer '+options.agent}:{Cookie:cookie},...body===undefined?{}:{'Content-Type':typeof body==='string'?'application/x-ndjson':'application/json'},...options.headers},...body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)}});
async function json(...args){const response=await request(...args);assert.ok(response.ok,`${args[0]} HTTP ${response.status}`);return response.json();}
async function start(){worker=await startTestWorker(15545);cookie=await signIn(origin);await chooseLocalAgentPolicy(origin,cookie);}
const app={origin,get cookie(){return cookie},devKey:testDevKey,request,json,archive:async()=>archiveProjection(await request('/api/archive')),async resetRestore(text){await worker.stop();await start();await json('/api/restore','POST',text,{headers:{'X-Confirm-Restore':'yes'}});}};
try{
 await start();const project=await json('/api/projects','POST',{id:'a',name:'Caps reproduction'});await json('/api/projects/a/releases','POST',{name:'z-release',build:'build-z'});
 const captured=await json('/api/ingest/a','POST',event('synthetic-spool-caps'),{agent:project.ingestKey});
 const archive=await capArchive(app,captured.issue);await app.resetRestore(archive.text);
 const unfiltered=await json('/api/projects/a/issues'),open=await json('/api/projects/a/issues?state=open&limit=1');
 console.log(JSON.stringify({unfilteredRows:unfiltered.length,unfilteredContainsOlderOpen:unfiltered.some(row=>row.id===captured.issue),openFilteredFindsOlder:open.length===1&&open[0].id===captured.issue}));
 await capProof(app,archive);
 console.log('Existing capProof passed');
}finally{await worker?.stop();}
