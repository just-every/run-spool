import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

// Read the native person door to exhaustion, including its terminal page.
export async function auditHistory(app,selectors=''){
 const rows=[],cursors=new Set();let after='0',pages=0;
 for(;;){
  assert.ok(!cursors.has(after),'Audit pagination must advance');cursors.add(after);
  const page=await app.json('/agents/api/audit?'+(selectors?selectors+'&':'')+'after='+encodeURIComponent(after));
  assert.equal(page.differs_from_policy,0,'Retained decisions still match their original policy');
  assert.ok(Array.isArray(page.rows));
  if(!page.rows.length){assert.equal(page.cursor,after);break;}
  pages++;
  for(const row of page.rows){
   assert.ok(row.sequence>Number(after),'Each page continues after its cursor');
   assert.ok(!rows.length||row.sequence>rows.at(-1).sequence,'Audit chronology is strictly ordered');
   rows.push(row);
  }
  assert.equal(page.cursor,String(rows.at(-1).sequence));after=page.cursor;
 }
 assert.equal(new Set(rows.map(row=>row.id)).size,rows.length,'Every retained fact appears once');
 return {rows,pages};
}

/** Retiring native agent authority preserves populated history under both policies. */
export async function auditRetirementContract(app){
 const agents=[];
 const done=answer=>{assert.ok(answer&&!answer.isError,answer?._meta?.['com.runeditrun/error']?.code??'Missing result');return answer.structuredContent;};
 for(const [policy,document] of [['autonomous',autonomousPolicy()],['held',heldPolicy()]]){
  await app.adopt(document);
  const project='synthetic-spool-'+randomUUID();
  const created=await app.json('/api/projects','POST',{id:project,name:'Audit retirement '+policy});
  await app.json('/api/projects/'+project+'/releases','POST',{name:'1.0.0',build:'web-1'});
  const capture=await app.json('/api/ingest/'+project,'POST',{version:1,eventId:'synthetic-spool-'+randomUUID(),release:'1.0.0',build:'web-1',environment:'production',type:'TypeError',message:'Retained retirement evidence',frames:[{file:'https://checkout.example/app.js',line:1,column:0,function:'total'}],breadcrumbs:[]},{Cookie:'',Authorization:'Bearer '+created.ingestKey});
  const retired={act:{sub:'synthetic-spool-'+randomUUID(),name:'Retired triage '+policy,specialist:'triage engineer'},consent:'synthetic-spool-'+randomUUID()};
  const peer={act:{sub:'synthetic-spool-'+randomUUID(),name:'Continuing triage '+policy,specialist:'triage engineer'},consent:'synthetic-spool-'+randomUUID()};
  agents.push(retired.act.sub,peer.act.sub);
  const read=claims=>app.call('spool.issues.list',{project},claims);
  // Cross the native audit page boundary with real authenticated private reads.
  for(let i=0;i<205;i++)assert.deepEqual(done(await read(retired)).items.map(row=>row.id),[capture.issue]);
  const issue=(await app.json('/api/projects/'+project+'/issues'))[0];
  const write=await app.call('spool.issues.update',{project,issue:issue.id,revision:issue.revision,state:'suppressed',idempotency_key:'synthetic-spool-'+randomUUID()},retired);
  if(policy==='autonomous')assert.equal(done(write).state,'suppressed');
  else{
   assert.equal(write._meta?.['com.runeditrun/error']?.code,'approval_required','Held live action remains pending');
   const pending=write._meta?.['com.runeditrun/approval']??write._meta?.['com.runeditrun/error']?.approval;
   assert.ok(pending?.id);assert.equal((await app.json('/agents/api/approvals/'+pending.id)).approval.state,'pending');
   assert.equal((await app.json('/api/projects/'+project+'/issues'))[0].state,issue.state,'Unapproved write changes no native issue');
  }
  const nativeBefore=await app.json('/api/projects/'+project+'/issues'),peerBefore=done(await read(peer)).items;
  assert.deepEqual(peerBefore.map(row=>[row.id,row.state]),nativeBefore.map(row=>[row.id,row.state]),'The peer reads the captured issue and its current state');
  const before=await auditHistory(app),retiredRows=before.rows.filter(row=>row.agent.id===retired.act.sub),peerRows=before.rows.filter(row=>row.agent.id===peer.act.sub);
  assert.ok(before.pages>1,'The pre-retirement witness spans multiple audit pages');
  assert.equal(retiredRows.length,206);assert.equal(peerRows.length,1);
  for(const row of retiredRows){
   assert.equal(row.agent.name,retired.act.name);assert.equal(row.sponsor.name,'Dana Engineer');
   assert.equal(row.label,retired.act.name+' for Dana Engineer');
   assert.ok(Number.isFinite(Date.parse(row.at)));assert.ok(row.id&&row.sponsor.id);
  }
  assert.ok(retiredRows.some(row=>row.tool==='spool.issues.update'&&row.decision===(policy==='held'?'approval':'autonomous')&&row.outcome===(policy==='held'?'pending':'done')),'History includes the actual write decision and outcome');
  assert.ok(retiredRows.some(row=>row.tool==='spool.issues.list'&&row.decision===(policy==='held'?'review':'autonomous')&&row.outcome==='done'));
  assert.deepEqual(await app.json('/agents/api/agents/'+encodeURIComponent(retired.act.sub)+'/revoke','POST',{}),{revoked:true});
  const inventory=(await app.json('/agents/api/agents')).agents;
  const retiredAgent=inventory.find(row=>row.id===retired.act.sub),peerAgent=inventory.find(row=>row.id===peer.act.sub);
  assert.equal(retiredAgent.revoked,true);assert.equal(retiredAgent.name,retired.act.name);assert.equal(retiredAgent.sponsor.name,'Dana Engineer');
  assert.equal(peerAgent.revoked,false);
  // Each helper invocation signs a fresh token. A renamed claim cannot revive it.
  for(const [method,params] of [['tools/call',{name:'spool.issues.list',arguments:{project}}],['tools/list',{}]]){
   const refused=await app.mcp(method,params,{...retired,act:{...retired.act,name:'Replacement name'}},'2025-11-25',401);
   assert.equal(refused.httpStatus,401);assert.equal(refused.error.code,-32001);
  }
  assert.deepEqual(await app.json('/api/projects/'+project+'/issues'),nativeBefore,'Current person access remains and refused calls change no issue');
  assert.deepEqual(done(await read(peer)).items,peerBefore,'Another agent retains its current scoped access');
  const after=await auditHistory(app),byId=new Map(after.rows.map(row=>[row.id,row]));
  for(const row of before.rows)assert.deepEqual(byId.get(row.id),row,'Retirement and fresh-token refusals preserve every prior audit field');
  assert.deepEqual(after.rows.filter(row=>row.agent.id===retired.act.sub&&retiredRows.some(prior=>prior.id===row.id)),retiredRows,'Retired history retains IDs, sequence, time, names, sponsor labels, decisions and outcomes');
  for(const row of peerRows)assert.deepEqual(byId.get(row.id),row,'Peer history remains intact');
  assert.ok(after.rows.length>=before.rows.length,'Refusal facts may append without replacing prior history');
  assert.equal((await app.json('/agents/api/agents')).agents.find(row=>row.id===retired.act.sub).name,retired.act.name,'A refused replacement claim cannot rename the retired agent');
  console.log('PROBE BASE-AGENT-009 acceptance-6 '+policy+': native paginated audit and signed-in revoke -> '+retiredRows.length+' prior agent rows unchanged across '+before.pages+' pages; fresh call and list tokens refused; current person and peer access retained');
 }
 await app.adopt();
 return {agents};
}
