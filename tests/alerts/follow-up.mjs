import assert from 'node:assert/strict';

// ALERT-004 an interrupted send, an expired lease and a lost provider response
// each leave one durable follow-up and never a duplicate (alert portion).
export async function alertFollowUp(app,inbox,delivery){
 const path='/api/projects/web/follow-up';
 let data=await app.json(path),row=data.rows.find(r=>r.source_id===delivery.id);
 assert.ok(row&&row.state==='uncertain','lost provider response becomes owner work');
 assert.equal(data.alternate.state,'none','an installation starts with no alternate');
 const facts=async()=>(await app.db.prepare("SELECT COUNT(*) n FROM spool_audit_events WHERE action='automation.follow_up'").first()).n;
 const before=await facts();await app.schedule(Date.now()+7000);assert.equal(await facts(),before,'repeated evaluation creates no duplicate follow-up fact');
 assert.equal((await app.request(path,'GET',undefined,{Cookie:''})).status,401);
 assert.equal((await app.request(path+'/alternate','PUT',{destination:'webhook-v1',channel:'webhook'},{Origin:'https://foreign.example'})).status,403);
 assert.ok((await app.request(path+'/alternate','PUT',{destination:'other-v1',channel:'mail'})).status>=400,'alternate belongs to the exact project');
 await app.json(path+'/alternate','PUT',{destination:'webhook-v1',channel:'webhook'});
 inbox.statuses.push(503);await app.schedule(Date.now()+8000);
 data=await app.json(path);row=data.rows.find(r=>r.id===row.id);
 assert.equal(row.notices.length,1);assert.equal(row.notices[0].state,'uncertain','failed alternate is visible');
 const sent=inbox.requests.length;await app.schedule(Date.now()+9000);await app.schedule(Date.now()+10000);
 assert.equal(inbox.requests.length,sent,'uncertain alternate never retries or recursively notifies itself');
 assert.equal((await app.json(path)).rows.find(r=>r.id===row.id).notices.length,1);
 const stale=await app.request(`${path}/${row.id}/reconcile`,'POST',{revision:row.revision+1,state:'accepted',evidence:'receiver_confirmed'});
 assert.equal(stale.status,409,'a stale decision cannot claim completion');
 const accepted=await app.json(`${path}/${row.id}/reconcile`,'POST',{revision:row.revision,state:'accepted',evidence:'receiver_confirmed'});
 assert.equal(accepted.replayed,false);assert.equal((await app.json(path)).rows.find(r=>r.id===row.id).state,'completed');
 await app.json(path+'/alternate','PUT',{destination:null});
 assert.equal(await facts(),before,'owner reconciliation is separate from the one follow-up fact');
}

