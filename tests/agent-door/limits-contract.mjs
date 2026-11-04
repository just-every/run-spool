import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {testOwner} from '../auth.mjs';
import {agentRuntime} from './runtime.mjs';
import {accessToken,autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

const decision=answer=>answer._meta?.['com.runeditrun/decision'];
const code=answer=>answer._meta?.['com.runeditrun/error']?.code;
const done=answer=>{assert.equal(answer.isError,false,code(answer));return answer.structuredContent;};

/** Exercise installation capacity and company recipient policy independently. */
export async function limitsContract(){
 for(const [phase,policy] of [['autonomous',autonomousPolicy],['held',heldPolicy]]){
  const app=await agentRuntime();
  try{
   let clock=Date.now();
   app.context.now=()=>clock;
   await app.setTime(clock);
   await app.json('/api/organization','POST',{id:'synthetic-spool-company',name:'Limits qualification'});
   const project='synthetic-spool-limits';
   await app.json('/api/projects','POST',{id:project,name:'Limits qualification'});
   await app.adopt(policy());
   const read=()=>app.call('spool.projects.list',{});
   const projects=()=>app.json('/api/projects');
   const before=await projects();
   assert.ok(done(await read()).items.some(row=>row.id===project),'Capacity proof starts with a populated authorized read');
   const limit=(await app.mcp('server/discover'))._meta['com.runeditrun/limits'].requestsPerMinute;
   assert.ok(Number.isSafeInteger(limit)&&limit>0,'Use the capacity this installation publishes');
   for(let request=1;request<limit;request++)assert.ok((await app.mcp('tools/list')).tools.length>0);
   const blockedArgs={name:'synthetic-spool-over-capacity',idempotency_key:randomUUID()};
   const response=await app.request('/mcp','POST',{jsonrpc:'2.0',id:randomUUID(),method:'tools/call',params:{name:'spool.projects.create',arguments:blockedArgs}},{Cookie:'',Authorization:'Bearer '+await accessToken(app.context),Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':'tools/call','Mcp-Name':'spool.projects.create'});
   assert.equal(response.status,429,'The next authenticated action exceeds request capacity');
   assert.equal((await response.json()).error.data.code,'rate_limited');
   const retry=Number(response.headers.get('retry-after'));
   assert.ok(Number.isInteger(retry)&&retry>=1&&retry<=60,'Rate refusal tells the caller when the minute window resets');
   assert.deepEqual(await projects(),before,'Rate refusal creates no partial project and native person reads still work');
   done(await app.call('spool.projects.list',{}, {act:{sub:'synthetic-spool-peer',name:'Other agent',specialist:'triage engineer'},consent:'synthetic-spool-peer-consent'}));
   clock+=retry*1000;
   await app.setTime(clock);
   assert.deepEqual(done(await read()).items.map(row=>row.id),before.map(row=>row.id),'The original agent regains the populated read after Retry-After');
   console.log(`PROBE BASE-AGENT-011 1 ${phase}: published MCP minute capacity exhausted -> 429 rate_limited with Retry-After; no project created; peer and person retain access; original agent recovers after deadline`);

   const document=policy();
   document.rules.push({id:'recipient-floor',class:'external',do:'blocked'},
    {id:'three-recipients',class:'external',seed:'spool',max_per_day:3,do:phase==='held'?'approval':'autonomous',...phase==='held'?{approver:['sponsor'],wait:'PT1H'}:{}});
   await app.adopt(document);
   const destinations=[];
   for(let index=1;index<=4;index++)destinations.push(await app.json(`/api/projects/${project}/alerting/destinations`,'POST',{label:'Synthetic recipient '+index,recipient:testOwner.replace('owner','synthetic-spool-'+index)}));
   const other='synthetic-spool-other';
   await app.json('/api/projects','POST',{id:other,name:'Shared seed allowance'});
   const otherDestination=await app.json(`/api/projects/${other}/alerting/destinations`,'POST',{label:'Other project recipient',recipient:testOwner.replace('owner','synthetic-spool-5')});
   const destinationState=async()=>{
    const state=await app.json(`/api/projects/${project}/alerting/destinations`);
    assert.equal(state.configuration,'available');return state.rows;
   };
   const send=async(index)=>{
    const args={project,id:destinations[index].id,idempotency_key:randomUUID()};
    const answer=await app.call('spool.alerts.test',args);let result;
    if(phase==='held'){
     assert.equal(decision(answer).disposition,'approval');
     const pending=answer._meta['com.runeditrun/approval']??answer._meta['com.runeditrun/error']?.approval;assert.ok(pending?.id);
     assert.equal((await destinationState()).find(row=>row.id===args.id).test??null,null,'Waiting for a person sends nothing');
     const approval=(await app.json('/agents/api/approvals/'+pending.id)).approval;
     const completed=await app.json('/agents/api/approvals/'+pending.id+'/approve','POST',{revision:approval.revision,summary_sha256:approval.summary_sha256});
     assert.equal(completed.approval.state,'executed','The named person completes the held send');
     const stored=(await destinationState()).find(row=>row.id===args.id).test;
     result={id:stored.id,state:stored.state,message:stored.detail};
    }else{assert.equal(decision(answer).disposition,'autonomous');result=done(answer);}
    assert.equal(result.state,'passing','The permitted recipient reaches the native sender');
    assert.ok((await app.mail()).some(message=>message.deliveryId===result.id&&message.to.includes(testOwner.replace('owner','synthetic-spool-'+(index+1)))),'The paid network edge observes the selected recipient');
    return {args,result};
   };
   const sent=[];
   sent.push(await send(0));
   const firstMail=await app.mail();
   assert.deepEqual(done(await app.call('spool.alerts.test',sent[0].args)),sent[0].result,'An admitted retry returns its first outcome');
   assert.deepEqual(await app.mail(),firstMail,'An admitted retry sends nothing and consumes no additional recipient allowance');
   for(let index=1;index<3;index++)sent.push(await send(index));
   const retained=await destinationState(),mail=await app.mail();
   assert.equal(retained.filter(row=>row.test?.state==='passing').length,3);
   const fourth={project,id:destinations[3].id,idempotency_key:randomUUID()};
   const refused=await app.call('spool.alerts.test',fourth);
   assert.equal(code(refused),'policy_blocked','The fourth outside recipient takes the fallback rule');
   assert.equal(decision(refused).classes.find(row=>row.class==='external').rule,'recipient-floor');
   assert.equal(code(await app.call('spool.alerts.test',{...fourth,idempotency_key:randomUUID()}, {act:{sub:'synthetic-spool-peer',name:'Other agent',specialist:'triage engineer'},consent:'synthetic-spool-peer-consent'})),'policy_blocked','A different agent cannot reset the shared seed recipient allowance');
   const otherBefore=await app.json(`/api/projects/${other}/alerting/destinations`);
   assert.equal(code(await app.call('spool.alerts.test',{project:other,id:otherDestination.id,idempotency_key:randomUUID()})),'policy_blocked','Changing projects cannot reset the shared seed recipient allowance');
   assert.deepEqual(await app.json(`/api/projects/${other}/alerting/destinations`),otherBefore,'The cross-project refusal starts no destination test');
   assert.deepEqual(await destinationState(),retained,'Daily policy refusal starts no destination test');
   assert.deepEqual(await app.mail(),mail,'Daily policy refusal makes no outbound effect');
   assert.equal(code(await app.call('spool.alerts.test',sent[0].args)),'policy_blocked','A retained outcome cannot bypass the current daily policy');
   assert.deepEqual(await app.mail(),mail,'A refused replay does not duplicate delivery');
   const audit=await app.json('/agents/api/audit');
   const denied=audit.rows.find(row=>row.idempotency_key===fourth.idempotency_key);
   assert.equal(denied.outcome,'refused');assert.equal(denied.decision,'blocked');
   assert.equal(denied.classes.find(row=>row.class==='external').facts.measure,1,'Recipient facts are computed by the native destination tool');
   assert.equal(audit.differs_from_policy,0,'Recorded decisions reconcile with their adopted policy and counted usage');
   done(await read());
   console.log(`PROBE BASE-AGENT-011 2 ${phase}: three distinct native destination tests complete, with person approvals when held -> fourth recipient policy_blocked by recipient-floor, unchanged destinations and mail; replay sends nothing`);

   clock=(Math.floor(clock/86400000)+1)*86400000+60000;
   await app.setTime(clock);
   await app.adopt(document);
   await send(3);
   assert.equal((await destinationState()).filter(row=>row.test?.state==='passing').length,4,'The next UTC day starts a fresh company recipient allowance');
   console.log(`PROBE BASE-AGENT-011 2 ${phase} reset: next fixed UTC day and fresh signed policy -> previously refused recipient completes through native sender`);

   const capped=policy();
   capped.spend={caps:[{seed:'spool',specialist:'triage engineer',microusd_per_day:0}]};
   await app.adopt(capped);
   assert.equal((await app.json('/agents/api/state')).policy.spend_caps,'not_enforced','The current Base boundary remains explicit');
   const beforeRead=await app.mail();
   assert.ok(done(await read()).items.some(row=>row.id===project),'A zero-cost populated read remains available with a zero provider cap');
   assert.deepEqual(await app.mail(),beforeRead,'A zero-cost read sends no message');
   console.log(`PROBE BASE-AGENT-011 4 ${phase} zero-cost: signed zero provider cap -> populated native read succeeds; spend enforcement and spending usage remain unqualified`);
  }finally{await app.stop();}
 }
}
