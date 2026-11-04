import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {agentRuntime} from './runtime.mjs';
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';
import {readFile} from 'node:fs/promises';
import {githubDouble} from '../execution/github-double.mjs';
import phaseFixtures from './phase-fixtures.mjs';
import nativeProof from './proof.mjs';
import {runner} from '../execution/reproduce.mjs';

const error=answer=>answer?._meta?.['com.runeditrun/error'];
const done=answer=>{assert.ok(answer&&!answer.isError,error(answer)?.code??'Missing tool result');return answer.structuredContent;};

/** Native MCP retries retain outcomes, but never replace current authority. */
export async function replayContract(){
 for(const [phase,policy,port] of [['autonomous',autonomousPolicy,15918],['held',heldPolicy,15919]]){
  const app=await agentRuntime(port);
  try{
   await app.adopt(policy());
   const project='synthetic-spool-replay',path='/api/projects/'+project;
   const created=await app.json('/api/projects','POST',{id:project,name:'Retry qualification'});
   await app.json(path+'/releases','POST',{name:'1.0.0',build:'web-1'});
   const admitted=await app.json('/api/ingest/'+project,'POST',{version:1,eventId:'synthetic-spool-1',release:'1.0.0',build:'web-1',environment:'production',type:'TypeError',message:'Synthetic retry failure',frames:[{file:'https://checkout.example/app.js',line:1,column:0,function:'total'}],breadcrumbs:[]},{Authorization:'Bearer '+created.ingestKey});
   const packet=done(await app.call('spool.packets.read',{project,issue:admitted.issue}));
   const issues=()=>app.json(path+'/issues'),proposals=()=>app.json(path+'/grouping-proposals');
   const initial=await issues(),revision=packet.issue.revision;
   const args={project,kind:'split',source:admitted.issue,revision,events:[packet.events[0].id],variants:[{stack:JSON.stringify(packet.events[0].event.frames),release:'1.0.0',route:''}],rationale:'Synthetic retry proposal',window:{start:packet.events[0].received,end:packet.events[0].received+1},idempotency_key:randomUUID()};
   const {idempotency_key:unused,...withoutKey}=args;
   assert.equal(error(await app.call('spool.proposals.create',withoutKey))?.code,'idempotency_key_required');
   assert.deepEqual(await proposals(),[],'A missing key saves no proposal');
   const firstAnswer=await app.call('spool.proposals.create',args),first=done(firstAnswer);
   assert.equal(first.state,'proposed');
   assert.equal(firstAnswer._meta['com.runeditrun/decision'].disposition,phase==='held'?'review':'autonomous');
   assert.deepEqual(done(await app.call('spool.proposals.create',args)),first,'Identical arguments return the complete first result');
   const one=await proposals();assert.equal(one.length,1);assert.equal(one[0].id,first.id);
   assert.deepEqual(await issues(),initial,'An inert proposal does not alter captured issues');
   console.log(`PROBE BASE-AGENT-012 1 ${phase}: native MCP identical proposal arguments and key -> equal complete results and one saved proposal`);

   // The server has accepted the mutation, but this client abandons its body.
   // Read the persisted record independently before retrying with a new RPC id.
   const droppedArgs={...args,rationale:'Synthetic abandoned response',idempotency_key:randomUUID()};
   const dropped=await app.mcpResponse('tools/call',{name:'spool.proposals.create',arguments:droppedArgs});
   assert.equal(dropped.response.status,200);await dropped.response.body.cancel();
   const recorded=(await proposals()).find(row=>row.id!==first.id);assert.ok(recorded);
   const saved=JSON.parse((await app.DB.prepare('SELECT outcome FROM agent_door_calls WHERE agent=? AND key=?').bind(app.context.agentId,droppedArgs.idempotency_key).first()).outcome).result;
   assert.equal(saved.id,recorded.id,'The retained outcome identifies the independently listed native proposal');
   const retry=await app.mcpResponse('tools/call',{name:'spool.proposals.create',arguments:droppedArgs});
   assert.notEqual(retry.id,dropped.id);assert.equal(retry.response.status,200);
   const recovered=await retry.response.json();assert.equal(recovered.id,retry.id);
   assert.deepEqual(done(recovered.result),saved,'The new RPC id recovers the actual persisted outcome after response loss');
   const two=await proposals();assert.equal(two.length,2);
   console.log(`PROBE BASE-AGENT-012 2 ${phase}: native MCP accepted response body abandoned, then new JSON-RPC id -> persisted proposal recovered without duplication`);

   assert.equal(error(await app.call('spool.proposals.create',{...args,rationale:'Changed arguments'}))?.code,'idempotency_conflict');
   assert.deepEqual(await proposals(),two,'Conflicting reuse cannot add or alter a proposal');
   assert.deepEqual(await issues(),initial);
   console.log(`PROBE BASE-AGENT-012 3 ${phase}: native MCP changed arguments with saved key -> idempotency_conflict and unchanged native records`);

   const update={project,issue:admitted.issue,state:'acknowledged',revision,expected_revision:revision,idempotency_key:randomUUID()};
   const {idempotency_key:updateKey,...updateWithoutKey}=update;
   assert.equal(error(await app.call('spool.issues.update',updateWithoutKey))?.code,'idempotency_key_required');
   assert.deepEqual(await issues(),initial,'A missing update key changes no issue');
   const updated=done(await app.call('spool.issues.update',update));
   assert.equal(updated.state,'acknowledged');assert.equal(updated.revision,revision+1);
   const afterUpdate=await issues(),afterUpdateProposals=await proposals();
   const stale=await app.call('spool.issues.update',{...update,state:'open',revision:updated.revision,idempotency_key:randomUUID()});
   assert.equal(error(stale)?.code,'revision_conflict');
   assert.equal(error(stale)?.current_revision,updated.revision,'The shared expected-revision conflict names the current native revision');
   assert.deepEqual(await issues(),afterUpdate,'Stale expected revision changes no issue');
   assert.deepEqual(done(await app.call('spool.issues.update',update)),updated,'An admitted update replays even after its original revision is stale');
   assert.equal(error(await app.call('spool.issues.update',{...update,state:'open'}))?.code,'idempotency_conflict');
   assert.deepEqual(await issues(),afterUpdate,'Conflicting update reuse changes no issue');
   console.log(`PROBE BASE-AGENT-012 4 ${phase}: native MCP stale expected_revision with current native revision -> revision_conflict naming ${updated.revision}, no change`);

   const original=await app.DB.prepare('SELECT created_at,expires_at FROM agent_door_calls WHERE agent=? AND key=?').bind(app.context.agentId,args.idempotency_key).first();
   const time=original.created_at+86400000+1;
   await app.setTime(time);app.context.now=()=>time;await app.adopt(policy());
   assert.deepEqual(done(await app.call('spool.proposals.create',args)),first,'A live saved proposal result remains replayable after 24 hours');
   assert.deepEqual(done(await app.call('spool.proposals.create',droppedArgs)),saved,'Response-loss recovery survives the same elapsed time');
   assert.equal((await app.DB.prepare('SELECT expires_at FROM agent_door_calls WHERE agent=? AND key=?').bind(app.context.agentId,args.idempotency_key).first()).expires_at,original.expires_at,'Replay does not extend the original completion horizon');
   await app.adopt(policy(),{paused:true});
   const paused=await app.call('spool.proposals.create',args);assert.equal(error(paused)?.code,'agents_paused');assert.equal(paused.structuredContent,undefined);
   await app.adopt(policy());
   const scope=await app.mcp('tools/call',{name:'spool.proposals.create',arguments:args},{scope:'spool:evidence'},'2025-11-25',403);
   assert.equal(scope.error?.data?.code,'insufficient_scope');
   assert.deepEqual(done(await app.call('spool.proposals.create',args)),first);
   assert.deepEqual(await proposals(),afterUpdateProposals);assert.deepEqual(await issues(),afterUpdate);
   console.log(`PROBE BASE-AGENT-012 horizon ${phase}: disposable Worker at completion plus 24 hours and 1 ms -> original live results, fixed expiry, Pause and current-scope refusals`);
  }finally{await app.stop();}
 }
}

