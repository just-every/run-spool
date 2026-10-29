// [SDK-005] Real default SDK session tracking, with only the DSN changed.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import AxeBuilder from '@axe-core/playwright';
import {referenceCollector,run,api} from './runtimes/harness.mjs';
import {objectJson} from '../src/domain/sentry/wire.ts';
import {archiveProjection} from './archive.mjs';
import {browserSignIn,signIn} from './auth.mjs';
import {startTestWorker} from './worker.mjs';
import {followErasure} from './project-erasure/follow.mjs';
export async function sessionFlow({origin,cookie,browser}){
 const app=api(origin,cookie),p=await app.json('/api/projects','POST',{id:'synthetic-spool-health',name:'Checkout release health'}),root='/api/projects/'+p.id,dir=await mkdtemp(join(tmpdir(),'spool-session-health-')),ref=await referenceCollector(),user='synthetic-spool-session-user-'+crypto.randomUUID();
 let server,restored;
 const send=async(dsn,type,value,headers={})=>{const d=new URL(dsn);return fetch(d.origin+'/api'+d.pathname+'/envelope/?sentry_version=7&sentry_key='+d.username,{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain',...headers},body:'{}\n'+JSON.stringify({type})+'\n'+JSON.stringify(value)})};
 try{
  await symlink(resolve('node_modules'),join(dir,'node_modules'),'dir');await writeFile(join(dir,'session-health.mjs'),await readFile('tests/runtimes/node/session-health.mjs','utf8'));
  const executeNode=async dsn=>{for(const [release,modes] of [['synthetic-spool-checkout@1',['healthy','healthy']],['synthetic-spool-checkout@2',['healthy','crash']]])for(const mode of modes){const r=await run(process.execPath,[join(dir,'session-health.mjs'),mode],{env:{SPOOL_FIXTURE_DSN:dsn,SENTRY_RELEASE:release,SPOOL_SESSION_USER:user}});assert.equal(r.code,mode==='crash'?1:0,r.stderr)}};
  await executeNode(ref.dsn);const referenceNode=ref.sent.filter(i=>i.type==='session').map(i=>objectJson(i.bytes));assert.ok(referenceNode.some(s=>s.status==='crashed'));assert.equal(new Set(referenceNode.map(s=>s.sid)).size,4);await executeNode(p.dsn);
  await build({stdin:{contents:`import * as Sentry from '@sentry/browser';Sentry.init({dsn:globalThis.__DSN__,release:'synthetic-spool-checkout@2',environment:'production'});Sentry.setUser({id:${JSON.stringify(user+'-browser')}});Sentry.getClient().on('afterSendEvent',()=>window.crashSent=true);window.finish=async()=>{Sentry.endSession();await Sentry.flush(10000)};window.ready=true;document.querySelector('button').onclick=()=>setTimeout(()=>{throw new Error('synthetic-spool-browser-session-crash')},0);`,resolveDir:process.cwd()},outfile:join(dir,'browser.js'),bundle:true,format:'esm',platform:'browser'});
  server=createServer(async(req,res)=>{res.setHeader('Content-Type',req.url==='/browser.js'?'text/javascript':'text/html');res.end(req.url==='/browser.js'?await readFile(join(dir,'browser.js')):`<!doctype html><meta name="viewport" content="width=device-width"><title>Session tracking fixture</title><button>Crash checkout</button><script>globalThis.__DSN__=${JSON.stringify(new URL(req.url,'http://fixture').searchParams.get('dsn'))}</script><script type="module" src="/browser.js"></script>`)});await new Promise(r=>server.listen(0,'127.0.0.1',r));const address='http://127.0.0.1:'+server.address().port;await app.json(root+'/browser-origins','POST',{origin:address});
  const executeBrowser=async dsn=>{for(const crash of [false,true]){const context=await browser.newContext(),page=await context.newPage();try{await page.goto(address+'/?dsn='+encodeURIComponent(dsn));await page.waitForFunction(()=>window.ready);if(crash){await page.getByRole('button',{name:'Crash checkout'}).click();await page.waitForFunction(()=>window.crashSent===true)}await page.evaluate(()=>window.finish())}finally{await context.close()}}};
  const before=ref.sent.length;await executeBrowser(ref.dsn);const referenceBrowser=ref.sent.slice(before).filter(i=>i.type==='session').map(i=>objectJson(i.bytes));assert.equal(new Set(referenceBrowser.map(s=>s.sid)).size,2);assert.ok(referenceBrowser.some(s=>s.status==='unhandled'));await executeBrowser(p.dsn);
  const reference=[...referenceNode,...referenceBrowser],latest=new Map();for(const s of reference)latest.set(s.sid,s);
  let report=await app.json(root+'/release-health');assert.equal(report.denominators.sessionsSeen,6);assert.equal(report.rows.reduce((n,r)=>n+r.crashed,0),[...latest.values()].filter(s=>s.status==='crashed').length);assert.equal(report.rows.reduce((n,r)=>n+r.sessions,0),latest.size);for(const row of report.rows){const same=[...latest.values()].filter(s=>s.attrs.release===row.release),users=new Map();for(const s of same)if(s.did)users.set(s.did,(users.get(s.did)??false)||['crashed','abnormal','unhandled'].includes(s.status));assert.equal(row.usersSeen,users.size);assert.equal(row.crashFreeUsers,[...users.values()].filter(v=>!v).length)}assert.ok(report.rows.every(r=>r.sessionInterval&&r.adoptionShare>0));assert.equal(report.rows.reduce((n,r)=>n+r.adoptionShare,0),1);
  const ownerIssues=await app.json(root+'/issues');assert.equal(ownerIssues.reduce((n,r)=>n+r.count,0),ref.sent.filter(i=>i.type==='event').length,'sessions add no accepted-error units or occurrences');
  const make=extra=>({sid:crypto.randomUUID().replaceAll('-',''),started:new Date().toISOString(),timestamp:new Date().toISOString(),status:'exited',errors:0,did:user,attrs:{release:'synthetic-spool-checkout@2',environment:'production'},...extra});
  const oversized=await send(p.dsn,'session',{...make(),padding:'x'.repeat(102401)});assert.equal((await oversized.json()).sessions.session_item_too_large,1);
  const discard=await send(p.dsn,'client_report',{timestamp:Date.now()/1000,discarded_events:[{reason:'before_send',category:'session',quantity:2}]});assert.equal(discard.status,200);await discard.body.cancel();
  const missing=make({attrs:{}});assert.equal((await (await send(p.dsn,'session',missing)).json()).sessions.session_missing_release,1);
  const aggregated={attrs:{release:'synthetic-spool-checkout@1',environment:'production'},aggregates:[{started:new Date().toISOString(),exited:3,errored:1,crashed:1}]};assert.equal((await (await send(p.dsn,'sessions',aggregated)).json()).sessions.session_stored,1);
  await app.json(root+'/browser-origins','POST',{origin:'https://synthetic-spool-allowed.test'});const blocked=await send(p.dsn,'session',make(),{Origin:'https://synthetic-spool-denied.test'});assert.equal(blocked.status,403);await blocked.body.cancel();
  const firstCount=(await app.json(root+'/release-health')).denominators.sessionsSeen;const d=new URL(p.dsn),bad=new URL(p.dsn);bad.username='0'.repeat(64);assert.equal((await send(bad.href,'session',make())).status,401);
  const key=await app.json(root+'/keys','POST',{kind:'ingest'});await app.json(root+'/keys/'+key.hash,'DELETE');const revoked=new URL(p.dsn);revoked.username=key.key;assert.equal((await send(revoked.href,'session',make())).status,401);
  const inbound=await app.json(root+'/inbound-filters');inbound.policy.filters.environments={...inbound.policy.filters.environments,enabled:true,values:['synthetic-spool-filtered']};await app.json(root+'/inbound-filters','PUT',{revision:inbound.revision,policy:inbound.policy});const filtered=await send(p.dsn,'session',make({attrs:{release:'synthetic-spool-checkout@2',environment:'synthetic-spool-filtered'}}));assert.equal((await filtered.json()).sessions.session_filtered,1);
  const foreign=await app.json('/api/projects','POST',{id:'synthetic-spool-health-foreign',name:'Foreign health project'}),foreignGrant=await app.json('/api/projects/'+foreign.id+'/keys','POST',{kind:'agent'});assert.equal((await app.request(root+'/release-health','GET',undefined,{Cookie:'',Authorization:'Bearer '+foreignGrant.key})).status,401);
  const grant=await app.json(root+'/keys','POST',{kind:'agent'});const read=await app.json(root+'/release-health','GET',undefined,{Cookie:'',Authorization:'Bearer '+grant.key});assert.equal(read.denominators.sessionsSeen,firstCount);for(const kind of ['deploy','ingest']){const k=await app.json(root+'/keys','POST',{kind});assert.equal((await app.request(root+'/release-health','GET',undefined,{Cookie:'',Authorization:'Bearer '+k.key})).status,401)}
  report=await app.json(root+'/release-health');assert.equal(report.denominators.releaseLess,1);assert.equal(report.denominators.invalid,1);assert.equal(report.denominators.filtered,1);assert.equal(report.denominators.clientDiscarded,2);assert.equal(report.denominators.aggregateSessions,5);assert.equal(report.denominators.sessionsSeen,11);assert.equal((await app.json(root+'/issues')).reduce((n,r)=>n+r.count,0),ownerIssues.reduce((n,r)=>n+r.count,0));
  await mkdir('.artifacts/c15/sdk005',{recursive:true});for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();try{await browserSignIn(page,origin);await page.goto(origin+'/projects/'+p.id+'/releases');const panel=page.getByRole('region',{name:'Release health',exact:true});await panel.getByText(/11 sessions seen/).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual((await new AxeBuilder({page}).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact)),[]);assert.deepEqual(await page.locator('button').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&!n.textContent.trim()).map(n=>n.getAttribute('aria-label'))),[]);await panel.screenshot({path:`.artifacts/c15/sdk005/health-${width}.png`});const download=await app.request(root+`/release-health?from=${report.window.from}&to=${report.window.to}&download=1`);assert.ok(download.headers.get('content-disposition'));assert.equal((await download.json()).denominators.sessionsSeen,11);await page.goto(origin+'/projects/'+p.id+'/issues/'+ownerIssues[0].id);const suspects=page.getByRole('region',{name:'Suspect changes',exact:true});await suspects.getByRole('heading',{name:'Observed session comparison',exact:true}).waitFor();assert.equal(await suspects.getByRole('table').nth(1).getByRole('row').count(),report.rows.length+1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual((await new AxeBuilder({page}).include('[aria-label=\"Suspect changes\"]').analyze()).violations.filter(v=>['serious','critical'].includes(v.impact)),[]);await suspects.screenshot({path:`.artifacts/c15/sdk005/issue-health-${width}.png`})}finally{await context.close()}}
  const recordProof=await sessionRecordReadFlow({app,send});
  const snapshot=await archiveProjection(await app.request('/api/archive'));assert.ok(!snapshot.text.includes(user));assert.equal(snapshot.data.health_sessions.filter(s=>s.project===p.id).length,6);assert.ok(snapshot.data.project_identity_keys.some(k=>k.project===p.id));
  const publicSession = row => row.kind==='individual' ? {project:recordProof.project,sid:row.sid,release:row.release,environment:row.environment,started:row.started,updated:row.updated,status:row.status,errors:row.errors} : {project:recordProof.project,release:row.release,environment:row.environment,started:row.started,status:row.status,quantity:row.quantity};
  const orderJson=rows=>rows.map(row=>JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))))).sort();
  assert.deepEqual(orderJson(recordProof.rows.filter(row=>row.kind==='individual').map(publicSession)),orderJson(snapshot.data.health_sessions.filter(row=>row.project===recordProof.project).map(({user_hash,...row})=>row)),'individual records reconcile with private archive observations');
  assert.deepEqual(orderJson(recordProof.rows.filter(row=>row.kind==='aggregate').map(publicSession)),orderJson(snapshot.data.health_aggregates.filter(row=>row.project===recordProof.project)),'aggregate records reconcile with private archive buckets');
  const recordWire=JSON.stringify(recordProof.rows);for(const row of snapshot.data.health_sessions.filter(row=>row.project===recordProof.project))if(row.user_hash)assert.ok(!recordWire.includes(row.user_hash));for(const row of snapshot.data.project_identity_keys.filter(row=>row.project===recordProof.project))assert.ok(!recordWire.includes(row.key));
  restored=await startTestWorker(15554);const restoredCookie=await signIn(restored.origin),r=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Cookie:restoredCookie,Origin:restored.origin,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:snapshot.text});assert.ok(r.ok,await r.text());const restoredApp=api(restored.origin,restoredCookie);assert.equal((await restoredApp.json(root+'/release-health')).denominators.sessionsSeen,11);
  assert.deepEqual((await recordProof.paginate(restoredApp,{})).rows,recordProof.rows,'private restore preserves all session records without restoring read grants');
  assert.equal((await restoredApp.request(recordProof.root+'/session-records','GET',undefined,recordProof.auth)).status,401);
  const recordPlan=await app.json(recordProof.root+'/erasure');await followErasure(app.json,await app.json(recordProof.root+'/erasure','POST',{confirm:recordProof.project,planHash:recordPlan.planHash}));
  assert.equal((await app.request(recordProof.root+'/session-records')).status,404);assert.equal((await app.request(recordProof.root+'/session-records','GET',undefined,recordProof.auth)).status,401,'erasure retires session read authority at the next read');
  const replay=await send(recordProof.dsn,'session',recordProof.capture);assert.equal(replay.status,401);await replay.body?.cancel();
  assert.equal((await app.request(recordProof.root+'/session-records')).status,404,'replayed captures cannot resurrect erased session records');
  const plan=await app.json(root+'/erasure');assert.equal(plan.deleted.health_sessions,6);await followErasure(app.json,await app.json(root+'/erasure','POST',{confirm:p.id,planHash:plan.planHash}));assert.equal((await app.request(root+'/release-health')).status,404);const erased=await archiveProjection(await app.request('/api/archive'));for(const table of ['health_sessions','health_aggregates','project_identity_keys']){assert.ok(!erased.data[table].some(r=>r.project===p.id));assert.ok(!erased.data[table].some(r=>r.project===recordProof.project))}
  console.log('[SDK-005] default Node healthy/crashed and browser healthy/unhandled sessions, exact reference reconciliation, aggregate unknown users, missing release/origin/key refusal, read grant, JSON, 1440/390, archive/restore and erasure passed');
 }finally{await restored?.stop();await ref.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r))}await rm(dir,{recursive:true,force:true})}
}

