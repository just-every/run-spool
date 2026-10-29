import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {run} from './runtimes/harness.mjs';
import {archiveProjection} from './archive.mjs';
import {followErasure} from './project-erasure/follow.mjs';

// Invoked by the packed-package journey: the SDK a buyer installs, against public doors.
export async function nativeSessionFlow({origin,cookie,request,app,browser,appOrigin,sessionConfig}) {
 const headers={Cookie:cookie,Origin:origin};
 const project=await request('/api/projects','POST',{id:'synthetic-spool-native-health',name:'Native SDK health'}),root='/api/projects/'+project.id;
 const config={endpoint:origin,project:project.id,ingestKey:project.ingestKey,release:'synthetic-spool-native@1',build:'synthetic-spool-1',environment:'production',client:'synthetic-spool-native-user-1',sessions:true};
 await request(root+'/releases','POST',{name:config.release,build:config.build});
 const node=async(mode,extra={})=>{
  await writeFile(resolve(app,'session-health.mjs'),`import {init} from '@just-every/spool/node';
const client=init(${JSON.stringify({...config,...extra})});
${mode==='crash'?"setTimeout(()=>{throw new Error('synthetic-spool-native-crash')},0);":mode==='handled'?"await client.captureException(new Error('synthetic-spool-native-handled'));":''}
`);
  const result=await run(process.execPath,[resolve(app,'session-health.mjs')]);
  assert.equal(result.code,mode==='crash'?1:0,result.stderr);
 };
 await node('healthy');await node('handled');await node('crash');
 await node('healthy',{sessions:false});await node('healthy',{sessionSampleRate:0});
 let report=await request(root+'/release-health');
 assert.equal(report.denominators.sessionsSeen,3,'only opted-in, sampled processes create observed sessions');
 assert.equal(report.rows[0].crashed,1);assert.equal(report.rows[0].activeSessions,0,'healthy process exit finishes its session');
 assert.equal(report.rows[0].crashFreeSessions,2);assert.equal(report.rows[0].usersSeen,1);assert.equal(report.rows[0].crashFreeUsers,0);

 const browserRelease='synthetic-spool-native@2';
 await request(root+'/releases','POST',{name:browserRelease,build:config.build});
 await request(root+'/browser-origins','POST',{origin:appOrigin});
 sessionConfig.value={...config,release:browserRelease,client:'synthetic-spool-browser-user-1'};
 for(const crash of [false,true]) {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  try {
   await page.goto(appOrigin+'/sessions');
   await page.waitForFunction(()=>window.__client);
   assert.equal((await page.evaluate(()=>window.__client.flushSessions())).outcome,'accepted','the browser session crosses native CORS preflight');
   if(crash){await page.getByRole('button',{name:'Throw',exact:true}).click();await page.waitForFunction(()=>window.__sessionOutcomes.some(r=>r.reason==='session_stored')&&window.__pageCrashed)}
   // Close settles the observation before the page is torn down; a duplicate flush adds no exposure.
   await page.evaluate(async()=>{window.__client.close();await window.__client.flushSessions();await window.__client.flushSessions()});
  } finally {await page.close()}
 }
 report=await request(root+'/release-health');
 const web=report.rows.find(r=>r.release===browserRelease);
 assert.equal(web.sessions,2);assert.equal(web.unhandled,1);assert.equal(web.crashed,0,'a browser exception is not a process crash');
 assert.equal(web.crashFreeSessions,1);assert.equal(web.crashFreeUserRate,0);assert.equal(web.adoptionShare,2/5);

 const offline=await browser.newPage({viewport:{width:1440,height:1000}}),sessionPath='**/api/ingest/'+project.id+'/sessions';
 try {
  await offline.route(sessionPath,route=>route.abort());
  await offline.goto(appOrigin+'/sessions');await offline.waitForFunction(()=>window.__client);
  assert.equal((await offline.evaluate(()=>window.__client.flushSessions())).outcome,'unknown');
  assert.equal((await request(root+'/release-health')).denominators.sessionsSeen,5,'an undelivered observation never invents healthy exposure');
  await offline.unroute(sessionPath);
  const recovered=await offline.evaluate(async()=>{window.__client.close();return window.__client.flushSessions()});
  assert.equal(recovered.outcome,'accepted');
  assert.equal((await request(root+'/release-health')).denominators.sessionsSeen,6,'fresh delivery observes one SID after an offline gap');
 } finally {await offline.close()}

 const {startSession,captureException}=await import(pathToFileURL(resolve(app,'node_modules/@just-every/spool/dist/worker.js')).href);
 const observed=[],workerConfig={...config,release:'synthetic-spool-native@3',onSessionOutcome:r=>observed.push(r)};
 const healthy=startSession(workerConfig),failed=startSession(workerConfig);
 assert.equal((await healthy.end()).outcome,'accepted');assert.equal((await failed.recordError(true)).outcome,'accepted');
 await failed.end();await healthy.end();
 report=await request(root+'/release-health');
 const edge=report.rows.find(r=>r.release===workerConfig.release);
 assert.equal(edge.sessions,2);assert.equal(edge.crashed,1);assert.equal(edge.crashFreeSessionRate,0.5);
 const auto=(await request(root+'/releases')).find(r=>r.name===workerConfig.release),installed=JSON.parse(await readFile(resolve(app,'node_modules/@just-every/spool/package.json'),'utf8'));
 assert.equal(auto.auto_created,1);assert.equal(JSON.parse(auto.creating_sdk).version,installed.version,'automatic session releases keep the SDK artifact identity');
 assert.ok(observed.every(r=>r.outcome==='accepted'));
 assert.equal((await request(root+'/issues')).reduce((n,r)=>n+r.count,0),3,'session observations add no error occurrence or accepted-error unit');
 const exported=await fetch(origin+root+`/release-health?from=${report.window.from}&to=${report.window.to}&download=1`,{headers});
 assert.ok(exported.headers.get('content-disposition'));
 const snapshot=await exported.json();assert.deepEqual(snapshot,report);
 assert.equal(snapshot.denominators.sessionsSeen,8);
 assert.ok(snapshot.rows.every(r=>r.sessionInterval&&r.userInterval),'observed session and known-user uncertainty is retained');

 const rawSession={sid:crypto.randomUUID().replaceAll('-',''),started:Date.now()/1000,status:'exited',attrs:{release:config.release,environment:'production'}};
 const intake=(key,value=rawSession,projectId=project.id)=>fetch(origin+'/api/ingest/'+projectId+'/sessions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(value)});
 const foreign=await request('/api/projects','POST',{id:'synthetic-spool-native-foreign',name:'Foreign native sessions'});
 const revoked=await request(root+'/keys','POST',{kind:'ingest'});await request(root+'/keys/'+revoked.hash,'DELETE');
 const before=await request(root+'/outcomes'),foreignBefore=await request('/api/projects/'+foreign.id+'/outcomes');
 for(const key of ['synthetic-spool-invalid',foreign.ingestKey,revoked.key]) {
  const denied=await intake(key);assert.equal(denied.status,401);await denied.body.cancel();
 }
 assert.deepEqual(await request(root+'/outcomes'),before,'unauthorized native sends attribute no project counters');
 assert.deepEqual(await request('/api/projects/'+foreign.id+'/outcomes'),foreignBefore);
 const invalid=await intake(project.ingestKey,{});assert.equal((await invalid.json()).reason,'session_invalid');
 const huge=await intake(project.ingestKey,{...rawSession,padding:'x'.repeat(102401)});assert.equal((await huge.json()).reason,'session_item_too_large');
 const policy=await request(root+'/inbound-filters');policy.policy.filters.environments={...policy.policy.filters.environments,enabled:true,values:['synthetic-spool-filtered']};
 await request(root+'/inbound-filters','PUT',{revision:policy.revision,policy:policy.policy});
 const filtered=await intake(project.ingestKey,{...rawSession,attrs:{...rawSession.attrs,environment:'synthetic-spool-filtered'}});
 assert.equal((await filtered.json()).reason,'session_filtered');
 assert.equal((await request(root+'/release-health')).denominators.sessionsSeen,8,'invalid, oversized and filtered items create no exposure');
 const audit=(await request('/api/audit/export?format=json')).rows.filter(r=>r.action==='capture.native');
 assert.ok(audit.some(r=>r.actor_kind==='ingest'&&r.subject_kind==='project'&&r.outcome==='succeeded'),'native session actions have safe project audit facts');
 assert.ok(audit.some(r=>r.actor_kind==='anonymous'&&r.outcome==='denied'),'revoked native attempts have truthful denied facts');
 const archive=await archiveProjection(await fetch(origin+'/api/archive',{headers}));
 const sessionCustody=JSON.stringify(archive.data.health_sessions);
 assert.ok(!sessionCustody.includes(config.client)&&!sessionCustody.includes(sessionConfig.value.client),'session custody retains keyed identifiers, apart from native error install identifiers');
 assert.ok(!JSON.stringify(snapshot).includes(config.client)&&!JSON.stringify(snapshot).includes('user_hash'),'health exports expose counts only');
 assert.equal(archive.data.health_sessions.filter(r=>r.project===project.id).length,8);

 const dsn=new URL(project.dsn),envelopePath=dsn.origin+'/api'+dsn.pathname+'/envelope/?sentry_version=7&sentry_key='+dsn.username;
 let limited,seconds,extraSessions=0;
 for(let batch=0;batch<40&&!limited;batch++) {
  const response=await fetch(envelopePath,{method:'POST',body:'{}\n'+Array.from({length:100},()=>'{"type":"session"}\n'+JSON.stringify(rawSession)).join('\n')});
  assert.equal(response.status,200);const header=response.headers.get('X-Sentry-Rate-Limits');await response.body.cancel();
  if(!header)continue;
  seconds=Number(header.split(':')[0]);assert.ok(seconds>=1&&seconds<=60);
  const probe=startSession(config),receipt=await probe.flush();
  if(receipt.outcome==='dropped'){assert.equal(receipt.reason,'session_rate_limited');limited=probe}
  else {assert.equal(receipt.outcome,'accepted');extraSessions++;await probe.end()}
 }
 assert.ok(limited,'native and Sentry observations share the real project-minute bucket');
 const saturated=await request(root+'/outcomes');
 assert.equal((await limited.recordError(true)).reason,'session_rate_limited');
 await limited.end();
 assert.deepEqual(await request(root+'/outcomes'),saturated,'cached native backoff suppresses requests without inventing server refusals');
 const kept=[];assert.equal((await captureException(new Error('synthetic-spool-error-during-session-backoff'),config,{waitUntil:p=>kept.push(p)})).outcome,'accepted');
 await Promise.all(kept);
 assert.equal((await request(root+'/issues')).reduce((n,r)=>n+r.count,0),4,'native companion error capture continues during session backoff');
 assert.equal((await request(root+'/release-health')).denominators.sessionsSeen,9+extraSessions,'refused native sessions add no exposure');
 await new Promise(done=>setTimeout(done,(seconds+1)*1000));
 const recovered=startSession(config);assert.equal((await recovered.end()).outcome,'accepted');
 assert.equal((await request(root+'/release-health')).denominators.sessionsSeen,10+extraSessions,'a fresh native session recovers after the deadline');
 const afterRecovery=await request(root+'/outcomes');
 const count=(outcomes,reason)=>outcomes.rows.find(row=>row.reason===reason)?.count??0;
 assert.equal(count(afterRecovery,'session_rate_limited'),count(saturated,'session_rate_limited'),'recovery adds no new refusal');
 const plan=await request(root+'/erasure');assert.equal(plan.deleted.health_sessions,10+extraSessions);
 await followErasure(request,await request(root+'/erasure','POST',{confirm:project.id,planHash:plan.planHash}));
 const replay=await intake(project.ingestKey);assert.equal(replay.status,401);await replay.body.cancel();
 console.log('[SDK-005] packed native Node, browser and Worker sessions, healthy and fatal boundaries, opt-in and sampling, known-user rates, exports, authority, filters, archive privacy and erasure replay passed');
}
