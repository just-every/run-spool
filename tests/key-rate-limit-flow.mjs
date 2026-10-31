import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { archiveProjection } from './archive.mjs';
import { runtime as nativeTeamRuntime } from './owner-erasure/helpers.mjs';
import { startTestWorker } from './worker.mjs';
import { freePort } from './admission-runtime.mjs';
import { signIn, confirmEmailLink, testOwner } from './auth.mjs';
import { registerLegacyMail } from './legacy-mail.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
// The installed SDK's own transport interprets the real response headers.
async function sdkClient(dsn) {
 const require=createRequire(import.meta.url),entry=require.resolve('@sentry/node');
 const source=`const Sentry=require(${JSON.stringify(entry)});const {mock}=require('node:test');mock.timers.enable({apis:['Date'],now:Date.now()});const rl=require('node:readline').createInterface({input:process.stdin});let chain=Promise.resolve();rl.on('line',line=>{chain=chain.then(async()=>{const command=JSON.parse(line);if(command.advance){mock.timers.tick(command.advance);}else if(command.dsn){Sentry.init({dsn:command.dsn,defaultIntegrations:false,sendClientReports:true});}else if(command.close){await Sentry.close(10000);process.stdout.write('ok\\n');process.exit(0);}else{Sentry.captureMessage(command.message,'error');if(!await Sentry.flush(10000))throw new Error('SDK flush failed');}process.stdout.write('ok\\n');}).catch(()=>{process.stderr.write('SDK command failed');process.exit(1)});});`;
 const child=spawn(process.execPath,['-e',source],{stdio:['pipe','pipe','pipe'],env:process.env}),lines=createInterface({input:child.stdout}),pending=[];
 let failure='';child.stderr.on('data',value=>failure+=value);
 lines.on('line',line=>{const waiter=pending.shift();if(waiter){assert.equal(line,'ok');waiter.resolve()}});
 child.on('exit',code=>{for(const waiter of pending.splice(0))waiter.reject(new Error('SDK exited '+code+': '+failure))});
 const command=value=>new Promise((resolve,reject)=>{pending.push({resolve,reject});child.stdin.write(JSON.stringify(value)+'\n')});
 await command({dsn});
 return {capture:message=>command({message}),advance:milliseconds=>command({advance:milliseconds}),close:async()=>{await command({close:true});await new Promise(resolve=>child.exitCode===null?child.once('exit',resolve):resolve());lines.close()}};
}