/** Run the existing native business journey, qualifying every public mutation. */
export async function replayAllTools(){
 const surface=JSON.parse(await readFile(new URL('../../agent-surface.json',import.meta.url),'utf8'));
 for(const [phase,policy,port] of [['autonomous',autonomousPolicy,15920],['held',heldPolicy,15921]]){
  const github=await githubDouble();
  const connection={...JSON.parse(github.connection),apiOrigin:'https://api.github.com'};
  const app=await agentRuntime(port,{GITHUB_CONNECTION:JSON.stringify(connection)},request=>fetch(github.origin+new URL(request.url).pathname+new URL(request.url).search,{method:request.method,headers:request.headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,duplex:'half'}));
  try{
   await app.json('/api/organization','POST',{id:'synthetic-spool-company',name:'Retry company'});
   await app.adopt(policy());
   const fixture=await phaseFixtures({request:fetch,origin:app.origin,cookie:app.cookie,phase});
   const email=['synthetic-spool-peer','spool.test'].join('@'),sub=randomUUID();
   await app.json('/api/organization/invites','POST',{email,name:'Job peer',role:'admin',grants:[]});
   const invite=(await app.mail()).findLast(message=>message.to?.includes(email));
   const token=invite?.text.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];assert.ok(token);
   const accepted=await app.request('/auth/confirm','POST',{token},{Cookie:''});assert.equal(accepted.status,303);await accepted.body?.cancel();
   await app.syncSettings([{id:sub,email,name:'Job peer',role:'admin',invite:1}]);
   const peer={sub,email,act:{sub:randomUUID(),name:'Peer agent',specialist:'triage engineer'}};
   assert.ok(done(await app.call('spool.issues.list',{project:fixture.values.project},peer)).items.length,'The other person really has current project read authority');
   const lifecycle=await jobLifecycle(app,fixture.values,peer,phase,policy);
   const outputs=new Map(),covered=new Set(),listed=(await app.mcp('tools/list')).tools;
   const resolve=value=>{
    if(value&&typeof value==='object'){
     if(value.$fixture)return fixture.values[value.$fixture];
     if(value.$from){let found=outputs.get(value.$from);for(const part of value.pointer.split('/').slice(1))found=found[part];return found;}
     if(Array.isArray(value))return value.map(resolve);
     return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,resolve(item)]));
    }
    return value;
   };
   const snapshot=async()=>({native:done(await app.call('spool.witness.read',{project:fixture.values.project})),mail:await app.mail(),provider:github.requests.length});
   for(const step of surface.journey){
    // Optional events remain undeclared; all native read and write steps run.
    if(step.tool==='spool.events.list')continue;
    const declared=surface.tools.find(tool=>tool.name===step.tool),args=resolve(step.args);
    let proof;
    if(declared.proof)proof=await nativeProof({kind:declared.proofKind,args,request:(path,init={})=>app.request(path,init.method??'GET',init.body===undefined?undefined:JSON.parse(init.body),init.headers)});
    if(!declared.readOnly){
     const before=await snapshot();
     assert.equal(error(await app.call(step.tool,args,{},proof))?.code,'idempotency_key_required',step.tool+' requires a key');
     assert.deepEqual(await snapshot(),before,step.tool+' missing key has no effect');
     if(listed.find(tool=>tool.name===step.tool).inputSchema.properties.expected_revision){
      const stale=await app.call(step.tool,{...args,expected_revision:Number.MAX_SAFE_INTEGER,idempotency_key:randomUUID()}, {},proof);
      assert.equal(error(stale)?.code,'revision_conflict',step.tool+' refuses a stale expected revision');
      assert.ok(Number.isSafeInteger(error(stale)?.current_revision),step.tool+' reports its current native revision');
      assert.deepEqual(await snapshot(),before,step.tool+' stale revision changes nothing');
     }
     args.idempotency_key=randomUUID();
    }
    let answer=await app.call(step.tool,args,{},proof);
    const pending=answer._meta?.['com.runeditrun/approval']??error(answer)?.approval;
    if(pending){
     assert.equal(phase,'held');
     const before=await snapshot(),again=await app.call(step.tool,args,{},proof);
     assert.equal((again._meta?.['com.runeditrun/approval']??error(again)?.approval)?.id,pending.id,'A held retry retains its one approval');
     assert.deepEqual(await snapshot(),before,'A pending retry executes nothing');
     const {approval}=await app.json('/agents/api/approvals/'+pending.id);
     await app.json('/agents/api/approvals/'+pending.id+'/approve','POST',{revision:approval.revision,summary_sha256:approval.summary_sha256});
     answer=await app.call(step.tool,args,{},proof);
    }
    const erased=error(answer)?.code==='subject_erased';
    const value=erased?{tombstone:error(answer).tombstone}:done(answer);
    outputs.set(step.id,value);
    if(step.id==='queue-status'||step.id==='erasure-status'){
     for(const claims of [peer,{act:{sub:randomUUID(),name:'Another agent',specialist:'triage engineer'}},{consent:randomUUID()}]){
      const denied=await app.call(step.tool,args,claims);
      assert.equal(error(denied)?.code,'not_found',step.tool+' hides a job from another current person, agent or consent');
      assert.equal(denied.structuredContent,undefined);
     }
     assert.equal(error(await app.call(step.tool,{...args,id:'synthetic-spool-absent'},peer))?.code,'not_found','Absent and restricted job handles have the same refusal');
     if(step.id==='erasure-status'&&phase==='autonomous'){
      await app.schedule(Date.now());
      assert.equal(done(await app.call(step.tool,args)).phase,'complete','The scheduled native continuation completes after the caller leaves and retains a readable private receipt');
      assert.equal(error(await app.call(step.tool,args,peer))?.code,'not_found','Scheduled completion cannot transfer job ownership');
     }
    }
    if(declared.readOnly)continue;
    const beforeReplay=await snapshot(),repeated=await app.call(step.tool,args,{},proof);
    if(erased)assert.deepEqual(error(repeated),error(answer),'Erasure repeats only its value-free tombstone');
    else assert.deepEqual(done(repeated),value,step.tool+' returns its complete original outcome');
    assert.deepEqual(await snapshot(),beforeReplay,step.tool+' retry has exactly one effect');
    if(!erased){
     const field=Object.keys(args).find(key=>key!=='idempotency_key'&&typeof args[key]==='string');
     assert.ok(field,step.tool+' has a genuine changed argument');
     assert.equal(error(await app.call(step.tool,{...args,[field]:args[field]+'-changed'}, {},proof))?.code,'idempotency_conflict',step.tool+' conflicting reuse');
     assert.deepEqual(await snapshot(),beforeReplay,step.tool+' conflict has no effect');
    }
    covered.add(step.tool);
    console.log('PROBE BASE-AGENT-012 registry '+phase+' '+step.tool+': native MCP -> required key, equal saved outcome, one effect and conflict nonmutation'+(erased?' (erasure tombstone)':''));
   }
   assert.deepEqual([...covered].sort(),listed.filter(tool=>!tool.annotations.readOnlyHint).map(tool=>tool.name).sort(),'Every currently offered mutation runs through the native replay journey');
   const finished=done(await app.call('spool.privacy.status',{id:outputs.get('erase').id}));
   assert.equal(finished.phase,'complete','Erasure status remains readable after the project is gone');
   const expiring=done(await app.call('spool.reproducers.run',{...lifecycle.args,idempotency_key:randomUUID()}));
   const expiredAt=expiring.expires+1;await app.setTime(expiredAt);app.context.now=()=>expiredAt;await app.adopt(policy());
   const expired=done(await app.call(expiring.job.tool,expiring.job.arguments));
   assert.equal(expired.state,'expired');assert.equal(expired.outcome,'failed');
   const refusedRun=await app.request(new URL(expiring.url).pathname,'GET',undefined,{Authorization:'Bearer '+expiring.token});
   assert.equal(refusedRun.status,401);await refusedRun.body?.cancel();
   await app.adopt(policy(),{revoked:{agents:[],consents:[app.context.consent]}});
   for(const [name,args] of [[lifecycle.queued.job.tool,lifecycle.queued.job.arguments],['spool.reproducers.run',lifecycle.args]]){
    const revoked=await app.mcp('tools/call',{name,arguments:args},{},'2025-11-25',401);
    assert.equal(revoked.httpStatus,401,'Revoked consent exposes neither job status nor a saved runner handoff');
   }
   assert.ok((await app.json('/api/projects')).some(row=>row.id===fixture.values.project),'Revocation preserves the native person door');
   const path='/api/projects/'+fixture.values.project,plan=await app.json(path+'/erasure');
   let receipt=await app.json(path+'/erasure','POST',{confirm:fixture.values.project,planHash:plan.planHash});
   for(let step=0;step<20&&receipt.phase!=='complete';step++)receipt=await app.json('/api/erasures/'+receipt.id+'/resume','POST',{});
   assert.equal(receipt.phase,'complete');
   // A fresh consent restores agent admission, never the erased job or bytes.
   app.context.consent=randomUUID();await app.adopt(policy());
   assert.equal(error(await app.call(lifecycle.queued.job.tool,lifecycle.queued.job.arguments))?.code,'not_found');
   const erasedJob=await app.call('spool.reproducers.run',lifecycle.args);
   assert.equal(error(erasedJob)?.code,'subject_erased');assert.equal(erasedJob.structuredContent,undefined);
   console.log('PROBE BASE-AGENT-012 custody '+phase+': revoked consent -> 401; native erasure and fresh consent -> status not_found and saved handoff subject_erased, no resurrection');
   console.log('Native replay coverage '+phase+': '+covered.size+' public mutating tools');
  }finally{await app.stop();await github.stop();}
 }
}

