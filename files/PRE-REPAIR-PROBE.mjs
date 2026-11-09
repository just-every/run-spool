import assert from 'node:assert/strict';
import {startTestWorker} from '/workspace/run-spool/tests/worker.mjs';
import {freePort} from '/workspace/run-spool/tests/admission-runtime.mjs';
import {signIn} from '/workspace/run-spool/tests/auth.mjs';
import {archiveProjection} from '/workspace/run-spool/tests/archive.mjs';
import {preRepairArchive} from '/workspace/run-spool/tests/repair-recovery/archive.mjs';

const workers=[];
try {
 const source=await startTestWorker(await freePort());workers.push(source);
 const cookie=await signIn(source.origin);
 const request=(worker,session,path,method='GET',body,headers={})=>fetch(worker.origin+path,{method,headers:{Origin:worker.origin,Cookie:session,Connection:'close',...body?{'content-type':typeof body==='string'?'application/x-ndjson':'application/json'}:{},...headers},...body?{body:typeof body==='string'?body:JSON.stringify(body)}:{}});
 const json=async(path,method,body,headers)=>{const response=await request(source,cookie,path,method,body,headers);assert.ok(response.ok,await response.clone().text());return response.json()};
 const project=await json('/api/projects','POST',{id:'archive-probe',name:'Historical repair inventory probe'});
 await json('/api/projects/archive-probe/releases','POST',{name:'repair-probe-1',build:'b1'});
 const event=await json('/api/ingest/archive-probe','POST',{version:1,eventId:'archive-probe-event',release:'repair-probe-1',build:'b1',environment:'production',type:'ProbeError',message:'Historical archive probe',frames:[{file:'app.js',line:1,column:0,function:'checkout'}],breadcrumbs:[]},{Cookie:'',Authorization:'Bearer '+project.ingestKey});
 const repair=await json('/api/projects/archive-probe/repairs','POST',{issue:event.issue,link:'https://github.example/cedar/dispatch/pull/1',note:'Public archive regression probe'});
 await json('/api/projects/archive-probe/repairs/'+repair.id+'/checks','POST',{revision:repair.revision,name:'Historical fixture',outcome:'passed'});
 const full=await archiveProjection(await request(source,cookie,'/api/archive'));
 assert.equal(full.data.repairs.length,1);assert.equal(full.data.repair_checks.length,1);assert.equal(full.data.events.length,1);
 const legacy=await preRepairArchive(full.text);
 for (const [label,text,expectedRepairs] of [['pre-repair',legacy,0],['populated',full.text,1]]) {
  const target=await startTestWorker(await freePort());workers.push(target);
  const session=await signIn(target.origin);
  const response=await request(target,session,'/api/restore','POST',text,{'X-Confirm-Restore':'yes'});
  assert.equal(response.status,200,await response.text());
  const restored=await archiveProjection(await request(target,session,'/api/archive'));
  assert.equal(restored.data.repairs.length,expectedRepairs);assert.equal(restored.data.repair_checks.length,expectedRepairs);assert.equal(restored.data.events.length,1);
  assert.equal(restored.data.native_symbols.length,0);
  assert.equal((await (await request(target,session,'/api/projects/archive-probe/issues')).json())[0].count,1);
  console.log('PROBE historical archive '+label+' -> POST /api/restore 200; native event retained; repairs='+expectedRepairs);
 }
} finally {for(const worker of workers.reverse())await worker.stop();}
