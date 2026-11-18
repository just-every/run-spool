import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sentryDoorClient } from '../../scripts/sentry-import.mjs';
import { startTestWorker } from '../worker.mjs';
import { signIn } from '../auth.mjs';
import { archiveProjection } from '../archive.mjs';
import { followErasure } from '../project-erasure/follow.mjs';
import { approveOnReceipt } from './rule-receipt.mjs';

function addHistoricalWindows(fixture) {
 const project=fixture.collections[0].pages[0].response[0].slug;
 const first=Math.floor(Date.now()/60000)*60000-15*60000, release='synthetic-source-version';
 fixture.window={start:new Date(first).toISOString(),end:new Date(first+15*60000).toISOString()};
 const stamp=(minutes,offset=0)=>new Date(first+minutes*60000+offset).toISOString();
 const collection=(kind,project,response)=>({kind,project,pages:[{cursor:null,nextCursor:null,response}]});
 fixture.collections.find(row=>row.kind==='releases').pages[0].response=[{version:release,dateCreated:stamp(0),projects:[{slug:project}]}];
 fixture.collections.push(
  collection('issues',project,[{id:'synthetic-issue',title:'Synthetic imported error',status:'unresolved',firstSeen:stamp(1),lastSeen:stamp(11)}]),
  collection('events',project,[1,5,1].flatMap((count,window)=>Array.from({length:count},(_,index)=>{
   const dateCreated=stamp(1+5*window,index*100);
   return {eventID:(window*10+index+1).toString(16).padStart(32,'0'),groupID:'synthetic-issue',release,dist:'synthetic-source',
    environment:'production',dateCreated,entries:[{type:'exception',data:{values:[{type:'Error',value:'Synthetic imported error',
     rawStacktrace:{frames:[{filename:'src/synthetic.js',lineNo:5,colNo:1,function:'synthetic'}]}}]}}]};
  }))),
 );
}

async function destinationBindings(fixture, apply, json, request) {
 const bundle=structuredClone(fixture);
 bundle.organization.slug='synthetic-alerts-targets';
 bundle.collections=bundle.collections.filter(collection=>['projects','releases','rules'].includes(collection.kind));
 const project=bundle.collections[0].pages[0].response[0],dateCreated=project.dateCreated;
 const team={id:'synthetic-team-1',slug:'synthetic-oncall',name:'Synthetic on call',dateCreated,projects:[{slug:project.slug}]};
 const member={id:'synthetic-member-1',email:'synthetic-alert-recipient@example.test',name:'Synthetic recipient',
  orgRole:'member',pending:false,expired:false,dateCreated,user:{id:'synthetic-user-1'}};
 const collection=(kind,response,extra={})=>({kind,project:null,pages:[{cursor:null,nextCursor:null,response}],...extra});
 bundle.collections.push(collection('teams',[team]),collection('members',[member]),collection('team-members',[{id:member.id,teamRole:'member'}],{team:team.slug}));
 const sourceRule=bundle.collections.find(c=>c.kind==='rules').pages[0].response[0];
 bundle.collections.find(c=>c.kind==='rules').pages[0].response=[
  ['Synthetic member target','Member',member.user.id],
  ['Synthetic team target','Team',team.id],
  ['Synthetic missing member','Member','synthetic-unmapped'],
 ].map(([name,targetType,targetIdentifier],i)=>({...sourceRule,id:'synthetic-target-rule-'+i,name,actions:[{
  id:'sentry.mail.actions.NotifyEmailAction',targetType,targetIdentifier,
 }]}));
 const run=await apply(bundle);
 await json('/api/organization','POST',{id:'synthetic-alert-organization',name:'Synthetic alerts organization'});
 const roster=(await json('/api/organization/imports')).proposals;
 const proposal=roster.find(row=>row.kind==='member'&&row.project===run.project);
 assert.ok(proposal);
 const invitation=await json('/api/organization/imports/'+proposal.id+'/invite','POST',{version:proposal.version});
 const directory=await json('/api/organization');
 const pending=directory.invites.find(row=>row.member===invitation.id);
 assert.ok(pending?.localLink,'the owner can open their authorized local invitation');
 const response=await request('/auth/confirm','POST',{token:new URL(pending.localLink).searchParams.get('token')},{Cookie:''},'manual');
 assert.equal(response.status,303,'the native invitee activates their own identity');
 await response.body?.cancel();
 await json('/api/organization/projects/'+run.project,'PUT',{team:team.slug});
 await json(run.approve,'POST',{fingerprint:run.planned.fingerprint});
 const rules=await json(run.root+'/alerting/rules'),destinations=(await json(run.root+'/alerting/destinations')).rows;
 for(const [name,targetType,target] of [['Synthetic member target','member',invitation.id],['Synthetic team target','team',team.slug]]){
  const rule=rules.find(row=>row.name===name),destination=destinations.find(row=>row.id===rule.destination);
  assert.equal(rule.enabled,1);
  assert.deepEqual([destination.targetType,destination.target,destination.fallthrough],[targetType,target,'no_one']);
 }
 assert.equal(rules.find(row=>row.name==='Synthetic missing member').enabled,0);
 assert.equal((await json(run.root+'/alerting/deliveries')).length,0);
 return {bound:2,unmapped:1};
}

