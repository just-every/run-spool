import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const load = path => import(pathToFileURL(process.cwd()+'/'+path));
const {startTestWorker}=await load('tests/worker.mjs');
const {signIn}=await load('tests/auth.mjs');
const {chooseLocalAgentPolicy}=await load('tests/agent-door/local-policy.mjs');
const {releaseIdentityFlow}=await load('tests/release-identity-flow.mjs');
const worker=await startTestWorker(15522),{origin}=worker;
try {
 const cookie=await signIn(origin);await chooseLocalAgentPolicy(origin,cookie);
 const req=(path,method='GET',body,headers={})=>fetch(origin+path,{method,headers:{Connection:'close',Origin:origin,Cookie:cookie,...body?{'Content-Type':'application/json'}:{},...headers},...body?{body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)}:{}});
 const json=async(path,method,body,headers)=>{const response=await req(path,method,body,headers);assert.ok(response.ok,`${path}: HTTP ${response.status}`);return response.json()};
 await releaseIdentityFlow({req,json,origin,cookie});
 console.log('PASS tests/release-identity-flow.mjs#releaseIdentityFlow, existing public HTTP journey, 1440/390 screens');
} finally {await worker.stop();}
