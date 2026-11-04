import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {agentRuntime} from './runtime.mjs';
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

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
   const first=done(await app.call('spool.proposals.create',args));
   assert.equal(first.state,'proposed');
   assert.equal((await app.call('spool.proposals.create',args))._meta['com.runeditrun/decision'].disposition,phase==='held'?'review':'autonomous');
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
   const updated=done(await app.call('spool.issues.update',update));
   assert.equal(updated.state,'acknowledged');assert.equal(updated.revision,revision+1);
   const afterUpdate=await issues(),afterUpdateProposals=await proposals();
   const stale=await app.call('spool.issues.update',{...update,state:'open',revision:updated.revision,idempotency_key:randomUUID()});
   assert.equal(error(stale)?.code,'revision_conflict');
   assert.equal(error(stale)?.current_revision,updated.revision,'The shared expected-revision conflict names the current native revision');
   assert.deepEqual(await issues(),afterUpdate,'Stale expected revision changes no issue');
   assert.deepEqual(done(await app.call('spool.issues.update',update)),updated,'An admitted update replays even after its original revision is stale');
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
