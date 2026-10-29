import { runtime } from './owner-erasure/helpers.mjs';
import assert from 'node:assert/strict';
import { archiveProjection } from './archive.mjs';
import { startTestWorker } from './worker.mjs';
import { signIn, confirmEmailLink } from './auth.mjs';
import { followErasure } from './project-erasure/follow.mjs';

// One public journey covers approval, an unmodified SDK, membership, custody and erasure.
export async function attachmentFlow() {
 const app=await runtime(),origin=app.origin;
 const req=(path,method='GET',value,headers={})=>fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,Cookie:app.cookie,...value===undefined?{}:{'Content-Type':'application/json'},...headers},...value===undefined?{}:{body:typeof value==='string'?value:JSON.stringify(value)}});
 const json=async(...args)=>{const response=await req(...args),text=await response.text();assert.ok(response.ok,args[0]+' HTTP '+response.status+' '+text);return JSON.parse(text)};
 try {
 const project=await json('/api/projects','POST',{id:'synthetic-spool-attachments',name:'Private attachment custody'}),root='/api/projects/'+project.id;
 const sdk=await import('@sentry/node'),bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
 const localDsn=new URL(project.dsn),transport=new URL(origin);localDsn.protocol=transport.protocol;localDsn.hostname=transport.hostname;localDsn.port=transport.port;
 sdk.init({dsn:localDsn.toString(),defaultIntegrations:false,sendClientReports:false,release:'synthetic-spool-attachment-release',dist:'web'});
 let event;
 const capture=async count=>{
  sdk.withScope(scope=>{for(let i=0;i<count;i++)scope.addAttachment({filename:'synthetic-spool-'+i+'.png',contentType:'image/png',data:bytes});event=sdk.captureException(new Error('synthetic-spool-attachment'))});
  assert.equal(await sdk.flush(10000),true,'the installed unmodified SDK flushes its actual envelope');
 };
 try{
  await capture(1);assert.equal((await json(root+'/attachments')).total,0,'default capture retains no original bytes');
  const policy=await json(root+'/attachment-policy');assert.equal(policy.enabled,0);
  assert.equal((await req(root+'/attachment-policy','PUT',{enabled:true,revision:policy.revision})).status,400,'capture cannot be enabled without explicit original-byte approval');
  await json(root+'/attachment-policy','PUT',{enabled:true,revision:policy.revision,confirm:'retain private original bytes'});
  assert.equal((await req(root+'/attachment-policy','PUT',{enabled:false,revision:policy.revision})).status,409,'stale approval cannot replace the current policy');
  await capture(30);
 }finally{await sdk.close(10000)}
 const grant=await json(root+'/keys','POST',{kind:'agent'}),auth={Cookie:'',Authorization:'Bearer '+grant.key};
 const first=await json(root+'/attachments','GET',undefined,auth),next=await json(root+'/attachments?cursor='+encodeURIComponent(first.next),'GET',undefined,auth),rows=[...first.rows,...next.rows];
 assert.equal(first.total,30);assert.equal(rows.length,30);assert.equal(new Set(rows.map(row=>row.id)).size,30);assert.equal(next.next,null);
 assert.ok(rows.every(row=>row.event===event&&row.bytes===bytes.length));assert.ok(rows.every(row=>!('payload' in row)));
 assert.deepEqual((await json(root+'/attachments?event='+event,'GET',undefined,auth)).rows,first.rows);
 for(const query of ['order=oldest','event='+event])assert.equal((await req(root+'/attachments?'+query+'&cursor='+encodeURIComponent(first.next),'GET',undefined,auth)).status,400);
 const one=rows[0],content=root+'/attachments/'+one.id+'/content';
 for(const suffix of ['', '?download=1']){const response=await req(content+suffix,'GET',undefined,auth);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.match(response.headers.get('content-disposition'),suffix?/^attachment/:/^inline/);assert.match(response.headers.get('content-security-policy'),/sandbox/);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes,'view and download retain exact attachment bytes');}
 const me=await json('/api/organization/me');if(!me.organization)await json('/api/organization','POST',{id:'synthetic-spool-attachment-org',name:'Private attachment organization'});
 await json('/api/organization/projects/'+project.id,'PUT',{team:'synthetic-spool-attachments'});
 const members=[];
 for(let n=0;n<2;n++){
  const identity=['synthetic-spool-attachment-'+n,'example.test'].join('@');
  await json('/api/organization/invites','POST',{email:identity,name:'Synthetic attachment member '+n,role:'member',grants:n?[]:[{project:project.id,role:'read-only'}]});
  const cookie=await confirmEmailLink(origin,identity),member=(await json('/api/organization')).members.find(row=>row.email===identity);members.push({cookie,member});
 }
 assert.equal((await req(content,'GET',undefined,{Cookie:members[0].cookie})).status,200,'permitted member can open an SDK screenshot');
 assert.equal((await req(content,'GET',undefined,{Cookie:members[1].cookie})).status,404,'unpermitted member cannot open the screenshot');
 const foreign=await json('/api/projects','POST',{id:'synthetic-spool-attachments-other',name:'Other attachment scope'}),foreignGrant=await json('/api/projects/'+foreign.id+'/keys','POST',{kind:'agent'}),deploy=await json(root+'/keys','POST',{kind:'deploy'});
 for(const key of [foreignGrant.key,deploy.key,project.ingestKey,'synthetic-spool-invalid'])for(const path of [root+'/attachments',content])assert.equal((await req(path,'GET',undefined,{Authorization:'Bearer '+key})).status,401);
 assert.equal((await req(root+'/attachment-policy','PUT',{enabled:false,revision:1},{...auth})).status,401,'read grants cannot change capture approval');
 await json('/api/organization/members/'+members[0].member.id,'DELETE',{version:members[0].member.version});
 assert.ok([401,404].includes((await req(content,'GET',undefined,{Cookie:members[0].cookie})).status),'removal retires screenshot access at once');
 const facts=(await json('/api/audit/export')).rows;for(const action of ['attachment.policy','attachment.view','attachment.download'])assert.ok(facts.some(row=>row.action===action&&row.outcome==='succeeded'));
 assert.ok(facts.some(row=>row.action==='attachment.view'&&row.outcome==='denied'),'refused view records its truthful audit outcome');
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
 const dsn=new URL(project.dsn),path='/api'+dsn.pathname+'/envelope/?sentry_key='+dsn.username+'&sentry_version=7';
 const replay=Buffer.concat([Buffer.from(JSON.stringify({event_id:event})+'\n'+JSON.stringify({type:'attachment',filename:one.name,content_type:'image/png',length:bytes.length})+'\n'),bytes]);
 const replayResponse=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/x-sentry-envelope'},body:replay});assert.equal(replayResponse.status,200);assert.equal((await replayResponse.json()).attachments.attachment_withdrawn,1);assert.equal((await json(root+'/attachments')).total,29);
 const plan=await json(root+'/erasure');assert.equal(plan.deleted.event_attachments,29);await followErasure(json,await json(root+'/erasure','POST',{confirm:project.id,planHash:plan.planHash}));
 assert.equal((await req(content)).status,404);assert.equal((await req(content,'GET',undefined,auth)).status,401);
 const after=await archiveProjection(await req('/api/archive'));assert.ok(!after.data.event_attachments.some(row=>row.project===project.id));assert.ok(!after.data.attachment_policies.some(row=>row.project===project.id));
 console.log('[API-001] owner-approved unmodified SDK attachments, two metadata pages, exact bytes, member and grant fences, audited views and downloads, inert restore, withdrawal replay and project erasure passed');
 }finally{await app.close()}
}
