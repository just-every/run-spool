import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { runtime, successor, snapshot, eraseInput } from './owner-erasure/helpers.mjs';

// A real request whose body remains incomplete while the worker authenticates
// its headers. Keep the transport open through the separate erasure request.
export async function heldOwnerRequest(app,path,value) {
 const body=JSON.stringify(value);let settled=false,req;
 const response=new Promise((resolve,reject)=>{
  req=httpRequest(app.origin+path,{method:'POST',headers:{Origin:app.origin,Cookie:app.cookie,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},res=>{
   let text='';res.setEncoding('utf8');res.on('data',chunk=>text+=chunk);res.on('end',()=>{settled=true;resolve({status:res.statusCode,body:JSON.parse(text)});});
  });
  req.on('error',reject);
 });
 response.catch(()=>{});
 await new Promise((resolve,reject)=>req.write(body.slice(0,1),error=>error?reject(error):resolve()));
 try {
  assert.equal((await app.request('/api/projects')).status,200,'worker remains responsive while the body is withheld');
  await new Promise(resolve=>setTimeout(resolve,500));
  assert.equal(settled,false,'request is waiting for the withheld body');
  return {release(){req.end(body.slice(1));return response;},close(){req.destroy();}};
 } catch(error) {req.destroy();throw error;}
}

export async function delayedRepairWrites() {
 const app=await runtime(),pending=[];
 try {
  await successor(app);
  const owner=await app.DB.prepare("SELECT * FROM oa_operators WHERE role='owner'").first();
  const project=await app.json('/api/projects',{id:'inflight-repair',name:'Test owner and Quinn Otherperson'},201);
  await app.json('/api/projects/inflight-repair/releases',{name:'r1',build:'b1'},201);
  const event=await app.json('/api/ingest/inflight-repair',{version:1,eventId:'inflight-event',release:'r1',build:'b1',environment:'test',type:'Error',message:'Example error',frames:[{file:'https://app.test/a.js',line:1,column:0,function:'run'}],breadcrumbs:[]},201,{Authorization:'Bearer '+project.ingestKey});
  const repair=await app.json('/api/projects/inflight-repair/repairs',{issue:event.issue,link:'https://code.test/pull/1',note:'Quinn Otherperson repair'},201);
  const deployed=await app.json(`/api/projects/inflight-repair/repairs/${repair.id}/facts`,{revision:repair.revision,fact:'deployed',release:'r1'});
  const requests=[
   ['/api/projects/inflight-repair/repairs',{issue:event.issue,link:'https://code.test/pull/2',note:owner.display_name}],
   [`/api/projects/inflight-repair/repairs/${repair.id}/checks`,{revision:deployed.revision,name:'Reproduced',outcome:'passed',note:owner.display_name}],
   [`/api/projects/inflight-repair/repairs/${repair.id}/facts`,{revision:deployed.revision,fact:'exercised',note:owner.display_name}],
  ];
  for(const [path,input] of requests)pending.push(await heldOwnerRequest(app,path,input));
  const preview=await app.json('/api/owner/erasure'),receipt=await app.json('/api/owner/erasure',eraseInput(preview));assert.equal(receipt.phase,'complete');
  const before=await snapshot(app),responses=await Promise.all(pending.map(request=>request.release()));
  for(const response of responses)assert.deepEqual(response,{status:409,body:{error:'authority_changed'}},'an admitted predecessor repair write is refused after handoff');
  assert.deepEqual(await snapshot(app),before,'delayed predecessor repair writes change no row');
  return {phase:receipt.phase,refused:responses.length,storedRows:'unchanged'};
 } finally {for(const request of pending)request.close();await app.close();}
}
