import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {agentRuntime} from './runtime.mjs';
import {operatorAgentArtifacts} from '../../src/domain/agent-door/artifact-map.mjs';
export async function ownerCustody(){
 const app=await agentRuntime(15918);
 const cookie=response=>response.headers.getSetCookie().map(row=>row.split(';')[0]).join('; ');
 const signIn=async email=>{await app.json('/auth/magic-link','POST',{email});return confirm(email);};
 const confirm=async email=>{const mail=(await app.mail()).findLast(message=>message.to?.includes(email));const token=mail?.text.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];assert.ok(token);const response=await app.request('/auth/confirm','POST',{token},{Cookie:''});assert.equal(response.status,303);const entered=cookie(response);await response.body?.cancel();return entered;};
 try{
  await app.adopt();const project=await app.json('/api/projects','POST',{id:'owner-custody',name:'Peer native project'});
  const answer=await app.call('spool.releases.record',{project:project.id,name:'Owner recorded release',build:'owner-build',idempotency_key:'owner-private-key-'+randomUUID()});assert.ok(!answer.isError);
  const owner=await app.DB.prepare("SELECT id,email,display_name FROM oa_operators WHERE role='owner' AND status='active'").first();
  const ownerCookie=await signIn(owner.email);
  await app.json('/api/owner/erasure/successor','POST',{email:'native-successor@spool.test',displayName:'Independent native successor'},{Cookie:ownerCookie});
  const successorCookie=await confirm('native-successor@spool.test');
  const successor=await app.DB.prepare("SELECT * FROM oa_operators WHERE email='native-successor@spool.test'").first();
  const preview=await app.json('/api/owner/erasure','GET',undefined,{Cookie:ownerCookie});assert.equal(preview.hold,null,JSON.stringify(preview));
  const receipt=await app.json('/api/owner/erasure','POST',{confirm:'ERASE MY PERSONAL DATA',planHash:preview.planHash},{Cookie:ownerCookie});assert.equal(receipt.phase,'complete');
  assert.deepEqual(await app.DB.prepare('SELECT id,email,display_name,status,version FROM oa_operators WHERE id=?').bind(successor.id).first(),{id:successor.id,email:successor.email,display_name:successor.display_name,status:successor.status,version:successor.version+1},'Successor identity survives with the native handoff version fence');
  const priorSession=await app.request('/api/projects','GET',undefined,{Cookie:successorCookie});assert.equal(priorSession.status,401,'The pre-handoff session cannot inherit owner authority');await priorSession.body?.cancel();
  const freshSuccessorCookie=await signIn(successor.email);
  assert.equal((await app.json('/api/projects','GET',undefined,{Cookie:freshSuccessorCookie}))[0].id,project.id,'The independent successor retains real native owner authority');
  for(const artifact of operatorAgentArtifacts.artifacts){const rows=(await app.DB.prepare('SELECT * FROM '+artifact.table).all()).results;const text=JSON.stringify(rows);for(const value of [owner.id,owner.email,owner.display_name,app.context.person.sub])assert.ok(!text.includes(value),artifact.table+' retains no erased native or Business person identity');}
  const settings=await app.DB.prepare('SELECT stopped,document,owner_id FROM bs_settings WHERE singleton=1').first();assert.deepEqual(settings,{stopped:1,document:null,owner_id:null},'Native owner retirement detaches and redacts its Business pairing atomically');
  console.log('Native owner custody: paired Business identity, call/approval/audit map scan, ordinary verified successor, retained project and irreversible detach passed.');
 }finally{await app.stop();}
}
