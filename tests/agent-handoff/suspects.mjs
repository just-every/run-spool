import assert from 'node:assert/strict';
import {reactivationFixture} from '../suspect-flow.mjs';
import {archiveProjection} from '../archive.mjs';
import {startTestWorker} from '../worker.mjs';
import {signIn} from '../auth.mjs';
import {followErasure} from '../project-erasure/follow.mjs';
import {cli,clientEnvironment,mcpClient,mcpValue} from './clients.mjs';
import {bounded} from './packet.mjs';

// One public-door journey: native capture, owner judgment, every packet client,
// bounded history, retention, inert restore, revoked authority and erased replay.
export async function suspectPacketHandoff(app) {
 const req=(path,method,body,headers)=>app.request(path,method,body,{headers}),json=app.json;
 const old='synthetic-spool-checkout@1',current='synthetic-spool-checkout@2',falseSha='a'.repeat(40),trueSha='b'.repeat(40),priorSha='c'.repeat(40),time=Date.now();
 const privateNote='synthetic-spool-private-judgment',privateAuthor='synthetic-spool-private-engineer',privateMessage='synthetic-spool-private-commit',privateAddress=[privateAuthor,'example.test'].join('@');
 const fixture=await reactivationFixture({req,json,old,current,falseSha,trueSha,priorSha,time,commitDetails:{message:privateMessage,author:{name:privateAuthor,email:privateAddress}}});
 const base='/api/projects/'+fixture.project,path=base+'/issues/'+fixture.issue+'/packet',suspectPath=base+'/suspects/issues/'+fixture.issue;
 const grant=await json(base+'/keys','POST',{kind:'agent'}),agent={agent:grant.key},env={...clientEnvironment(app,grant.key),SPOOL_URL:app.origin+base};

 for(const [sha,judgment,revision] of [[falseSha,'confirmed',0],[falseSha,'rejected',1],[trueSha,'confirmed',0]]){
  const before=(await app.archive()).data;
  await json(suspectPath,'PUT',{release:current,sha,judgment,note:privateNote,revision});
  const after=(await app.archive()).data;
  for(const table of ['events','issues','alerts'])assert.deepEqual(after[table],before[table],'engineer judgments preserve '+table);
 }
 const owner=await json(suspectPath),packet=await json(path,'GET',undefined,agent),beforeReads=(await app.archive()).data;
 const original=owner.candidates.find(row=>row.release===old).reason[0].record;
 assert.equal(packet.commits.sharing,'sha_only');assert.equal(packet.suspects.candidates.length,3);
 assert.deepEqual(packet.suspects.candidates.map(row=>[row.release,row.sha,row.judgment.state,row.judgment.revision]),[[old,priorSha,'unreviewed',0],[current,falseSha,'rejected',2],[current,trueSha,'confirmed',1]]);
 for(const candidate of packet.suspects.candidates){
  const recorded=owner.candidates.find(row=>row.release===candidate.release&&row.sha===candidate.sha);
  assert.deepEqual(candidate.reason,recorded.reason,'packet uses the exact retained occurrence or regression alert reference');
  assert.deepEqual(candidate.inclusion,{source:recorded.inclusion.source,created:recorded.inclusion.created});
  assert.deepEqual(candidate.deployments,recorded.deployments.map(row=>({...row,historical:row.historical===1})));
  assert.deepEqual(candidate.judgment,{state:recorded.decision?.judgment??'unreviewed',revision:recorded.decision?.revision??0,updated:recorded.decision?.updated??null});
  assert.equal(candidate.correlation,'Correlation, not a demonstrated cause.');assert.equal(candidate.changedSource.available,false);assert.match(candidate.changedSource.reason,/no changed-file list/);
  if(candidate.release===old){assert.equal(candidate.reason[0].record.id,'synthetic-spool-resolved-old');assert.ok(candidate.reason[0].record.occurrence);}
  else {assert.deepEqual(candidate.reason,[{kind:'reactivation',record:{alertId:fixture.alert.id,received:fixture.alert.created,release:current}}]);assert.deepEqual(candidate.deployments,[{id:fixture.deployment.id,environment:'production',started:time-60000,deadline:time+3600000,historical:false}]);assert.equal(recorded.decision.note,privateNote);}
 }
 const privateRows=(await app.archive()).data.commits;
 assert.ok(privateRows.some(row=>row.author_email===privateAddress&&row.message===privateMessage),'privacy checks start with populated confidential records');
 const safe=value=>{const serialized=JSON.stringify(value);for(const canary of [privateNote,privateAuthor,privateMessage,privateAddress,grant.key,fixture.ingestKey,fixture.deployment.repository])assert.ok(!serialized.includes(canary),'private suspect value excluded');for(const candidate of value.suspects.candidates){assert.ok(!Object.hasOwn(candidate,'decision'));assert.deepEqual(Object.keys(candidate.judgment).sort(),['revision','state','updated']);}};
 const compareClients=async(expected,client,issue=fixture.issue)=>{
  const output=await cli(['packet',issue,'--format','json'],env);assert.equal(output.code,0);assert.deepEqual(JSON.parse(output.stdout),expected,'complete CLI JSON equals settled HTTP packet');
  const markdown=await cli(['packet',issue,'--format','markdown'],env);assert.equal(markdown.code,0);const embedded=/\n(`+)json\n([\s\S]*)\n\1\n$/.exec(markdown.stdout);assert.ok(embedded);assert.deepEqual(JSON.parse(embedded[2]),expected,'complete embedded Markdown JSON equals HTTP');
  for(const name of ['get_packet','spool.issues.read']){
   const result=await client.call(name,{issue});assert.deepEqual(mcpValue(result),expected,'complete official MCP packet equals HTTP');
   for(const canary of [privateNote,privateAuthor,privateMessage,privateAddress,grant.key,fixture.ingestKey,fixture.deployment.repository])assert.ok(!JSON.stringify(result).includes(canary),'private suspect value excluded from complete MCP response');
  }
  for(const rendered of [output.stdout,output.stderr,markdown.stdout,markdown.stderr])for(const canary of [privateNote,privateAuthor,privateMessage,privateAddress,grant.key,fixture.ingestKey,fixture.deployment.repository])assert.ok(!rendered.includes(canary),'private suspect value excluded from complete CLI response');
  safe(expected);return bounded(expected);
 };
 const client=await mcpClient(app,grant.key,fixture.project);
 try{
  await compareClients(packet,client);
  assert.deepEqual((await app.archive()).data,beforeReads,'all packet readers preserve product records');
  for(const foreignPath of ['/api/projects/a/issues/'+fixture.issue+'/packet',base+'/issues/'+(await json('/api/projects/a/issues'))[0].id+'/packet']){
   const response=await app.request(foreignPath,'GET',undefined,agent);assert.ok([403,404].includes(response.status));await response.body?.cancel();
  }
  const foreignEnv={...env,SPOOL_URL:app.origin+'/api/projects/a'};assert.equal((await cli(['packet',fixture.issue,'--format','json'],foreignEnv)).code,3);
  const foreign=await mcpClient(app,grant.key,'a');try{assert.equal((await foreign.call('get_packet',{issue:fixture.issue})).isError,true);}finally{await foreign.close();}
  assert.deepEqual((await app.archive()).data,beforeReads,'foreign reads neither expose nor mutate evidence');
  await json(base+'/releases','POST',{name:'synthetic-spool-unlinked',build:'web-3'});
  const unlinked=await json('/api/ingest/'+fixture.project,'POST',{version:1,eventId:'synthetic-spool-unlinked',release:'synthetic-spool-unlinked',build:'web-3',environment:'production',type:'TypeError',message:'Synthetic unlinked release failure',frames:[{file:'checkout.js',line:99,column:0,function:'unlinked'}],breadcrumbs:[]},{agent:fixture.ingestKey});
  const unlinkedPath=base+'/issues/'+unlinked.issue+'/packet',unlinkedPacket=await json(unlinkedPath,'GET',undefined,agent),unlinkedCandidate=unlinkedPacket.suspects.candidates[0];
  assert.equal(unlinkedCandidate.sha,null,'no commit is invented for an observed release');assert.equal(unlinkedCandidate.inclusion.source,'retained_occurrence');assert.match(unlinkedCandidate.inclusion.reason,/No recorded commit receipt/);assert.equal(unlinkedCandidate.inclusion.created,unlinkedCandidate.reason[0].record.received);assert.deepEqual(unlinkedCandidate.deployments,[]);assert.equal(unlinkedCandidate.judgment.state,'unreviewed');
  const beforeUnlinkedReads=(await app.archive()).data;await compareClients(unlinkedPacket,client,unlinked.issue);
  assert.deepEqual((await app.archive()).data,beforeUnlinkedReads,'release-only packet clients change no archived rows');

  const unlinkedOwner=(await json(base+'/issues')).find(row=>row.id===unlinked.issue);
  await json(base+'/issues/'+unlinked.issue,'PATCH',{revision:unlinkedOwner.revision,state:'resolved',resolution:'plain'});
  const unlinkedEvent=(id,fn)=>({version:1,eventId:id,release:'synthetic-spool-unlinked',build:'web-3',environment:'production',type:'TypeError',message:'Synthetic unlinked release failure',frames:[{file:'checkout.js',line:99,column:0,function:fn}],breadcrumbs:[]});
  await json('/api/ingest/'+fixture.project,'POST',unlinkedEvent('synthetic-spool-unlinked-again','unlinked'),{agent:fixture.ingestKey});
  const noHistory=await json('/api/ingest/'+fixture.project,'POST',unlinkedEvent('synthetic-spool-no-history','noHistory'),{agent:fixture.ingestKey});
  // Grow real native history past all nested projection limits. Public calls
  // preserve the existing grouping, registered ordering and minute budget.
  for(let index=0;index<23;index++){
   const issue=(await json(base+'/issues')).find(row=>row.id===fixture.issue);
   await json(base+'/issues/'+fixture.issue,'PATCH',{revision:issue.revision,state:'resolved',resolution:'plain'});
   await json('/api/ingest/'+fixture.project,'POST',{version:1,eventId:'synthetic-spool-regression-'+index,release:current,build:'web-2',environment:'production',type:'TypeError',message:'Checkout confirmation receipt missing',frames:[{file:'checkout.js',line:12,column:0,function:'confirm'}],breadcrumbs:[]},{agent:fixture.ingestKey});
  }
  for(let index=0;index<6;index++)await json(base+'/deployments','POST',{...fixture.deployment,id:'synthetic-spool-rollout-'+index});
  await json(base+'/releases','POST',{name:current,build:'web-2',commits:Array.from({length:30},(_,index)=>({sha:(index+256).toString(16).padStart(40,'0'),message:privateMessage}))});
  const crowdedOwner=await json(suspectPath),crowded=await json(path,'GET',undefined,agent);
  assert.ok(crowded.suspects.bounds.available>crowded.suspects.candidates.length);assert.equal(crowded.suspects.bounds.available,crowdedOwner.bounds.available);
  assert.equal(crowded.suspects.bounds.included,crowded.suspects.candidates.length);assert.equal(crowded.suspects.bounds.reactivationsAvailable,24);assert.equal(crowded.suspects.bounds.reactivationsIncluded,crowded.suspects.bounds.reactivationLimit);assert.ok(crowded.suspects.bounds.reactivationsAvailable>crowded.suspects.bounds.reactivationsIncluded);assert.ok(crowded.suspects.candidates.length<=crowded.suspects.bounds.candidateLimit);
  for(const candidate of crowded.suspects.candidates.filter(row=>row.release===current)){
   assert.equal(candidate.bounds.reasonsAvailable,crowded.suspects.bounds.reactivationsIncluded);assert.equal(candidate.reason.length,candidate.bounds.reasonLimit);assert.ok(candidate.bounds.reasonsAvailable>candidate.reason.length);
   assert.equal(candidate.bounds.deploymentsAvailable,7);assert.equal(candidate.deployments.length,candidate.bounds.deploymentLimit);assert.ok(candidate.bounds.deploymentsAvailable>candidate.deployments.length);
   const ownerCandidate=crowdedOwner.candidates.find(row=>row.sha===candidate.sha&&row.release===candidate.release);
   assert.deepEqual(candidate.reason,ownerCandidate.reason.slice(0,candidate.bounds.reasonLimit));
   assert.deepEqual(candidate.deployments,ownerCandidate.deployments.slice(0,candidate.bounds.deploymentLimit).map(row=>({...row,historical:false})));
  }
  assert.ok(crowded.gaps.some(row=>row.code==='suspects_omitted'&&row.omitted===crowded.suspects.bounds.available-crowded.suspects.bounds.included));
  assert.ok(crowded.gaps.some(row=>row.code==='suspect_reactivations_omitted'));
  await compareClients(crowded,client);
  // Public captures keep the same first frame and issue, but grow the complete
  // multibyte event evidence beyond the packet cap. Suspect provenance must
  // survive event omission and stay identical through every packet client.
  for(let index=0;index<6;index++){
   const captured=await json('/api/ingest/'+fixture.project,'POST',{version:1,eventId:'synthetic-spool-packet-bytes-'+index,release:current,build:'web-2',environment:'production',type:'TypeError',message:'Checkout confirmation receipt missing',
    frames:Array.from({length:30},(_,frame)=>frame===0?{file:'checkout.js',line:12,column:0,function:'confirm'}:{file:'https://example.test/'+('界'.repeat(70))+frame+'.js',line:frame+1,column:0,function:'界'.repeat(100)}),
    breadcrumbs:Array.from({length:20},()=> '界'.repeat(150))},{agent:fixture.ingestKey});
   assert.equal(captured.issue,fixture.issue,'large public captures retain the original issue identity');
  }
  const byteBounded=await json(path,'GET',undefined,agent),beforeBoundedReads=(await app.archive()).data;
  assert.ok(byteBounded.events.length>0,'the newest multibyte event still fits');
  assert.ok(byteBounded.events.length<byteBounded.bounds.eventLimit,'the byte cap omits events before the count limit');
  assert.equal(byteBounded.events[0].id,'synthetic-spool-packet-bytes-5');
  assert.equal(byteBounded.bounds.includedEvents,byteBounded.events.length);
  assert.equal(byteBounded.bounds.omittedEvents,byteBounded.bounds.availableEvents-byteBounded.events.length);
  assert.deepEqual(byteBounded.suspects,crowded.suspects,'byte pressure preserves the complete bounded suspect projection');
  assert.ok(byteBounded.gaps.some(row=>row.code==='events_omitted'&&row.omitted===byteBounded.bounds.omittedEvents));
  for(const included of byteBounded.events){
   const recorded=await json(base+'/issues/'+fixture.issue+'/events/'+included.id+'?occurrence='+encodeURIComponent(included.occurrence));
   for(const field of ['id','occurrence','received','event','atAdmission','currentLookup'])assert.deepEqual(included[field],recorded[field],'byte pressure preserves complete retained evidence: '+field);
  }
  const byteProof=await compareClients(byteBounded,client);
  console.log(`PROBE REL-002 packet byte cap: six public multibyte captures -> ${byteProof.bytes} UTF-8 bytes of ${byteProof.cap}, ${byteBounded.bounds.includedEvents} events included, ${byteBounded.bounds.omittedEvents} omitted, suspect projection unchanged across all clients`);
  assert.deepEqual((await app.archive()).data,beforeBoundedReads,'byte-bounded packet reads preserve every archived product row');
  const snapshot=await app.archive();
  let restored;
  try{
   restored=await startTestWorker(15554);const cookie=await signIn(restored.origin);
   const request=(route,method='GET',value)=>fetch(restored.origin+route,{method,headers:{Origin:restored.origin,Cookie:cookie,...value===undefined?{}:{'Content-Type':typeof value==='string'?'application/x-ndjson':'application/json','X-Confirm-Restore':'yes'}},...value===undefined?{}:{body:typeof value==='string'?value:JSON.stringify(value)}});
   const get=async(...args)=>{const response=await request(...args);assert.ok(response.ok,'restored public door '+args[0]+' HTTP '+response.status);return response.json();};
   await get('/api/restore','POST',snapshot.text);
   const restoredBefore=(await archiveProjection(await request('/api/archive'))).data,copy=await get(path);
   assert.deepEqual(copy.suspects.candidates,crowded.suspects.candidates.map(row=>({...row,deployments:row.deployments.map(deployment=>({...deployment,historical:true}))})),'restore preserves states and revisions and labels historical deployment windows');
   assert.deepEqual((await archiveProjection(await request('/api/archive'))).data,restoredBefore,'restored packet read executes no work');
   const wrong=await fetch(restored.origin+path,{headers:{Authorization:'Bearer '+grant.key}});assert.ok([401,403].includes(wrong.status),'archives grant no authority');await wrong.body?.cancel();
   for(const project of await get('/api/projects')){
    const root='/api/projects/'+project.id,plan=await get(root+'/erasure');await followErasure(get,await get(root+'/erasure','POST',{confirm:project.id,planHash:plan.planHash}));
   }
   const erased=(await archiveProjection(await request('/api/archive'))).data;
   assert.equal(erased.suspect_decisions.length,0);assert.equal((await request(path)).status,404);
   const replay=await request('/api/restore','POST',snapshot.text);assert.ok([400,409].includes(replay.status),'erased archive replay refuses');await replay.body?.cancel();
   assert.deepEqual((await archiveProjection(await request('/api/archive'))).data,erased,'archive replay cannot resurrect erased suspects');
  }finally{await restored?.stop();}
  await json(base+'/retention','POST',{cutoff:original.received+1,apply:true});
  const retainedOwner=await json(suspectPath),retained=await json(path,'GET',undefined,agent);
  assert.ok(!retained.suspects.candidates.some(row=>row.release===old));assert.ok(!JSON.stringify(retained.suspects).includes(original.occurrence));
  const first=retained.suspects.candidates[0].reason.find(row=>row.kind==='first_retained_occurrence');assert.ok(first);assert.deepEqual(first.record,retainedOwner.candidates[0].reason.find(row=>row.kind==='first_retained_occurrence').record);assert.notEqual(first.record.occurrence,original.occurrence);
  assert.ok(retained.gaps.some(row=>row.code==='retention_gap'));safe(retained);bounded(retained);
  const beforeRetainedReads=(await app.archive()).data;await compareClients(retained,client);
  assert.deepEqual((await app.archive()).data,beforeRetainedReads,'every packet client reads surviving evidence without changing it');
  await json(base+'/retention','POST',{cutoff:Date.now()+1,apply:true});
  const expired=await json(base+'/issues/'+noHistory.issue+'/packet','GET',undefined,agent);assert.deepEqual(expired.events,[]);assert.deepEqual(expired.suspects.candidates,[]);assert.match(expired.suspects.unavailable,/No retained released occurrence/);
  const beforeExpiredReads=(await app.archive()).data;await compareClients(expired,client,noHistory.issue);
  assert.deepEqual((await app.archive()).data,beforeExpiredReads,'every packet client preserves the empty retained evidence and its unavailable reason');
  const alertWithoutCommit=(await json(unlinkedPath,'GET',undefined,agent)).suspects.candidates[0];assert.equal(alertWithoutCommit.sha,null);assert.equal(alertWithoutCommit.inclusion.source,'regression_alert');assert.equal(alertWithoutCommit.inclusion.created,alertWithoutCommit.reason[0].record.received);assert.equal(alertWithoutCommit.reason[0].kind,'reactivation');
  const alertOnly=await json(path,'GET',undefined,agent);assert.ok(alertOnly.suspects.candidates.length>0);assert.ok(alertOnly.suspects.candidates.every(row=>row.reason.every(reason=>reason.kind==='reactivation')),'retention cannot invent a removed first occurrence');
  safe(alertOnly);bounded(alertOnly);
  const beforeAlertReads=(await app.archive()).data;await compareClients(alertOnly,client);
  assert.deepEqual((await app.archive()).data,beforeAlertReads,'every packet client preserves alert-only provenance without resurrecting retained occurrences');
  // A live official client has already read this exact issue. Revocation must
  // take effect on its next call, without reinitialization or cached packets.
  await json(base+'/keys/'+grant.hash,'DELETE');const afterRevocation=(await app.archive()).data;
  assert.ok([401,403].includes((await app.request(path,'GET',undefined,agent)).status));assert.equal((await cli(['packet',fixture.issue,'--format','json'],env)).code,2);
  for(const name of ['get_packet','spool.issues.read']){const refused=await client.call(name,{issue:fixture.issue});assert.equal(refused.isError,true);assert.match(refused.content[0].text,/"exitCode": 2/);assert.ok(!JSON.stringify(refused).includes(privateNote));}
  assert.deepEqual((await app.archive()).data,afterRevocation,'revoked packet reads change no archived product rows');
 }finally{await client.close();}
 console.log('PROBE REL-002 agent-packet provenance: native reactivation and judgments -> complete HTTP, CLI JSON, Markdown JSON and official MCP equality; private values excluded; multibyte byte-cap event omission preserves suspect provenance; inert restore, erased replay, complete release-only and post-retention packet equality without writes, and next-call revocation passed');
 return {candidates:3,judgments:['rejected revision 2','confirmed revision 1'],wholeClientEquality:true,lifecycleClientEquality:true,privateNotesExcluded:true,boundedOmissions:true,retention:true,inertRestore:true,erasedReplayRefused:true,nextCallRevocation:true};
}