// One populated public-door journey covers retained observations, buckets,
// authority, current-data cursors and their reconciliation with the health report.
async function sessionRecordReadFlow({app,send}) {
 const p=await app.json('/api/projects','POST',{id:'synthetic-spool-session-records',name:'Retained session records'}),root='/api/projects/'+p.id;
 const started=Math.floor((Date.now()-120000)/60000)*60000,release='synthetic-spool-record-release',did='synthetic-spool-private-did';
 for(let i=0;i<30;i++){
  const result=await send(p.dsn,'session',{sid:(i+1).toString(16).padStart(32,'0'),started:new Date(started).toISOString(),timestamp:new Date(started).toISOString(),status:i<5?'crashed':'exited',errors:i<5?1:0,did,attrs:{release,environment:'production'}});
  assert.equal(result.status,200);assert.equal((await result.json()).sessions.session_stored,1);
 }
 for(let i=0;i<15;i++){
  const result=await send(p.dsn,'sessions',{attrs:{release:release+'-'+i,environment:'production'},aggregates:[{started:new Date(started).toISOString(),exited:2,crashed:1}]});
  assert.equal(result.status,200);assert.equal((await result.json()).sessions.session_stored,1);
 }
 const key=await app.json(root+'/keys','POST',{kind:'agent'}),auth={Cookie:'',Authorization:'Bearer '+key.key};
 const paginate=async(client=app,headers=auth,query='')=>{
  const rows=[];let cursor,pages=0,summary;
  do{
   assert.ok(pages++<10,'session traversal terminates');
   const response=await client.request(root+'/session-records'+(query||cursor?'?':'')+query+(cursor?(query?'&':'')+'cursor='+encodeURIComponent(cursor):''),'GET',undefined,headers);
   assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
   const page=await response.json();assert.equal(page.version,1);assert.ok(page.rows.length<=page.bounds.pageSize);rows.push(...page.rows);cursor=page.next;summary=page;
  }while(cursor);
  assert.equal(new Set(rows.map(row=>row.id)).size,rows.length,'tied session cursor keys neither repeat nor skip records');assert.equal(rows.length,summary.total);
  return {rows,pages,summary};
 };
 const read=await paginate();assert.equal(read.pages,3);assert.equal(read.rows.length,60);assert.equal(new Set(read.rows.map(row=>row.started)).size,1);
 assert.deepEqual(read.summary.quantities,{individualSessions:30,aggregateSessions:45,sessionsSeen:75});
 assert.deepEqual((await paginate(app,{})).rows,read.rows,'service read equals the owner projection');
 assert.deepEqual((await paginate(app,auth,'order=oldest')).rows,[...read.rows].reverse());
 for(const kind of ['individual','aggregate']){const page=await paginate(app,auth,'kind='+kind);assert.equal(page.pages,2);assert.equal(page.rows.length,30);assert.ok(page.rows.every(row=>row.kind===kind))}
 assert.equal((await paginate(app,auth,'release='+release)).rows.length,30);
 assert.equal((await paginate(app,auth,'environment=staging')).rows.length,0);
 assert.equal((await paginate(app,auth,`from=${started}&to=${started+1}`)).rows.length,60);assert.equal((await paginate(app,auth,'to='+started)).rows.length,0);
 const health=await app.json(root+`/release-health?from=${started}&to=${started+60000}`);
 assert.equal(health.denominators.sessionsSeen,75);assert.equal(health.denominators.aggregateSessions,45);assert.equal(health.denominators.individualSessions,30);
 for(const group of health.rows){const rows=read.rows.filter(row=>row.release===group.release&&row.environment===group.environment);assert.equal(rows.reduce((n,row)=>n+row.quantity,0),group.sessions);for(const status of ['crashed','abnormal','unhandled'])assert.equal(rows.filter(row=>row.status===status).reduce((n,row)=>n+row.quantity,0),group[status])}
 const wire=JSON.stringify(read);for(const value of [did,'user_hash','project_identity_keys'])assert.ok(!wire.includes(value),'session records exclude private identity material');
 const first=await app.json(root+'/session-records','GET',undefined,auth);
 for(const query of ['order=oldest','kind=individual','release='+release,'environment=production','from='+started,'to='+(started+60000)])assert.equal((await app.request(root+'/session-records?'+query+'&cursor='+encodeURIComponent(first.next),'GET',undefined,auth)).status,400,'session cursors cannot cross filters');
 for(const query of ['cursor=not-a-cursor','cursor='+encodeURIComponent(btoa('{}')),'cursor=','cursor='+'a'.repeat(4097),'kind=unknown','order=unknown','from=-1','from=1&to=1','q=unknown','kind=all&kind=individual'])assert.equal((await app.request(root+'/session-records?'+query,'GET',undefined,auth)).status,400);
 assert.equal((await app.request(root+'/release-records?cursor='+encodeURIComponent(first.next),'GET',undefined,auth)).status,400,'session cursors never cross record surfaces');
 const foreign=await app.json('/api/projects','POST',{id:'synthetic-spool-session-records-other',name:'Foreign retained sessions'}),foreignKey=await app.json('/api/projects/'+foreign.id+'/keys','POST',{kind:'agent'});
 assert.equal((await app.request('/api/projects/'+foreign.id+'/session-records?cursor='+encodeURIComponent(first.next),'GET',undefined,{Cookie:'',Authorization:'Bearer '+foreignKey.key})).status,400,'session cursors are project-bound');
 const revoked=await app.json(root+'/keys','POST',{kind:'agent'});await app.json(root+'/keys/'+revoked.hash,'DELETE');
 const denied=[];
 for(const token of [foreignKey.key,p.ingestKey,(await app.json(root+'/keys','POST',{kind:'deploy'})).key,revoked.key,'synthetic-spool-invalid']){
  const response=await app.request(root+'/session-records','GET',undefined,{Authorization:'Bearer '+token});denied.push([response.status,await response.json()]);
 }
 for(const response of denied)assert.deepEqual(response,[401,{error:'Sign in required'}],'an invalid bearer cannot borrow a coincident owner cookie');
 assert.equal((await app.request(root+'/session-records','GET',undefined,{Cookie:''})).status,401);
 assert.deepEqual((await paginate()).rows,read.rows,'denied reads change no session observations');
 console.log('[API-001] 60 tied individual and aggregate records, health quantities, owner equality, query and project cursor fences, identity exclusion and wrong-purpose or revoked read refusals passed');
 return {project:p.id,root,rows:read.rows,auth,paginate,dsn:p.dsn,capture:{sid:'1'.padStart(32,'0'),started:new Date(started).toISOString(),timestamp:new Date(started).toISOString(),status:'crashed',errors:1,did,attrs:{release,environment:'production'}}};
}
