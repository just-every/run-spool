import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {agentRuntime} from './runtime.mjs';
import {checkAgentArtifacts} from '../../src/modules/agent-door/index.ts';
import {projectAgentArtifacts} from '../../src/domain/agent-door/artifact-map.mjs';

// Advance only the disposable Worker's clock, retaining its real D1, production
// module, native sessions and signing/authorization rules. No application route,
// tool response or persisted effect is replaced.
export async function replayHorizon(){
 const app=await agentRuntime(15917);
 const done=answer=>{assert.ok(!answer.isError,answer?._meta?.['com.runeditrun/error']?.code);return answer.structuredContent;};
 const code=answer=>answer?._meta?.['com.runeditrun/error']?.code;
 try{
  console.log('Replay fixture: native owner ready');await app.adopt();const project=await app.json('/api/projects','POST',{id:'horizon-native',name:'Replay horizon'});
  const args={project:project.id,name:'native-private-horizon',build:'horizon-build',idempotency_key:'private-native-key-'+randomUUID()};
  done(await app.call('spool.releases.record',args));
  const original=await app.DB.prepare('SELECT decision_id,created_at,expires_at FROM agent_door_calls WHERE key=?').bind(args.idempotency_key).first();
  assert.ok(original.expires_at>=original.created_at+30*86400000,'Completion establishes the fixed replay horizon');
  console.log('Replay fixture: native call saved');const archive=await app.request('/api/archive');assert.equal(archive.status,200);const bytes=await archive.text();
  console.log('Replay fixture: native archive read');const preview=await app.json('/api/projects/'+project.id+'/erasure');
  const opened=await app.json('/api/projects/'+project.id+'/erasure','POST',{confirm:project.id,planHash:preview.planHash});
  let receipt=opened;for(let step=0;step<20&&receipt.phase!=='complete';step++){receipt=await app.json('/api/erasures/'+opened.id+'/resume','POST',{});console.log('Replay erasure step '+step+': '+receipt.phase);}
  assert.equal(receipt.phase,'complete','The native erasure completes in bounded steps');
  await checkAgentArtifacts(app.DB,projectAgentArtifacts);
  const exported=await app.request('/api/archive');assert.equal(exported.status,200);const postArchive=await exported.text();const manifest=JSON.parse(postArchive.split('\n')[0]);assert.ok(!manifest.tables.some(table=>table.name.startsWith('agent_door_')),'Relay, aliases and agent custody remain installation-private in native exports');
  const redacted=await app.DB.prepare('SELECT key,digest,expires_at FROM agent_door_calls WHERE decision_id=?').bind(original.decision_id).first();
  assert.equal(redacted.expires_at,original.expires_at,'Erasure preserves the original completion horizon exactly');assert.equal(redacted.digest,'');assert.equal(redacted.key,'erased:'+original.decision_id);
  assert.equal(code(await app.call('spool.releases.record',args)),'subject_erased','Replay now returns only its tombstone');
  // Use the actual archived bytes through the public restore door.
  const old=await fetch(app.origin+'/api/restore',{method:'POST',headers:{Origin:app.origin,Cookie:app.cookie,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:bytes});
  assert.equal(old.status,400);assert.equal((await old.json()).error,'erasure_epoch','The native checkpoint refuses resurrection from the earlier archive');
  for(const time of [original.created_at+86400000+1,original.expires_at+1]){
   console.log('Replay clock boundary '+(time<original.expires_at?'24h+1ms':'horizon+1ms'));await app.setTime(time);console.log('Replay clock restarted');app.context.now=()=>time;await app.adopt();console.log('Replay clock policy adopted');
   const answer=await app.call('spool.releases.record',args);
   if(time<original.expires_at)assert.equal(code(answer),'subject_erased','Replay at 24 hours plus 1 ms remains a tombstone');
   else {assert.equal(code(answer),'not_found','The old key is a new request under current native missing-record authority');assert.equal((await app.DB.prepare('SELECT count(*) n FROM agent_door_replay_aliases WHERE call_id=?').bind(original.decision_id).first()).n,0,'Admission at the original horizon purges the call and its alias atomically');}
  }
  assert.equal((await app.DB.prepare('SELECT count(*) n FROM releases WHERE project=?').bind(project.id).first()).n,0);
  console.log('Native replay horizon: original completion expiry preserved; now/24h+1ms tombstones; horizon+1ms fresh refusal; old archive epoch refused.');
 }finally{await app.stop();}
}
