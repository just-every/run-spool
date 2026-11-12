import assert from 'node:assert/strict';
import {startTestWorker} from '../tests/worker.mjs';
import {signIn} from '../tests/auth.mjs';
import {chooseLocalAgentPolicy} from '../tests/agent-door/local-policy.mjs';
import {releaseIdentityFlow} from '../tests/release-identity-flow.mjs';
const worker=await startTestWorker(15522),{origin}=worker;
try{
 const cookie=await signIn(origin);await chooseLocalAgentPolicy(origin,cookie);
 const req=(path,method='GET',body,headers={})=>fetch(origin+path,{method,headers:{Connection:'close',Origin:origin,Cookie:cookie,...body?{'Content-Type':'application/json'}:{},...headers},...body?{body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)}:{}});
 const json=async(path,method,body,headers)=>{const response=await req(path,method,body,headers);assert.ok(response.ok,`${path}: HTTP ${response.status}`);return response.json()};
 await releaseIdentityFlow({req,json,origin,cookie});
}finally{await worker.stop();}
