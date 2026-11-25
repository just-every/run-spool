import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {authBindings,signIn} from './auth.mjs';
import {migrationEvidence} from './migration-evidence.mjs';

// A small company runs Spool on Workers Free, where every tool on the account shares 5,000,000 D1 rows read a day.
// The real Worker entry runs over a migrated local D1 holding 30 days of history at the default retention; its
// binding adds D1's own meta.rows_read per statement. A minute cron, an open issue list and an event's intake must
// cost the same rows whatever the history holds, so the steady cost is measured at 30 days kept and again at the full 89.
const require=createRequire(import.meta.url);
const {Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler/package.json')]}));
const {unstable_splitSqlQuery}=require('wrangler');
const esbuild=require('esbuild');
const documentStub={name:'document-stub',setup(build){
 build.onResolve({filter:/^@tanstack\/react-start\/server-entry$/},()=>({path:'document',namespace:'stub'}));
 build.onResolve({filter:/^virtual:spool-docs$/},()=>({path:'docs',namespace:'stub'}));
 build.onLoad({filter:/^docs$/,namespace:'stub'},()=>({loader:'js',contents:"export const repository='';export default {repository:'',sections:[],pages:[]}"}));
 build.onLoad({filter:/^document$/,namespace:'stub'},()=>({loader:'js',contents:"export default {fetch:async()=>new Response('<!doctype html><title>Spool</title>',{headers:{'content-type':'text/html'}})}"}));
}};
const script=(await esbuild.build({entryPoints:['tests/d1-budget/metered-entry.mjs'],bundle:true,write:false,format:'esm',platform:'neutral',target:'es2022',conditions:['workerd','worker','browser'],mainFields:['module','main'],external:['cloudflare:*','node:*'],plugins:[documentStub,migrationEvidence],loader:{'.sql':'text'},logLevel:'error'})).outputFiles[0].text;

const minute=60000,day=1440*minute,freeDailyReads=5_000_000;
// Ceilings, generous against the measured cost and far below what a history-sized read would take.
const steadyTickCeiling=800,firstTickCeiling=40_000,unchangedPollCeiling=40,intakeCeiling=1_000,dailyShareCeiling=0.2;
const project='web',port=15491,origin=`http://127.0.0.1:${port}`;

// One installation with 100 events a day kept for `days` days and its audit history, a due day of retention, a 24-hour
// error-count rule, a one-minute baseline rule, 100 delivered alerts awaiting acknowledgement and 300 projected mail
// receipts: its first run, ten steady minute runs, the issue list read once and then polled unchanged, and two events.
async function installation(days){
 const directory=await mkdtemp(resolve(tmpdir(),'spool-d1-budget-'));
 const mf=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port,defaultPersistRoot:directory,modules:true,script,compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'spool-d1-budget'},bindings:{...authBindings(origin),MAIL_PROVIDER:'development'}}));
 try{
  await mf.ready;
  const db=await mf.getD1Database('DB'),worker=await mf.getWorker();
  for(const file of (await readdir('migrations/core')).filter(f=>f.endsWith('.sql')).sort()){
   const queries=unstable_splitSqlQuery(await readFile(resolve('migrations/core',file),'utf8')).filter(sql=>!/^PRAGMA foreign_keys\s*=\s*ON;?$/i.test(sql.trim()));
   await db.batch(queries.map(sql=>db.prepare(sql)));
  }
  const cookie=await signIn(origin);
  const request=(path,{method='GET',body,headers={}}={})=>fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,Connection:'close',Cookie:cookie,...body?{'Content-Type':'application/json'}:{},...headers},...body?{body:JSON.stringify(body)}:{}});
  const created=await request('/api/projects',{method:'POST',body:{id:project,name:'Web'}});assert.equal(created.status,201);const {ingestKey:key}=await created.json();
  const meter=async()=>{const report=await (await fetch(origin+'/__d1_meter?reset=1',{headers:{Connection:'close'}})).json();assert.equal(report.unmetered,0,'every D1 statement reports its rows read');return report.rows};
  const tick=async time=>{await meter();const result=await worker.scheduled({scheduledTime:new Date(time),cron:'* * * * *'});assert.equal(result.outcome,'ok');return meter()};
  const poll=async etag=>{await meter();const response=await request(`/api/projects/${project}/issues`,{headers:etag?{'If-None-Match':etag}:{}});const body=await response.text();return {status:response.status,etag:response.headers.get('ETag'),rows:await meter(),body}};

  const now=Math.floor(Date.now()/minute)*minute,write=async list=>{for(let i=0;i<list.length;i+=500)await db.batch(list.slice(i,i+500))};
  const q=(sql,...values)=>db.prepare(sql).bind(...values),issue=i=>(i+1).toString(16).padStart(64,'0');
  let sequence=0;
  // Twenty issues, events in arrival order spread evenly from start to end, an SDK discard count on every seventh.
  const history=async(count,start,end)=>{
   const rows=[];for(let i=0;i<20;i++)rows.push(q("INSERT OR IGNORE INTO issues(id,project,fingerprint,algorithm,title,state,count,first_seen,last_seen) VALUES(?,?,?,'js-frame-v1',?,'open',0,?,?)",issue(i),project,'f'+i,'Error: boom '+i,start,end));
   for(let k=0;k<count;k++){const n=sequence++,i=n%20,release='r'+Math.floor(n/500);
    rows.push(q("INSERT INTO events(id,project,issue,release,release_seq,build,environment,payload,digest,diagnostic,received,occurrence,historical) VALUES(?,?,?,?,1,'b1','production',?,'d','{}',?,?,0)",
     n.toString(16).padStart(32,'0'),project,issue(i),release,JSON.stringify({version:1,type:'Error',message:'boom '+i,frames:[],breadcrumbs:[],...n%7?{}:{dropped:2},padding:'x'.repeat(400)}),Math.floor(start+k*(end-start)/count),crypto.randomUUID()));}
   await write(rows);
   await db.prepare('UPDATE issues SET count=(SELECT COUNT(*) FROM events WHERE issue=issues.id),last_seen=?').bind(end).run();
  };
  // Part of a day past the 90-day default, one scheduled batch of it, is due for retention.
  await history(50,now-91*day,now-90*day-minute);
  await history(100*days,now-days*day,now-minute);
  // Its audit: each issue's capture facts, a retention gap a day and owner triage, 60 rows a day.
  const facts=[];for(let i=0;i<20;i++)for(const kind of ['capture_history_started','capture_unsuppressed'])facts.push(q('INSERT INTO audit VALUES(?,?,?,json_object(\'issue\',?),?)',kind+i,project,kind,issue(i),now-days*day));
  for(let d=0;d<days;d++){facts.push(q("INSERT INTO audit VALUES(?,?,'retention_gap',json_object('cutoff',?,'removed',100,'dedupHorizon',?),?)",'gap'+d,project,now-(90+d)*day,now-(90+d)*day,now-d*day));
   for(let t=0;t<59;t++)facts.push(q("INSERT INTO audit VALUES(?,?,'triage',json_object('issue',?,'state','acknowledged','revision',1),?)",`triage${d}-${t}`,project,issue(t%20),now-d*day-t*minute));}
  const context=q("INSERT INTO audit_context(slot,actor_kind,actor_label,action,subject_kind,subject_label,project_label,created) VALUES(1,'service',?,'issue.triage','issue',?,NULL,?)",'audit:'+'a'.repeat(32),'audit:'+'b'.repeat(32),now);
  for(let i=0;i<facts.length;i+=400)await db.batch([context,...facts.slice(i,i+400),q('DELETE FROM audit_context')]);
  await write([
   q("INSERT INTO alert_rules VALUES('metric-rule',?,1,'Errors per day',1,'mail','dest',?,?,2,?,?)",project,JSON.stringify(['metric']),day,now-day,now-day),
   q('INSERT INTO alert_rule_configs VALUES(?,?,1,?)','metric-rule',project,JSON.stringify({metric:'aggregate',dataset:'errors',aggregate:'count',query:{},filters:{},thresholdType:'above',triggers:[{label:'critical',alertThreshold:1e9}],resolveThreshold:null,tagKeys:[]})),
   q("INSERT INTO alert_rules VALUES('quiet-rule',?,1,'Quiet',0,'mail','dest',?,3600000,10000,?,?)",project,JSON.stringify(['spike']),now-day,now-day),
   q("INSERT INTO alert_rules VALUES('baseline-rule',?,1,'Baseline',1,'mail','dest',?,60000,2,?,?)",project,JSON.stringify(['spike']),now-day,now-day),
   q('INSERT INTO alert_rule_configs VALUES(?,?,1,?)','baseline-rule',project,JSON.stringify({metric:'baseline',filters:{},tagKeys:[]})),
   q('INSERT INTO alert_cursors(rule_id,project,revision,next_start) VALUES(?,?,1,?)','baseline-rule',project,now-minute),
   q("INSERT INTO follow_up_settings(project,destination,channel,updated) VALUES(?,'dest','mail',?)",project,now-day),
   ...Array.from({length:100},(_,k)=>[
    q("INSERT INTO alerts(id,project,issue,kind,created,payload) VALUES(?,?,?,'new_issue',?,'{}')",'alert'+k,project,issue(k%20),now-2*day),
    q("INSERT INTO alert_history(id,project,alert_id,rule_id,rule_revision,channel,destination,state,attempts,created,updated) VALUES(?,?,?,'quiet-rule',1,'mail','dest','accepted',1,?,?)",'delivery'+k,project,'alert'+k,now-2*day,now-2*day),
   ]).flat(),
   ...Array.from({length:300},(_,k)=>[
    q("INSERT INTO rer_mail_event_receipts(provider,tenant_id,event_namespace,event_id,fingerprint,event_json,commit_token,ordinal) VALUES('sendgrid','spool',?,?,?,?,'c',?)",project,'receipt'+k,'f'+k,JSON.stringify({eventId:'receipt'+k,eventNamespace:project,deliveryId:'delivery'+k,type:'delivered',status:'accepted',occurredAt:now-day}),k),
    q("INSERT INTO alert_provider_events VALUES(?,?,?,'delivered','accepted',?,'sendgrid')",'receipt'+k,project,'delivery'+k,now-day),
   ]).flat(),
  ]);

  // The first run removes the due day, measures the rule and opens the backlog; a second settles the last of it.
  const first=await tick(now);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM events WHERE received<?').bind(now-90*day).first()).n,0,'retention removed the due day');
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM follow_up_attention WHERE state<>'completed'").first()).n,100,'the backlog is open');
  await tick(now+minute);
  const steady=[];for(let m=2;m<=11;m++)steady.push(await tick(now+m*minute));
  const listed=await poll(),unchanged=await poll(listed.etag);
  assert.equal(listed.status,200);assert.ok(listed.etag,'the issue list names its version');assert.equal(JSON.parse(listed.body).length,20);
  assert.equal(unchanged.status,304,'an unchanged list answers its poll without a body');
  const added=await request('/api/projects/'+project+'/issues/'+issue(0),{method:'PATCH',body:{state:'acknowledged',revision:JSON.parse(listed.body).find(row=>row.id===issue(0)).revision}});
  assert.equal(added.status,200,'triage changes the list');await added.body?.cancel();
  const changed=await poll(listed.etag);assert.equal(changed.status,200,'a changed list is read again');assert.notEqual(changed.etag,listed.etag);
  // A new issue's first event, then a second event of it, through public intake.
  const registered=await request(`/api/projects/${project}/releases`,{method:'POST',body:{name:'fresh@1',build:'b1'}});assert.equal(registered.status,201);await registered.body?.cancel();
  const intake=async eventId=>{await meter();const response=await fetch(origin+'/api/ingest/'+project,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Connection:'close'},body:JSON.stringify({version:1,eventId,release:'fresh@1',build:'b1',environment:'production',type:'Error',message:'fresh failure',frames:[{file:'app.js',line:1,column:1,function:'f'}],breadcrumbs:[]})});assert.equal(response.status,201,await response.text());return meter()};
  const events=[await intake('fresh-1'),await intake('fresh-2')];
  return {first,steady,listed:listed.rows,unchanged:unchanged.rows,events};
 }finally{await mf.dispose();await rm(directory,{recursive:true,force:true})}
}

