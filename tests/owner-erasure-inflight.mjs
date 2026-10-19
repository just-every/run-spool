import { assertAuditAppendOnly } from './owner-erasure/helpers.mjs';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { runtime, successor, snapshot, eraseInput, archive } from './owner-erasure/helpers.mjs';

// A real request whose body remains incomplete while the worker authenticates
// its headers. Keep the transport open through the separate erasure request.
export async function heldOwnerRequest(app,path,value,{method='POST',headers={}}={}) {
 const body=typeof value==='string'?value:JSON.stringify(value);let settled=false,req;
 const response=new Promise((resolve,reject)=>{
  req=httpRequest(app.origin+path,{method,headers:{Origin:app.origin,Cookie:app.cookie,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),...headers}},res=>{
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

// Owner writes in the main API that read a body: admitted before the handoff, they commit nothing after it.
// Key revocation reads no body, so its request cannot be held open here; it commits through the same check.
export async function delayedOwnerWrites() {
 const app=await runtime({ALERT_DESTINATIONS:JSON.stringify([{id:'owner-mail',project:'inflight-owner',label:'Owner mail',channel:'mail',recipient:'owner@spool.test'}])}),pending=[];
 try {
  await successor(app);
  const project=await app.json('/api/projects',{id:'inflight-owner',name:'Inflight owner'},201);
  await app.json('/api/projects/inflight-owner/releases',{name:'r1',build:'b1'},201);
  const event=await app.json('/api/ingest/inflight-owner',{version:1,eventId:'inflight-owner-event',release:'r1',build:'b1',environment:'test',type:'Error',message:'Example error',frames:[{file:'https://app.test/a.js',line:1,column:0,function:'run'}],breadcrumbs:[]},201,{Authorization:'Bearer '+project.ingestKey});
  const issue=(await app.json('/api/projects/inflight-owner/issues')).find(row=>row.id===event.issue);
  await app.json('/api/projects/inflight-owner/browser-origins',{origin:'https://app.test'},201);
  const alertRule={name:'Owner mail',enabled:true,channel:'mail',destination:'owner-mail',kinds:['new_issue'],windowMs:60000,threshold:2};
  const rule=await app.json('/api/projects/inflight-owner/alerting/rules',alertRule,201);
  const now=Date.now();
  await app.DB.batch([
   app.DB.prepare("INSERT INTO alerts(id,project,issue,kind,created) VALUES('inflight-alert','inflight-owner',?,'new_issue',?)").bind(issue.id,now),
   app.DB.prepare("INSERT INTO alert_intents VALUES('inflight-delivery','inflight-owner','inflight-alert',?,1,'mail','owner-mail','{}','spool.issue.new',?,'queued',NULL,1)").bind(rule.id,now),
   app.DB.prepare("INSERT INTO alert_mail_jobs(id,project,message,destination_hash,state,next_at) VALUES('inflight-delivery','inflight-owner','{}','hmac:x','uncertain',?)").bind(now),
   app.DB.prepare("INSERT INTO alert_history VALUES('inflight-delivery','inflight-owner','inflight-alert',?,1,'mail','owner-mail','uncertain',NULL,1,?,?,0)").bind(rule.id,now,now),
  ]);
  const policy=await app.json('/api/projects/inflight-owner/suppression-policies',{field:'message',mode:'exact',value:'Future quiet error',enabled:true},201);
  const correction=await app.json('/api/projects/inflight-owner/corrections/preview',{kind:'split',source:issue.id,revision:issue.revision,events:['inflight-owner-event']},201);
  await app.json(`/api/projects/inflight-owner/corrections/${correction.id}/apply`,{confirm:true});
  const nextPreview=await app.json('/api/projects/inflight-owner/corrections/preview',{kind:'split',source:correction.plan.target,revision:1,events:['inflight-owner-event']},201);
  const requests=[
   [`/api/projects/inflight-owner/issues/${issue.id}/assignment`,{revision:issue.revision+1,label:'Late operator'},{method:'PATCH'}],
   ['/api/projects/inflight-owner/suppression-policies',{field:'release',mode:'exact',value:'r1',enabled:true}],
   [`/api/projects/inflight-owner/suppression-policies/${policy.id}`,{...policy,enabled:false},{method:'PATCH'}],
   ['/api/projects/inflight-owner/corrections/preview',{kind:'split',source:correction.plan.target,revision:1,events:['inflight-owner-event']}],
   [`/api/projects/inflight-owner/corrections/${nextPreview.id}/apply`,{confirm:true}],
   [`/api/projects/inflight-owner/corrections/${correction.id}/undo`,{confirm:true}],
   ['/api/projects',{id:'late-project',name:'Late project'}],
   ['/api/projects/inflight-owner/alerting/rules',{...alertRule,name:'Late rule'}],
   [`/api/projects/inflight-owner/alerting/rules/${rule.id}`,{...alertRule,name:'Revised rule',revision:1},{method:'PUT'}],
   ['/api/projects/inflight-owner/alerting/deliveries/inflight-delivery/resolve',{state:'accepted',evidence:'receiver_confirmed'}],
   ['/api/projects/inflight-owner/keys',{kind:'ingest'}],
   ['/api/projects/inflight-owner/browser-origins',{origin:'https://late.test'}],
   ['/api/projects/inflight-owner/browser-origins',{origin:'https://app.test'},{method:'DELETE'}],
   [`/api/projects/inflight-owner/issues/${issue.id}`,{state:'resolved',revision:issue.revision},{method:'PATCH'}],
   ['/api/projects/inflight-owner/retention',{cutoff:Date.now(),apply:true}],
  ];
  for(const [path,input,options] of requests)pending.push(await heldOwnerRequest(app,path,input,options));
  const preview=await app.json('/api/owner/erasure'),receipt=await app.json('/api/owner/erasure',eraseInput(preview));assert.equal(receipt.phase,'complete');
  const before=await snapshot(app),responses=await Promise.all(pending.map(request=>request.release()));
  const route=index=>`${requests[index][2]?.method??'POST'} ${requests[index][0]}`;
  assert.deepEqual(responses.map((response,index)=>({route:route(index),...response})),requests.map((_,index)=>({route:route(index),status:409,body:{error:'authority_changed'}})),'every admitted predecessor owner write is refused after handoff');
  assertAuditAppendOnly(await snapshot(app),before,'delayed predecessor owner writes change no row');
  return {phase:receipt.phase,refused:responses.length,storedRows:'unchanged'};
 } finally {for(const request of pending)request.close();await app.close();}
}

// Restore of another installation's archive into this empty one, admitted before the handoff.
export async function delayedRestore() {
 const source=await runtime();let text;
 try {await source.json('/api/projects',{id:'restored',name:'Restored project'},201);({text}=await archive(source));} finally {await source.close();}
 const app=await runtime();let pending;
 try {
  await successor(app);
  pending=await heldOwnerRequest(app,'/api/restore',text,{headers:{'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'}});
  const preview=await app.json('/api/owner/erasure'),receipt=await app.json('/api/owner/erasure',eraseInput(preview));assert.equal(receipt.phase,'complete');
  const before=await snapshot(app),response=await pending.release();
  assert.deepEqual(response,{status:409,body:{error:'authority_changed'}},'an admitted predecessor restore is refused after handoff');
  assertAuditAppendOnly(await snapshot(app),before,'a delayed predecessor restore changes no row');
  return {phase:receipt.phase,refused:1,storedRows:'unchanged'};
 } finally {pending?.close();await app.close();}
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
  assertAuditAppendOnly(await snapshot(app),before,'delayed predecessor repair writes change no row');
  return {phase:receipt.phase,refused:responses.length,storedRows:'unchanged'};
 } finally {for(const request of pending)request.close();await app.close();}
}