export async function alertRulesImport() {
 const fixture=JSON.parse(await readFile(new URL('../fixtures/sentry/alert-rules.json',import.meta.url)));
 addHistoricalWindows(fixture);
 const bytes=Buffer.from(JSON.stringify(fixture)), app=await startTestWorker(15525);
 const expectedProposals=10;
 const waitingNames=['Synthetic crash-free sessions','Synthetic session count','Synthetic session failure rate','Synthetic unique users'];
 const {origin}=app, history='/api/imports/business', packet=process.env.SPOOL_ALERT_IMPORT_PACKET;
 try {
  const cookie=await signIn(origin);
  const request=(path,method='GET',body,headers={},redirect='follow')=>fetch(origin+path,{method,redirect,headers:{
   Origin:origin,Cookie:cookie,Connection:'close',...body?{'Content-Type':'application/json'}:{},...headers,
  },...body?{body:JSON.stringify(body)}:{}});
  const json=async(...args)=>{
   const response=await request(...args);
   assert.ok(response.ok,`${args[1]??'GET'} ${args[0]}: ${response.status} ${await response.clone().text()}`);
   return response.json();
  };
  const client=organization=>sentryDoorClient({endpoint:origin,cookie,organization});
  const snapshot=async()=>archiveProjection(await request('/api/archive'));
  const before=(await snapshot()).data;
  async function apply(bundle){
   const door=client(bundle.organization.slug), data=Buffer.from(JSON.stringify(bundle));
   const planned=await door.plan(data);
   assert.ok((await door.apply(planned.planId,planned.fingerprint)).job.state==='completed');
   const project=(await door.status(planned.planId)).projectIds[0];
   return {door,planned,project,root:'/api/projects/'+project,approve:history+'/'+planned.planId+'/alert-rules'};
  }
  const noWrite=await client(fixture.organization.slug).plan(bytes);
  assert.deepEqual((await snapshot()).data,before,'review has no native side effects');
  assert.equal(noWrite.rejected.length,1,'a malformed rule is refused');
  assert.equal(noWrite.sentry.rules.items.filter(row=>row.state==='proposed').length,expectedProposals);
  assert.equal((await client(fixture.organization.slug).call('undo',{planId:noWrite.planId})).state,'cancelled');
  const run=await apply(fixture), {door,planned,root,approve,project}=run;
  const facts=()=>door.status(planned.planId);
  const rules=()=>json(root+'/alerting/rules');
  assert.deepEqual(await rules(),[]);
  assert.deepEqual(await json(root+'/alerts'),[]);
  assert.equal((await facts()).sentry.rules.pending,expectedProposals);
  assert.equal((await request(approve,'POST',{fingerprint:planned.fingerprint},{Cookie:''})).status,401);
  assert.equal((await request(approve,'POST',{fingerprint:planned.fingerprint},{Origin:'https://other.example.test'})).status,403);
  assert.equal((await request(approve,'POST',{fingerprint:'0'.repeat(64)})).status,409);

  const definitions=fixture.collections.filter(c=>['rules','metric_alerts','workflows'].includes(c.kind))
   .flatMap(c=>c.pages.flatMap(page=>page.response.map(rule=>rule.name)));
  await approveOnReceipt({origin,cookie,project,definitions,output:packet??'.artifacts/sentry-import-alerts'});

  const states=(await facts()).sentry.rules;
  const native=await rules(), byName=name=>native.find(rule=>rule.name===name);
  assert.equal(states.created,expectedProposals);
  assert.equal(states.pending,0);
  assert.deepEqual(states.items.filter(row=>row.state==='waiting').map(row=>row.name).sort(),
   [...waitingNames].sort());
  assert.equal(byName('Synthetic Slack').enabled,0);
  assert.match(states.items.find(row=>row.name==='Synthetic Slack').status,/Slack/);
  assert.equal(byName('Synthetic unrepresentable aggregate').enabled,0);
  assert.ok(states.items.find(row=>row.name==='Synthetic unrepresentable aggregate').omissions.some(row=>row.path.endsWith('/aggregate')&&row.reason.includes('histogram')));
  assert.deepEqual(JSON.parse(byName('Synthetic error thresholds').config).triggers.map(t=>t.alertThreshold),[4,2]);
  assert.equal(JSON.parse(byName('Synthetic error thresholds').config).resolveThreshold,0);
  assert.deepEqual(await json(approve,'POST',{fingerprint:planned.fingerprint}),{created:expectedProposals});
  assert.deepEqual(await rules(),native,'repeated approval preserves the native rules');
  assert.deepEqual(await json(root+'/alerting/deliveries'),[]);
  assert.deepEqual(await json(root+'/alerts'),[]);
  const threshold=byName('Synthetic error thresholds');
  const previewInput={ruleId:threshold.id,revision:threshold.revision,name:threshold.name,enabled:true,channel:threshold.channel,
   destination:threshold.destination,kinds:JSON.parse(threshold.kinds),windowMs:threshold.window_ms,
   threshold:threshold.threshold,config:JSON.parse(threshold.config)};
  const historical=await json(root+'/alerting/rules/preview','POST',{...previewInput,windowMs:3600000});
  const historicalEvents=(await snapshot()).data.events.filter(row=>row.project===project&&row.historical===1);
  assert.equal(historicalEvents.length,7);
  assert.ok(historicalEvents.every(row=>row.received>=historical.window.from&&row.received<historical.window.to));
  assert.equal(historical.matchedEvents,0,'imported normal, burst and recovery occurrences are excluded from live alert evaluation');
  assert.deepEqual(await json(root+'/alerting/deliveries'),[],'reviewing history adds no delivery');
  assert.ok((await json('/api/audit/export?format=json')).rows.some(row=>row.action==='import.apply'&&row.subject_kind==='import'&&row.source==='transaction'));
  assert.equal((await door.apply(planned.planId,planned.fingerprint)).job.state,'completed');

  const undoBundle=structuredClone(fixture);
  undoBundle.organization.slug='synthetic-alerts-undo';
  const undone=await apply(undoBundle);
  await json(undone.approve,'POST',{fingerprint:undone.planned.fingerprint});
  assert.equal((await undone.door.undo(undone.planned.planId)).job.state,'undone');
  assert.ok(!(await json('/api/projects')).some(p=>p.id===undone.project),'guarded undo removes both unchanged rules and their project');
  const edited=byName('Synthetic new issue');
  await json(root+'/alerting/rules/'+edited.id,'PUT',{revision:edited.revision,name:'Locally revised synthetic rule',enabled:false,
   channel:edited.channel,destination:edited.destination,kinds:JSON.parse(edited.kinds),windowMs:edited.window_ms,
   threshold:edited.threshold,config:JSON.parse(edited.config)});
  await assert.rejects(door.undo(planned.planId),error=>error.status===409&&error.code==='native_edit_conflict');
  assert.equal((await rules()).find(row=>row.id===edited.id).name,'Locally revised synthetic rule');

  const key=await json(root+'/keys','POST',{kind:'ingest'});
  await json(root+'/releases','POST',{name:'synthetic-v1',build:'synthetic-build'});
  const dsn=new URL(key.dsn);
  const send=async(type,body)=>{
   const response=await fetch(origin+'/api'+dsn.pathname+'/envelope/?sentry_version=7&sentry_key='+encodeURIComponent(dsn.username),{
    method:'POST',body:'{}\n'+JSON.stringify({type})+'\n'+JSON.stringify(body),headers:{Connection:'close'},
   });
   assert.equal(response.status,200,await response.clone().text());
   return response.json();
  };
  const policy={id:'hash',email:'drop',username:'drop',ip_address:'drop'};
  const policyRoot=root+'/identity-policy';
  const raised=await json(policyRoot+'/preview','POST',{policy});
  await json(policyRoot,'PUT',{policy,revision:raised.revision,token:raised.token});
  const now=Date.now();
  const tick=async(time)=>{const response=await app.scheduled(time);assert.equal(response.status,200);assert.equal((await response.json()).outcome,'ok');};
  await tick(now);
  assert.equal((await facts()).sentry.rules.items.filter(row=>row.state==='waiting').length,waitingNames.length,'quiet scheduling leaves the rules waiting');
  const event=(environment,user)=>send('event',{
   event_id:crypto.randomUUID().replaceAll('-',''),release:'synthetic-v1',dist:'synthetic-build',environment,
   ...user?{user:{id:user}}:{},
   sdk:{name:'synthetic-spool',version:'1'},
   exception:{values:[{type:'Error',value:'Synthetic import alert observation',stacktrace:{frames:[
    {filename:'https://synthetic-spool.test/alert.js',function:'synthetic',lineno:1,colno:1},
   ]}}]},
  });
  await event('nonmatching','synthetic-client-one');
  await event('production',null);
  await tick(Date.now());
  assert.equal((await facts()).sentry.rules.items.filter(row=>row.state==='waiting').length,waitingNames.length,
   'an unattributed or nonmatching event leaves the dependent rules waiting');
  await event('production','synthetic-client-two');
  const stamp=new Date().toISOString();
  await send('session',{sid:crypto.randomUUID().replaceAll('-',''),started:stamp,timestamp:stamp,status:'crashed',errors:1,
   attrs:{release:'synthetic-v1',environment:'production'}});
  const end=(Math.floor(Date.now()/60000)+1)*60000;
  await tick(end);
  const after=await rules(), activated=after.filter(row=>waitingNames.includes(row.name));
  assert.ok(activated.every(row=>row.enabled===1&&row.revision===1),'matching evidence activates both existing rules without a new revision');
  const feed=await json(root+'/alerts');
  for(const name of waitingNames.slice(0,3)) {
   assert.equal(feed.filter(row=>row.kind==='metric'&&JSON.parse(row.payload).rule.id===byName(name).id).length,1,
    'one observed breach belongs to each session metric');
  }
  const replay=await json(root+'/alerting/rules/preview','POST',previewInput);
  assert.ok(replay.decisions.length);
  assert.deepEqual(await json(root+'/alerts'),feed,'preview never adds an alert to the live feed');
  await app.restart();
  await tick(end);
  assert.deepEqual(await json(root+'/alerts'),feed,'a restarted Worker does not duplicate alert evaluation');
  assert.deepEqual(await json(root+'/alerting/deliveries'),[],'new local observations do not send to an unbound destination');

  const archive=await snapshot();
  assert.ok(archive.data.alert_rules.filter(row=>row.project===project).every(row=>row.enabled===0),'portable rules are inert');
  const preview=await json(root+'/erasure');
  const start=await json(root+'/erasure','POST',{confirm:project,planHash:preview.planHash});
  const erased=await followErasure((path,method)=>json(path,method),start);
  assert.equal(erased.phase,'complete');
  assert.ok(!(await snapshot()).data.spool_import_proposals.some(row=>row.project===project));
  assert.ok(!(await snapshot()).data.alert_rules.some(row=>row.project===project));
  const bindings=await destinationBindings(fixture,apply,json,request);
  if(packet)await writeFile(join(packet,'ALERT-IMPORT-RECEIPT.json'),JSON.stringify({
   synthetic:true,at:new Date().toISOString(),sourceDefinitions:states.sourceDefinitions,proposals:expectedProposals,created:states.created,
   refused:states.notImported,waiting:activated.length,alertsAfterObservation:feed.length,deliveries:0,erasure:erased.phase,bindings,
  },null,2)+'\n');
  console.log('Sentry alert import: public proposal, approval, wait, restart, native-edit undo refusal and erasure journey passed.');
 } finally {
  await app.stop();
 }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await alertRulesImport();
