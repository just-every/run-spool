import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startTestWorker} from '/workspace/run-spool/tests/worker.mjs';
import {signIn} from '/workspace/run-spool/tests/auth.mjs';
import {launchBrowser} from '/workspace/run-spool/tests/browser-launch.mjs';
import {sourceMapCapacity} from '/workspace/run-spool/tests/source-map-capacity.mjs';
const run=promisify(execFile),app=await mkdtemp('/tmp/spool-capacity-check-');let worker,browser;
try{
 const built=await run(process.execPath,['packages/sdk/build.mjs','--pack']);const {tarball}=JSON.parse(built.stdout.trim().split('\n').at(-1));
 await writeFile(app+'/package.json','{"private":true,"type":"module"}');await run('npm',['install',tarball,'--offline','--ignore-scripts','--no-audit','--no-fund'],{cwd:app});
 worker=await startTestWorker(15698);const {origin}=worker,cookie=await signIn(origin);
 const request=async(path,method='GET',body)=>{const response=await fetch(origin+path,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.ok(response.ok,`${path}: ${response.status}`);return response.json()};
 browser=await launchBrowser();await sourceMapCapacity({origin,request,app,browser});
 console.log('PASS sourceMapCapacity through packed SDK bin and emitted local application');
}finally{await browser?.close();await worker?.stop();await rm(app,{recursive:true,force:true})}
