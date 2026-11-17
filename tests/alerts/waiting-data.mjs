import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {sentryDoorClient} from '../../scripts/sentry-import.mjs';
import {testAndReview,rule} from './runtime.mjs';
import {metric,sentry} from '../alerts-metric.mjs';

// Public import, owner rule writes, SDK intake and the emitted scheduled handler.
// The current Sentry door imports projects/history, but has no native rule carry.
export async function waitingData(app,{proof}={}) {
 const organization='synthetic-spool-waiting',slug='synthetic-spool-1',time=new Date().toISOString();
 const collection=(kind,project,response)=>({kind,project,pages:[{cursor:null,nextCursor:null,response}]});
 const bundle={format:'spool-sentry-org-export',version:1,organization:{id:organization,slug:organization,region:'us'},window:{start:time,end:time},collections:[
  collection('projects',null,[{id:slug,slug,name:'Synthetic spool 1',dateCreated:time}]),
  collection('releases',null,[{version:'synthetic-spool-1',dateCreated:time,projects:[{slug}]}]),
 ],omissions:['Synthetic project only; no historical observations.']};
 const client=sentryDoorClient({endpoint:app.origin,cookie:app.cookie,organization});
 const plan=await client.plan(Buffer.from(JSON.stringify(bundle))),applied=await client.apply(plan.planId,plan.fingerprint);
 assert.equal(applied.job.state,'completed');
 const reconciliation=await client.reconcile(plan.planId);assert.equal(reconciliation.ok,true);
 const project=(await app.json('/api/projects')).find(row=>reconciliation.projectIds.includes(row.id));assert.ok(project);
 const base=`/api/projects/${project.id}/alerting`,grant=await app.json(`/api/projects/${project.id}/keys`,'POST',{kind:'ingest'});
 const destination=await app.json(base+'/destinations','POST',{label:'Synthetic spool mailbox',recipient:'synthetic-spool-1@example.test'});
 await testAndReview(app.json,base,destination.id);
 // Keep explicit privacy policy refusal separate from an absence of observations.
 const identity=await app.json(`/api/projects/${project.id}/identity-policy`),policy={id:'keep',email:'drop',username:'drop',ip_address:'drop'};
 const policyPreview=await app.json(`/api/projects/${project.id}/identity-policy/preview`,'POST',{policy});
 await app.json(`/api/projects/${project.id}/identity-policy`,'PUT',{revision:identity.revision,policy,token:policyPreview.token});
 const drafts=[
  rule('mail',{name:'Synthetic affected users',destination:destination.id,kinds:['spike'],threshold:2,config:{metric:'users',filters:{environment:'production'},tagKeys:[]}}),
  rule('mail',{name:'Synthetic crash-free sessions',destination:destination.id,kinds:['metric'],windowMs:600000,config:metric('sessions')}),
  rule('mail',{name:'Synthetic affected sessions',destination:destination.id,kinds:['spike'],threshold:2,config:{metric:'session_percent',filters:{environment:'production'},tagKeys:[]}}),
 ];
 const rules=[];
 for(const draft of drafts){
  // Exercise the owner re-enable PUT as well as the enabled POST.
  const disabled=await app.json(base+'/rules','POST',{...draft,enabled:false});
  const preview=await app.json(base+'/rules/preview','POST',{...draft,revision:disabled.revision,ruleId:disabled.id});
  assert.equal(preview.refusal,null);assert.ok(preview.token);
  await app.json(base+'/rules/'+disabled.id,'PUT',{...draft,revision:disabled.revision,previewToken:preview.token});rules.push(disabled.id);
 }
 let end=Math.ceil(Date.now()/60000)*60000+60000;
 const tick=async()=>{const response=await app.tick(end);assert.equal(response.status,200);assert.equal((await response.json()).outcome,'ok');end+=60000};
 const states=async()=>{const rows=await app.json(base+'/rules');return rules.map(id=>rows.find(row=>row.id===id))};
 const receipt=[];
 const snapshot=async stage=>{const rows=await states();assert.ok(rows.every(row=>row.enabled===1),'waiting never turns a rule off');receipt.push({stage,rules:rows.map(row=>({name:row.name,enabled:row.enabled,waitingFor:row.waitingFor,metricValue:row.metric_value})),deliveries:(await app.json(base+'/deliveries')).length});return rows};
 await tick();let rows=await snapshot('empty');assert.deepEqual(rows.map(row=>row.waitingFor),['user_event','session','session']);
 assert.equal((await app.json(base+'/deliveries')).length,0);assert.equal(rows[1].metric_value,null,'an empty denominator is unavailable, never a zero percent crash-free rate');
 if(proof)await proof('waiting',project,rows);
 // Wrong environment sessions and events cannot satisfy a filtered rule.
 const session=(environment='production')=>['session',{sid:crypto.randomUUID().replaceAll('-',''),init:true,started:new Date().toISOString(),status:'crashed',errors:1,attrs:{release:'synthetic-spool-1',environment}}];
 const event=(user,environment='production')=>['event',{event_id:crypto.randomUUID().replaceAll('-',''),environment,release:'synthetic-spool-1',...user?{user:{id:user}}:{},exception:{values:[{type:'SyntheticSpoolError',value:'Synthetic spool waiting flow'}]}}];
 const send=async items=>{const response=await sentry(app,grant,items);assert.equal(response.status,200);return response.json()};
 await send([session('staging'),event('synthetic-spool-other','staging')]);
 rows=await snapshot('nonmatching environment');assert.deepEqual(rows.map(row=>row.waitingFor),['user_event','session','session']);
 await send([event()]);await tick();rows=await snapshot('events without a user');
 assert.deepEqual(rows.map(row=>row.waitingFor),['user_event','session','session']);assert.equal(rows[1].metric_value,null);
 assert.equal((await app.json(base+'/deliveries')).length,0,'events alone cannot fire a session or user rule');
 await send([session()]);await tick();rows=await snapshot('first matching session');
 assert.deepEqual(rows.map(row=>row.waitingFor),['user_event',null,null]);assert.equal(rows[1].metric_value,0);
 assert.equal(rows[1].metric_status,'critical','the first real crashed session starts metric evaluation automatically');
 assert.ok((await app.json(base+'/deliveries')).some(row=>row.rule_id===rules[1]));
 assert.ok(!(await app.json(base+'/deliveries')).some(row=>row.rule_id===rules[0]),'sessions do not supply a user event');
 await send([event('synthetic-spool-1')]);rows=await snapshot('first matching user event');assert.ok(rows.every(row=>row.waitingFor===null));
 assert.ok(!(await app.json(base+'/deliveries')).some(row=>row.rule_id===rules[0]),'one real user does not breach a more-than-two threshold');
 await send([event('synthetic-spool-2'),event('synthetic-spool-3')]);
 // Scheduled spike windows begin at the next complete boundary. Replay the real
 // receipt window through that cursor without altering the ingested observations.
 const observed=(await app.db.prepare('SELECT MIN(received) first FROM events WHERE project=? AND historical=0').bind(project.id).first()).first;
 await app.db.prepare('UPDATE alert_cursors SET next_start=? WHERE rule_id IN (?,?)').bind(Math.floor(observed/60000)*60000,rules[0],rules[2]).run();
 await tick();rows=await snapshot('threshold reached');
 const deliveries=await app.json(base+'/deliveries');assert.ok(deliveries.some(row=>row.rule_id===rules[0]));assert.ok(deliveries.some(row=>row.rule_id===rules[2]));
 const before=deliveries.length;await tick();assert.equal((await app.json(base+'/deliveries')).length,before,'the same retained data does not deliver twice');
 if(proof)await proof('evaluating',project,rows);
 // A separate truly empty project starts with only sessions, then its first event.
 const only=await app.json('/api/projects','POST',{id:'synthetic-spool-only-sessions',name:'Synthetic spool 2'}),onlyBase=`/api/projects/${only.id}/alerting`;
 const onlyDestination=await app.json(onlyBase+'/destinations','POST',{label:'Synthetic spool mailbox',recipient:'synthetic-spool-2@example.test'});await testAndReview(app.json,onlyBase,onlyDestination.id);
 const onlyPolicy=await app.json(`/api/projects/${only.id}/identity-policy/preview`,'POST',{policy});await app.json(`/api/projects/${only.id}/identity-policy`,'PUT',{revision:onlyPolicy.revision,policy,token:onlyPolicy.token});
 const onlyRule=await app.json(onlyBase+'/rules','POST',{...drafts[0],kinds:['new_issue','spike'],destination:onlyDestination.id});
 let response=await sentry(app,only,[session()]);assert.equal(response.status,200);await response.body.cancel();await tick();
 let onlyState=(await app.json(onlyBase+'/rules')).find(row=>row.id===onlyRule.id);assert.equal(onlyState.enabled,1);assert.equal(onlyState.waitingFor,'user_event');assert.deepEqual(await app.json(onlyBase+'/deliveries'),[]);
 response=await sentry(app,only,[event()]);assert.equal(response.status,200);await response.body.cancel();assert.deepEqual(await app.json(onlyBase+'/deliveries'),[],'a mixed new-issue and user rule cannot bypass waiting on an anonymous first event');
 response=await sentry(app,only,[event('synthetic-spool-4')]);assert.equal(response.status,200);await response.body.cancel();onlyState=(await app.json(onlyBase+'/rules')).find(row=>row.id===onlyRule.id);assert.equal(onlyState.waitingFor,null);assert.equal(onlyState.enabled,1);
 if(process.env.SPOOL_WAITING_RECEIPT)await writeFile(process.env.SPOOL_WAITING_RECEIPT,JSON.stringify({schema:1,importedTargets:reconciliation.counts.byKind,stages:receipt,onlySessions:{waitingFor:'user_event',afterFirstEvent:onlyState.waitingFor,enabled:onlyState.enabled}},null,2)+'\n');
 console.log('Waiting rules: empty imported project, nonmatching data, events without users, sessions only, first matching data, automatic threshold evaluation and no replay passed.');
}
