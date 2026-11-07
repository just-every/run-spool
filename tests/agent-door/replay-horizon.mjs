import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {agentRuntime} from './runtime.mjs';
import {checkAgentArtifacts} from '../../src/modules/agent-door/index.ts';
import {projectAgentArtifacts} from '../../src/domain/agent-door/artifact-map.mjs';

// Advance only the disposable Worker's clock, retaining its real D1, production
// module, native sessions and signing/authorization rules. No application route,
// tool response or persisted effect is replaced.
export async function replayHorizon(){
 const app=await agentRuntime({},undefined,{deferAgentUpgrade:true});
 const done=answer=>{assert.ok(!answer.isError,answer?._meta?.['com.runeditrun/error']?.code);return answer.structuredContent;};
 const code=answer=>answer?._meta?.['com.runeditrun/error']?.code;
 try{
  console.log('Replay fixture: native owner ready');await app.adopt();const project=await app.json('/api/projects','POST',{id:'horizon-native',name:'Replay horizon'});
  // 0098 is the recovered saved door DDL, byte-identical to the original
  // 0091. Bootstrap uses real native doors before applying the additive upgrade.
  assert.ok(!(await app.DB.prepare('PRAGMA table_info(agent_door_calls)').all()).results.some(column=>column.name==='expires_at'));
  const nativeRelease=await app.json(`/api/projects/${project.id}/releases`,'POST',{name:'legacy-private-release',build:'legacy-build'});
  const legacyKey='legacy-personal-key-'+randomUUID(),legacyId=randomUUID(),legacyCreated=Date.now()-86400000-1;
  const owner=await app.DB.prepare("SELECT id,display_name FROM oa_operators WHERE role='owner' AND status='active'").first();
  await app.DB.prepare('INSERT INTO agent_door_calls(agent,key,digest,decision_id,created_at,state,outcome) VALUES(?,?,?,?,?,?,?)').bind(app.context.agentId,legacyKey,'1'.repeat(64),legacyId,legacyCreated,'done',JSON.stringify({outcome:'done',decision:null,result:nativeRelease,resources:[{uri:`spool://projects/${project.id}/releases/legacy-private-release`,name:'legacy release'}]})).run();
  await app.DB.prepare('INSERT INTO agent_door_audit(id,at,agent,classes,row,evidence) VALUES(?,?,?,?,?,NULL)').bind(legacyId,new Date(legacyCreated).toISOString(),app.context.agentId,'["standard"]',JSON.stringify({id:legacyId,at:new Date(legacyCreated).toISOString(),door:'mcp',agent:{id:app.context.agentId},sponsor:{id:owner.id,name:owner.display_name},tool:'spool.releases.record',resource:{kind:'project',id:project.id},classes:[{class:'standard',facts:{measure:1}}],outcome:'done',consent:app.context.consent,idempotency_key:legacyKey})).run();
  await app.applyAgentUpgrade();
  const legacyExpiry=legacyCreated+30*86400000;
  assert.equal((await app.DB.prepare('SELECT expires_at FROM agent_door_calls WHERE decision_id=?').bind(legacyId).first()).expires_at,legacyExpiry,'The actual prior door ledger backfills the original completed-call horizon');
  const legacyArgs={project:project.id,name:'legacy-private-release',build:'legacy-build',idempotency_key:legacyKey};
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
  assert.equal(code(await app.call('spool.releases.record',legacyArgs)),'subject_erased','The upgraded legacy key replays in-window only as a tombstone');
  assert.equal((await app.DB.prepare('SELECT expires_at FROM agent_door_calls WHERE decision_id=?').bind(legacyId).first()).expires_at,legacyExpiry,'Native erasure cannot extend the upgraded legacy horizon');
  // Use the actual archived bytes through the public restore door.
  const old=await fetch(app.origin+'/api/restore',{method:'POST',headers:{Origin:app.origin,Cookie:app.cookie,Connection:'close','Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:bytes});
  assert.equal(old.status,400);assert.equal((await old.json()).error,'erasure_epoch','The native checkpoint refuses resurrection from the earlier archive');
  for(const time of [original.created_at+86400000+1,legacyExpiry+1,original.expires_at+1]){
   console.log('Replay clock boundary '+(time===legacyExpiry+1?'legacy horizon+1ms':time<original.expires_at?'24h+1ms':'completion horizon+1ms'));await app.setTime(time);console.log('Replay clock restarted');app.context.now=()=>time;await app.adopt();console.log('Replay clock policy adopted');
   const legacyAnswer=await app.call('spool.releases.record',legacyArgs);assert.equal(code(legacyAnswer),time<legacyExpiry?'subject_erased':'not_found','Legacy replay obeys its original upgrade horizon');
   const answer=await app.call('spool.releases.record',args);
   if(time<original.expires_at)assert.equal(code(answer),'subject_erased','Replay at 24 hours plus 1 ms remains a tombstone');
   else {assert.equal(code(answer),'not_found','The old key is a new request under current native missing-record authority');assert.equal((await app.DB.prepare('SELECT count(*) n FROM agent_door_replay_aliases WHERE call_id=?').bind(original.decision_id).first()).n,0,'Admission at the original horizon purges the call and its alias atomically');}
  }
  assert.equal((await app.DB.prepare('SELECT count(*) n FROM releases WHERE project=?').bind(project.id).first()).n,0);
  console.log('Native replay horizon: original completion expiry preserved; now/24h+1ms tombstones; horizon+1ms fresh refusal; old archive epoch refused.');
 }finally{await app.stop();}
}