export async function keyRateLimitFlow({req,json,worker,origin}) {
 const project=await json('/api/projects','POST',{id:'key-limits',name:'Independent capture key limits'}),root='/api/projects/key-limits';
 const second=await json(root+'/keys','POST',{kind:'ingest'}),other=await json('/api/projects','POST',{id:'key-limits-other',name:'Other key custody'});
 const key=digest(project.ingestKey),key2=second.hash,path=root+'/keys/'+key+'/rate-limit';
 const send=async(rawKey=project.ingestKey,items)=>{
  const dsn=new URL(project.dsn),values=items??[['event',{event_id:randomUUID().replaceAll('-',''),message:'synthetic-spool-1'}]];
  return req(`/api${dsn.pathname}/envelope/?sentry_key=${rawKey}&sentry_version=7`,'POST','{}\n'+values.map(([type,value])=>JSON.stringify({type})+'\n'+JSON.stringify(value)).join('\n'),{Cookie:''});
 };
 let config=await json(path);
 const configure=async(limit,period='hour')=>config=await json(path,'PUT',{revision:config.revision,limit,period});
 const rows=async()=>(await json(root+'/outcomes')).rows;
 const count=(rows,reason)=>rows.filter(row=>row.reason===reason).reduce((sum,row)=>sum+row.count,0);
 const refused=async(response,period=3600)=>{
  assert.equal(response.status,429);const result=await response.json();assert.equal(result.reason,'key_rate_limited');
  const retry=Number(response.headers.get('Retry-After'));assert.ok(Number.isInteger(retry)&&retry>=1&&retry<=period);
  assert.equal(result.retryAfter,retry);assert.equal(response.headers.get('X-Sentry-Rate-Limits'),`${retry}:error:project:key_rate_limited`);
  assert.equal(response.headers.get('X-Sentry-Error'),'key_rate_limited');return result;
 };
 await configure(2,'minute');
 // Begin with enough of the server's advertised window left for this burst.
 // Follow its deadline rather than assuming a particular time of day.
 if(config.retryAfter<=15){await new Promise(resolve=>setTimeout(resolve,(config.retryAfter+1)*1000));config=await json(path)}
 const same={event_id:randomUUID().replaceAll('-',''),message:'synthetic-spool-retry'};
 assert.equal((await send(project.ingestKey,[['event',same]])).status,200);
 assert.equal((await send(project.ingestKey,[['event',same]])).status,200);
 assert.equal((await json(path)).used,1,'duplicate delivery spends no key quota');
 const filters=await json(root+'/inbound-filters'),policy=structuredClone(filters.policy);
 policy.filters.messages.enabled=true;policy.filters.messages.values=['*synthetic-spool-filter*'];
 await json(root+'/inbound-filters','PUT',{revision:filters.revision,policy});
 assert.equal((await send(project.ingestKey,[['event',{event_id:randomUUID().replaceAll('-',''),message:'synthetic-spool-filter'}]])).status,200);
 assert.equal((await json(path)).used,1,'filtered capture spends no key quota');
 const malformed=await req(`/api${new URL(project.dsn).pathname}/store/?sentry_key=${project.ingestKey}&sentry_version=7`,'POST','not json',{Cookie:''});assert.equal(malformed.status,400);
 const conflict=await send(project.ingestKey,[['event',{...same,message:'synthetic-spool-conflict'}]]);assert.equal(conflict.status,409);
 assert.equal((await json(path)).used,1,'invalid captures and conflicting retries do not spend quota');
 assert.equal((await send()).status,200);
 await refused(await send(),60);
 assert.equal((await send(project.ingestKey,[['event',same]])).status,200,'a full key still recognizes an already accepted event');
 assert.equal((await send(project.ingestKey,[['event',{event_id:randomUUID().replaceAll('-',''),message:'synthetic-spool-filter'}]])).status,200,'a full key still applies inbound filters before quota');
 assert.equal((await json(path)).used,2,'filtered and duplicate deliveries at the limit spend no extra quota');
 assert.equal((await send(second.key)).status,200,'another key in the same project remains admitted');
 assert.equal(count(await rows(),'accepted'),3);assert.equal(count(await rows(),'duplicate'),2);assert.equal(count(await rows(),'filtered'),2);assert.equal(count(await rows(),'key_rate_limited'),1);
 console.log('PROBE BILL-001 5 minute: public envelope, two key grants -> accepted=3, duplicate=2, filtered=2, key_rate_limited=1; second key accepted');

 // Configuration changes preserve BOTH UTC counters. Raising does not create a
 // fresh allowance and changing period includes earlier admissions this hour.
 await configure(3,'hour');assert.equal(config.used,2);
 const burst=await Promise.all(Array.from({length:6},()=>send()));
 assert.equal(burst.filter(response=>response.status===200).length,1,'atomic final slot admits one concurrent event');
 for(const response of burst.filter(response=>response.status!==200))await refused(response);
 assert.equal((await json(path)).used,3);assert.equal(count(await rows(),'key_rate_limited'),6);
 const saved=await json(path);await worker.restart();registerLegacyMail(origin,await worker.db());config=await json(path);assert.deepEqual({...config,retryAfter:0},{...saved,retryAfter:0},'restart retains configuration and used quota');
 await refused(await send());
 await configure(2);await refused(await send());
 await configure(4);assert.equal((await send()).status,200);await refused(await send());
 const stale=await req(path,'PUT',{revision:config.revision-1,limit:99,period:'hour'});assert.equal(stale.status,409);assert.equal((await json(path)).limit,4);
 console.log('PROBE BILL-001 5 hour and concurrency: six public envelopes at one remaining slot -> one accepted, five key-limited; restart and lower/raise preserve spend');

 const beforeUnauthorized=await json(path),beforeRows=await rows();
 for(const headers of [{Cookie:''},{Cookie:'',Authorization:'Bearer '+project.ingestKey},{Cookie:'',Authorization:'Bearer '+(await json(root+'/keys','POST',{kind:'agent'})).key},{Origin:'https://foreign.example'}]){
  const response=await req(path,'PUT',{revision:config.revision,limit:99,period:'hour'},headers);assert.ok([401,403,404].includes(response.status));await response.body?.cancel();
 }
 for(const input of [{limit:0,period:'hour'},{limit:1.5,period:'hour'},{limit:2,period:'day'},{limit:-1,period:'minute'}])assert.equal((await req(path,'PUT',{revision:config.revision,...input})).status,400);
 for(const wrong of [other.ingestKey,'synthetic-spool-invalid-key'])assert.equal((await send(wrong)).status,401);
 const revoked=await json(root+'/keys','POST',{kind:'ingest'});await json(root+'/keys/'+revoked.hash,'DELETE');assert.equal((await send(revoked.key)).status,401);
 assert.equal((await req(root+'/keys/'+revoked.hash+'/rate-limit','PUT',{revision:0,limit:1,period:'hour'})).status,404);
 assert.equal((await req(root+'/keys/'+digest(other.ingestKey)+'/rate-limit')).status,404);
 assert.deepEqual(await rows(),beforeRows,'invalid and foreign and revoked credentials attribute no quota or outcome');
 assert.deepEqual({...await json(path),retryAfter:0},{...beforeUnauthorized,retryAfter:0});

 // Expire persisted buckets at the native clock seam, avoiding an hour-long
 // sleep or assertions tied to a local date boundary. Admission uses SQL time.
 const db=await worker.db();
 await db.prepare('UPDATE key_rate_usage SET minute_start=minute_start-60000,hour_start=hour_start-3600000 WHERE project=? AND key_hash=?').bind(project.id,key).run();
 assert.equal((await send()).status,200,'a capture after the persisted deadline gets a fresh quota');
 assert.equal((await json(path)).used,1);
 await configure(null);assert.equal((await send()).status,200);
 await configure(1);await refused(await send());
 const mixed=await send(project.ingestKey,[['event',{event_id:randomUUID().replaceAll('-',''),message:'synthetic-spool-2'}],['event',{event_id:randomUUID().replaceAll('-',''),message:'synthetic-spool-3'}],['client_report',{timestamp:123,discarded_events:[{reason:'before_send',category:'error',quantity:7}]}]]);
 const mixedReceipt=await refused(mixed);assert.equal(mixedReceipt.dropped.key_rate_limited,2);assert.equal(mixedReceipt.clientReports.discarded['client_discarded:error:before_send'],7);
 console.log('PROBE BILL-001 5 deadline and configuration: public envelope after expired persisted buckets -> accepted; disable/re-enable retains spend; mixed refusal count=2 and SDK discard count=7');

 // Fresh clients and unchanged SDK DSNs: the limited SDK sends one refusal,
 // suppresses its next error locally, and the independent SDK still delivers.
 await configure(1);const sdk=await sdkClient(project.dsn),sdk2=await sdkClient(second.dsn);
 try{
  const initial=await rows();await sdk.capture('synthetic-spool-sdk-refused');const after=await rows();assert.equal(count(after,'key_rate_limited'),count(initial,'key_rate_limited')+1);
  await sdk.capture('synthetic-spool-sdk-backed-off');await sdk2.capture('synthetic-spool-sdk-other');
  const final=await rows();assert.equal(count(final,'key_rate_limited'),count(after,'key_rate_limited'),'SDK obeys error category backoff instead of sending another limited capture');assert.equal(count(final,'accepted'),count(after,'accepted')+1,'other DSN SDK still ingests');
  await configure(null);
  await db.prepare('UPDATE key_rate_usage SET minute_start=minute_start-60000,hour_start=hour_start-3600000 WHERE project=? AND key_hash=?').bind(project.id,key).run();
  await configure(1);
  await sdk.advance(3601000);await sdk.capture('synthetic-spool-sdk-recovered');
  assert.equal(count(await rows(),'accepted'),count(final,'accepted')+1,'unmodified SDK resumes after its clock passes the backoff deadline');
 }finally{await sdk.close();await sdk2.close()}
 const independent=await json(root+'/issues');assert.ok(independent.some(row=>row.title.includes('synthetic-spool-sdk-other')));assert.ok(!independent.some(row=>row.title.includes('synthetic-spool-sdk-backed-off')));
 const reconciled=await rows();assert.equal(count(reconciled,'accepted'),9);assert.equal(count(reconciled,'key_rate_limited'),13);assert.equal(count(reconciled,'invalid'),1);assert.equal(count(reconciled,'conflict'),1);assert.equal(independent.reduce((sum,row)=>sum+row.count,0),9);
 const reportWindow={from:Date.now()-3600000,to:Date.now()+1000};
 const report=await json('/api/reports?'+new URLSearchParams({projects:project.id,from:String(reportWindow.from),to:String(reportWindow.to),timeZone:'UTC'}));assert.equal(report.metadata.dropped.serverRefused,14,'reports include all thirteen key refusals plus the malformed capture');
 const widget=await json('/api/reporting/preview','POST',{project:project.id,config:{metric:'count',q:'',...reportWindow}});assert.equal(widget.metadata.dropped.serverRefused,14,'widget loss agrees with reports and receipts');
 console.log('PROBE BILL-001 5 SDK: installed unmodified Node clients with two DSNs -> first key honors backoff; second key stores its error');

 const audit=await json('/api/audit?limit=100');
 const changes=audit.rows.filter(row=>row.action==='credential.rate_limit');
 assert.ok(changes.some(row=>row.source==='transaction'&&row.outcome==='succeeded'&&row.actor_kind==='owner'),'saved configuration has a committed owner audit fact');
 assert.ok(changes.some(row=>row.outcome==='denied'),'unauthorized configuration is recorded truthfully');
 for(const row of changes){assert.match(row.actor_label,/^audit:[a-f0-9]{32}$/);assert.match(row.subject_label,/^audit:[a-f0-9]{32}$/)}
 for(const value of [project.ingestKey,second.key,key,key2])assert.ok(!JSON.stringify(audit).includes(value),'safe audit exposes neither credentials nor their hashes');
 const snapshot=await archiveProjection(await req('/api/archive'));
 for(const table of ['key_rate_limits','key_rate_usage','credentials'])assert.equal(snapshot.data[table],undefined,'key authority and quota custody never export');
 for(const value of [project.ingestKey,second.key])assert.ok(!snapshot.text.includes(value));
 assert.equal(count(snapshot.data.outcomes.filter(row=>row.project===project.id),'key_rate_limited'),count(await rows(),'key_rate_limited'),'named refusals are archived independently of authority');
 const destination=await startTestWorker(await freePort());
 try{
  const cookie=await signIn(destination.origin);
  const response=await fetch(destination.origin+'/api/restore',{method:'POST',headers:{Origin:destination.origin,Cookie:cookie,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:snapshot.text});assert.ok(response.ok,await response.text());
  const restoredDb=await destination.db();for(const table of ['credentials','key_rate_limits','key_rate_usage'])assert.equal((await restoredDb.prepare('SELECT COUNT(*) n FROM '+table).first()).n,0);
  const restoredResponse=await fetch(destination.origin+root+'/outcomes',{headers:{Cookie:cookie}});assert.equal(restoredResponse.status,200);
  assert.deepEqual((await restoredResponse.json()).rows,await rows(),'fresh restore retains exact named usage without the original credential authority');
  const revokedReplay=await fetch(destination.origin+`/api${new URL(project.dsn).pathname}/envelope/?sentry_key=${project.ingestKey}&sentry_version=7`,{method:'POST',body:'{}\n{"type":"event"}\n'+JSON.stringify({event_id:randomUUID().replaceAll('-',''),message:'synthetic-spool-restored'})});
  assert.equal(revokedReplay.status,401,'an archived key cannot regain capture authority at the destination');await revokedReplay.body.cancel();
 }finally{await destination.stop()}
 const preview=await json(root+'/erasure');assert.equal(preview.deleted.key_rate_limits,1);assert.equal(preview.deleted.key_rate_usage,2);
 let erase=await json(root+'/erasure','POST',{confirm:project.id,planHash:preview.planHash});
 for(let turn=0;turn<50&&erase.phase!=='complete';turn++)erase=await json('/api/erasures/'+erase.id+'/resume','POST',{});
 assert.equal(erase.phase,'complete');
 for(const table of ['key_rate_limits','key_rate_usage'])assert.equal((await db.prepare('SELECT COUNT(*) n FROM '+table+' WHERE project=?').bind(project.id).first()).n,0);
 assert.equal((await send()).status,401,'erased project keys cannot replay capture');
 console.log('PROBE BILL-001 5 custody: private archive and fresh restore -> no key authority or quota state; owner project erasure -> both tables removed and replay refused');
 await keyLimitRoleAuthority();
 await combinedCategoryBackoff({req,json});
 await keyLimitRepairCoverage({req,json});
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const worker=await startTestWorker(await freePort()),{origin}=worker;
 try{const cookie=await signIn(origin);const req=(path,method='GET',body,headers={})=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,...body!==undefined?{'Content-Type':'application/json'}:{},...headers},...body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{}});const json=async(...args)=>{const response=await req(...args);assert.ok(response.ok,`${args[0]}: HTTP ${response.status} ${await response.clone().text()}`);return response.json()};await keyRateLimitFlow({req,json,worker,origin});await keyRateLimitScreens({req,json,origin,cookie});if(process.argv.includes('--screens'))await keyRateLimitScreens({req,json,origin,cookie,width:390});console.log('key rate limit flow passed')}finally{await worker.stop()}
}

