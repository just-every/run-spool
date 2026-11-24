import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {authBindings,signIn} from './auth.mjs';
import {migrationEvidence} from './migration-evidence.mjs';

// A small company runs Spool on Workers Free, where every tool on the account shares 5,000,000 D1 rows read a day.
// The real Worker entry runs over a migrated local D1 holding 30 days of history at the default retention; its
// binding adds D1's own meta.rows_read per statement. A minute cron and an open issue list must cost the same rows
// whatever the history holds, so the steady cost is measured at 30 days kept and again at the full 89.
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
const steadyTickCeiling=800,firstTickCeiling=40_000,unchangedPollCeiling=40,dailyShareCeiling=0.2;
const project='web',port=15491,origin=`http://127.0.0.1:${port}`;

// One installation with 100 events a day kept for `days` days, a due day of retention, a 24-hour error-count rule,
// 100 delivered alerts awaiting acknowledgement and 300 projected mail receipts: its first run, ten steady minute
// runs, and the issue list read once and then polled unchanged.
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
  const created=await request('/api/projects',{method:'POST',body:{id:project,name:'Web'}});assert.equal(created.status,201);await created.body?.cancel();
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
  // A day past the 90-day default is due for retention.
  await history(100,now-91*day,now-90*day-minute);
  await history(100*days,now-days*day,now-minute);
  await write([
   q("INSERT INTO alert_rules VALUES('metric-rule',?,1,'Errors per day',1,'mail','dest',?,?,2,?,?)",project,JSON.stringify(['metric']),day,now-day,now-day),
   q('INSERT INTO alert_rule_configs VALUES(?,?,1,?)','metric-rule',project,JSON.stringify({metric:'aggregate',dataset:'errors',aggregate:'count',query:{},filters:{},thresholdType:'above',triggers:[{label:'critical',alertThreshold:1e9}],resolveThreshold:null,tagKeys:[]})),
   q("INSERT INTO alert_rules VALUES('quiet-rule',?,1,'Quiet',0,'mail','dest',?,3600000,10000,?,?)",project,JSON.stringify(['spike']),now-day,now-day),
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
  return {first,steady,listed:listed.rows,unchanged:unchanged.rows};
 }finally{await mf.dispose();await rm(directory,{recursive:true,force:true})}
}

const mean=costs=>costs.reduce((a,b)=>a+b,0)/costs.length;
const base=await installation(30),grown=await installation(89);
for(const [label,run] of [['30 days',base],['89 days',grown]]){
 assert.ok(run.first<=firstTickCeiling,`at ${label} the first run read ${run.first} rows`);
 assert.ok(Math.max(...run.steady)<=steadyTickCeiling,`at ${label} a minute run read ${Math.max(...run.steady)} rows`);
 assert.ok(run.unchanged<=unchangedPollCeiling,`at ${label} an unchanged issue-list poll read ${run.unchanged} rows`);
}
assert.ok(mean(grown.steady)<=mean(base.steady)*1.25+20,`minute runs grew with history: ${mean(base.steady)} then ${mean(grown.steady)} rows`);
assert.ok(grown.unchanged<=base.unchanged+10,`unchanged polls grew with history: ${base.unchanged} then ${grown.unchanged} rows`);
// A day of minute runs and an issue list polled every minute stay a small share of the account's allowance.
const daily=grown.first+mean(grown.steady)*1440+grown.unchanged*1440;
assert.ok(daily<=freeDailyReads*dailyShareCeiling,`a day reads about ${Math.round(daily)} rows`);
console.log(`D1 read budget (100 events a day kept 30, then 89 days): first run ${base.first} then ${grown.first}; minute run ${mean(base.steady).toFixed(0)} then ${mean(grown.steady).toFixed(0)} rows (max ${Math.max(...grown.steady)}); issue list ${base.listed} then ${grown.listed}, unchanged poll ${base.unchanged} then ${grown.unchanged}; a day about ${Math.round(daily)} of ${freeDailyReads}`);
