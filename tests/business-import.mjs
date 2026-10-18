import {followErasure} from './project-erasure/follow.mjs';
import assert from 'node:assert/strict';
import { createHash, randomUUID, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { startTestWorker } from './worker.mjs';
import { signIn, testOwner } from './auth.mjs';
import { archiveProjection } from './archive.mjs';

// Base import-kit door conformance (modules/import-kit/src/door/ADOPTING.md,
// rer 0.2.61), copied unchanged and run against both of Spool's door mounts.
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
 const ownerRequest=(path,method='GET',body,authenticated=true)=>fetch(origin+path,{
  method,redirect:'manual',headers:{Origin:origin,...authenticated?{Cookie:cookie}:{},
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
  method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${await grant(action,grantNamespace,extra)}`},
  body:JSON.stringify(body),
 });
 const doorJson=async(action,grantNamespace,body,extra)=>json(await doorRequest(action,grantNamespace,body,extra));
 async function upload(next) {
  bytes=next;
  const bundleSha256=digest(bytes),totalChunks=Math.ceil(bytes.length/65_536);
  let uploadId,result;
  for(let index=0;index<totalChunks;index++) {
   const chunk=bytes.subarray(index*65_536,(index+1)*65_536);
   const body={...uploadId?{uploadId}:{},name:'synthetic-sentry-organization.json',bundleSha256,
    totalBytes:bytes.length,totalChunks,index,chunkSha256:digest(chunk),base64:chunk.toString('base64')};
   if(index===0) {
    const corrupt=await json(await doorRequest('uploads',namespace,{...body,chunkSha256:'0'.repeat(64)}),400);
    assert.equal(corrupt.error,'chunk_hash_or_size_mismatch','corrupt bytes cannot enter retained upload');
   }
   result=await doorJson('uploads',namespace,body);
   uploadId??=result.uploadId;
   assert.equal(result.uploadId,uploadId);
   assert.equal(result.complete,index===totalChunks-1);
   assert.equal(result.received.length,index+1);
   if(index===0) {
    const duplicate=await doorJson('uploads',namespace,{...body,uploadId});
    assert.deepEqual(duplicate.received,result.received,'an identical chunk is idempotent with a fresh grant');
   }
  }
  const inventory=await doorJson('uploads',namespace,{uploadId});
  assert.equal(inventory.complete,true);
  assert.equal(inventory.bundleSha256,bundleSha256);
  assert.deepEqual(inventory.received,result.received);
  assert.equal(inventory.received.reduce((n,chunk)=>n+chunk.size,0),bytes.length);
  for(const chunk of inventory.received) {
   assert.equal(chunk.sha256,digest(bytes.subarray(chunk.ordinal*65_536,(chunk.ordinal+1)*65_536)));
  }
  return uploadId;
 }
 async function untilState(step,state) {
  let result;
  for(let batch=0;batch<20;batch++) {
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
 assert.deepEqual(initial.keys,[{kid,revoked:false}]);
 assert.deepEqual(initial.history,[]);
 assert.equal((await json(await doorRequest('uploads',namespace,{}),404)).error,'not_found');
 assert.equal((await ownerJson(settingsPath,'POST',{enabled:true})).enabled,true);
 await json(await ownerRequest('/api/projects','POST',{id:'native-business-control',name:'Untouched owner project'}),201);
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
 assert.match(history.caption,/approved via Business by/);
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
 await conformance(async(action,body,review)=>{bytes=variant(3);return doorRequest(action,namespace,body,action==='apply'?review:{})},variant(3));

 // Project erasure withdraws the door's duplicate raw custody as well as kit originals.
 const erasePlan=await doorJson('plan',namespace,{uploadId:await upload(variant(4))});
 const eraseApproval={fingerprint:erasePlan.fingerprint,approvalRecordId:randomUUID(),approvedAt:new Date().toISOString()};
 await untilState(()=>doorJson('apply',namespace,{planId:erasePlan.planId,reviewedFingerprint:erasePlan.fingerprint},eraseApproval),'completed');
 const erasePreview=await ownerJson(projectPath+'/erasure');
 assert.equal(erasePreview.hold,null);
 for(const table of ['ik_door_uploads','ik_door_chunks','ik_door_plans','ik_door_plan_chunks','ik_door_approvals','ik_door_scopes'])assert.ok(erasePreview.deleted[table]>0,`${table} participates in project erasure`);
 const accepted=await json(await ownerRequest(projectPath+'/erasure','POST',{confirm:imported[0].id,planHash:erasePreview.planHash}),202);
 const erased=await followErasure(async(path,method)=>{const response=await ownerRequest(path,method);assert.ok(response.ok);return response.json();},accepted);
 assert.equal(erased.phase,'complete');
 assert.deepEqual(await nativeSnapshot(),beforeNative,'erasure removes imported graph and preserves the unrelated native project');
 await json(await doorRequest('status',namespace,{planId:erasePlan.planId}),404);
 assert.deepEqual((await ownerJson(settingsPath)).history,[],'withdrawn private snapshots cannot be reopened from history');

 await ownerJson(settingsPath,'POST',{enabled:true,revokedKids:[kid]});
 await ownerJson(settingsPath,'POST',{enabled:false});
 await ownerJson(settingsPath,'POST',{enabled:true,revokedKids:[]});
 const revoked=await ownerJson(settingsPath);
 assert.equal(revoked.enabled,true);
 assert.deepEqual(revoked.keys,[{kid,revoked:true}],'revocation survives later settings writes and re-enablement');
 const refused=await json(await doorRequest('uploads',namespace,{}),403);
 assert.equal(refused.error,'grant_replayed_revoked_or_expired','fresh correctly signed grants from a revoked key fail closed');
 assert.deepEqual(await nativeSnapshot(),beforeNative);
 console.log('Business import public HTTP journey passed: owner opt-in, namespace allow-list, checked chunks, no-write review, signed approval, native reconciliation, Base door conformance through the owner and Business mounts, both undo doors, project erasure of door custody and durable key revocation. Synthetic export only.');
} finally {
 await worker.stop();
}