// The recorded Slack edge qualifies alternate notices, never a real workspace.
export async function slackFollowUp(receiver,edge){
 const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const {alertRuntime,event,rule,testAndReview}=await import('./runtime.mjs'),{archiveProjection}=await import('../archive.mjs'),{followErasure}=await import('../project-erasure/follow.mjs');
 const state=await mkdtemp(join(tmpdir(),'spool-slack-follow-up-')),path='/api/projects/web/follow-up',base='/api/projects/web/alerting';let app;
 const token='synthetic-spool-'+crypto.randomUUID(),connect=value=>({kind:'slack',label:'Alternate operator',channelId:'synthetic-spool-alternate',token:value});
 const open=()=>alertRuntime(receiver,{state,configure:false,egressBridge:wire=>edge.send(wire),extraBindings:{SLACK_TIMEOUT_MS:'100'}});
 try{
  app=await open();const project=await app.json('/api/projects','POST',{id:'web',name:'Follow-up qualification'}),auth={Authorization:`Bearer ${project.ingestKey}`};
  await app.json('/api/projects/web/releases','POST',{name:'r1',build:'b1'});await app.json('/api/projects','POST',{id:'other',name:'Other project'});
  let destination=await app.json(base+'/destinations','POST',connect(token));
  assert.equal((await app.request(path+'/alternate','PUT',{destination:destination.id,channel:'webhook'})).status,400,'unreviewed Slack cannot become the alternate');
  assert.equal((await app.json(path)).alternate.state,'none');assert.equal(edge.calls.length,0);
  await testAndReview(app.json,base,destination.id);
  assert.equal((await app.request('/api/projects/other/follow-up/alternate','PUT',{destination:destination.id,channel:'webhook'})).status,400,'foreign-project Slack is refused');
  assert.equal((await app.request(path+'/alternate','PUT',{destination:destination.id,channel:'webhook'},{Cookie:''})).status,401);
  assert.equal((await app.request(path+'/alternate','PUT',{destination:destination.id,channel:'webhook'},{Origin:'https://foreign.example'})).status,403);
  await app.json(path+'/alternate','PUT',{destination:destination.id,channel:'webhook'});
  const sourceRule=await app.json(base+'/rules','POST',rule('webhook',{destination:destination.id}));
  const capture=async name=>{edge.behavior='500';return app.json('/api/ingest/web','POST',event('synthetic-spool-'+name,{message:'Synthetic '+name,frames:[{file:name+'.js',line:1,column:0,function:'capture'}]}),auth)};
  const forIssue=async issue=>{const deliveries=await app.json(base+'/deliveries'),delivery=deliveries.find(d=>d.issue===issue);return (await app.json(path)).rows.find(r=>r.source_id===delivery.id)};
  const noticeCalls=id=>edge.calls.filter(wire=>JSON.parse(wire.body).text.includes('Item: '+id+'.'));
  const first=await capture('alternate-first');edge.behavior='posted';
  await Promise.all([app.schedule(Date.now()),app.schedule(Date.now())]);
  let row=await forIssue(first.issue),notice=row.notices[0];
  assert.equal(row.notices.length,1);assert.equal(notice.state,'completed');assert.equal(notice.code,'slack_posted');assert.equal(notice.provider,'slack');assert.match(notice.message_id,/^\d+\.\d+$/);assert.equal(notice.log.length,1);assert.equal(notice.log[0].code,'slack_posted');assert.equal(noticeCalls(row.id).length,1);
  const snapshot={id:row.id,notice:notice.id,message:notice.message_id};
  const audit=(await app.json('/api/audit/export')).rows,followFacts=audit.filter(f=>f.action==='automation.follow_up');assert.equal(followFacts.length,1,'one durable source creates one safe follow-up audit fact');assert.ok(audit.some(f=>f.action==='notification.attempt'&&f.outcome==='accepted'));
  assert.ok(!JSON.stringify([await app.json(path),audit]).includes(token));
  await app.close();app=await open();await app.schedule(Date.now()+1000);row=await forIssue(first.issue);notice=row.notices[0];assert.deepEqual({id:row.id,notice:notice.id,message:notice.message_id},snapshot);assert.equal(notice.log.length,1);assert.equal(noticeCalls(row.id).length,1,'restart cannot resend a posted notice');
  const rate=await capture('alternate-rate');edge.behavior='rate';const started=Date.now();await app.schedule(started);row=await forIssue(rate.issue);notice=row.notices[0];assert.equal(notice.state,'queued');assert.equal(notice.code,'slack_rate_limited');assert.ok(notice.next_at>=started+60000);assert.equal(notice.message_id,null);
  const rateId=notice.id,rateRow=row.id;edge.behavior='posted';await app.schedule(started+59000);assert.equal(noticeCalls(rateRow).length,1,'Retry-After stops an early resend');
  await app.close();app=await open();await app.schedule(notice.next_at+1);row=await forIssue(rate.issue);assert.equal(row.notices[0].id,rateId);assert.equal(row.notices[0].state,'completed');assert.equal(row.notices[0].log.length,2);assert.equal(noticeCalls(rateRow).length,2);assert.ok(row.notices[0].message_id);
  const lost=await capture('alternate-lost');edge.behavior='never';await app.schedule(Date.now());row=await forIssue(lost.issue);assert.equal(row.notices[0].state,'uncertain');assert.equal(row.notices[0].code,'slack_timeout');assert.equal(row.notices[0].message_id,null);const lostId=row.id,lostNotice=row.notices[0].id;
  edge.behavior='posted';await app.close();app=await open();await Promise.all([app.schedule(Date.now()+600000),app.schedule(Date.now()+600000)]);row=await forIssue(lost.issue);assert.equal(row.notices.length,1);assert.equal(row.notices[0].id,lostNotice);assert.equal(row.notices[0].state,'uncertain');assert.equal(noticeCalls(lostId).length,1,'unknown provider effect is never resent or recursively notified');assert.equal((await app.json(path)).rows.length,3,'alternate failures never become new attention sources');
  const beforeReconcile=edge.calls.length;await app.json(path+'/'+row.id+'/reconcile','POST',{revision:row.revision,state:'accepted',evidence:'receiver_confirmed'});row=await forIssue(lost.issue);assert.equal(row.state,'completed');assert.equal(row.notices[0].state,'uncertain','source reconciliation does not fabricate an alternate recipient receipt');assert.equal(edge.calls.length,beforeReconcile);
  // A queued, definitely rate-limited notice must not cross the old credential
  // boundary after rotation or revocation, including across a process restart.
  const held=await capture('alternate-rotation');edge.behavior='rate';await app.schedule(Date.now());row=await forIssue(held.issue);const oldNotice=row.notices[0].id;assert.equal(row.notices[0].state,'queued');
  const rotatedToken='synthetic-spool-'+crypto.randomUUID();destination=await app.json(base+'/destinations/'+destination.id,'PUT',connect(rotatedToken));const stopped=edge.calls.length;edge.behavior='posted';await app.close();app=await open();await app.schedule(Date.now()+600000);assert.equal(edge.calls.length,stopped);row=await forIssue(held.issue);assert.equal(row.notices.find(n=>n.id===oldNotice).state,'canceled');assert.equal((await app.json(path)).alternate.state,'broken');
  assert.equal((await app.request(path+'/alternate','PUT',{destination:destination.id,channel:'webhook'})).status,400,'rotation requires a new reviewed test');
  await testAndReview(app.json,base,destination.id);await app.json(path+'/alternate','PUT',{destination:destination.id,channel:'webhook'});await app.schedule(Date.now());assert.equal(edge.calls.at(-1).headers.authorization,'Bearer '+rotatedToken);
  const current=(await app.json(base+'/rules')).find(r=>r.id===sourceRule.id);await app.json(base+'/rules/'+current.id,'PUT',rule('webhook',{destination:destination.id,revision:current.revision}));
  const revoked=await capture('alternate-revoked');edge.behavior='rate';await app.schedule(Date.now());row=await forIssue(revoked.issue);assert.equal(row.notices[0].state,'queued');await app.json(base+'/destinations/'+destination.id,'DELETE');const afterRevoke=edge.calls.length;edge.behavior='posted';await app.close();app=await open();await app.schedule(Date.now()+600000);assert.equal(edge.calls.length,afterRevoke);row=await forIssue(revoked.issue);assert.equal(row.notices[0].state,'canceled');
  const archive=await archiveProjection(await app.request('/api/archive'));for(const table of ['follow_up_settings','follow_up_attention','follow_up_notices','follow_up_attempts'])assert.equal(archive.data[table],undefined,'operational notice custody excluded: '+table);assert.ok(!archive.text.includes(token)&&!archive.text.includes(rotatedToken));
  const plan=await app.json('/api/projects/web/erasure');await followErasure(app.json,await app.json('/api/projects/web/erasure','POST',{confirm:'web',planHash:plan.planHash}));for(const table of ['follow_up_settings','follow_up_attention','follow_up_notices','follow_up_attempts'])assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM '+table).first()).n,0,'project erasure removes '+table);await app.schedule(Date.now()+600000);assert.equal(edge.calls.length,afterRevoke,'erasure never resurrects a notice');
  console.log('PROBE ALERT-002 alternate: reviewed exact-project Slack -> one posted notice, attempt, message identifier and safe follow-up fact across concurrent ticks and restart');
  console.log('PROBE ALERT-002 uncertainty: provider timeout -> uncertain once without automatic resend or recursive notices; source reconciliation preserves unknown alternate receipt');
  console.log('PROBE ALERT-002 rate: HTTP 429 with Retry-After 60 -> no early retry; restart continues the same notice and records the posted message');
  console.log('PROBE ALERT-002 credentials: foreign and unreviewed alternates refused; rotation and revocation cancel old queued notices across restart');
  console.log('PROBE ALERT-002 custody: archive excludes notice queues and tokens; project erasure removes operational notice custody and no later send occurs');
 }finally{await app?.close();await rm(state,{recursive:true,force:true})}
}