const mean=costs=>costs.reduce((a,b)=>a+b,0)/costs.length;
const base=await installation(30),grown=await installation(89);
for(const [label,run] of [['30 days',base],['89 days',grown]]){
 assert.ok(run.first<=firstTickCeiling,`at ${label} the first run read ${run.first} rows`);
 assert.ok(Math.max(...run.steady)<=steadyTickCeiling,`at ${label} a minute run read ${Math.max(...run.steady)} rows`);
 assert.ok(run.unchanged<=unchangedPollCeiling,`at ${label} an unchanged issue-list poll read ${run.unchanged} rows`);
 assert.ok(Math.max(...run.events)<=intakeCeiling,`at ${label} an event's intake read ${Math.max(...run.events)} rows`);
}
assert.ok(mean(grown.steady)<=mean(base.steady)*1.25+20,`minute runs grew with history: ${mean(base.steady)} then ${mean(grown.steady)} rows`);
assert.ok(grown.unchanged<=base.unchanged+10,`unchanged polls grew with history: ${base.unchanged} then ${grown.unchanged} rows`);
// A day of minute runs and an issue list polled every minute stay a small share of the account's allowance.
const daily=grown.first+mean(grown.steady)*1440+grown.unchanged*1440;
assert.ok(daily<=freeDailyReads*dailyShareCeiling,`a day reads about ${Math.round(daily)} rows`);
console.log(`D1 read budget (100 events a day kept 30, then 89 days): first run ${base.first} then ${grown.first}; minute run ${mean(base.steady).toFixed(0)} then ${mean(grown.steady).toFixed(0)} rows (max ${Math.max(...grown.steady)}); issue list ${base.listed} then ${grown.listed}, unchanged poll ${base.unchanged} then ${grown.unchanged}; new and repeat event ${base.events.join('/')} then ${grown.events.join('/')}; a day about ${Math.round(daily)} of ${freeDailyReads}`);
