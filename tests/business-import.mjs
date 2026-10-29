import {followErasure} from './project-erasure/follow.mjs';
import assert from 'node:assert/strict';
import { createHash, randomUUID, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { startTestWorker } from './worker.mjs';
import { signIn, testOwner } from './auth.mjs';
import { archiveProjection } from './archive.mjs';

// Base import-kit door conformance (modules/import-kit/src/door/ADOPTING.md,
// rer 0.2.61; unchanged through rer 0.2.72), copied unchanged and run against both of Spool's door mounts.
export async function checkDoor({request, bytes, name, nativeSnapshot,
  assertApplied, assertUndone}) {
  const hash = b => createHash('sha256').update(b).digest('hex');
  const json = async (action, body, review, expected = 200) => {
    const response = await request(action, body, review);
    assert.equal(response.status, expected, `${action}: ${response.status}`);
    return response.json();
  };
  const until = async (action, body, review, state) => {
    for (let batch = 0; batch < 100; batch++) {
      const result = await json(action, body, review);
      if (result.job?.state === state) return result.job;
      assert.ok(['queued','applying','undoing'].includes(result.job?.state));
    }
    assert.fail(`${action} did not finish`);
  };
  assert.ok(bytes.length > 0);
  const before = await nativeSnapshot(), bundleSha256 = hash(bytes);
  const totalChunks = Math.ceil(bytes.length / 65536);
  let uploadId;
  for (let index = 0; index < totalChunks; index++) {
    const chunk = bytes.subarray(index * 65536, (index + 1) * 65536);
    const uploaded = await json('uploads', {uploadId, name, bundleSha256,
      totalBytes:bytes.length, totalChunks, index,
      chunkSha256:hash(chunk), base64:chunk.toString('base64')});
    uploadId = uploaded.uploadId;
  }
  const inventory = await json('uploads', {uploadId});
  assert.equal(inventory.complete, true);
  assert.equal(inventory.bundleSha256, bundleSha256);
  assert.equal(inventory.received.reduce((n,c) => n + c.size, 0), bytes.length);
  const plan = await json('plan', {uploadId});
  assert.equal(plan.bundleSha256, bundleSha256);
  assert.ok(plan.summary.sourceRecords > 0);
  assert.deepEqual(await nativeSnapshot(), before);
  const review = {fingerprint:plan.fingerprint,
    approvalRecordId:randomUUID(), approvedAt:new Date().toISOString()};
  const wrong = (plan.fingerprint[0] === '0' ? '1' : '0') + plan.fingerprint.slice(1);
  await json('apply', {planId:plan.planId, reviewedFingerprint:wrong}, review, 403);
  assert.deepEqual(await nativeSnapshot(), before);
  const job = await until('apply', {planId:plan.planId,
    reviewedFingerprint:plan.fingerprint}, review, 'completed');
  const status = await json('status', {planId:plan.planId});
  assert.equal(status.job.id, job.id);
  assert.equal(status.job.state, 'completed');
  const report = await json('reconcile', {planId:plan.planId});
  assert.equal(report.ok, true);
  assert.equal(report.fingerprint, plan.fingerprint);
  assert.equal(report.bundleSha256, bundleSha256);
  assert.equal(report.counts.sourceRecords, plan.summary.sourceRecords);
  assert.equal(report.counts.present + report.counts.explained, report.counts.sourceRecords);
  assert.equal(report.sourceIds.length, report.counts.sourceRecords);
  await assertApplied(before, await nativeSnapshot(), report);
  await until('undo', {planId:plan.planId}, undefined, 'undone');
  await assertUndone(before, await nativeSnapshot());
}

const port=15525, origin=`http://127.0.0.1:${port}`;
const issuer='https://business.example', installationId='synthetic-spool-install', kid='business-test';
// Only the public key enters the Worker. The signing key never leaves this process.
const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
const publicKey=await webcrypto.subtle.exportKey('jwk',keys.publicKey);
const worker=await startTestWorker(port,{
 RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify({[kid]:publicKey}),
 RER_OWNER_CLAIM_ISSUER:issuer,
 RER_OWNER_CLAIM_INSTALLATION_ID:installationId,
 RER_OWNER_CLAIM_APP_ORIGIN:origin,
});

try {
 const cookie=await signIn(origin);
 // One connection per request, as the other local journeys do: a reused keep-alive
 // socket the local workerd has closed fails a request as "other side closed".
 const ownerRequest=(path,method='GET',body,authenticated=true)=>fetch(origin+path,{
  method,redirect:'manual',headers:{Origin:origin,Connection:'close',...authenticated?{Cookie:cookie}:{},
   ...body===undefined?{}:{'Content-Type':'application/json'}},
  ...body===undefined?{}:{body:JSON.stringify(body)},
 });
 const json=async(response,expected=200)=>{
  assert.equal(response.status,expected,`public HTTP response ${new URL(response.url).pathname}: ${response.status===expected?'':await response.clone().text()}`);
  return response.json();
 };
 const ownerJson=async(path,method,body)=>json(await ownerRequest(path,method,body));
 const settingsPath='/api/imports/business';
 const fixture=await readFile(new URL('./fixtures/sentry/organization.json',import.meta.url));
 // One logical namespace per Sentry organization, from Spool's allow-list.
 const namespace='sentry-org:fixture-org';
 // Legal trailing JSON whitespace takes the unchanged synthetic bundle across
 // a full chunk boundary and a short final chunk without adding source records;
 // its length gives each fresh import in the namespace its own bundle.
 const variant=n=>Buffer.concat([fixture,Buffer.alloc(65_536+n,0x20)]);
 let bytes=variant(0);
 const digest=value=>createHash('sha256').update(value).digest('hex');
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 async function grant(action,grantNamespace,extra={}) {
  const iat=Math.floor(Date.now()/1000);
  const message=encode({alg:'ES256',typ:'rer-import-grant+jwt',kid})+'.'+encode({
   v:1,iss:issuer,aud:origin,installationId,email:testOwner,jti:randomUUID(),iat,exp:iat+300,
   action,namespace:grantNamespace,maxBytes:bytes.length,maxChunks:Math.ceil(bytes.length/65_536),maxRecords:500,...extra,
  });
  const signature=await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,Buffer.from(message));
  return message+'.'+Buffer.from(signature).toString('base64url');
 }
 const doorRequest=async(action,grantNamespace,body,extra={})=>fetch(`${origin}/api/rer/import/${action}`,{
  method:'POST',headers:{'Content-Type':'application/json',Connection:'close',Authorization:`Bearer ${await grant(action,grantNamespace,extra)}`},
  body:JSON.stringify(body),
 });
 const doorJson=async(action,grantNamespace,body,extra)=>json(await doorRequest(action,grantNamespace,body,extra));
 async function upload(next,uploadNamespace=namespace) {
  bytes=next;
  const bundleSha256=digest(bytes),totalChunks=Math.ceil(bytes.length/65_536);
  let uploadId,result;
  for(let index=0;index<totalChunks;index++) {
   const chunk=bytes.subarray(index*65_536,(index+1)*65_536);
   const body={...uploadId?{uploadId}:{},name:'synthetic-sentry-organization.json',bundleSha256,
    totalBytes:bytes.length,totalChunks,index,chunkSha256:digest(chunk),base64:chunk.toString('base64')};
   if(index===0) {
    const corrupt=await json(await doorRequest('uploads',uploadNamespace,{...body,chunkSha256:'0'.repeat(64)}),400);
    assert.equal(corrupt.error,'chunk_hash_or_size_mismatch','corrupt bytes cannot enter retained upload');
   }
   result=await doorJson('uploads',uploadNamespace,body);
   uploadId??=result.uploadId;
   assert.equal(result.uploadId,uploadId);
   assert.equal(result.complete,index===totalChunks-1);
   assert.equal(result.received.length,index+1);
   if(index===0) {
    const duplicate=await doorJson('uploads',uploadNamespace,{...body,uploadId});
    assert.deepEqual(duplicate.received,result.received,'an identical chunk is idempotent with a fresh grant');
   }
  }
  const inventory=await doorJson('uploads',uploadNamespace,{uploadId});
  assert.equal(inventory.complete,true);
  assert.equal(inventory.bundleSha256,bundleSha256);
  assert.deepEqual(inventory.received,result.received);
  assert.equal(inventory.received.reduce((n,chunk)=>n+chunk.size,0),bytes.length);
  for(const chunk of inventory.received) {
   assert.equal(chunk.sha256,digest(bytes.subarray(chunk.ordinal*65_536,(chunk.ordinal+1)*65_536)));
  }
  return uploadId;
 }
 async function untilState(step,state,maxBatches=20) {
  let result;
  for(let batch=0;batch<maxBatches;batch++) {
   result=await step();
   assert.ok(result.job,`${state} journey returns its real import job`);
   if(result.job.state===state)return result;
   assert.ok(['queued','applying','undoing'].includes(result.job.state),`unexpected job state ${result.job.state}`);
  }
  assert.fail(`import did not reach ${state} within bounded public requests`);
 }
 const nativeTables=['projects','releases','issues','events','sentry_import_targets'];
 async function nativeSnapshot(tables=nativeTables) {
  const response=await ownerRequest('/api/archive');
  assert.equal(response.status,200);
  const {data}=await archiveProjection(response);
  return Object.fromEntries(tables.map(table=>{
   assert.ok(Array.isArray(data[table]),`${table} is present in the owner archive`);
   return [table,data[table]];
  }));
 }

 await Promise.all(['GET','POST'].map(async method=>{
  await json(await ownerRequest(settingsPath,method,method==='POST'?{enabled:true}:undefined,false),401);
 }));
 const initial=await ownerJson(settingsPath);
 assert.equal(initial.configured,true);
 assert.equal(initial.enabled,false);
 assert.deepEqual(initial.keys.map(({kid,revoked})=>({kid,revoked})),[{kid,revoked:false}]);
 assert.equal(initial.keys[0].name,null);assert.equal(initial.keys[0].createdAt,null);
 for(const code of [initial.keys[0].nameReasonCode,initial.keys[0].createdAtReasonCode])assert.ok(initial.reasonLabels[code],'missing trust metadata has a renderable reason');
 assert.deepEqual(initial.history,[]);
 assert.equal((await json(await doorRequest('uploads',namespace,{}),404)).error,'not_found');
 assert.equal((await ownerJson(settingsPath,'POST',{enabled:true})).enabled,true);
 const control=await json(await ownerRequest('/api/projects','POST',{id:'native-business-control',name:'Untouched owner project'}),201);

 // Run Edit Run's signed cutover read (PLAN section 2, Spool): counts and a time
 // only, under its own grant action, for the embed check and difference report.
 const cutoverPath='/api/rer/cutover-status';
 async function rerGrant(payload={},{signingKey=keys.privateKey,header={}}={}) {
  const iat=Math.floor(Date.now()/1000);
  const body=Object.fromEntries(Object.entries({v:1,iss:issuer,aud:origin,installationId,email:testOwner,jti:randomUUID(),iat,exp:iat+300,action:'cutover-status',...payload}).filter(([,value])=>value!==undefined));
  const message=encode({alg:'ES256',typ:'rer-import-grant+jwt',kid,...header})+'.'+encode(body);
  const signature=await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},signingKey,Buffer.from(message));
  return message+'.'+Buffer.from(signature).toString('base64url');
 }
 const cutoverRequest=async(body,token,method='POST')=>fetch(origin+cutoverPath,{method,
  headers:{'Content-Type':'application/json',...token?{Authorization:`Bearer ${token}`}:{}},...method==='POST'?{body:JSON.stringify(body)}:{}});
 const cutoverRead=async since=>{
  const response=await cutoverRequest({since},await rerGrant());
  const text=await response.clone().text();
  for(const secret of [testOwner,control.ingestKey,control.id,'Untouched owner project','Cutover canary','fixture-org','web@1.0.0'])assert.ok(!text.includes(secret),'the cutover read carries counts and times only');
  const status=await json(response);
  assert.deepEqual(Object.keys(status).sort(),['created_since','events_since','last_event_at']);
  assert.deepEqual(Object.keys(status.created_since).sort(),['events','issues']);
  return status;
 };
 const epoch='1970-01-01T00:00:00.000Z',beforeCapture=new Date().toISOString();
 assert.deepEqual(await cutoverRead(epoch),{events_since:0,last_event_at:null,created_since:{issues:0,events:0}});
 await json(await ownerRequest(`/api/projects/${control.id}/releases`,'POST',{name:'control@1.0.0',build:'web'}),201);
 const captured=await fetch(`${origin}/api/ingest/${control.id}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${control.ingestKey}`},
  body:JSON.stringify({version:1,eventId:'cutover-live-event',release:'control@1.0.0',build:'web',environment:'production',type:'TypeError',message:'Cutover canary',frames:[{file:'https://control.example/app.js',function:'run',line:1,column:1}],breadcrumbs:[]})});
 assert.ok(captured.ok,`live capture: HTTP ${captured.status}`);
 const liveIssue=(await captured.json()).issue;
 const beforeRead=await nativeSnapshot();
 const live=await cutoverRead(beforeCapture);
 assert.deepEqual({...live,last_event_at:undefined},{events_since:1,last_event_at:undefined,created_since:{issues:1,events:1}});
 assert.ok(Date.parse(live.last_event_at)>=Date.parse(beforeCapture),'the newest event Spool received');
 assert.ok(!JSON.stringify(live).includes(liveIssue));
 assert.deepEqual(await cutoverRead(new Date(Date.now()+60_000).toISOString()),{events_since:0,last_event_at:live.last_event_at,created_since:{issues:0,events:0}});
 // Refusals: a non-POST, no grant, and every grant that is not this installation's own cutover-status grant.
 assert.equal((await json(await cutoverRequest(undefined,await rerGrant(),'GET'),405)).error,'method_not_allowed');
 assert.equal((await json(await cutoverRequest({since:beforeCapture}),401)).error,'grant_required');
 const otherKeys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 const past=Math.floor(Date.now()/1000)-600;
 for(const [label,token] of [
  ['another action',await rerGrant({action:'runner-status'})],
  ['an import door action',await rerGrant({action:'status'})],
  ['a door grant',await rerGrant({namespace,maxBytes:1,maxChunks:1,maxRecords:1})],
  ['an expired grant',await rerGrant({iat:past,exp:past+300})],
  ['another installation',await rerGrant({installationId:'another-spool-install'})],
  ['another owner',await rerGrant({email:'someone-else@example.com'})],
  ['another audience',await rerGrant({aud:'https://spool.example'})],
  ['a wrong key',await rerGrant({},{signingKey:otherKeys.privateKey})],
  ['an unknown key id',await rerGrant({},{header:{kid:'unknown-key'}})],
 ])assert.equal((await json(await cutoverRequest({since:beforeCapture},token),403)).error,'invalid_grant',label);
 for(const body of [{},{since:'yesterday'},{since:beforeCapture,project:control.id},[beforeCapture]])
  assert.equal((await json(await cutoverRequest(body,await rerGrant()),400)).error,'invalid_since');
 assert.deepEqual(await nativeSnapshot(),beforeRead,'the cutover read writes nothing native');

 const [beforeProjects,beforeNative]=await Promise.all([ownerJson('/api/projects'),nativeSnapshot()]);
 // Only namespaces from Spool's server-side allow-list reach the door.
 const unlisted=await json(await doorRequest('uploads','business-fixture',{}),403);
 assert.equal(unlisted.error,'unknown_import_source','a correctly signed grant for an unlisted namespace is refused');
 assert.deepEqual(await nativeSnapshot(),beforeNative);

 const uploadId=await upload(variant(0));
 const planned=await doorJson('plan',namespace,{uploadId});
 assert.equal(planned.bundleSha256,digest(bytes));
 assert.equal(planned.counts.effects,4);
 assert.equal(planned.counts.duplicates,1);
 assert.equal(planned.counts.rejected,0);
 assert.deepEqual(planned.rejected,[]);
 assert.equal(planned.summary.sourceRecords,planned.counts.unique);
 assert.equal(planned.differences.additions.length,planned.summary.created);
 assert.deepEqual(planned.differences.replacements,[]);
 assert.deepEqual(planned.differences.gone,[]);
 assert.deepEqual(planned.differences.conflicts,[]);
 assert.deepEqual(await ownerJson('/api/projects'),beforeProjects,'review makes no native project writes');
 assert.deepEqual(await nativeSnapshot(),beforeNative,'planning leaves the complete native graph unchanged');

 const approval={approvalRecordId:randomUUID(),approvedAt:new Date().toISOString()};
 const wrongFingerprint=(planned.fingerprint[0]==='0'?'1':'0')+planned.fingerprint.slice(1);
 const applyBody={planId:planned.planId,reviewedFingerprint:planned.fingerprint};
 const denied=await json(await doorRequest('apply',namespace,applyBody,{...approval,fingerprint:wrongFingerprint}),403);
 assert.equal(denied.error,'review_fingerprint_mismatch');
 assert.deepEqual(await nativeSnapshot(),beforeNative,'a signed but unreviewed fingerprint cannot write targets');
 const applied=await untilState(()=>doorJson('apply',namespace,applyBody,{...approval,fingerprint:planned.fingerprint}),'completed');
 const repeat=await doorJson('apply',namespace,applyBody,{...approval,fingerprint:planned.fingerprint});
 assert.equal(repeat.job.id,applied.job.id,'fresh grants resume the same durable job');
 assert.equal(repeat.job.state,'completed');

 const [report,status,settings,projects]=await Promise.all([
  doorJson('reconcile',namespace,{planId:planned.planId}),
  doorJson('status',namespace,{planId:planned.planId}),ownerJson(settingsPath),ownerJson('/api/projects'),
 ]);
 assert.equal(report.ok,true);
 assert.equal(report.fingerprint,planned.fingerprint);
 assert.equal(report.bundleSha256,digest(bytes));
 assert.equal(report.counts.sourceRecords,planned.summary.sourceRecords);
 assert.equal(report.sourceIds.length,report.counts.sourceRecords);
 assert.equal(report.counts.present+report.counts.explained,report.counts.sourceRecords);
 assert.equal(report.counts.nativeTargets,planned.counts.effects);
 assert.deepEqual(report.counts.byKind,{project:1,release:1,issue:1,event:1});
 assert.ok(report.sourceIds.every(row=>row.status==='present'||row.status==='explained'));
 assert.ok(report.sourceIds.some(row=>row.kind==='dashboards'&&row.status==='explained'&&row.reason));
 assert.equal(status.job.id,applied.job.id);
 assert.equal(status.job.state,'completed');
 assert.equal(status.approval.owner,testOwner);
 assert.equal(status.approval.approval_id,approval.approvalRecordId);
 assert.equal(status.approval.approved_at,approval.approvedAt);
 const history=settings.history.find(row=>row.planId===planned.planId);
 assert.ok(history,'owner history includes the actual Business import');
 assert.equal(history.jobId,applied.job.id);
 assert.equal(history.namespace,namespace);
 assert.equal(history.fingerprint,planned.fingerprint);
 assert.equal(history.owner,testOwner);
 assert.equal(history.approvalRecordId,approval.approvalRecordId);
 assert.equal(history.approvedAt,approval.approvedAt);
 assert.equal(history.state,'completed');
 assert.equal(history.caption,status.caption);
 assert.deepEqual(history.counts,planned.counts);
 assert.equal(history.organization,'fixture-org');
 assert.equal(history.undo.available,true);
 assert.match(history.caption,/approved via Business by/);
 // Imported Sentry history is the vendor's, never counted as created or received in Spool.
 assert.deepEqual(await cutoverRead(epoch),{...live,events_since:1,created_since:{issues:1,events:1}});
 const imported=projects.filter(project=>!beforeProjects.some(before=>before.id===project.id));
 assert.equal(imported.length,1);
 const projectPath=`/api/projects/${imported[0].id}`;
 const [issues,releases,credentials,alerts]=await Promise.all([
  ownerJson(projectPath+'/issues'),ownerJson(projectPath+'/releases'),
  ownerJson(projectPath+'/keys'),ownerJson(projectPath+'/alerts'),
 ]);
 assert.equal(issues.length,1);
 assert.equal(releases.length,1);
 assert.deepEqual(credentials,[]);
 assert.deepEqual(alerts,[]);
 const packet=await ownerJson(`${projectPath}/issues/${issues[0].id}/packet`);
 assert.equal(packet.events.length,1);
 assert.equal(packet.events[0].historical,true);
 for(const canary of ['IMPORT_SECRET','PRIVATE_LABEL','person@example.com'])assert.ok(!JSON.stringify(packet).includes(canary),'native evidence is scrubbed');

 const undone=await untilState(()=>doorJson('undo',namespace,{planId:planned.planId}),'undone');
 assert.equal(undone.job.id,applied.job.id);
 assert.deepEqual(await nativeSnapshot(),beforeNative,'grant undo removes all attributed native targets');
 assert.equal((await ownerJson(settingsPath)).history.find(row=>row.planId===planned.planId).state,'undone');

 // Another real completed import for the owner to undo from ordinary history
 // after Business admission has been switched off.
 const ownerPlan=await doorJson('plan',namespace,{uploadId:await upload(variant(1))});
 const ownerApproval={fingerprint:ownerPlan.fingerprint,approvalRecordId:randomUUID(),approvedAt:new Date().toISOString()};
 const ownerApplied=await untilState(()=>doorJson('apply',namespace,{
  planId:ownerPlan.planId,reviewedFingerprint:ownerPlan.fingerprint,
 },ownerApproval),'completed');
 assert.equal((await ownerJson(settingsPath,'POST',{enabled:false})).enabled,false);
 await json(await doorRequest('undo',namespace,{planId:ownerPlan.planId}),404);
 await json(await ownerRequest(`${settingsPath}/${ownerPlan.planId}/undo`,'POST',{},false),401);
 const ownerUndone=await untilState(()=>ownerJson(`${settingsPath}/${ownerPlan.planId}/undo`,'POST',{}),'undone');
 assert.equal(ownerUndone.job.id,ownerApplied.job.id);
 assert.deepEqual(await nativeSnapshot(),beforeNative,'owner history undo remains usable with Business disabled');
 const ownerHistory=(await ownerJson(settingsPath)).history;
 assert.equal(ownerHistory.find(row=>row.planId===ownerPlan.planId).state,'undone');

 // The copied Base conformance, through the owner's own importer (operator
 // mount, Business off) and then through Business grants.
 const conformanceTables=['projects','releases','issues','events'];
 const importedProjectId='sentry-'+digest(JSON.stringify(['fixture-org','web'])).slice(0,32);
 const conformance=(request,next)=>checkDoor({request,bytes:next,name:'synthetic-sentry-organization.json',
  nativeSnapshot:()=>nativeSnapshot(conformanceTables),
  async assertApplied(before,after,report) {
   assert.ok(!before.projects.some(row=>row.id===importedProjectId));
   const project=after.projects.find(row=>row.id===importedProjectId);
   assert.equal(project?.name,'Imported web');
   const issue=after.issues.find(row=>row.project===importedProjectId);
   assert.equal(issue.state,'open');
   assert.equal(issue.algorithm,'sentry-import-v1');
   assert.match(issue.title,/^TypeError: failed/);
   const release=after.releases.find(row=>row.project===importedProjectId);
   assert.equal(release.name,'web@1.0.0');
   const events=after.events.filter(row=>row.project===importedProjectId);
   assert.equal(events.length,1,'the duplicate exported event lands once');
   assert.equal(events[0].historical,1);
   assert.equal(events[0].issue,issue.id);
   for(const canary of ['IMPORT_SECRET','PRIVATE_LABEL','person@example.com'])assert.ok(!JSON.stringify(after).includes(canary),'native evidence is scrubbed');
   assert.deepEqual(report.counts.byKind,{project:1,release:1,issue:1,event:1});
  },
  async assertUndone(before,after) { assert.deepEqual(after,before,'undo leaves exactly the pre-import native records'); },
 });
 await conformance((action,body)=>fetch(`${origin}/api/operator/import/${action}`,{method:'POST',
  headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-Import-Source':namespace},body:JSON.stringify(body)}),variant(2));
 const operatorHistory=(await ownerJson(settingsPath)).history.filter(row=>/^approved by /.test(row.caption));
 assert.equal(operatorHistory.length,1,'the owner\'s own import shows in history as approved by the owner');
 assert.ok(operatorHistory[0].caption.includes(testOwner));
 assert.equal(operatorHistory[0].state,'undone');
 await ownerJson(settingsPath,'POST',{enabled:true});
 await conformance(async(action,body,review)=>{bytes=variant(3);return doorRequest(action,'sentry',body,action==='apply'?review:{})},variant(3));
 const vendorHistory=(await ownerJson(settingsPath)).history.find(row=>row.namespace==='sentry');
 assert.equal(vendorHistory.organization,'fixture-org','the vendor namespace reads its organization from the retained manifest');

 // Project erasure withdraws the door's duplicate raw custody as well as kit originals.
 // The tool's archive: the exact uploaded bytes, kept apart from plan and catch-up, test-restored with no native write.
 const eraseUpload=await upload(variant(4)),takenAt=new Date().toISOString(),beforeArchive=await nativeSnapshot();
 const archived=await doorJson('archive',namespace,{uploadId:eraseUpload,tool:'sentry',takenAt});
 assert.equal(archived.key,`business-archive/sentry/${takenAt}`);
 assert.equal(archived.bundleSha256,digest(bytes));
 assert.equal(archived.bytes,bytes.length);
 assert.equal(archived.counts.rejected,0);
 assert.deepEqual(await doorJson('archive',namespace,{uploadId:eraseUpload,tool:'sentry',takenAt}),archived,'the same archive request answers the same archive');
 assert.equal((await json(await doorRequest('archive',namespace,{uploadId:eraseUpload,tool:'sentry',takenAt:new Date(Date.now()+1000).toISOString()}),409)).error,'archive_exists');
 assert.equal((await fetch(`${origin}/api/operator/import/archive`,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-Import-Source':namespace},body:JSON.stringify({uploadId:eraseUpload,tool:'sentry',takenAt})})).status,404,'archives are Business grant actions only');
 const restoreChecked=await doorJson('restore-check',namespace,{archiveId:archived.archiveId});
 assert.equal(restoreChecked.archiveId,archived.archiveId);
 assert.equal(restoreChecked.bundleSha256,archived.bundleSha256);
 assert.equal(restoreChecked.bytes,archived.bytes);
 assert.deepEqual(restoreChecked.counts,archived.counts);
 assert.deepEqual(restoreChecked.rejected,[]);
 assert.deepEqual(await nativeSnapshot(),beforeArchive,'archive and restore-check write nothing native');
 const erasePlan=await doorJson('plan',namespace,{uploadId:eraseUpload});
 assert.equal((await doorJson('restore-check',namespace,{archiveId:archived.archiveId})).bundleSha256,archived.bundleSha256,'planning the upload leaves its archive');
 const eraseApproval={fingerprint:erasePlan.fingerprint,approvalRecordId:randomUUID(),approvedAt:new Date().toISOString()};
 await untilState(()=>doorJson('apply',namespace,{planId:erasePlan.planId,reviewedFingerprint:erasePlan.fingerprint},eraseApproval),'completed');
 // Business's final export, archived under its own `sentry` namespace that no plan ever opens, names the same project in its bytes.
 const finalUpload=await upload(variant(5),'sentry'),finalArchive=await doorJson('archive','sentry',{uploadId:finalUpload,tool:'sentry',takenAt:new Date().toISOString()});
 // Unplanned custody has no trusted project attribution: neither a caller's
 // namespace nor the readable prefix of a broken export can establish it.
 const personal=`synthetic-erasure-${randomUUID()}@private.example`;
 const pendingNamespace='sentry-org:interrupted-export';
 const interrupted=Buffer.concat([Buffer.from(JSON.stringify({project:imported[0].id,email:personal})),Buffer.alloc(65_536,0x20)]);
 bytes=interrupted;
 const first=interrupted.subarray(0,65_536);
 const pending=await doorJson('uploads',pendingNamespace,{name:'synthetic-interrupted.json',bundleSha256:digest(interrupted),
  totalBytes:interrupted.length,totalChunks:2,index:0,chunkSha256:digest(first),base64:first.toString('base64')});
 assert.equal(pending.complete,false);
 const brokenNamespace='sentry-org:unparseable-export';
 const broken=await upload(Buffer.from(JSON.stringify({project:imported[0].id,email:personal}).slice(0,-1)),brokenNamespace);
 // A readable project list with an unfinished page chain is also uncertain.
 const partialBundle=JSON.parse(fixture);
 partialBundle.organization.slug='different-organization';
 partialBundle.collections[0].pages[0].nextCursor='unfinished';
 partialBundle.omissions.push(personal);
 const partialNamespace='sentry-org:partial-export';
 const partial=await upload(Buffer.from(JSON.stringify(partialBundle)),partialNamespace);
 // A complete, independently scoped peer export can be attributed and stays.
 const peerBundle=JSON.parse(fixture);
 peerBundle.organization.slug='peer-organization';
 peerBundle.collections=peerBundle.collections.filter(collection=>collection.kind!=='dashboards');
 const peerNamespace='sentry-org:peer-organization';
 const peerUpload=await upload(Buffer.from(JSON.stringify(peerBundle)),peerNamespace);
 const peerArchive=await doorJson('archive',peerNamespace,{uploadId:peerUpload,tool:'sentry',takenAt:new Date().toISOString()});
 // An unsupported collection may hold project data without usable membership.
 // The public archive door retains it for review, with no native effects.
 const uncertainBundle=JSON.parse(fixture);
 uncertainBundle.organization.slug='unattributed-archive';
 uncertainBundle.collections.find(collection=>collection.kind==='dashboards').pages[0].response[0].title=personal;
 const uncertainNamespace='sentry-org:unattributed-archive';
 const uncertainUpload=await upload(Buffer.from(JSON.stringify(uncertainBundle)),uncertainNamespace);
 const uncertainArchive=await doorJson('archive',uncertainNamespace,{uploadId:uncertainUpload,tool:'sentry',takenAt:new Date().toISOString()});
 const oldArchive=await (await ownerRequest('/api/archive')).text();
 const heldBefore=await nativeSnapshot();
 const ownerHold=await ownerJson('/api/owner/erasure');
 assert.equal(ownerHold.hold,'shared_import_custody','shared original custody still honestly holds owner erasure');
 assert.deepEqual(await nativeSnapshot(),heldBefore,'owner erasure preview is nonmutating');
 const erasePreview=await ownerJson(projectPath+'/erasure');
 assert.equal(erasePreview.hold,null);
 assert.equal(erasePreview.deleted.ik_door_archives,3,'the two affected archives and the unattributable archive participate in project erasure');
 for(const table of ['ik_door_uploads','ik_door_chunks','ik_door_plans','ik_door_plan_chunks','ik_door_approvals','ik_door_scopes','ik_door_archives','ik_door_archive_chunks'])assert.ok(erasePreview.deleted[table]>0,`${table} participates in project erasure`);
 const accepted=await json(await ownerRequest(projectPath+'/erasure','POST',{confirm:imported[0].id,planHash:erasePreview.planHash}),202);
 const erased=await followErasure(async(path,method)=>{const response=await ownerRequest(path,method);assert.ok(response.ok);return response.json();},accepted);
 assert.equal(erased.phase,'complete');
 assert.deepEqual(await nativeSnapshot(),beforeNative,'erasure removes imported graph and preserves the unrelated native project');
 await json(await doorRequest('status',namespace,{planId:erasePlan.planId}),404);
 assert.equal((await json(await doorRequest('restore-check',namespace,{archiveId:archived.archiveId}),404)).error,'archive_not_found','project erasure withdraws the archive with its namespace');
 assert.equal((await json(await doorRequest('restore-check','sentry',{archiveId:finalArchive.archiveId}),404)).error,'archive_not_found','project erasure withdraws an archive naming the project from a namespace no plan opened');
 assert.deepEqual((await ownerJson(settingsPath)).history,[],'withdrawn private snapshots cannot be reopened from history');
 assert.equal((await json(await doorRequest('restore-check',uncertainNamespace,{archiveId:uncertainArchive.archiveId}),404)).error,'archive_not_found','uncertain unplanned archive headers and bytes are withdrawn');
 bytes=variant(6);
 for(const [uploadNamespace,id] of [[pendingNamespace,pending.uploadId],[brokenNamespace,broken],[partialNamespace,partial]]) {
  assert.equal((await json(await doorRequest('uploads',uploadNamespace,{uploadId:id}),404)).error,'upload_not_found','unattributable raw custody is withdrawn across namespaces');
  await json(await doorRequest('plan',uploadNamespace,{uploadId:id,catchup:true}),404);
 }
 assert.equal((await doorJson('uploads',peerNamespace,{uploadId:peerUpload})).complete,true,'proven peer custody stays');
 assert.equal((await doorJson('restore-check',peerNamespace,{archiveId:peerArchive.archiveId})).bundleSha256,peerArchive.bundleSha256);
 const freshArchive=await (await ownerRequest('/api/archive')).text();
 assert.ok(!freshArchive.includes(personal),'private exports retain none of the erased personal data');
 const restore=await fetch(origin+'/api/restore',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:oldArchive});
 const restoreRefusal=await json(restore,400);
 assert.equal(restoreRefusal.error,'erasure_epoch','an old private archive cannot resurrect erased data');
 assert.deepEqual(await nativeSnapshot(),beforeNative);
 const retryUpload=await upload(variant(4));
 assert.equal((await json(await doorRequest('plan',namespace,{uploadId:retryUpload,catchup:true}),409)).error,'source_erased','old source cannot return through catch-up');
 assert.deepEqual(await nativeSnapshot(),beforeNative);
 assert.notDeepEqual(heldBefore,beforeNative,'the old native export really held the erased project');


 // MIG-001: a large, realistic synthetic organization through the signed door.
 // Keep the native control project populated throughout. No SQL setup or reads:
 // both the imported graph and every refusal are checked through owner exports.
 const catchupOrg='synthetic-catchup',catchupNamespace=`sentry-org:${catchupOrg}`;
 const page=response=>[{cursor:null,nextCursor:null,response}];
 const sourceIssues=Array.from({length:247},(_,n)=>({id:`synthetic-issue-${n}`,
  title:`Checkout failure ${n}`,status:'unresolved',firstSeen:'2026-02-02T00:00:00Z',lastSeen:'2026-02-02T00:00:00Z'}));
 const sourceEvent=n=>({eventID:n.toString(16).padStart(32,'0'),groupID:`synthetic-issue-${n}`,
  dateCreated:'2026-02-02T00:00:00Z',release:{version:'checkout@1.0.0'},dist:'build-1',environment:'production',
  entries:[{type:'exception',data:{values:[{type:'TypeError',value:`Checkout failure ${n}`,
   stacktrace:{frames:[{filename:'src/checkout.ts',lineNo:12,colNo:3,function:'checkout'}]}}]}}]});
 const baseline={format:'spool-sentry-org-export',version:1,
  organization:{id:'synthetic-org-1',slug:catchupOrg,region:'us'},
  window:{start:'2026-02-01T00:00:00Z',end:'2026-02-03T00:00:00Z'},
  collections:[
   {kind:'projects',project:null,pages:page([{id:'synthetic-project-1',slug:'checkout',name:'Synthetic checkout',dateCreated:'2026-01-01T00:00:00Z'}])},
   {kind:'releases',project:null,pages:page([{version:'checkout@1.0.0',dateCreated:'2026-02-01T00:00:00Z',projects:[{slug:'checkout'}]}])},
   {kind:'issues',project:'checkout',pages:page(sourceIssues)},
   {kind:'events',project:'checkout',pages:page(sourceIssues.map((_,n)=>sourceEvent(n)))},
  ],omissions:['Synthetic export only; no attachments, maps, sessions, tracing or replay.']};
 const collection=(bundle,kind)=>bundle.collections.find(row=>row.kind===kind).pages[0].response;
 const beforeCatchup=await nativeSnapshot();
 assert.ok(beforeCatchup.events.length>0,'the destination already contains native evidence');
 const planBundle=async(bundle,extra={},expected=200)=>{
  const uploadId=await upload(Buffer.from(JSON.stringify(bundle)),catchupNamespace);
  return json(await doorRequest('plan',catchupNamespace,{uploadId,...extra.catchup?{catchup:true}:{}},extra),expected);
 };
 const reviewed=plan=>({fingerprint:plan.fingerprint,approvalRecordId:randomUUID(),approvedAt:new Date().toISOString()});
 const applyPlan=(plan,review)=>untilState(()=>doorJson('apply',catchupNamespace,
  {planId:plan.planId,reviewedFingerprint:plan.fingerprint},review),'completed',100);
 const reconcilePlan=async(plan,byKind)=>{
  const report=await doorJson('reconcile',catchupNamespace,{planId:plan.planId});
  assert.equal(report.ok,true);
  assert.equal(report.fingerprint,plan.fingerprint);
  assert.equal(report.bundleSha256,plan.bundleSha256);
  assert.equal(report.counts.sourceRecords,plan.summary.sourceRecords);
  assert.equal(report.counts.present+report.counts.explained,report.counts.sourceRecords);
  assert.deepEqual(report.counts.byKind,byKind);
  assert.ok(report.sourceIds.every(row=>['present','explained'].includes(row.status)));
  return report;
 };
 const basePlan=await planBundle(baseline);
 assert.deepEqual(await nativeSnapshot(),beforeCatchup,'large-set planning changes no native rows');
 assert.equal(basePlan.counts.rejected,0);
 await applyPlan(basePlan,reviewed(basePlan));
 const baseKinds={project:1,release:1,issue:sourceIssues.length,event:sourceIssues.length};
 await reconcilePlan(basePlan,baseKinds);
 const firstLayer=await nativeSnapshot();
 const catchupProject=firstLayer.projects.find(row=>row.name==='Synthetic checkout');
 assert.ok(catchupProject);
 const graph=snapshot=>Object.fromEntries(nativeTables.map(table=>[table,
  snapshot[table].filter(row=>table==='projects'?row.id===catchupProject.id:
   table==='sentry_import_targets'?JSON.parse(row.source).organization===catchupOrg:row.project===catchupProject.id)]));
 const importedGraph=graph(firstLayer);
 assert.equal(importedGraph.issues.length,sourceIssues.length);
 assert.equal(importedGraph.events.length,sourceIssues.length);
 for(const event of importedGraph.events) {
  assert.equal(event.historical,1);
  assert.equal(event.release,'checkout@1.0.0');
  assert.ok(importedGraph.issues.some(issue=>issue.id===event.issue&&issue.count===1));
  assert.equal(JSON.parse(event.payload).frames[0].file,'src/checkout.ts');
 }
 assert.deepEqual(firstLayer.projects.filter(row=>row.id!==catchupProject.id),beforeCatchup.projects);
 const nextBundle=structuredClone(baseline);
 collection(nextBundle,'issues')[0].title='Checkout failure investigated';
 collection(nextBundle,'issues').push({...sourceIssues[0],id:'synthetic-issue-247',title:'New checkout failure'});
 collection(nextBundle,'events').push(sourceEvent(247));
 const standing={catchup:'bounded',approvalRecordId:randomUUID(),approvedAt:new Date().toISOString()};
 const refusedPlan=async(bundle,reason)=>{
  const before=await nativeSnapshot();
  const result=await planBundle(bundle,standing,409);
  assert.equal(result.error,`catchup_requires_proposal:${reason}`);
  assert.deepEqual(await nativeSnapshot(),before,'refused catch-up preserves every native row');
 };
 const excessive=structuredClone(baseline);
 for(const issue of collection(excessive,'issues').slice(0,40))issue.title+=' changed outside allowance';
 await refusedPlan(excessive,'change_must_be_under_five_percent');
 const gone=structuredClone(baseline);
 collection(gone,'events').pop();
 await refusedPlan(gone,'source_records_gone');
 const catchupPlan=await planBundle(nextBundle,standing);
 assert.equal(catchupPlan.counts.rejected,0);
 assert.equal(catchupPlan.summary.updated,1);
 assert.equal(catchupPlan.summary.created,2);
 assert.equal(catchupPlan.summary.sourceRecords,basePlan.summary.sourceRecords+2);
 assert.deepEqual(await nativeSnapshot(),firstLayer,'bounded review reads the full native set without changes');
 const applyCatchup={planId:catchupPlan.planId,reviewedFingerprint:catchupPlan.fingerprint};
 const wrongStanding=await json(await doorRequest('apply',catchupNamespace,applyCatchup,
  {...standing,fingerprint:catchupPlan.fingerprint,approvalRecordId:randomUUID()}),403);
 assert.equal(wrongStanding.error,'standing_approval_mismatch');
 const wrongTime=await json(await doorRequest('apply',catchupNamespace,applyCatchup,
  {...standing,fingerprint:catchupPlan.fingerprint,approvedAt:new Date(Date.parse(standing.approvedAt)-1000).toISOString()}),403);
 assert.equal(wrongTime.error,'standing_approval_mismatch');
 assert.deepEqual(await nativeSnapshot(),firstLayer,'another approval cannot borrow the standing allowance');
 await applyPlan(catchupPlan,{...standing,fingerprint:catchupPlan.fingerprint});
 await reconcilePlan(catchupPlan,{...baseKinds,issue:sourceIssues.length+1,event:sourceIssues.length+1});
 const secondLayer=await nativeSnapshot(),nextGraph=graph(secondLayer);
 assert.equal(nextGraph.issues.find(row=>row.id===importedGraph.issues.find(row=>row.title==='Checkout failure 0').id).title,'Checkout failure investigated');
 assert.equal(nextGraph.issues.filter(row=>row.title==='New checkout failure').length,1);
 assert.equal(nextGraph.events.length,importedGraph.events.length+1);
 assert.deepEqual(nextGraph.events.filter(row=>importedGraph.events.some(old=>old.id===row.id)),importedGraph.events,
  'unchanged imported event identities and values survive replacement of their parent issue');
 const catchupStatus=await doorJson('status',catchupNamespace,{planId:catchupPlan.planId});
 assert.equal(catchupStatus.approval.approval_id,standing.approvalRecordId);
 assert.equal(catchupStatus.approval.approved_at,standing.approvedAt);
 const oldFirst=await json(await doorRequest('undo',catchupNamespace,{planId:basePlan.planId}),409);
 assert.equal(oldFirst.error,'import_superseded');
 assert.deepEqual(await nativeSnapshot(),secondLayer,'old-first undo cannot remove a newer layer');
 await untilState(()=>doorJson('undo',catchupNamespace,{planId:catchupPlan.planId}),'undone',100);
 assert.deepEqual(await nativeSnapshot(),firstLayer,'newest undo restores the exact first imported graph and provenance');
 await reconcilePlan(basePlan,baseKinds);
 await untilState(()=>doorJson('undo',catchupNamespace,{planId:basePlan.planId}),'undone',100);
 assert.deepEqual(await nativeSnapshot(),beforeCatchup,'oldest undo restores the pre-import populated installation');

 // A human triage edit must remain authoritative over a later vendor change.
 // Re-import via the same public door, then edit through the ordinary owner API.
 const editedPlan=await planBundle(baseline);
 await applyPlan(editedPlan,reviewed(editedPlan));
 const beforeEdit=await nativeSnapshot();
 const editedIssue=graph(beforeEdit).issues.find(row=>row.title==='Checkout failure 0');
 const issuePath=`/api/projects/${catchupProject.id}/issues/${editedIssue.id}`;
 await ownerJson(issuePath,'PATCH',{state:'acknowledged',revision:editedIssue.revision});
 const editedLayer=await nativeSnapshot();
 await refusedPlan(nextBundle,'native_or_mapping_conflict');
 const editedReport=await doorJson('reconcile',catchupNamespace,{planId:editedPlan.planId});
 assert.equal(editedReport.ok,false);
 assert.ok(editedReport.sourceIds.some(row=>row.kind==='issues'&&row.status==='mismatched'));
 assert.deepEqual(await nativeSnapshot(),editedLayer,'reconciliation reports the edit without changing it');
 // Public project erasure cleans up this deliberately edited graph; never reset
 // its revision in SQL merely to make an undo pass.
 const catchupPath=`/api/projects/${catchupProject.id}`;
 const cleanupPreview=await ownerJson(catchupPath+'/erasure');
 assert.equal(cleanupPreview.hold,null);
 const cleanupAccepted=await json(await ownerRequest(catchupPath+'/erasure','POST',
  {confirm:catchupProject.id,planHash:cleanupPreview.planHash}),202);
 const cleanup=await followErasure(async(path,method)=>{
  const response=await ownerRequest(path,method);assert.ok(response.ok);return response.json();
 },cleanupAccepted);
 assert.equal(cleanup.phase,'complete');
 assert.deepEqual(await nativeSnapshot(),beforeCatchup,'cleanup preserves the original live native evidence');
 console.log(`Signed bounded catch-up passed: ${basePlan.summary.sourceRecords} baseline -> ${catchupPlan.summary.sourceRecords} source records; native reconcile, changed issue + added issue/event, approval binding, over-allowance/gone/native-edit refusals and exact newest-first undo. Large-set reads approached the record limit with this synthetic graph; no arbitrary-byte/native-set claim.`);

 await ownerJson(settingsPath,'POST',{enabled:true,revokedKids:[kid]});
 await ownerJson(settingsPath,'POST',{enabled:false});
 await ownerJson(settingsPath,'POST',{enabled:true,revokedKids:[]});
 const revoked=await ownerJson(settingsPath);
 assert.equal(revoked.enabled,true);
 assert.deepEqual(revoked.keys.map(({kid,revoked})=>({kid,revoked})),[{kid,revoked:true}],'revocation survives later settings writes and re-enablement');
 const refused=await json(await doorRequest('uploads',namespace,{}),403);
 assert.equal(refused.error,'grant_replayed_revoked_or_expired','fresh correctly signed grants from a revoked key fail closed');
 assert.equal((await json(await cutoverRequest({since:epoch},await rerGrant()),403)).error,'invalid_grant','the cutover read refuses a revoked key');
 assert.deepEqual(await nativeSnapshot(),beforeNative);
 console.log('Business import public HTTP journey passed: owner opt-in, namespace allow-list, checked chunks, no-write review, signed approval, native reconciliation, Base door conformance through the owner and Business mounts, both undo doors, the tool archive and its restore check, project erasure of door custody, the signed cutover read with its refusals, and durable key revocation. Synthetic export only.');
} finally {
 await worker.stop();
}
