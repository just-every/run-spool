import assert from 'node:assert/strict';
import {startTestWorker} from '/workspace/run-spool/tests/worker.mjs';
import {signIn} from '/workspace/run-spool/tests/auth.mjs';
import {dashboardFlow} from '/workspace/run-spool/tests/investigation-flow.mjs';
const worker=await startTestWorker(15592);
try {
 const origin=worker.origin,cookie=await signIn(origin);
 const req=(path,method='GET',body,headers={})=>fetch(origin+path,{method,headers:{Connection:'close',Origin:origin,Cookie:cookie,...body?{'Content-Type':'application/json'}:{},...headers},...body?{body:typeof body==='string'?body:JSON.stringify(body)}:{}});
 const json=async(path,method,body,headers)=>{const response=await req(path,method,body,headers);assert.ok(response.ok,`${path}: HTTP ${response.status}`);return response.json()};
 await dashboardFlow({req,json});
}finally{await worker.stop()}
