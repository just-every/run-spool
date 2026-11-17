import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startTestWorker} from '/workspace/run-spool/tests/worker.mjs';
import {signIn} from '/workspace/run-spool/tests/auth.mjs';
import {fieldAccounting} from '/workspace/run-spool/tests/sentry-import/field-accounting.mjs';
const worker=await startTestWorker(15528),{origin}=worker;
const scratch=await mkdtemp(join(tmpdir(),'spool-accounting-'));
try {
 const cookie=await signIn(origin);
 const req=(path,method='GET',value)=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,...value?{'Content-Type':'application/json'}:{}},...value?{body:JSON.stringify(value)}:{}});
 const json=async(path,method,value)=>{const r=await req(path,method,value);assert.ok(r.ok,`${path}: ${r.status}`);return r.json()};
 await json('/api/projects','POST',{id:'synthetic-control',name:'Native control'});
 await fieldAccounting({origin,cookie,scratch,json,req});
}finally{await worker.stop();await rm(scratch,{recursive:true,force:true})}
