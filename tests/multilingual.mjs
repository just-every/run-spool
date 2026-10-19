import {followErasure} from './project-erasure/follow.mjs';
import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queuedExit=await queuedEntrypoint(import.meta.url);if(queuedExit!==null)process.exit(queuedExit);
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {executionRuntime} from './execution/runtime.mjs';
import {launchBrowser} from './browser-launch.mjs';
import {openGate} from './auth.mjs';
import {mappingArchive} from './multilingual/archive.mjs';
import {exceptionTrust} from './multilingual/trust.mjs';
const state=await mkdtemp(join(tmpdir(),'spool-languages-')),restoredState=await mkdtemp(join(tmpdir(),'spool-languages-restore-'));
let app,restored,browser;
try{
 app=await executionRuntime(state,15484);
 const project=await app.json('/api/projects','POST',{id:'languages',name:'Language evidence'}),other=await app.json('/api/projects','POST',{id:'elsewhere',name:'Other project'});
 const p='/api/projects/languages',release={name:'server-1',build:'b1'},headers={Cookie:'',Authorization:'Bearer '+project.ingestKey};
 await app.json(`${p}/releases`,'POST',release);
 const previous=await mappingArchive(await (await app.request('/api/archive')).text(),()=>{},true);
 const base={version:1,release:release.name,build:release.build,environment:'production',breadcrumbs:[]};
 // Synthetic absolute paths exercise home-directory and query scrubbing.
 const posixHome=['','home','PRIVATE_USER','app'].join('/'),scrubbedPosixHome=['','home','[user]','app'].join('/');
 const windowsHome=['C:','users','PRIVATE_WINDOWS'],scrubbedWindowsHome=['C:','users','[user]'].join('/');
 const python=`Traceback (most recent call last):\n  File "${posixHome}/old.py", line 2, in old\n    PRIVATE_SOURCE\nKeyError: prior\n\nDuring handling of the above exception, another exception occurred:\n\nTraceback (most recent call last):\n  File "${posixHome}/main.py", line 8, in run\n    PRIVATE_SOURCE\n  File "${posixHome}/cart.py?private=PRIVATE_QUERY", line 42, in checkout\n    PRIVATE_SOURCE = "ExceptionGroup"\nValueError: quantity\nPRIVATE_NOTE\n  File "PRIVATE_NOTE.py", line 9, in note\nTraceback (most recent call last):\n  File "PRIVATE_NOTE.py", line 10, in note\nValueError: note`;
 const go='panic: quantity\n\ngoroutine 4 [runnable]:\nother.ready(PRIVATE_OTHER)\n\t/private/other.go:99 +0x1\n\ngoroutine 7 [running]:\nmain.(*账本[go.shape.int]).Checkout(0x1234, PRIVATE_ARGS)\n\t/build/service/cart.go:42 +0x42\nmain.main()\n\t/build/service/main.go:8 +0x12\n\ngoroutine 1 [chan receive]:\nother.wait(PRIVATE_OTHER)\n\t/private/other.go:99 +0x1';
 const ingest=async(value,status=201)=>{try{return await app.json('/api/ingest/languages','POST',value,headers,status);}catch(error){error.message=`Native fixture ${value.eventId}: ${error.message}`;throw error;}};
 const py=await ingest({...base,eventId:'python-raw',language:'python',stack:python}),goResult=await ingest({...base,eventId:'go-raw',language:'go',stack:go});
 const packet=issue=>app.json(`${p}/issues/${issue}/packet`);
 let pyPacket=await packet(py.issue),goPacket=await packet(goResult.issue);
 assert.equal(pyPacket.events[0].event.type,'ValueError');assert.equal(pyPacket.events[0].event.frames[0].line,42);assert.equal(pyPacket.events[0].event.frames[0].column,null);
 assert.equal(pyPacket.events[0].event.frames[0].file,`${scrubbedPosixHome}/cart.py`);assert.equal(goPacket.events[0].event.frames.length,2);assert.equal(goPacket.events[0].event.frames[0].function,'main.(*账本[go.shape.int]).Checkout');
 const rawAdmissions={python:pyPacket.events[0].atAdmission,go:goPacket.events[0].atAdmission};
 const alias=new URL(project.dsn).pathname.slice(1);
 await exceptionTrust(app,ingest,packet,base,alias,project.ingestKey);
 for(const [language,issue,source] of [['python',py.issue,pyPacket],['go',goResult.issue,goPacket]]){
  const event=source.events[0].event;
  const equivalent=await ingest({...event,eventId:language+'-structured',message:'changed message'});assert.equal(equivalent.issue,issue);
  const sentry={event_id:(language==='python'?'a':'b').repeat(32),platform:language,release:release.name,dist:release.build,environment:'production',exception:{values:[{type:event.type,value:'other message',stacktrace:{frames:[...event.frames].reverse().map(f=>({filename:f.file,lineno:f.line,function:f.function,vars:{secret:'PRIVATE_LOCALS'},context_line:'PRIVATE_CONTEXT'}))}}]},user:{email:'PRIVATE_USER'},extra:{private:'PRIVATE_EXTRA'}};
  await app.json(`/api/${alias}/store/`,'POST',sentry,{Cookie:'','X-Sentry-Auth':`Sentry sentry_version=7,sentry_key=${project.ingestKey}`},200);
  const malformed=structuredClone(sentry);malformed.event_id=(language==='python'?'c':'d').repeat(32);malformed.exception.values[0].stacktrace.frames.at(-1).lineno=-1;
  await app.json(`/api/${alias}/store/`,'POST',malformed,{Cookie:'','X-Sentry-Auth':`Sentry sentry_version=7,sentry_key=${project.ingestKey}`},200);
  const chainIssue=(await app.json(`${p}/issue-search?q=`+encodeURIComponent(`error.type:${event.type}`))).rows.find(row=>row.algorithm==='sentry-chain-v1');assert.ok(chainIssue);assert.notEqual(chainIssue.id,issue);const chainPacket=await packet(chainIssue.id);assert.equal(chainPacket.events[0].event.sentry.exceptions.length,1);assert.ok(!JSON.stringify(chainPacket).includes('PRIVATE_CONTEXT'));assert.ok(!JSON.stringify(chainPacket).includes('PRIVATE_EXTRA'));
  const updated=await packet(issue);assert.equal(updated.issue.count,2);assert.ok(updated.events.every(e=>e.originalGrouping.issue===issue&&e.event.language===language));
  const deceptive=await ingest({...event,eventId:language+'-deceptive',frames:[{file:'evil.js',line:1,column:0,function:'main',debugId:'evil-map'}]});
  const repro=await app.json(`${p}/reproducers`,'POST',{event:language+'-deceptive',input:[]});assert.equal(repro.support,'unsupported');assert.equal(repro.reason,'capture_language_unsupported');
  await app.json(`${p}/reproducers/${repro.id}/runs`,'POST',{},undefined,409);
 }
 await app.json(`${p}/artifacts`,'POST',{release:release.name,build:release.build,debugId:'evil-map',map:{version:3,sources:['evil.js'],sourcesContent:['export default function main(){throw Error("never run")}'],names:[],mappings:'AAAA'}});
 for(const language of ['python','go']){const blocked=await app.json(`${p}/reproducers`,'POST',{event:language+'-deceptive',input:[]});assert.equal(blocked.support,'unsupported');}
 await ingest({...base,eventId:'python-raw',language:'python',stack:python},200);
 await ingest({...base,eventId:'python-raw',language:'python',stack:python.replace('PRIVATE_SOURCE','ALTERED_SOURCE')},409);
 for(const input of [
  {...base,eventId:'bad-python',language:'python',stack:'ExceptionGroup: unsupported'},
  {...base,eventId:'bad-python-location',language:'python',stack:python.replace('line 42','line -1')},
  {...base,eventId:'bad-go-location',language:'go',stack:'panic: bad\n\ngoroutine 1 [running]:\nmain.crash()\n\t/app/crash.go:-1'},
  {...base,eventId:'bad-mixed',language:'go',stack:'panic: bad\nmain.crash()\n\tcrash.go:1\n'+python},
  {...base,eventId:'bad-go-prefix',language:'go',stack:python+'\n'+go},
  {...base,eventId:'bad-python-prefix',language:'python',stack:go+'\n'+python},
  ...['python','go'].map(language=>({...base,eventId:'bad-empty-'+language,language,type:'Error',message:'bad',frames:[{file:'?query=only',line:1,function:'crash'}]})),
  {...base,eventId:'large',language:'go',stack:'a'.repeat(32769)},
  {...base,eventId:'bad',language:'python',stack:'not a traceback'},
 ])await ingest(input,400);
 const manifest={commitSha:'0123456789abcdef0123456789abcdef01234567',repository:'https://github.com/just-every/run-spool',deployedAt:'2026-10-15T00:00:00.000Z',environment:'production',pathMappings:[{from:'/build',to:'fallback'},{from:'/build/service',to:'src'},{from:'example.com/service',to:'.'}]};
 const deploy=await app.json(`${p}/keys`,'POST',{kind:'deploy'}),agent=await app.json(`${p}/keys`,'POST',{kind:'agent'});
 for(const denied of [{Cookie:''},{Cookie:'',Authorization:'Bearer '+agent.key},{Cookie:'',Authorization:'Bearer '+other.ingestKey}]){
  const r=await app.request(`${p}/releases`,'POST',{...release,manifest},denied);assert.ok([401,403].includes(r.status));await r.body?.cancel();
 }
 const deployHeaders={Cookie:'',Authorization:'Bearer '+deploy.key};
 await app.json(`${p}/releases`,'POST',{...release,manifest},deployHeaders);
 await app.json(`${p}/releases`,'POST',{...release,manifest},deployHeaders);
 await app.json(`${p}/releases`,'POST',{...release,manifest:{...manifest,pathMappings:[{from:'/build',to:'changed'}]}},deployHeaders,409);
 await app.json('/api/projects/elsewhere/releases','POST',{...release,manifest},deployHeaders,403);
 for(const path of ['/api/archive',`${p}/issues/${goResult.issue}/packet`]){const r=await app.request(path,'GET',undefined,deployHeaders);assert.ok([401,403].includes(r.status));await r.body?.cancel();}
 for(const to of ['../escape','/absolute','src/%2e%2e','src?secret=yes'])await app.json(`${p}/releases`,'POST',{...release,manifest:{...manifest,pathMappings:[{from:'/build',to}]}},undefined,400);
 await app.json(`${p}/releases`,'POST',{...release,manifest:{...manifest,pathMappings:[{from:windowsHome.join('/'),to:'src'}]}},undefined,400);
 goPacket=await packet(goResult.issue);
 assert.deepEqual(goPacket.events.find(e=>e.id==='go-raw').atAdmission,rawAdmissions.go);
 assert.ok(goPacket.events.every(e=>e.currentLookup[0].status==='go_path_mapped'&&e.currentLookup[0].original.file==='src/cart.go'));
 assert.equal(goPacket.events[0].currentLookup[0].mapping.commitSha,manifest.commitSha);
 const alternate=await ingest({...goPacket.events[0].event,eventId:'go-staging',environment:'staging'});assert.equal(alternate.diagnostic[0].status,'go_mapping_unavailable');
 const mismatch=await ingest({...goPacket.events[0].event,eventId:'go-unmatched',frames:[{file:'/elsewhere/cart.go',line:42,function:'main.(*Cart).Checkout'}]});assert.equal(mismatch.diagnostic[0].status,'go_path_unmatched');
 const moduleRoot=await ingest({...goPacket.events[0].event,eventId:'module-root',frames:[{file:'example.com/service/cart.go',line:42,function:'main.Checkout'}]});assert.equal(moduleRoot.diagnostic[0].original.file,'cart.go');
 const sibling=await ingest({...goPacket.events[0].event,eventId:'module-sibling',frames:[{file:'example.com/service-other/cart.go',line:42,function:'main.Checkout'}]});assert.equal(sibling.diagnostic[0].status,'go_path_unmatched');
 await ingest({...goPacket.events[0].event,eventId:'go-pointer-type',type:'*runtime.TypeAssertionError'});
 const windows=await ingest({...pyPacket.events[0].event,eventId:'windows',frames:[{file:[...windowsHome,'cart.py?token=PRIVATE_QUERY'].join('\\'),line:42,function:'checkout'}]});assert.equal(windows.diagnostic[0].generated.file,`${scrubbedWindowsHome}/cart.py`);
 const js=await ingest({...base,eventId:'js',type:'ValueError',message:'quantity',frames:[{...pyPacket.events[0].event.frames[0],column:0}]});assert.notEqual(js.issue,py.issue);
 await ingest({...goPacket.events[0].event,eventId:'go-ui',environment:'production'});
 const countBefore=(await app.json(`${p}/issues`)).reduce((n,i)=>n+i.count,0);
 const archive=await (await app.request('/api/archive')).text();
 for(const secret of ['PRIVATE_USER','PRIVATE_SOURCE','PRIVATE_ARGS','PRIVATE_OTHER','PRIVATE_LOCALS','PRIVATE_NOTE','PRIVATE_WINDOWS','PRIVATE_QUERY'])assert.ok(!archive.includes(secret),`discard ${secret}`);
 assert.ok(archive.includes('PRIVATE_CONTEXT'),'SDK source context retained in private archive');assert.ok(archive.includes('PRIVATE_EXTRA'),'ordinary structured extra retained in private archive');
 assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM deployment_path_mappings').first()).n,1);
 // Free the first worker before restoration: one Worker runtime at a time.
 await app.stop();app=null;
 restored=await executionRuntime(restoredState,15485);
 for(const edit of [
  rows=>{rows.deployment_path_mappings[0].payload=JSON.stringify([{from:'/build',to:'../escape'}]);},
  rows=>{rows.deployment_path_mappings[0].project='elsewhere';},
  rows=>{rows.deployment_path_mappings[0].build='wrong-build';},
  rows=>{const row=rows.events.find(e=>JSON.parse(e.diagnostic).some(d=>d.status==='go_path_mapped'));const diagnostic=JSON.parse(row.diagnostic);diagnostic.find(d=>d.mapping).mapping.repository='https://example.com/forged';row.diagnostic=JSON.stringify(diagnostic);},
 ]){
  await restored.json('/api/restore','POST',await mappingArchive(archive,edit),{'X-Confirm-Restore':'yes'},400);
  assert.deepEqual(await restored.json('/api/projects'),[],'semantic archive rejection leaves destination empty');
 }
 await restored.json('/api/restore','POST',archive,{'X-Confirm-Restore':'yes'});
 const after=await restored.json(`${p}/issues/${goResult.issue}/packet`);
 assert.equal(after.events.find(e=>e.id==='go-raw').event.exceptionSource,'parsed-text');
 assert.equal(after.events.find(e=>e.id==='go-raw').currentLookup[0].original.file,'src/cart.go');assert.deepEqual(after.events.find(e=>e.id==='go-raw').atAdmission,rawAdmissions.go);
 assert.equal((await restored.json(`${p}/issues`)).reduce((n,i)=>n+i.count,0),countBefore);
 const retainedSentry=(await restored.json(`${p}/issue-search?q=error.type:ValueError`)).rows.find(row=>row.algorithm==='sentry-chain-v1');const retainedList=await restored.json(`${p}/issues/${retainedSentry.id}/events`);const retainedDetail=await restored.json(`${p}/issues/${retainedSentry.id}/events/${retainedList.latest.id}?occurrence=${retainedList.latest.occurrence}`);assert.ok(retainedDetail.event.sentry.exceptions[0].stacktrace.frames.some(f=>f.context_line==='PRIVATE_CONTEXT'));assert.equal(retainedDetail.event.sentry.extra.private,'PRIVATE_EXTRA');
 assert.equal((await restored.db.prepare('SELECT COUNT(*) n FROM credentials').first()).n,0);
 if(!process.argv.includes('--no-browser')){
  await mkdir('.artifacts/languages',{recursive:true});
  browser=await launchBrowser();
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:900}});
   try{await openGate(context,restored.origin);await context.addCookies([{name:restored.cookie.split('=')[0],value:restored.cookie.slice(restored.cookie.indexOf('=')+1),url:restored.origin}]);const page=await context.newPage();
    await page.goto(`${restored.origin}/projects/languages/issues/${py.issue}`);await page.getByRole('heading',{name:'Stack trace',exact:true}).waitFor();await page.getByText('Exception type and frames were parsed from text for some retained occurrences.',{exact:false}).waitFor();assert.ok((await page.locator('.frame-coordinate').first().innerText()).endsWith('cart.py:42'));assert.ok(!(await page.locator('.frame-coordinate').first().innerText()).includes('null'));await page.screenshot({path:`.artifacts/languages/python-${width}.png`,fullPage:true});
    await page.goto(`${restored.origin}/projects/languages/issues/${goResult.issue}`);await page.getByRole('heading',{name:'Stack trace',exact:true}).waitFor();await page.locator('.frame-coordinate').filter({hasText:'src/cart.go:42'}).first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:`.artifacts/languages/go-${width}.png`,fullPage:true});
   }finally{await context.close();}
  }
  await browser.close();browser=null;
 }
 const preview=await restored.json(`${p}/erasure`);await followErasure(restored.json,await restored.json(`${p}/erasure`,'POST',{confirm:'languages',planHash:preview.planHash}));
 assert.equal((await restored.db.prepare('SELECT COUNT(*) n FROM deployment_path_mappings').first()).n,0);
 await restored.stop();restored=null;await rm(state,{recursive:true,force:true});
 app=await executionRuntime(state,15484);await app.json('/api/restore','POST',previous,{'X-Confirm-Restore':'yes'});
 assert.equal((await app.json(`${p}/releases`))[0].build,release.build);assert.ok(archive.includes('PRIVATE_CONTEXT'),'SDK source context retained in private archive');assert.ok(archive.includes('PRIVATE_EXTRA'),'ordinary structured extra retained in private archive');
 assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM deployment_path_mappings').first()).n,0);
 assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM inbound_filter_policies').first()).n,0,'pre-mapping archive starts inbound policies empty');
 for(const table of ['deployment_runs','deployment_steps','deployment_notices'])assert.equal((await app.db.prepare(`SELECT COUNT(*) n FROM ${table}`).first()).n,0,'pre-mapping archive starts '+table+' empty');
 console.log('Multilingual public journey passed: native/Sentry equivalence, grammar/privacy/deduplication, scoped late path mapping, unchanged admission, JS-only execution, archive restoration and project erasure.');
}finally{
 await browser?.close();await app?.stop();await restored?.stop();await rm(state,{recursive:true,force:true});await rm(restoredState,{recursive:true,force:true});
}
