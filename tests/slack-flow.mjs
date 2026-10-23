// [ALERT-002] The only double is Slack's documented reply at INTEGRATION_EGRESS.
import assert from 'node:assert/strict';
import {alertRuntime,event,rule,testAndReview} from './alerts/runtime.mjs';
import {archiveProjection} from './archive.mjs';
import {followErasure} from './project-erasure/follow.mjs';
import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';
export function slackReceiver(){
 const calls=[];let behavior='posted',sequence=0;
 return {calls,set behavior(value){behavior=value},async send(wire){assert.equal(wire.url,'https://slack.com/api/chat.postMessage');const body=JSON.parse(wire.body);assert.equal(body.mrkdwn,false);assert.equal(body.unfurl_links,false);assert.equal(body.unfurl_media,false);assert.equal(body.parse,'none');calls.push(wire);if(behavior==='never')return new Promise(()=>{});if(behavior==='500')return {status:500,headers:{},body:'provider failure'};if(behavior==='error')return {status:200,headers:{},body:JSON.stringify({ok:false,error:'not_in_channel'})};return {status:200,headers:{},body:JSON.stringify({ok:true,channel:body.channel,ts:`1900000000.${++sequence}`})}}};
}
export async function slackFlow(receiver){
 const edge=slackReceiver(),app=await alertRuntime(receiver,{configure:false,egressBridge:wire=>edge.send(wire),extraBindings:{SLACK_TIMEOUT_MS:'500'}}),base='/api/projects/web/alerting',token='synthetic-spool-'+crypto.randomUUID(),nextToken='synthetic-spool-'+crypto.randomUUID();
 let restored;
 try{
  const p=await app.json('/api/projects','POST',{id:'web',name:'Checkout alerts'}),auth={Authorization:`Bearer ${p.ingestKey}`};await app.json('/api/projects/web/releases','POST',{name:'r1',build:'b1'});await app.json('/api/projects/web/releases','POST',{name:'r2',build:'b2'});
  const connect=(value=token)=>({kind:'slack',label:'Checkout on call',channelId:'synthetic-spool-channel',token:value});
  let destination=await app.json(base+'/destinations','POST',connect());assert.equal((await app.request('/api/projects/web/follow-up/alternate','PUT',{destination:destination.id,channel:'webhook'})).status,400);await testAndReview(app.json,base,destination.id);assert.equal(edge.calls.length,1);assert.match((await app.json(base+'/destinations')).rows[0].test.detail,/message identifier/);
  const r=await app.json(base+'/rules','POST',rule('webhook',{destination:destination.id}));edge.calls.length=0;
  const first=await app.json('/api/ingest/web','POST',event('synthetic-spool-slack-first',{message:'Checkout confirmation missing'}),auth);await Promise.all([app.schedule(Date.now()),app.schedule(Date.now())]);assert.equal(edge.calls.length,1,'concurrent scheduler posts one new-issue alert');
  let deliveries=await app.json(base+'/deliveries');assert.equal(deliveries[0].code,'slack_posted');assert.equal(deliveries[0].state,'accepted');assert.ok(deliveries[0].message_id);assert.ok(JSON.parse(edge.calls[0].body).text.includes('https://spool.example.com/projects/web/issues/'+first.issue));
  const issue=(await app.json('/api/projects/web/issues')).find(i=>i.id===first.issue);await app.json('/api/projects/web/issues/'+first.issue,'PATCH',{state:'resolved',revision:issue.revision});
  await app.json('/api/ingest/web','POST',event('synthetic-spool-slack-regressed',{release:'r2',build:'b2',message:'Checkout confirmation missing'}),auth);await app.schedule(Date.now());assert.equal(edge.calls.length,2,'regression posts once');await app.schedule(Date.now()+1000);assert.equal(edge.calls.length,2);
  await app.json('/api/ingest/web','POST',event('synthetic-spool-slack-held',{message:'Queued before token rotation',frames:[{file:'held.js',line:19,column:0,function:'held'}]}),{...auth,'x-fixture-unconfigured':'egress'});
  const oldId=destination.id;destination=await app.json(base+'/destinations/'+oldId,'PUT',connect(nextToken));assert.notEqual(destination.id,oldId);assert.equal((await app.json(base+'/rules'))[0].enabled,0);const n=edge.calls.length;
  await app.json('/api/ingest/web','POST',event('synthetic-spool-slack-rotated',{message:'Cart is unavailable',frames:[{file:'cart.js',line:25,column:0,function:'cart'}]}),auth);await app.schedule(Date.now());assert.equal(edge.calls.length,n,'rotation stops old rules and queued posts');
  await testAndReview(app.json,base,destination.id);assert.equal(edge.calls.at(-1).headers.authorization,'Bearer '+nextToken);
  const current=(await app.json(base+'/rules'))[0];await app.json(base+'/rules/'+r.id,'PUT',rule('webhook',{destination:destination.id,revision:current.revision}));
  for(const [behavior,code] of [['500','slack_http_500'],['error','slack_not_in_channel'],['never','slack_timeout']]){
   edge.behavior=behavior;await app.json('/api/ingest/web','POST',event('synthetic-spool-slack-'+behavior,{message:'Synthetic '+behavior+' checkout failure',frames:[{file:behavior+'.js',line:11,column:0,function:'fail'}]}),auth);await app.schedule(Date.now());deliveries=await app.json(base+'/deliveries');const failed=deliveries.find(d=>d.code===code);assert.ok(failed,JSON.stringify(deliveries));assert.ok(['uncertain','rejected'].includes(failed.state));assert.equal(failed.attempts,1);
  }
  edge.behavior='posted';const count=edge.calls.length;await app.schedule(Date.now()+60000);assert.equal(edge.calls.length,count,'uncertain and rejected posts are not retried');
  await app.json('/api/ingest/web','POST',event('synthetic-spool-slack-off',{message:'No egress available',frames:[{file:'offline.js',line:8,column:0,function:'offline'}]}),{...auth,'x-fixture-unconfigured':'egress'});await app.json('/__fixture/schedule','POST',{time:Date.now(),disableEgress:true});assert.ok((await app.json(base+'/deliveries')).some(d=>d.code==='egress_unconfigured'));
  const snapshot=await archiveProjection(await app.request('/api/archive'));assert.ok(snapshot.data.slack_delivery_meta.some(r=>r.message_id));assert.equal(snapshot.data.slack_destinations,undefined);
  const reads=[snapshot.text,JSON.stringify(await app.json(base+'/destinations')),JSON.stringify(await app.json(base+'/deliveries')),JSON.stringify(await app.json('/api/projects/web/issues/'+first.issue+'/packet'))];for(const d of await app.json(base+'/deliveries'))reads.push(JSON.stringify(await app.json(base+'/deliveries/'+d.id)));for(const secret of [token,nextToken])assert.ok(reads.every(s=>!s.includes(secret)),'token never appears in reads, packet, errors or archive');
  restored=await startTestWorker(15554);const cookie=await signIn(restored.origin);const restore=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Cookie:cookie,Origin:restored.origin,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:snapshot.text});assert.ok(restore.ok,await restore.text());const copied=await archiveProjection(await fetch(restored.origin+'/api/archive',{headers:{Cookie:cookie}}));assert.deepEqual(copied.data.slack_delivery_meta,snapshot.data.slack_delivery_meta);assert.ok(copied.data.alert_rules.every(r=>r.enabled===0));
  await app.json('/api/ingest/web','POST',event('synthetic-spool-slack-revoke-held',{message:'Queued before revoke',frames:[{file:'revoke-held.js',line:18,column:0,function:'held'}]}),{...auth,'x-fixture-unconfigured':'egress'});
  await app.json(base+'/destinations/'+destination.id,'DELETE');const stopped=edge.calls.length;await app.json('/api/ingest/web','POST',event('synthetic-spool-slack-revoked',{message:'No connection remains',frames:[{file:'revoked.js',line:7,column:0,function:'revoked'}]}),auth);await app.schedule(Date.now());assert.equal(edge.calls.length,stopped);assert.equal((await app.json(base+'/destinations')).rows.length,0);
  const plan=await app.json('/api/projects/web/erasure');await followErasure(app.json,await app.json('/api/projects/web/erasure','POST',{confirm:'web',planHash:plan.planHash}));assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM slack_delivery_meta').first()).n,0);assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM slack_destinations').first()).n,0);
  console.log('[ALERT-002] reviewed Slack test, exactly-once new/regression, safe identifiers, rotation/revoke, API/500/timeout/egress failures, secret exclusion, inert restore and erasure passed (recorded edge double only)');
 }finally{await restored?.stop();await app.close()}
}
