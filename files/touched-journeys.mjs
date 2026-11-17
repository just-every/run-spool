import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {startTestWorker} from '/workspace/run-spool/tests/worker.mjs';
import {signIn} from '/workspace/run-spool/tests/auth.mjs';
import {prioritySearchFlow,prioritySearchScreen} from '/workspace/run-spool/tests/priority-search-flow.mjs';
import {reviewInboxFlow} from '/workspace/run-spool/tests/review-inbox-flow.mjs';
import {releaseIdentityFlow} from '/workspace/run-spool/tests/release-identity-flow.mjs';
const worker=await startTestWorker(15494),checks=[];
try{
const cookie=await signIn(worker.origin),req=(path,method='GET',value,headers={})=>fetch(worker.origin+path,{method,redirect:'manual',headers:{Origin:worker.origin,Cookie:cookie,...value!==undefined?{'Content-Type':'application/json'}:{},...headers},...value!==undefined?{body:typeof value==='string'?value:JSON.stringify(value)}:{}}),json=async(...args)=>{const r=await req(...args);assert.ok(r.ok,args[0]+' '+r.status+' '+(r.ok?'':await r.text()));return r.json()},input={req,json,origin:worker.origin,cookie};
if(!process.argv.includes('--release-only')){const priority=await prioritySearchFlow(input);await prioritySearchScreen({origin:worker.origin,...priority,width:1440});checks.push('prioritySearchFlow + prioritySearchScreen(1440)');
await reviewInboxFlow(input);checks.push('reviewInboxFlow');}
await releaseIdentityFlow(input);checks.push('releaseIdentityFlow');
await writeFile(process.env.HOME+'/rer-consolidation/work/sd-spool-design-issues-1/packet/touched-receipt.json',JSON.stringify({at:new Date().toISOString(),checks,status:'passed'},null,2)+'\n');
}finally{await worker.stop()}
