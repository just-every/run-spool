import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {agentRuntime} from './runtime.mjs';
import {agentScreens} from './screens.mjs';
import {accessToken,autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

/** Qualify the two independent pause sources through the emitted Worker. */
export async function pauseContract(){
 for(const [phase,policy] of [['autonomous',autonomousPolicy],['held',heldPolicy]]){
  const app=await agentRuntime();let screens;
  const code=answer=>answer?._meta?.['com.runeditrun/error']?.code;
  const done=answer=>{assert.equal(answer.isError,false,code(answer));return answer.structuredContent;};
  try{
   const project='synthetic-spool-pause';
   await app.json('/api/organization','POST',{id:'synthetic-spool-company',name:'Pause qualification'});
   const created=await app.json('/api/projects','POST',{id:project,name:'Pause qualification'});
   await app.json(`/api/projects/${project}/releases`,'POST',{name:'1.0.0',build:'web-1'});
   const admitted=await app.json(`/api/ingest/${project}`,'POST',{version:1,eventId:'synthetic-spool-1',release:'1.0.0',build:'web-1',environment:'production',type:'TypeError',message:'Pause qualification',frames:[{file:'https://checkout.example/app.js',line:1,column:0,function:'total'}],breadcrumbs:[]},{Authorization:'Bearer '+created.ingestKey,Cookie:''});
   const grant=await app.json(`/api/projects/${project}/keys`,'POST',{kind:'agent'});
   await app.adopt(policy());
   let rpcId=0;
   const native=async(name,args)=>{
    const response=await app.request('/mcp','POST',{jsonrpc:'2.0',id:++rpcId,method:'tools/call',params:{name,arguments:args}},{Authorization:'Bearer '+grant.key,Cookie:'',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':'tools/call','Mcp-Name':name});
    assert.equal(response.status,200,'Current native project agent authenticates');
    const body=await response.json();assert.ok(body.result,JSON.stringify(body));return body.result;
   };
   const nativeHttp=()=>app.request(`/api/projects/${project}/issues`,'GET',undefined,{Authorization:'Bearer '+grant.key,Cookie:''});
   const issues=()=>app.json(`/api/projects/${project}/issues`);
   const proposals=()=>app.json(`/api/projects/${project}/grouping-proposals`);
   const readArgs={project};
   const allowed=async()=>{
    const expected=await issues();assert.equal(expected.length,1);assert.equal(expected[0].id,admitted.issue);
    let projection;
    for(const answer of [await app.call('spool.issues.list',readArgs),await native('spool.issues.list',readArgs)]){
     const items=done(answer).items;assert.equal(items.length,1);
     for(const field of ['id','project','title','state','revision','count'])assert.equal(items[0][field],expected[0][field],'Resumed agents read the actual retained issue '+field);
     if(projection)assert.deepEqual(items,projection,'Both agent credentials retain the same complete agent projection');
     projection=items;
     assert.equal(answer._meta['com.runeditrun/decision'].disposition,phase==='held'?'review':'autonomous','Resume retains the selected company policy');
    }
    const response=await nativeHttp();assert.equal(response.status,200);assert.deepEqual(await response.json(),projection);
   };
   await allowed();
   const packet=done(await app.call('spool.packets.read',{project,issue:admitted.issue}));
   const event=packet.events[0];
   const proposal={project,kind:'split',source:admitted.issue,revision:packet.issue.revision,events:[event.id],variants:[{stack:JSON.stringify(event.event.frames),release:'1.0.0',route:''}],rationale:'Inert pause replay qualification',window:{start:event.received,end:event.received+1},idempotency_key:randomUUID()};
   const saved=done(await app.call('spool.proposals.create',proposal));
   const localProposal={...proposal,idempotency_key:randomUUID()};
   const localSaved=done(await native('spool.proposals.create',localProposal));
   const pausedState=async expected=>assert.deepEqual((await app.json('/agents/api/state')).paused,expected);
   const agentCannotResume=async()=>{
    const before=await app.json('/agents/api/state');
    for(const token of [await accessToken(app.context),grant.key]){
     const response=await app.request('/agents/api/pause','POST',{paused:false},{Authorization:'Bearer '+token,Cookie:''});
     assert.equal(response.status,403,'An agent cannot use the native person resume door');
     assert.equal((await response.json()).code,'person_session_required');
     assert.deepEqual(await app.json('/agents/api/state'),before,'Agent resume refusal changes neither pause nor policy');
    }
   };
   const stopped=async(label,started)=>{
    const before=await issues(),retained=await proposals();
    assert.equal(code(await app.call('spool.issues.list',readArgs)),'agents_paused',label+' stops the next valid Business call');
    assert.equal(code(await native('spool.issues.list',readArgs)),'agents_paused',label+' stops the next valid native project agent call');
    const response=await nativeHttp();assert.equal(response.status,403);assert.equal((await response.json()).code,'agents_paused');
    assert.ok(performance.now()-started<60000,label+' takes effect within 60 seconds');
    assert.equal(code(await app.call('spool.proposals.create',proposal)),'agents_paused','Pause refuses a retained Business outcome');
    assert.equal(code(await native('spool.proposals.create',localProposal)),'agents_paused','Pause refuses a retained native outcome');
    await agentCannotResume();
    assert.deepEqual(await issues(),before,'Paused calls preserve the populated native issue');
    assert.deepEqual(await proposals(),retained,'Paused replays neither return nor duplicate their retained effect');
    console.log(`PROBE BASE-AGENT-011 6 ${phase} ${label}: Business MCP, native project MCP and HTTP read -> agents_paused within 60 seconds; retained writes refused without changes`);
   };
   let started=performance.now();
   screens=await agentScreens(app);
   const toggle=async(page,name,expected)=>{
    const response=page.waitForResponse(reply=>new URL(reply.url()).pathname==='/agents/api/pause'&&reply.request().method()==='POST');
    const button=page.getByRole('button',{name,exact:true});await button.focus();
    started=performance.now();await page.keyboard.press('Enter');
    const saved=await response;assert.equal(saved.status(),200);
    await page.getByRole('button',{name:name==='Pause agents'?'Resume agents':'Pause agents',exact:true}).waitFor();
    assert.deepEqual((await app.json('/agents/api/state')).paused,expected,'The native browser control changes only its own pause source');
   };
   await screens.capture('pause-native-'+phase,'/agents','Agents are paused.',page=>toggle(page,'Pause agents',{business:false,local:true}));
   await pausedState({business:false,local:true});await stopped('native Pause',started);
   // A native person keeps real read and write authority while agents stop.
   const issue=(await issues())[0];
   await app.json(`/api/projects/${project}/issues/${issue.id}`,'PATCH',{state:'suppressed',revision:issue.revision});
   assert.equal((await issues())[0].state,'suppressed','Pause preserves native person write authority');
   await screens.capture('resume-native-'+phase,'/agents','Agents are on.',page=>toggle(page,'Resume agents',{business:false,local:false}));
   await allowed();
   console.log(`PROBE BASE-AGENT-011 6 ${phase} native resume: owner resumes -> both agent credentials read the retained issue under the original disposition; native person mutation remains usable`);

   started=performance.now();await app.adopt(policy(),{paused:true});
   await pausedState({business:true,local:false});await stopped('signed Business Pause',started);
   await app.adopt(policy());await allowed();
   console.log(`PROBE BASE-AGENT-011 6 ${phase} Business resume: signed policy clears pause -> both agent credentials and the native HTTP alias regain access`);

   await app.json('/agents/api/pause','POST',{paused:true});await app.adopt(policy(),{paused:true});
   await pausedState({business:true,local:true});
   if(phase==='autonomous'){
    await screens.capture('pause-combined','/agents','Agents are paused.');
   }
   await screens.capture('resume-local-business-paused-'+phase,'/agents','Agents are paused.',page=>toggle(page,'Resume agents',{business:true,local:false}));
   await pausedState({business:true,local:false});await stopped('Business pause after local resume',started);
   await app.adopt(policy());await pausedState({business:false,local:false});await allowed();

   await app.json('/agents/api/pause','POST',{paused:true});await app.adopt(policy(),{paused:true});
   started=performance.now();await app.adopt(policy());
   await pausedState({business:false,local:true});await stopped('local pause after Business resume',started);
   await app.json('/agents/api/pause','POST',{paused:false});await pausedState({business:false,local:false});await allowed();
   assert.deepEqual(done(await app.call('spool.proposals.create',proposal)),saved,'Business replay restores its original outcome only after both pauses clear');
   assert.deepEqual(done(await native('spool.proposals.create',localProposal)),localSaved,'Native replay restores its original outcome only after both pauses clear');
   assert.equal((await proposals()).length,2,'All resume and replay paths preserve exactly the original inert effects');
   console.log(`PROBE BASE-AGENT-011 6 ${phase} combined pause: clear either source alone -> agents_paused; clear both -> access and original replay restored without duplicate effects`);
   console.log(`PROBE BASE-AGENT-011 7 ${phase}: valid Business and native project agent POST paused=false -> 403 person_session_required with identical pause and policy state`);
  }finally{await screens?.close();await app.stop();}
 }
}
