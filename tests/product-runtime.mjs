import {localRuntime} from './local-runtime.mjs';
import { operatorArchiveTamper, operatorRetentionAndErasure } from './operator-archive.mjs';
import { operatorFlow } from './operator-flow.mjs';
import { bundleGroupingFlow } from './bundle-grouping.mjs';
import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queuedExit=await queuedEntrypoint(import.meta.url);if(queuedExit!==null)process.exit(queuedExit);
import {authBindings,signIn,browserSignIn} from './auth.mjs';
import {archiveProjection,nativeArchive,archiveConfiguration} from './archive.mjs';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir,rm,readdir,stat,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {canonical} from '../src/domain/privacy.ts';
import {finishProductRun,migrationFailure,observeChild,stopChild,stopCommand,workerOutput} from './product-diagnostics.mjs';
import {miniflareAssets} from './product-assets.mjs';
const require=createRequire(import.meta.url);
const {Miniflare,convertV4MiniflareOptions,Log,LogLevel}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler/package.json')]}));
const withoutBrowser=process.argv.includes('--no-browser');
const duplicateOnly=process.argv.includes('--duplicate-only');
assert.ok(!duplicateOnly||withoutBrowser,'Duplicate investigation must not launch a browser');
const runId=Date.now();
let temporary,env,config,cfg,migrationFile,failure;
const artifactDirectory=resolve('.artifacts'),output=workerOutput();
const port=15469,origin=`http://127.0.0.1:${port}`;
let worker,captureWorker,browser,miniflare;
async function start(state,migrate=true){
 if(!process.argv.includes('--wrangler-proxy')){
  const log=new Log(LogLevel.INFO);log.log=message=>output.add(message+'\n');
  const bindings=authBindings(origin);if(!migrate)delete bindings.SETUP_TOKEN; // An existing hosted owner has retired the bootstrap token.
  // Miniflare permits a missing asset directory; this fixture requires the real build.
  if(!(await stat(config.assets.directory)).isDirectory())throw new Error('Emitted asset directory is required');
  const emittedModules=(await readdir('dist/server',{recursive:true}))
   .filter(p=>/\.(m?js)$/.test(p)&&resolve('dist/server',p)!==config.main&&p!=='duplicate-probe.js')
   .map(p=>({type:'ESModule',path:resolve('dist/server',p)}));
  miniflare=new Miniflare(convertV4MiniflareOptions(await localRuntime({
   log,handleStructuredLogs:({message})=>output.add(message+'\n'),
   name:config.name,modules:[{type:'ESModule',path:config.main},...emittedModules],
   modulesRoot:resolve('dist/server'),compatibilityDate:config.compatibility_date,
   compatibilityFlags:config.compatibility_flags,bindings,
   assets:miniflareAssets(config),
   d1Databases:{DB:config.d1_databases[0].database_id},
   resourcePersistencePath:resolve(state,'v3'),host:'127.0.0.1',port
  })));
  await miniflare.ready;
  if(migrate){
   const db=await miniflare.getD1Database('DB');
   assert.equal((await db.prepare('PRAGMA foreign_keys').first()).foreign_keys,1);
   const {unstable_splitSqlQuery}=require('wrangler');
   // D1 already enforces foreign keys; asserting it replaces the ON no-op rejected by D1 exec.
   const queries=unstable_splitSqlQuery(await readFile(migrationFile,'utf8'))
    .filter(sql=>!/^PRAGMA foreign_keys\s*=\s*ON;?$/i.test(sql.trim()));
   try{await db.batch(queries.map(sql=>db.prepare(sql)))}catch(error){error.migration=migrationFailure({status:null,stderr:error?.cause?.message??error?.message});throw error}
  }
  assert.equal((await fetch(origin+'/health')).status,200);return;
 }
 const migrated=migrate?spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','errors-local','--local','--config',cfg,'--persist-to',state,'--file',migrationFile],{env,encoding:'utf8',detached:true}):{status:0};try{assert.equal(migrated.status,0,'test database migrations succeed')}catch(error){error.migration=migrationFailure(migrated);throw error}finally{await stopCommand(migrated)}
 worker=observeChild(spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--config',cfg,'--persist-to',state,'--port',String(port),'--inspector-port','15467'],{env,stdio:['ignore','pipe','pipe'],detached:true}),output);
 for(let i=0;i<120;i++){if(worker.fixtureSpawnError)throw worker.fixtureSpawnError;if(worker.exitCode!==null)throw new Error('Test Worker failed readiness; private output withheld');try{if((await fetch(origin+'/health')).ok)return}catch{}await new Promise(r=>setTimeout(r,250))}throw new Error('Test Worker failed readiness; private output withheld');
}
async function stop(){const active=miniflare;miniflare=null;try{if(active)await active.dispose()}finally{const child=worker;worker=null;await stopChild(child,{group:true})}}
// Wrangler's two-hop local proxy can close a pooled idle connection before a POST reaches the app.
// Native Miniflare serves the emitted assets and API in both browser and domain modes.
// This removes Wrangler's extra local proxy hop, with no API retries.
// --wrangler-proxy retains the failing control; Connection:close did not reliably fix it.
let cookie='',requestSequence=0;
async function req(path,method='GET',value,headers={}){
 const requestId=requestSequence+1;
 let response;
 try {
  response=await fetch(origin+path,{method,headers:{...(path==='/api/restore'?{'X-Confirm-Restore':'yes'}:{}),'X-Fixture-Request':String(++requestSequence),Origin:origin,...cookie?{Cookie:cookie}:{},...value?{'Content-Type':typeof value==='string'?'application/x-ndjson':'application/json'}:{},...headers},...value?{body:typeof value==='string'?value:JSON.stringify(value)}:{}});
 } catch(error) {error.productRequest={method,path,ordinal:requestId};throw error}
 Object.defineProperty(response,'fixtureRequest',{value:requestId});return response;
}
async function json(path,method,value,headers){const r=await req(path,method,value,headers);try{assert.ok(r.ok,'product HTTP request succeeds');return await (path==='/api/archive'?archiveProjection(r):r.json())}catch(error){error.productRequest={method:method??'GET',status:r.status,ordinal:r.fixtureRequest};throw error}}
async function login(options){cookie=await signIn(origin,options)}
async function setupLocation(expected){const r=await fetch(origin+'/setup',{headers:{Cookie:cookie},redirect:'manual'});assert.equal(r.status,expected?303:200);if(expected)assert.equal(r.headers.get('location'),'/');}

try {
 await mkdir(artifactDirectory,{recursive:true});
 temporary=await mkdtemp(resolve(tmpdir(),'errors-acceptance-'));
 env={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:resolve(temporary,'logs')};
 config=JSON.parse(await readFile('dist/server/wrangler.json','utf8'));config.vars={...config.vars,...authBindings(origin)};config.assets.directory=resolve('dist/client');config.main=resolve('dist/server/index.js');
if(process.argv.includes('--probe-request-path')){const probe=resolve('dist/server/duplicate-probe.js');await writeFile(probe,"import application from './index.js';export default {async fetch(request,env,ctx){const id=request.headers.get('x-fixture-request');console.log('DUPLICATE_PROBE_ENTER',id);try{const response=await application.fetch(request,env,ctx);console.log('DUPLICATE_PROBE_EXIT',id,response.status);return response}catch(error){console.log('DUPLICATE_PROBE_THROW',id);throw error}}};");config.main=probe;}
cfg=resolve(temporary,'wrangler.json');await writeFile(cfg,JSON.stringify(config));
migrationFile=resolve(temporary,'all-migrations.sql');await writeFile(migrationFile,(await Promise.all((await readdir('migrations/core')).filter(f=>f.endsWith('.sql')).sort().map(f=>readFile('migrations/core/'+f,'utf8')))).join('\n'));
 await start(resolve(temporary,'state-a'));
 assert.equal((await req('/api/projects')).status,401);
 assert.equal((await req('/auth/magic-link','POST',{email:'owner@spool.test'},{Origin:'https://attacker.invalid'})).status,403);
 await login();assert.equal((await req('/api/missing')).status,404);assert.ok(isDeepStrictEqual(await json('/api/projects'),[]),'private domain rows match exactly');
 await setupLocation(false);
 const project=await json('/api/projects','POST',{id:'web',name:'Web app'});
 await setupLocation(true);
 await json('/api/projects','POST',{id:'other',name:'Other'});
 await json('/api/projects/web/releases','POST',{name:'r1',build:'b1'});
 const auth={Authorization:`Bearer ${project.ingestKey}`};
 const event={version:1,eventId:'first',release:'r1',build:'b1',environment:'production',type:'TypeError',message:'failed token=test-spool-private-canary user@example.com',frames:[{file:'https://app.test/bundle.js?token=test-spool-url-canary',line:1,column:0,function:'upgrade',debugId:'d1'}],breadcrumbs:['password=test-spool-breadcrumb-canary']};
 const admitted=await json('/api/ingest/web','POST',event,auth);assert.equal(admitted.outcome,'accepted');
 assert.equal((await json('/api/ingest/web','POST',event,auth)).outcome,'duplicate');
 assert.equal((await req('/api/ingest/web','POST',{...event,message:'failed token=test-spool-conflicting-private-canary user@example.com'},auth)).status,409);
 const concurrent=await Promise.all(Array.from({length:6},()=>req('/api/ingest/web','POST',{...event,eventId:'concurrent'},auth)));assert.equal(concurrent.filter(r=>r.status===201).length,1);
 let groups=await json('/api/projects/web/issues');assert.equal(groups.length,1);assert.equal(groups[0].count,2);assert.equal((await json('/api/projects/web/alerts')).length,1);
 // Real minified call chain through map upload, ingest and the issue packet.
 const esbuild=await import(require.resolve('esbuild',{paths:[resolve('node_modules/vite')]}));
 await mkdir(resolve(temporary,'src'),{recursive:true});
 const fixture=resolve(temporary,'src/account.js'),bundle=resolve(temporary,'dist/assets/bundle.mjs');
 await writeFile(fixture,'export function describeUser(account) {\n  return account.address.city;\n}\nexport function checkout(account) {\n  return globalThis.spoolMappingFixture.describeUser(account);\n}\nglobalThis.spoolMappingFixture = {describeUser, checkout};\n');
 await writeFile(resolve(temporary,'src/main.js'),'import "./account.js";\n[{}].map(account => globalThis.spoolMappingFixture.checkout(account));\n');
 await writeFile(resolve(temporary,'index.html'),'<script type="module" src="/src/main.js"></script>');
 const {build:viteBuild}=await import('vite');
 await viteBuild({configFile:false,root:await realpath(temporary),logLevel:'silent',build:{outDir:'dist',minify:true,sourcemap:true,modulePreload:false,rollupOptions:{output:{entryFileNames:'assets/bundle.mjs'}}}});
 let thrown;try{await import('file://'+bundle)}catch(e){thrown=e}finally{delete globalThis.spoolMappingFixture}assert.ok(thrown instanceof TypeError);
 const {frames,captureException}=await import('../src/domain/capture.ts');
 const parsed=frames(thrown.stack,'d1').filter(frame=>frame.file.endsWith('/dist/assets/bundle.mjs'));assert.equal(parsed.length,4);assert.equal(parsed[0].line,1);assert.notEqual(parsed[0].function.replace(/ \[as [^\]]+\]$/, '').split('.').at(-1),'describeUser','Vite really minifies the reported function');
 const map=JSON.parse(await readFile(bundle+'.map','utf8'));
 await json('/api/projects/web/artifacts','POST',{release:'r1',build:'b1',debugId:'d1',map});
 const mappedEvent={...event,eventId:'mapped',message:thrown.message,frames:parsed};
 const mapped=await json('/api/ingest/web','POST',mappedEvent,auth);assert.equal(mapped.diagnostic[0].status,'mapped');assert.equal(mapped.diagnostic[0].original.line,2);
 const mappedPacket=await json(`/api/projects/web/issues/${mapped.issue}/packet`),mappedOccurrence=mappedPacket.events.find(row=>row.id==='mapped');
 for(const diagnostic of [mapped.diagnostic,mappedOccurrence.atAdmission,mappedOccurrence.currentLookup])assert.deepEqual(diagnostic.map(row=>({file:row.original.file,line:row.original.line,function:row.original.function})),[
  {file:'src/account.js',line:2,function:'describeUser'},
  {file:'src/account.js',line:5,function:'checkout'},
  {file:'src/main.js',line:2,function:'<anonymous>'},
  {file:'src/main.js',line:2,function:parsed[3].function}
 ]);
 const capture=await captureException(thrown,{endpoint:origin,project:'web',ingestKey:project.ingestKey,release:'r1',build:'b1',environment:'test',debugId:'d1'},'capture-real');assert.equal(capture.outcome,'accepted');
 const offline=await captureException(thrown,{endpoint:'http://127.0.0.1:15479',project:'web',ingestKey:project.ingestKey,release:'r1',build:'b1',environment:'test'},'capture-offline');assert.equal(offline.outcome,'unknown');
 if(!withoutBrowser){
 // Real browser automatic error capture against emitted application assets/API.
 // The signed-out document forbids scripts; enter the app through ordinary owner sign-in.
 const {launchBrowser}=await import('./browser-launch.mjs');browser=await launchBrowser();const page=await browser.newPage();await browserSignIn(page,origin);await page.waitForURL(url=>/^\/projects\/[^/]+\/issues$/.test(url.pathname));
 await page.evaluate(async ({origin,key})=>{const sdk=await import(origin+'/errors-capture.js');window.captureOutcome=null;sdk.installBrowserCapture({endpoint:origin,project:'web',ingestKey:key,release:'r1',build:'b1',environment:'browser',onOutcome:r=>window.captureOutcome=r});setTimeout(function upgrade(){const account={};return account.address.city},0)}, {origin,key:project.ingestKey});
 await page.waitForFunction(()=>window.captureOutcome?.outcome==='accepted');assert.equal((await page.evaluate(()=>window.captureOutcome)).outcome,'accepted');
 await browser.close();browser=null;
 // The real two-origin triage journey owns UI navigation, mapping and regression proof.
 }
 // Genuine Worker exception; waitUntil performs async durable transport after fetch returns.
 const harness=resolve(temporary,'capture-worker.ts');await writeFile(harness,`import {captureException} from ${JSON.stringify(resolve('src/domain/capture.ts'))};export default {fetch(request,env,ctx){try{const account=JSON.parse('{}');account.address.city}catch(error){ctx.waitUntil(captureException(error,${JSON.stringify({endpoint:origin,project:'web',ingestKey:project.ingestKey,release:'r1',build:'b1',environment:'worker'})},'worker-real'));}return new Response('queued',{status:202})}}`);
 await esbuild.build({entryPoints:[harness],outfile:resolve(temporary,'capture-worker.js'),bundle:true,format:'esm',platform:'browser'});
 const harnessConfig=resolve(temporary,'capture-wrangler.json');await writeFile(harnessConfig,JSON.stringify({name:'errors-capture-test',main:resolve(temporary,'capture-worker.js'),compatibility_date:'2026-09-08'}));
 captureWorker=observeChild(spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--config',harnessConfig,'--port','15470','--inspector-port','15466'],{env,stdio:['ignore','pipe','pipe'],detached:true}),output);
 let queued=false;for(let i=0;i<80;i++){try{queued=(await fetch('http://127.0.0.1:15470')).status===202}catch{}if(queued)break;await new Promise(r=>setTimeout(r,250))}assert.ok(queued,'capture worker becomes ready');
 let workerCaptured=false;for(let i=0;i<80;i++){const a=await json('/api/archive');workerCaptured=a.data.events.some(e=>e.id==='worker-real');if(workerCaptured)break;await new Promise(r=>setTimeout(r,100))}assert.ok(workerCaptured,'capture worker event is stored');
 await stopChild(captureWorker,{group:true});captureWorker=null;
 groups=await json('/api/projects/web/issues');const group=groups.find(g=>g.id===admitted.issue);
 assert.equal((await req(`/api/projects/web/issues/${group.id}`,'PATCH',{state:'resolved',revision:group.revision},{Origin:'https://evil.invalid'})).status,403);
 await json(`/api/projects/web/issues/${group.id}`,'PATCH',{state:'resolved',revision:group.revision});
 assert.equal((await req(`/api/projects/web/issues/${group.id}`,'PATCH',{state:'open',revision:group.revision})).status,409);
 await json('/api/ingest/web','POST',{...event,eventId:'delayed-old'},auth);groups=await json('/api/projects/web/issues');assert.equal(groups.find(g=>g.id===group.id).state,'resolved');
 await json('/api/projects/web/releases','POST',{name:'r2',build:'b2'});
 const regressed=await json('/api/ingest/web','POST',{...event,eventId:'new-release',release:'r2',build:'b2'},auth);assert.equal(regressed.diagnostic[0].status,'identity_mismatch');
 groups=await json('/api/projects/web/issues');assert.equal(groups.find(g=>g.id===group.id).state,'open');assert.ok((await json('/api/projects/web/alerts')).some(a=>a.kind==='regression'));
 assert.equal((await req('/api/ingest/web','POST',{...event,eventId:'bad',headers:{secret:'hidden'}},auth)).status,400);
 assert.equal((await req('/api/projects/web/artifacts','POST',{release:'r1',build:'b1',debugId:'bad',map:{version:3,sources:[],names:[],mappings:''}})).status,400);
 for(const mappings of ['!','g','!AAA','AAggggggEA'])assert.equal((await req('/api/projects/web/artifacts','POST',{release:'r1',build:'b1',debugId:'lexical-'+mappings.replace('!','invalid'),map:{version:3,sources:['fake.ts'],names:[],mappings}})).status,400);
 await json('/api/projects/other/releases','POST',{name:'r1',build:'b1'});
 const parallelMap={version:3,sources:['source.ts'],names:[],mappings:'AAAA'},artifactCap=Buffer.byteLength(canonical(parallelMap))*7;
 await json('/api/projects/other/artifact-storage','PUT',{revision:0,artifact_storage_cap:artifactCap});
 const uploads=await Promise.all(Array.from({length:30},(_,i)=>req('/api/projects/other/artifacts','POST',{release:'r1',build:'b1',debugId:'parallel-'+i,map:parallelMap})));assert.ok(uploads.some(r=>r.status===201)&&uploads.some(r=>r.status===429),'parallel uploads observe the owner byte cap without exceeding it');assert.ok(uploads.every(r=>[201,429].includes(r.status)));
 assert.ok((await json('/api/projects/other/artifact-storage')).bytes<=artifactCap,'the concurrent inserts stay within the configured stored-byte cap');
 for(const response of uploads.filter(row=>row.status===429))assert.match((await response.json()).error,/storage cap [0-9]+ bytes/,'every refused map names its storage cap');
 const beforeDuplicates=(await json('/api/projects/web/outcomes')).rows.find(r=>r.reason==='duplicate')?.count??0;
 let concurrentDuplicateResponses=0;for(let cohort=0;cohort<3;cohort++){const results=await Promise.all(Array.from({length:50},()=>req('/api/ingest/web','POST',{...event,eventId:'accounting-cohort-'+cohort},auth)));await writeFile(resolve('.artifacts','cohort-'+runId+'-'+cohort+'.json'),JSON.stringify(await Promise.all(results.map(async r=>({requestId:r.fixtureRequest,status:r.status,bodyBytes:(await r.clone().arrayBuffer()).byteLength}))),null,2));assert.equal(results.filter(r=>r.status===201).length,1);assert.ok(results.every(r=>[200,201].includes(r.status)),'Concurrent cohort must contain only accepted or duplicate responses');concurrentDuplicateResponses+=results.filter(r=>r.status===200).length;}
 const duplicates=await Promise.all(Array.from({length:50},()=>req('/api/ingest/web','POST',event,auth)));const duplicateEvidence=await Promise.all(duplicates.map(async r=>({requestId:r.fixtureRequest,status:r.status,bodyBytes:(await r.clone().arrayBuffer()).byteLength})));await writeFile(resolve('.artifacts','duplicate-'+Date.now()+'.json'),JSON.stringify(duplicateEvidence,null,2));await writeFile(resolve('.artifacts','duplicate-state-'+runId+'.json'),JSON.stringify({beforeDuplicates,concurrentDuplicateResponses,duplicateStatuses:duplicateEvidence.map(r=>r.status),outcomes:await json('/api/projects/web/outcomes'),issueCount:(await json('/api/projects/web/issues')).length},null,2));assert.ok(duplicates.every(r=>r.status===200),'every exact retry is accepted as a duplicate');const duplicateCounters=await json('/api/projects/web/outcomes');assert.equal(duplicateCounters.rows.find(r=>r.reason==='duplicate').count-beforeDuplicates,concurrentDuplicateResponses+50);
 if(duplicateOnly){console.log('Exact duplicate investigation passed: three50-request cohorts plus50 existing-ID duplicates, unchanged accounting.');}else{
 const budgetProject=await json('/api/projects','POST',{id:'budget',name:'Budget test'});await json('/api/projects/budget/releases','POST',{name:'r1',build:'b1'});
 if(Date.now()%60000>50000)await new Promise(r=>setTimeout(r,60000-Date.now()%60000+20));
 const burst=await Promise.all(Array.from({length:140},(_,i)=>req('/api/ingest/budget','POST',{...event,eventId:'budget-'+i},{Authorization:`Bearer ${budgetProject.ingestKey}`})));const burstEvidence=await Promise.all(burst.map(async r=>({requestId:r.fixtureRequest,status:r.status,bodyBytes:(await r.clone().arrayBuffer()).byteLength})));await writeFile(resolve('.artifacts','latest-burst-results.json'),JSON.stringify(burstEvidence,null,2));await writeFile(resolve('.artifacts','burst-'+Date.now()+'.json'),JSON.stringify(burstEvidence,null,2));assert.ok(burst.some(r=>r.status===201)&&burst.some(r=>r.status===429),'admission workload reaches a real capacity boundary');assert.ok(burst.every(r=>[201,429].includes(r.status)));const admittedCount=burst.filter(r=>r.status===201).length;const budgetGroups=await json('/api/projects/budget/issues');assert.equal(budgetGroups.reduce((n,g)=>n+g.count,0),admittedCount,'only admitted occurrences mutate aggregates');const budgetOutcomes=await json('/api/projects/budget/outcomes');assert.ok(!budgetOutcomes.rows.some(r=>r.reason==='storage_failure'));
 const older=await json('/api/ingest/web','POST',{...event,eventId:'retention-old',message:'RETENTION_OLD_CONTEXT',frames:[{...event.frames[0],function:'retentionCase'}]},auth);await new Promise(r=>setTimeout(r,20));const retentionCutoff=Date.now();await new Promise(r=>setTimeout(r,20));await json('/api/ingest/web','POST',{...event,eventId:'retention-new',message:'RETAINED_NEW_CONTEXT',frames:[{...event.frames[0],function:'retentionCase'}]},auth);
 await json('/api/ingest/web','POST',{...event,eventId:'long-title',message:'x'.repeat(1000),frames:[{...event.frames[0],function:'longTitle'}]},auth);
 for(const [index,message] of ['a@b.test '.repeat(111),'token=x '.repeat(125),'😀'.repeat(500)].entries())await json('/api/ingest/web','POST',{...event,eventId:'expanded-title-'+index,message,frames:[{...event.frames[0],function:'expandedTitle'+index}]},auth);
 await json('/api/ingest/web','POST',{...event,eventId:'combined-type-scrub',type:'token',message:'synthetic-value',frames:[{...event.frames[0],function:'combinedScrub'}]},auth);
 await operatorFlow({req,json});
 const inbound=await json('/api/projects/web/inbound-filters');inbound.policy.filters.messages={enabled:true,values:['*noise from old checkout*']};await json('/api/projects/web/inbound-filters','PUT',{revision:inbound.revision,policy:inbound.policy});
 const bundleRetention=await bundleGroupingFlow({json});
 const archive=await json('/api/archive');assert.ok(!JSON.stringify(archive).includes('a@b.test'));assert.ok(!JSON.stringify(archive).includes('token=x'));await stop();await start(resolve(temporary,'state-a'),false);await login({bootstrap:false});await setupLocation(true);assert.ok(isDeepStrictEqual((await json('/api/archive')).data,archive.data),'private domain rows match exactly');assert.ok(!JSON.stringify(archive).includes(project.ingestKey));assert.ok(!('credentials' in archive.data));assert.ok(!('sessions' in archive.data));
 assert.equal((await req('/api/restore','POST',archive.text)).status,409);

 await stop();cookie='';await start(resolve(temporary,'state-b'));await login({choosePolicy:false});await setupLocation(false);
 assert.equal((await req('/api/restore','POST',{...nativeArchive(archive.data),checksum:'broken'})).status,400);
 const poisoned=nativeArchive(archive.data);poisoned.data.issues[0].title='token=test-spool-restore-title-canary alice@private.example';poisoned.data.events[0].diagnostic=JSON.stringify([{generated:{secret:'synthetic-test-spool-restore-diagnostic-canary'},status:'mapped',original:{sourceContent:'test-spool-restore-source-canary'}}]);poisoned.checksum=createHash('sha256').update(canonical({version:poisoned.version,migration:poisoned.migration,data:poisoned.data})).digest('hex');assert.equal((await req('/api/restore','POST',poisoned)).status,400);assert.ok(isDeepStrictEqual(await json('/api/projects'),[]),'private domain rows match exactly');

 await operatorArchiveTamper({archive,req,json});
 const retiredConfiguration=[...archive.manifest.requiredConfiguration];retiredConfiguration.splice(2,0,'SETUP_TOKEN');
 const emptyArchive=await json('/api/archive');
 assert.equal((await req('/api/restore','POST',await archiveConfiguration(emptyArchive.text,[...retiredConfiguration,'UNEXPECTED_CONFIGURATION']))).status,400,'retiring bootstrap configuration does not permit unrelated inventory changes');
 assert.deepEqual(await json('/api/projects'),[],'configuration refusal preserves an empty destination');
 await json('/api/restore','POST',await archiveConfiguration(archive.text,retiredConfiguration));await setupLocation(true);const restored=await json('/api/archive');assert.deepEqual(restored.data.grouping_proposals,archive.data.grouping_proposals,'AI-005 proposal records round trip inert with original decisions');assert.ok(restored.data.grouping_proposals.some(p=>p.state==='proposed'),'Unapproved restored advice stays proposed');assert.ok(isDeepStrictEqual(restored.data,archive.data),'private domain rows match exactly');assert.deepEqual((await json('/api/projects/web/inbound-filters')).policy,inbound.policy,'inbound policy survives independent private restore');
 await bundleRetention();
 const before=await json('/api/projects/web/retention','POST',{cutoff:Date.now(),apply:false});assert.ok(before.events>0);
 await json('/api/projects/web/retention','POST',{cutoff:retentionCutoff,apply:true});const retainedPacket=await json(`/api/projects/web/issues/${older.issue}/packet`);assert.equal(retainedPacket.issue.count,1);assert.equal(retainedPacket.issue.title,'TypeError: RETAINED_NEW_CONTEXT');assert.ok(!JSON.stringify(retainedPacket).includes('RETENTION_OLD_CONTEXT'));
 const retainedArchive=await json('/api/archive');await stop();cookie='';await start(resolve(temporary,'state-c'));await login({choosePolicy:false});await json('/api/restore','POST',retainedArchive.text);assert.ok(isDeepStrictEqual((await json('/api/archive')).data,retainedArchive.data),'private domain rows match exactly');
 await json('/api/projects/web/retention','POST',{cutoff:Date.now(),apply:true});groups=await json('/api/projects/web/issues');assert.ok(groups.every(g=>g.count===0));
 await operatorRetentionAndErasure({req,json});
 console.log('Spool emitted Worker/D1 acceptance passed: atomic retry, pre-scrub conflict, privacy, minified capture, CSRF, delayed release/regression, archive independent restore, retention.');
 console.log(withoutBrowser?'Non-browser domain gate: browser capture/UI skipped under explicit launch hold; separate Worker transport passed.':'Real Chromium automatic exception, stored-group browsing/selection and separate Worker waitUntil transport also passed.');
}
}catch(error){failure=error}finally {
 const result=await finishProductRun({failure,output,artifactDirectory,runId,cleanup:[
  ['capture-worker',()=>stopChild(captureWorker,{group:true})],
  ['browser',async()=>{if(browser)await browser.close()}],
  ['product-worker',stop],
  ['temporary-files',async()=>{if(temporary)await rm(temporary,{recursive:true,force:true})}],
  ['request-probe',async()=>{if(process.argv.includes('--probe-request-path'))await rm(resolve('dist/server/duplicate-probe.js'),{force:true})}]
 ]});
 if(result.failed){console.error('Product acceptance failed:',JSON.stringify(result));process.exitCode=1}
}
