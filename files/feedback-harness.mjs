import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const load=path=>import(pathToFileURL(process.cwd()+'/'+path).href);
const {feedbackFlow}=await load('tests/feedback-flow.mjs');
const {startTestWorker}=await load('tests/worker.mjs');
const {freePort}=await load('tests/admission-runtime.mjs');
const {signIn}=await load('tests/auth.mjs');
const {chooseLocalAgentPolicy}=await load('tests/agent-door/local-policy.mjs');
const worker=await startTestWorker(await freePort()),{origin}=worker;
try{
 const cookie=await signIn(origin);await chooseLocalAgentPolicy(origin,cookie);
 const req=(path,method='GET',body,headers={})=>fetch(origin+path,{method,headers:{Connection:'close',Origin:origin,Cookie:cookie,...body?{'Content-Type':'application/json'}:{},...headers},...body?{body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)}:{}});
 const json=async(path,method,body,headers)=>{const response=await req(path,method,body,headers);assert.ok(response.ok,`${path}: HTTP ${response.status}`);return response.json()};
 await feedbackFlow({req,json,origin});
 console.log('PASS tests/feedback-flow.mjs#feedbackFlow on '+process.env.RER_CANDIDATE_SHA);
}finally{await worker.stop()}
