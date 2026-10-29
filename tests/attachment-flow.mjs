import { launchBrowser } from './browser-launch.mjs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runtime, successor, eraseInput } from './owner-erasure/helpers.mjs';
import assert from 'node:assert/strict';
import { archiveProjection } from './archive.mjs';
import { startTestWorker } from './worker.mjs';
import { signIn, confirmEmailLink } from './auth.mjs';
import { followErasure } from './project-erasure/follow.mjs';

// One public journey covers approval, an unmodified SDK, membership, custody and erasure.
export async function attachmentFlow() {
 console.log('[API-001 attachments] starting native hosted runtime');
 const app=await runtime(),origin=app.origin;
 console.log('[API-001 attachments] native owner admitted');
 const req=(path,method='GET',value,headers={})=>fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,Cookie:app.cookie,...value===undefined?{}:{'Content-Type':'application/json'},...headers},...value===undefined?{}:{body:typeof value==='string'?value:JSON.stringify(value)}});
 const json=async(...args)=>{const response=await req(...args),text=await response.text();assert.ok(response.ok,args[0]+' HTTP '+response.status+' '+text);return JSON.parse(text)};
 try {
 const project=await json('/api/projects','POST',{id:'synthetic-spool-attachments',name:'Private attachment custody'}),root='/api/projects/'+project.id;
 const sdk=await import('@sentry/node'),bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
 const localDsn=new URL(project.dsn),transport=new URL(origin);localDsn.protocol=transport.protocol;localDsn.hostname=transport.hostname;localDsn.port=transport.port;
 sdk.init({dsn:localDsn.toString(),defaultIntegrations:false,sendClientReports:false,release:'synthetic-spool-attachment-release',dist:'web'});
 let event,policy;
 const capture=async count=>{
  sdk.withScope(scope=>{for(let i=0;i<count;i++)scope.addAttachment({filename:'synthetic-spool-'+i+'.png',contentType:'image/png',data:bytes});event=sdk.captureException(new Error('synthetic-spool-attachment'))});
  assert.equal(await sdk.flush(10000),true,'the installed unmodified SDK flushes its actual envelope');
 };
 try{
  console.log('[API-001 attachments] default capture');await capture(1);assert.equal((await json(root+'/attachments')).total,0,'default capture retains no original bytes');
  policy=await json(root+'/attachment-policy');assert.equal(policy.enabled,0);
  assert.equal((await req(root+'/attachment-policy','PUT',{enabled:true,revision:policy.revision})).status,400,'capture cannot be enabled without explicit original-byte approval');
  await json(root+'/attachment-policy','PUT',{enabled:true,revision:policy.revision,confirm:'retain private original bytes'});
  assert.equal((await req(root+'/attachment-policy','PUT',{enabled:false,revision:policy.revision})).status,409,'stale approval cannot replace the current policy');
  console.log('[API-001 attachments] approved capture');await capture(30);
 }finally{await sdk.close(10000)}
 console.log('[API-001 attachments] verifying retained metadata and bytes');
 const grant=await json(root+'/keys','POST',{kind:'agent'}),auth={Cookie:'',Authorization:'Bearer '+grant.key};
 const first=await json(root+'/attachments','GET',undefined,auth),next=await json(root+'/attachments?cursor='+encodeURIComponent(first.next),'GET',undefined,auth),rows=[...first.rows,...next.rows];
 assert.equal(first.total,30);assert.equal(rows.length,30);assert.equal(new Set(rows.map(row=>row.id)).size,30);assert.equal(next.next,null);
 assert.ok(rows.every(row=>row.event===event&&row.bytes===bytes.length));assert.ok(rows.every(row=>!('payload' in row)));
 assert.deepEqual((await json(root+'/attachments?event='+event,'GET',undefined,auth)).rows,first.rows);
 for(const query of ['order=oldest','event='+event])assert.equal((await req(root+'/attachments?'+query+'&cursor='+encodeURIComponent(first.next),'GET',undefined,auth)).status,400);
 const one=rows[0],content=root+'/attachments/'+one.id+'/content';
 for(const suffix of ['', '?download=1']){const response=await req(content+suffix,'GET',undefined,auth);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.match(response.headers.get('content-disposition'),suffix?/^attachment/:/^inline/);assert.match(response.headers.get('content-security-policy'),/sandbox/);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes,'view and download retain exact attachment bytes');}
 const dsn=new URL(project.dsn),path='/api'+dsn.pathname+'/envelope/?sentry_key='+dsn.username+'&sentry_version=7';
 const send=async(eventId,items,query=path)=>{
  const chunks=[Buffer.from(JSON.stringify({event_id:eventId})+'\n')];
  for(const item of items){chunks.push(Buffer.from(JSON.stringify({...item.header,length:item.bytes.length})+'\n'),item.bytes,Buffer.from('\n'))}
  const response=await fetch(origin+query,{method:'POST',headers:{'Content-Type':'application/x-sentry-envelope'},body:Buffer.concat(chunks)});
  return {status:response.status,data:await response.json()};
 };
 const companion='ab'.repeat(16),oversized=Buffer.alloc(policy.bounds.itemBytes+1,65);
 const isolated=await send(companion,[{header:{type:'attachment',filename:'synthetic-spool-oversized.bin'},bytes:oversized},{header:{type:'attachment',filename:''},bytes},{header:{type:'event'},bytes:Buffer.from(JSON.stringify({event_id:companion,release:'synthetic-spool-attachment-release',dist:'web',message:'synthetic-spool-companion'}))}]);
 assert.equal(isolated.status,200);assert.equal(isolated.data.id,companion);assert.equal(isolated.data.attachments.attachment_oversized,1);assert.equal(isolated.data.attachments.attachment_invalid,1);
 assert.equal((await json(root+'/attachments')).total,30,'refused attachment items create no partial rows');
 assert.ok((await json(root+'/occurrences')).rows.some(row=>row.id===companion),'valid companion error survives attachment item refusals');
 const orphan=await send('cd'.repeat(16),[{header:{type:'attachment',filename:'synthetic-spool-orphan.png'},bytes}]);assert.equal(orphan.data.attachments.attachment_event_unavailable,1);
 await json(root+'/attachment-policy','PUT',{enabled:false,revision:policy.revision+1});
 const disabled=await send(companion,[{header:{type:'attachment',filename:'synthetic-spool-disabled.png'},bytes}]);assert.equal(disabled.data.attachments.attachment_disabled,1);assert.equal(disabled.data.dropped.sentry_unsupported_attachment,1);assert.equal((await json(root+'/attachments')).total,30,'disabling capture preserves existing files and retains no new bytes');
 await json(root+'/attachment-policy','PUT',{enabled:true,revision:policy.revision+2,confirm:'retain private original bytes'});
 const counted=(await json(root+'/outcomes')).rows;for(const reason of ['sentry_unsupported_attachment','attachment_oversized','attachment_invalid','attachment_event_unavailable'])assert.ok(counted.some(row=>row.reason===reason&&row.count>0));
 const me=await json('/api/organization/me');if(!me.organization)await json('/api/organization','POST',{id:'synthetic-spool-attachment-org',name:'Private attachment organization'});
 await json('/api/organization/projects/'+project.id,'PUT',{team:'synthetic-spool-attachments'});
 const service=await json('/api/organization/services','POST',{name:'synthetic-spool-attachment-reader',scopes:[{project:project.id,kind:'agent'}]});
 const serviceKey=await json('/api/organization/services/'+service.id+'/keys','POST',{project:project.id,kind:'agent'}),serviceAuth={Cookie:'',Authorization:'Bearer '+serviceKey.key};
 const serviceFirst=await json(root+'/attachments','GET',undefined,serviceAuth),serviceNext=await json(root+'/attachments?cursor='+encodeURIComponent(serviceFirst.next),'GET',undefined,serviceAuth);
 assert.deepEqual([...serviceFirst.rows,...serviceNext.rows],rows,'a scoped read-only service traverses every retained attachment');
 const serviceContent=await req(content,'GET',undefined,serviceAuth);assert.equal(serviceContent.status,200);assert.deepEqual(Buffer.from(await serviceContent.arrayBuffer()),bytes);
 await json(root+'/keys/'+serviceKey.hash,'DELETE');for(const path of [root+'/attachments',content])assert.equal((await req(path,'GET',undefined,serviceAuth)).status,401,'revoking the service key immediately retires attachment reads');
 const members=[];
 for(let n=0;n<2;n++){
  const identity=['synthetic-spool-attachment-'+n,'example.test'].join('@');
  await json('/api/organization/invites','POST',{email:identity,name:'Synthetic attachment member '+n,role:'member',grants:n?[]:[{project:project.id,role:'read-only'}]});
  const cookie=await confirmEmailLink(origin,identity),member=(await json('/api/organization')).members.find(row=>row.email===identity);members.push({cookie,member});
 }
 assert.equal((await req(content,'GET',undefined,{Cookie:members[0].cookie})).status,200,'permitted member can open an SDK screenshot');
 assert.equal((await req(content,'GET',undefined,{Cookie:members[1].cookie})).status,404,'unpermitted member cannot open the screenshot');
 console.log('[API-001 attachments] verifying permitted-member screenshot');
 const browser=await launchBrowser();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}}),split=members[0].cookie.indexOf('=');
  await context.addCookies([{name:members[0].cookie.slice(0,split),value:members[0].cookie.slice(split+1),url:origin.replace('http:','https:'),secure:true}]);
  const page=await context.newPage(),response=await page.goto(origin+content);assert.equal(response.status(),200);await page.locator('img').waitFor();assert.equal(await page.locator('img').evaluate(image=>image.complete&&image.naturalWidth>0),true,'a permitted member sees the actual SDK screenshot in a browser');
  const folder=process.env.SPOOL_ATTACHMENT_EVIDENCE||'.artifacts/attachments';await mkdir(folder,{recursive:true});await page.screenshot({path:resolve(folder,'screenshot-1440.png')});await page.setViewportSize({width:390,height:900});await page.screenshot({path:resolve(folder,'screenshot-390.png')});
  await context.close();
 }finally{await browser.close()}
 const foreign=await json('/api/projects','POST',{id:'synthetic-spool-attachments-other',name:'Other attachment scope'}),foreignGrant=await json('/api/projects/'+foreign.id+'/keys','POST',{kind:'agent'}),deploy=await json(root+'/keys','POST',{kind:'deploy'});
 for(const key of [foreignGrant.key,deploy.key,project.ingestKey,'synthetic-spool-invalid'])for(const path of [root+'/attachments',content])assert.equal((await req(path,'GET',undefined,{Authorization:'Bearer '+key})).status,401);
 assert.equal((await req(root+'/attachment-policy','PUT',{enabled:false,revision:1},{...auth})).status,401,'read grants cannot change capture approval');
 await json('/api/organization/members/'+members[0].member.id,'DELETE',{version:members[0].member.version});
 assert.ok([401,404].includes((await req(content,'GET',undefined,{Cookie:members[0].cookie})).status),'removal retires screenshot access at once');
 const facts=(await json('/api/audit/export')).rows;for(const action of ['attachment.policy','attachment.view','attachment.download'])assert.ok(facts.some(row=>row.action===action&&row.outcome==='succeeded'));
 assert.ok(facts.some(row=>row.action==='attachment.view'&&row.outcome==='denied'),'refused view records its truthful audit outcome');
 await successor(app);const held=await json('/api/owner/erasure');assert.equal(held.hold,'private_attachment_attribution_unavailable','unattributed private bytes cannot be certified as personally erased');
 assert.equal((await req('/api/owner/erasure','POST',eraseInput(held))).status,409);assert.equal((await json(root+'/attachments')).total,30,'held personal erasure preserves unrelated attachment custody');
 console.log('[API-001 attachments] verifying inert archive and erasure');
 const snapshot=await archiveProjection(await req('/api/archive'));assert.equal(snapshot.data.attachment_policies.find(row=>row.project===project.id).enabled,0,'capture approval never travels');
 assert.deepEqual(new Set(snapshot.data.event_attachments.filter(row=>row.project===project.id).map(row=>row.id)),new Set(rows.map(row=>row.id)));
 const restored=await startTestWorker(15562);
 try{
  const cookie=await signIn(restored.origin),response=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Cookie:cookie,Origin:restored.origin,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:snapshot.text});assert.equal(response.status,200,await response.text());
  const restoredRead=await fetch(restored.origin+content,{headers:{Cookie:cookie}});assert.equal(restoredRead.status,200);assert.deepEqual(Buffer.from(await restoredRead.arrayBuffer()),bytes);
  assert.equal((await fetch(restored.origin+root+'/attachment-policy',{headers:{Cookie:cookie}}).then(response=>response.json())).enabled,0);
  assert.equal((await fetch(restored.origin+content,{headers:auth})).status,401,'private restore never revives read authority');
 }finally{await restored.stop()}
 await json(root+'/attachments/'+one.id,'DELETE');assert.equal((await req(content,'GET',undefined,auth)).status,404);
 const olderRestore=await req('/api/restore','POST',snapshot.text,{'X-Confirm-Restore':'yes','Content-Type':'application/x-ndjson'});assert.equal(olderRestore.status,400);assert.equal((await olderRestore.json()).error,'erasure_epoch','the withdrawal journal refuses an earlier archive before occupancy checks');
 const replay=Buffer.concat([Buffer.from(JSON.stringify({event_id:event})+'\n'+JSON.stringify({type:'attachment',filename:one.name,content_type:'image/png',length:bytes.length})+'\n'),bytes]);
 const replayResponse=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/x-sentry-envelope'},body:replay});assert.equal(replayResponse.status,200);assert.equal((await replayResponse.json()).attachments.attachment_withdrawn,1);assert.equal((await json(root+'/attachments')).total,29);
 const plan=await json(root+'/erasure');assert.equal(plan.deleted.event_attachments,29);await followErasure(json,await json(root+'/erasure','POST',{confirm:project.id,planHash:plan.planHash}));
 assert.equal((await req(content)).status,404);assert.equal((await req(content,'GET',undefined,auth)).status,401);
 const after=await archiveProjection(await req('/api/archive'));assert.ok(!after.data.event_attachments.some(row=>row.project===project.id));assert.ok(!after.data.attachment_policies.some(row=>row.project===project.id));
 console.log('[API-001] owner-approved unmodified SDK attachments, two metadata pages, exact bytes, member and grant fences, audited views and downloads, inert restore, withdrawal replay and project erasure passed');
 }finally{await app.close()}
}