// One assertion width in Verify; the separate phone capture is round evidence.
export async function keyRateLimitScreens({req,json,origin,cookie,width=1440}) {
 const {chromium}=await import('@playwright/test'),{default:AxeBuilder}=await import('@axe-core/playwright');
 const {mkdir}=await import('node:fs/promises');
 const output=process.env.SPOOL_KEY_RATE_PROOF_DIR??'.artifacts/key-rate-limits';await mkdir(output,{recursive:true});
 const id='key-limit-screen-'+width,project=await json('/api/projects','POST',{id,name:'Capture rate controls'}),key=digest(project.ingestKey);
 const browser=await chromium.launch({headless:true,...process.env.RER_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.RER_CHROMIUM_EXECUTABLE_PATH}:{},args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.addCookies([{name:cookie.split('=')[0],value:cookie.slice(cookie.indexOf('=')+1),url:origin}]);
  const page=await context.newPage();await page.goto(origin+'/projects/'+id+'/settings');
  const row=page.locator('.key-row').filter({hasText:key.slice(0,12)});await row.getByRole('button',{name:'Details: Project key',exact:true}).click();
  const form=page.getByRole('region',{name:'Capture key event rate'});await form.getByLabel('Limit this capture key').check();
  await form.getByLabel('Accepted events per period').fill('1');await form.getByLabel('Rate period').selectOption('hour');
  await form.getByRole('button',{name:'Save key rate limit',exact:true}).click();await form.getByRole('status').filter({hasText:'Key rate limit saved'}).waitFor();
  const read=await json('/api/projects/'+id+'/keys/'+key+'/rate-limit');assert.equal(read.limit,1);assert.equal(read.period,'hour');
  assert.match(await form.innerText(),/0 of 1 events accepted/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.equal(await form.evaluate(element=>element.scrollWidth<=element.clientWidth+1),true);
  const audit=await new AxeBuilder({page}).include('[role="dialog"],dialog[open]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(row=>row.id),[]);
  await page.getByRole('button',{name:'Close details',exact:true}).click();assert.equal(await row.getByRole('button',{name:'Details: Project key',exact:true}).evaluate(element=>element===document.activeElement),true);
  const dsn=new URL(project.dsn),path=`/api${dsn.pathname}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
  const send=()=>req(path,'POST','{}\n{"type":"event"}\n'+JSON.stringify({event_id:randomUUID().replaceAll('-',''),message:'synthetic-spool-screen'}),{Cookie:''});
  assert.equal((await send()).status,200);assert.equal((await send()).status,429);
  await row.getByRole('button',{name:'Details: Project key',exact:true}).click();
  await form.getByText('1 of 1 events accepted in the current UTC hour.',{exact:false}).waitFor();
  assert.match(await form.innerText(),/1 of 1 events accepted/,'reopening key settings refreshes admitted usage');
  await form.scrollIntoViewIfNeeded();await page.screenshot({path:output+'/settings-'+width+'.png'});
  await form.getByLabel('Accepted events per period').fill('2');
  await page.getByRole('button',{name:'Close details',exact:true}).click();
  await row.getByRole('button',{name:'Details: Project key',exact:true}).click();
  assert.equal(await form.getByLabel('Accepted events per period').inputValue(),'2','usage refresh preserves the unsaved limit');
  await page.getByRole('button',{name:'Close details',exact:true}).click();
  await page.goto(origin+'/projects/'+id+'/capture');await page.getByRole('heading',{name:'Capture receipts',exact:true}).waitFor();
  const receipt=page.locator('dl > div').filter({has:page.getByText('Capture key rate limited',{exact:true})});assert.equal(await receipt.locator('dd').innerText(),'1');
  const accepted=page.locator('dl > div').filter({has:page.getByText('Events received',{exact:true})});assert.equal(await accepted.locator('dd').innerText(),'1');
  await receipt.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.screenshot({path:output+'/receipts-'+width+'.png'});
  console.log('PROBE BILL-001 5 UI '+width+': Settings save -> one event per hour; Capture receipts -> accepted=1 and capture-key-limited=1; keyboard, Axe and reflow passed');
 }finally{await browser.close()}
}

async function keyLimitRepairCoverage({req,json}) {
 const project=await json('/api/projects','POST',{id:'key-limit-repair',name:'Capture loss and repair observation'}),root='/api/projects/'+project.id;
 const native=(id,release,type)=>({version:1,eventId:id,release,build:'web',environment:'test',type,message:type,frames:[{file:'app.js',line:1,column:0,function:type}],breadcrumbs:[]});
 const capture=(id,release,type)=>json('/api/ingest/'+project.id,'POST',native(id,release,type),{Cookie:'',Authorization:'Bearer '+project.ingestKey});
 await json(root+'/releases','POST',{name:'synthetic-spool-old',build:'web'});
 const original=await capture('synthetic-spool-1','synthetic-spool-old','TypeError');
 let repair=await json(root+'/repairs','POST',{issue:original.issue,link:'https://example.test/pull/1',note:'Check capture loss'});
 await json(root+'/releases','POST',{name:'synthetic-spool-fixed',build:'web'});await capture('synthetic-spool-2','synthetic-spool-fixed','RangeError');
 await json(root+'/artifacts','POST',{release:'synthetic-spool-fixed',build:'web',debugId:'synthetic-spool-map',map:{version:3,sources:['source.js'],sourcesContent:['throw new Error()'],names:[],mappings:'AAAA'}});
 repair=await json(root+'/repairs/'+repair.id+'/facts','POST',{revision:repair.revision,fact:'deployed',release:'synthetic-spool-fixed'});
 repair=await json(root+'/repairs/'+repair.id+'/facts','POST',{revision:repair.revision,fact:'exercised',note:'Exercised the affected flow'});assert.equal(repair.observation.verdict,'no_recurrence_after_exercise');
 await json(root+'/keys/'+digest(project.ingestKey)+'/rate-limit','PUT',{revision:0,limit:2,period:'hour'});
 const refusal=await req('/api/ingest/'+project.id,'POST',native('synthetic-spool-3','synthetic-spool-fixed','TypeError'),{Cookie:'',Authorization:'Bearer '+project.ingestKey});assert.equal(refusal.status,429);assert.equal((await refusal.json()).reason,'key_rate_limited');
 const observed=(await json(root+'/repairs?issue='+original.issue)).repairs.find(row=>row.id===repair.id).observation;
 assert.equal(observed.verdict,'inconclusive','a key-limited capture cannot support a clean repair verdict');assert.deepEqual(observed.evidence.loss,[{reason:'key_rate_limited',count:1}]);
 console.log('PROBE BILL-001 5 loss: native capture refused by key limit -> repair verdict becomes inconclusive; reports and widgets reconcile server refusals');
}

// Exercise the interaction with session backpressure already shipped by main.
async function combinedCategoryBackoff({req,json}) {
 const project=await json('/api/projects','POST',{id:'key-limit-mixed',name:'Independent category backoff'}),root='/api/projects/'+project.id;
 const dsn=new URL(project.dsn),path=`/api${dsn.pathname}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 const send=items=>req(path,'POST','{}\n'+items.map(([type,value])=>JSON.stringify({type})+'\n'+JSON.stringify(value)).join('\n'),{Cookie:''});
 const event=()=>['event',{event_id:randomUUID().replaceAll('-',''),message:'synthetic-spool-mixed'}];
 const session={sid:randomUUID().replaceAll('-',''),started:new Date().toISOString(),status:'exited',attrs:{release:'synthetic-spool-mixed'}};
 await json(root+'/keys/'+digest(project.ingestKey)+'/rate-limit','PUT',{revision:0,limit:1,period:'hour'});
 assert.equal((await send([event()])).status,200);
 let combined;
 for(let batch=0;batch<40;batch++) {
  const response=await send(Array.from({length:100},()=>['session',session]));assert.equal(response.status,200);
  const receipt=await response.json();
  if(!receipt.sessions.session_rate_limited)continue;
  combined=await send([event(),['session',session]]);
  const body=await combined.json();assert.equal(combined.status,429);assert.equal(body.reason,'key_rate_limited');
  if(!body.sessions.session_rate_limited)continue;
  assert.equal(body.dropped.key_rate_limited,1);assert.equal(body.sessions.session_rate_limited,1);
  const limits=combined.headers.get('X-Sentry-Rate-Limits').split(',').map(value=>value.trim().split(':'));
  assert.equal(limits.length,2,'both refused categories advertise their independent deadlines');
  assert.equal(limits[0][1],'error');assert.equal(limits[0][3],'key_rate_limited');
  assert.equal(limits[0][0],combined.headers.get('Retry-After'));assert.ok(Number(limits[0][0])>=1&&Number(limits[0][0])<=3600);
  assert.equal(limits[1][1],'session');assert.equal(limits[1][3],'session_rate_limited');assert.ok(Number(limits[1][0])>=1&&Number(limits[1][0])<=60);
  assert.equal((await json(root+'/issues')).reduce((sum,row)=>sum+row.count,0),1,'mixed refusal creates no extra error');
  console.log('PROBE BILL-001 5 mixed categories: public envelope at key and session limits -> 429 with separate error and session deadlines; no extra occurrence');
  return;
 }
 assert.fail('public intake did not reach combined category backpressure');
}

// Native invitations establish real role sessions; only the mail edge is read.
async function keyLimitRoleAuthority() {
 const app=await nativeTeamRuntime();
 try {
 const {origin}=app;
 const req=(path,method='GET',body,headers={})=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:app.cookie,...body!==undefined?{'Content-Type':'application/json'}:{},...headers},...body!==undefined?{body:JSON.stringify(body)}:{}});
 const json=async(...args)=>{const response=await req(...args);assert.ok(response.ok,`${args[0]} HTTP ${response.status}`);return response.json()};
 await json('/api/organization','POST',{id:'synthetic-spool-key-team',name:'Capture key administrators'});
 const project=await json('/api/projects','POST',{id:'key-limit-roles',name:'Key limit authority'}),root='/api/projects/'+project.id,path=root+'/keys/'+digest(project.ingestKey)+'/rate-limit';
 let admin;
 for(const [index,role] of ['admin','maintainer','member','read-only','billing'].entries()) {
  const email=testOwner.replace('owner','synthetic-spool-key-'+index);
  const input={email,name:'synthetic-spool-'+index,role:['maintainer','member'].includes(role)?'member':role,grants:['maintainer','member','read-only'].includes(role)?[{project:project.id,role}]:[]};
  assert.equal((await req('/api/organization/invites','POST',input)).status,202);
  const cookie=await confirmEmailLink(origin,email),headers={Cookie:cookie};
  if(role==='admin') {
   admin={headers,member:(await json('/api/organization')).members.find(row=>row.email===email)};
   const saved=await req(path,'PUT',{revision:0,limit:2,period:'hour'},headers);assert.equal(saved.status,200);assert.equal((await saved.json()).limit,2);
  } else {
   const before=await json(path);
   for(const method of ['GET','PUT']) {
    const response=await req(path,method,method==='PUT'?{revision:before.revision,limit:99,period:'hour'}:undefined,headers);
    assert.ok([401,403,404].includes(response.status),role+' cannot configure or inspect a key budget');await response.body.cancel();
   }
   assert.deepEqual({...await json(path),retryAfter:0},{...before,retryAfter:0},role+' refusal leaves configuration and usage unchanged');
  }
 }
 const before=await json(path);
 await json('/api/organization/members/'+admin.member.id,'PUT',{version:admin.member.version,role:'read-only',grants:[]});
 const revoked=await req(path,'PUT',{revision:before.revision,limit:99,period:'hour'},admin.headers);assert.ok([401,403,404].includes(revoked.status));await revoked.body.cancel();
 assert.deepEqual({...await json(path),retryAfter:0},{...before,retryAfter:0},'demoted admin session cannot change the saved limit');
 console.log('PROBE BILL-001 5 roles: native invited admin saves a key limit; maintainer, member, read-only, billing and demoted admin are refused without changing it');
 }finally{await app.close()}
}