async function jobLifecycle(app,fixture,peer,phase,policy){
 const args={project:fixture.project,id:fixture.reproducer,idempotency_key:randomUUID()};
 const queued=done(await app.call('spool.reproducers.run',args));
 assert.equal(queued.job.id,queued.run);assert.equal(queued.job.tool,'spool.reproducers.status');
 const nativePath='/api/projects/'+fixture.project+'/reproducers/runs/'+queued.run;
 const anonymous=await app.request(nativePath,'GET',undefined,{Cookie:''});
 assert.equal(anonymous.status,401,'The direct job-status route checks its own native session');await anonymous.body?.cancel();
 assert.equal((await app.json(nativePath)).state,'queued','The current native person retains ordinary project authority');
 const status=()=>app.call(queued.job.tool,queued.job.arguments);
 assert.equal(done(await status()).state,'queued');
 assert.equal(error(await app.call(queued.job.tool,queued.job.arguments,peer))?.code,'not_found','Another person with project access cannot use the job handle');
 for(const claims of [{act:{sub:randomUUID(),name:'Other agent',specialist:'triage engineer'}},{consent:randomUUID()}]){
  const refused=await app.call(queued.job.tool,queued.job.arguments,claims);
  assert.equal(error(refused)?.code,'not_found');assert.equal(refused.structuredContent,undefined);
 }
 await app.adopt(policy(),{paused:true});assert.equal(error(await status())?.code,'agents_paused');
 const paused=await app.request(new URL(queued.url).pathname,'GET',undefined,{Authorization:'Bearer '+queued.token});
 assert.equal(paused.status,403);assert.equal((await paused.json()).code,'agents_paused');
 await app.adopt(policy());
 assert.equal(done(await status()).state,'queued','Pause leaves the native run unclaimed');
 await app.restart();
 assert.equal(done(await status()).state,'queued','The job and its ownership survive an emitted Worker restart');
 const observed=await runner(queued.command.replace(app.canonicalOrigin,app.origin));
 assert.equal(observed.code,0,observed.output);assert.match(observed.output,/^reproduced:/m);
 const result=done(await status());assert.equal(result.state,'finished');assert.equal(result.outcome,'reproduced');
 assert.ok(!JSON.stringify(result).includes(queued.token));assert.equal(result.modules,undefined);
 assert.deepEqual(done(await app.call('spool.reproducers.run',args)),queued,'Retry recovers the original job handle after completion');
 const used=await app.request(new URL(queued.url).pathname,'GET',undefined,{Authorization:'Bearer '+queued.token});assert.equal(used.status,401);await used.body?.cancel();
 const stopped=await app.mcp('tools/call',{name:queued.job.tool,arguments:queued.job.arguments},{scope:'spool:propose'},'2025-11-25',403);
 assert.equal(stopped.error?.data?.code,'insufficient_scope');
 console.log('PROBE BASE-AGENT-012 5 '+phase+': native MCP job handle -> queued, restart, reproduced completion; other person, agent, consent and reduced scope refused; Pause prevents execution; single-use runner cannot replay');
 return {queued,args};
}
