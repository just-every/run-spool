import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {agentRuntime} from './runtime.mjs';
import {shopFixture} from '../execution/fixture.mjs';
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

// Two accepted native administrators share a project, never each other's jobs.
export async function jobStatusContract(){
 for(const [phase,policy] of [['autonomous',autonomousPolicy],['held',heldPolicy]]){
  const app=await agentRuntime();
  const done=answer=>{assert.equal(answer.isError,false,JSON.stringify(answer));return answer.structuredContent;};
  try{
   const project='synthetic-spool-job-status',path='/api/projects/'+project;
   await app.json('/api/organization','POST',{id:'synthetic-spool-company',name:'Job status qualification'});
   const created=await app.json('/api/projects','POST',{id:project,name:'Shared job qualification'});
   const sponsors=[];
   for(const n of [1,2]){
    const email=['synthetic-spool-'+n,'spool.test'].join(String.fromCharCode(64)),name='Synthetic sponsor '+n;
    const invited=await app.json('/api/organization/invites','POST',{email,name,role:'admin',grants:[]});
    const message=(await app.mail()).findLast(row=>row.to?.includes(email));
    const token=message?.text.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];assert.ok(token,'A real native invitation reaches its sponsor');
    const accepted=await app.request('/auth/confirm','POST',{token},{Cookie:''});assert.equal(accepted.status,303);
    const cookie=accepted.headers.getSetCookie().map(row=>row.split(';')[0]).join('; ');await accepted.body?.cancel();assert.ok(cookie);
    sponsors.push({id:randomUUID(),email,name,role:'admin',invite:1,member:invited.id,cookie,agent:randomUUID(),consent:randomUUID()});
   }
   await app.syncSettings(sponsors.map(({id,email,name,role,invite})=>({id,email,name,role,invite})));
   const claims=sponsor=>({sub:sponsor.id,email:sponsor.email,act:{sub:sponsor.agent,name:sponsor.name+' agent',specialist:'triage engineer'},consent:sponsor.consent});
   const members=(await app.json('/api/organization')).members;
   const first=members.find(row=>row.id===sponsors[0].member),second=members.find(row=>row.id===sponsors[1].member);
   assert.ok(first?.operator_id&&second?.operator_id);assert.notEqual(first.operator_id,second.operator_id);
   const fixture=await shopFixture();
   await app.json(path+'/releases','POST',{name:'1.0.0',build:'web-1'});
   await app.json(path+'/artifacts','POST',{release:'1.0.0',build:'web-1',debugId:'cart-map',map:fixture.broken});
   const event='synthetic-spool-1';
   const {issue}=await app.json('/api/ingest/'+project,'POST',{version:1,eventId:event,release:'1.0.0',build:'web-1',environment:'production',type:fixture.type,message:fixture.message,frames:fixture.frames,breadcrumbs:[]},{Authorization:'Bearer '+created.ingestKey,Cookie:''});
   await app.adopt(policy());
   const recipe=done(await app.call('spool.reproducers.create',{project,event,input:[{}],idempotency_key:randomUUID()},claims(sponsors[0])));
   const runs=[];
   for(const sponsor of sponsors){
    const result=await app.call('spool.reproducers.run',{project,id:recipe.id,idempotency_key:randomUUID()},claims(sponsor));
    assert.equal(result._meta['com.runeditrun/decision'].disposition,phase==='held'?'review':'autonomous');
    runs.push(done(result));
   }
   const nativeHistory=()=>app.json(path+'/reproducers?issue='+issue);
   const nativeRun=async id=>(await nativeHistory()).reproducers.find(row=>row.id===recipe.id).runs.find(row=>row.id===id);
   const read=(run,sponsor,extra={})=>app.call('spool.reproducers.read',{project,issue,run,...extra},claims(sponsor));
   const status=async(id,sponsor,state)=>{
    const answer=await read(id,sponsor),selected=done(answer);
    assert.equal(answer._meta['com.runeditrun/decision'].disposition,phase==='held'?'review':'autonomous');
    const native=await nativeRun(id);assert.equal(native.state,state);
    assert.deepEqual(selected,{run:{id:native.id,state:native.state,outcome:native.outcome,created:native.created,expires:native.expires,claimed:native.claimed,finished:native.finished}},'Selected status reconciles with native history and carries no source, observation or runner handoff');
    const bytes=JSON.stringify(selected);
    for(const run of runs){assert.ok(!bytes.includes(run.token));assert.ok(!bytes.includes(run.command));}
    for(const source of fixture.broken.sourcesContent)assert.ok(!bytes.includes(source),'No uploaded source crosses the status door');
    assert.ok(Buffer.byteLength(bytes)<1024,'Status remains bounded independently of source size');
   };
   for(let n=0;n<2;n++)await status(runs[n].run,sponsors[n],'queued');
   const snapshot=async()=>Object.fromEntries(await Promise.all(['reproducers','reproducer_runs','reproducer_run_tokens','spool_agent_custody','issues'].map(async table=>[table,(await app.DB.prepare('SELECT * FROM '+table+' ORDER BY 1').all()).results])));
   const before=await snapshot();
   const missing=await read('synthetic-spool-missing',sponsors[0]);assert.equal(missing._meta['com.runeditrun/error'].code,'not_found');
   const refusal=answer=>{
    assert.equal(answer.isError,true);assert.deepEqual(answer.structuredContent,missing.structuredContent);
    assert.deepEqual(answer.content,missing.content,'Restricted and nonexistent handles have the same visible refusal');
    assert.deepEqual(answer._meta['com.runeditrun/error'],missing._meta['com.runeditrun/error']);
    assert.equal(answer.structuredContent?.run,undefined,'A refusal returns no status');
   };
   for(let n=0;n<2;n++)refusal(await read(runs[1-n].run,sponsors[n]));
   const changedAgent={...sponsors[0],agent:randomUUID()},changedConsent={...sponsors[0],consent:randomUUID()};
   refusal(await read(runs[0].run,changedAgent));refusal(await read(runs[0].run,changedConsent));
   for(let n=0;n<2;n++){
    const history=done(await app.call('spool.reproducers.read',{project,issue},claims(sponsors[n])));
    assert.deepEqual(history.reproducers.flatMap(row=>row.runs.map(run=>run.id)),[runs[n].run],'Omitting the selector cannot expose another sponsor’s job through history');
   }
   for(const sponsor of [changedAgent,changedConsent])assert.deepEqual(done(await app.call('spool.reproducers.read',{project,issue},claims(sponsor))).reproducers[0].runs,[],'History also respects saved agent and consent custody');
   const scopeRefusal=answer=>{
    assert.equal(answer.isError,true);assert.equal(answer._meta['com.runeditrun/error'].code,'not_found');
    assert.equal(answer.structuredContent,undefined,'An outer native authority refusal exposes no selected status');
   };
   scopeRefusal(await read(runs[0].run,sponsors[0],{issue:'synthetic-spool-missing'}));
   const foreign=await app.json('/api/projects','POST',{id:'synthetic-spool-other',name:'Other project'});
   scopeRefusal(await read(runs[0].run,sponsors[0],{project:foreign.id}));
   for(const sponsor of [sponsors[1],changedAgent,changedConsent]){
    const claim=await app.call('spool.reproducers.claim',{project,id:runs[0].run,idempotency_key:randomUUID()},claims(sponsor));
    assert.equal(claim._meta['com.runeditrun/error'].code,'not_found','Status adds no authority to claim another principal’s work');
   }
   assert.deepEqual(await snapshot(),before,'Missing, foreign and mismatched-custody reads and claims mutate no native work or runner token');
   done(await app.call('spool.reproducers.claim',{project,id:runs[0].run,idempotency_key:randomUUID()},claims(sponsors[0])));
   await status(runs[0].run,sponsors[0],'claimed');await status(runs[1].run,sponsors[1],'queued');
   const personRun=await app.json(path+'/reproducers/'+recipe.id+'/runs','POST',{}, {Cookie:sponsors[0].cookie});
   refusal(await read(personRun.run,sponsors[0]));
   const personBefore=await snapshot();
   const personClaim=await app.call('spool.reproducers.claim',{project,id:personRun.run,idempotency_key:randomUUID()},claims(sponsors[0]));
   assert.equal(personClaim._meta['com.runeditrun/error'].code,'not_found','An agent cannot acquire a native person’s run without saved agent custody');
   assert.deepEqual(await snapshot(),personBefore,'Absent agent custody refuses claim without changing the run or its single-use token');
   const personHistory=await app.json(path+'/reproducers?issue='+issue,'GET',undefined,{Cookie:sponsors[1].cookie});
   assert.deepEqual(personHistory,await nativeHistory(),'Current native people retain complete shared issue history');
   assert.equal(personHistory.reproducers[0].runs.length,3);assert.ok(personHistory.reproducers[0].runs.every(row=>row.modules.length>0));
   const selectedPerson=await app.json(path+'/reproducers?issue='+issue+'&run='+runs[0].run,'GET',undefined,{Cookie:sponsors[1].cookie});
   assert.equal(selectedPerson.run.state,'claimed','The native person route shares the bounded selected-status projection');
   await app.json('/api/organization/members/'+second.id,'PUT',{version:second.version,role:'member',grants:[{project,role:'maintainer'}]});
   const fenced=await snapshot();
   scopeRefusal(await read(runs[1].run,sponsors[1]));
   const personFenced=await app.request(path+'/reproducers?issue='+issue+'&run='+runs[1].run,'GET',undefined,{Cookie:sponsors[1].cookie});
   assert.equal(personFenced.status,404);await personFenced.body?.cancel();
   assert.deepEqual(await snapshot(),fenced,'Current native operational role fences remain in force for both doors');
   const retired=async(extra)=>{
    await app.adopt(policy(),extra);
    const answer=await app.mcp('tools/call',{name:'spool.reproducers.read',arguments:{project,issue,run:runs[0].run}},claims(sponsors[0]),'2025-11-25',401);
    assert.equal(answer.httpStatus,401);assert.equal(answer.structuredContent,undefined);
    assert.deepEqual(await snapshot(),fenced,'Revoked authority cannot return retained status or mutate work');
   };
   await retired({revoked:{agents:[sponsors[0].agent],consents:[]}});
   await retired({revoked:{agents:[],consents:[sponsors[0].consent]}});
   await app.adopt(policy());await status(runs[0].run,sponsors[0],'claimed');
   await app.json('/api/organization/members/'+first.id,'DELETE',{version:first.version});
   const removed=await snapshot();
   const gone=await app.mcp('tools/call',{name:'spool.reproducers.read',arguments:{project,issue,run:runs[0].run}},claims(sponsors[0]),'2025-11-25',401);
   assert.equal(gone.httpStatus,401);assert.equal(gone.structuredContent,undefined);assert.deepEqual(await snapshot(),removed,'A removed sponsor cannot read or revive its job');
   console.log(`PROBE BASE-AGENT-012 acceptance-5-${phase}: two accepted native admin sponsors through MCP -> own queued and claimed statuses match native reads; foreign, missing, different agent, different consent and absent custody return not_found without native mutation; role narrowing and revoked agent, consent and sponsor refuse; status excludes runner tokens and source bytes`);
  }finally{await app.stop();}
 }
}
