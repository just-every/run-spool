import { loaderPage } from './loader-page.mjs';
import { loaderFlow } from './loader-flow.mjs';
// [SDK-001] [SDK-023] Browser and Node qualification through the public intake, API and UI.
import { qualifyBrowser } from './runtimes/browser.mjs';
import { sdkInboundFilterFlow } from './inbound-filter-flow.mjs';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { build as viteBuild } from 'vite';
import { spoolSourceMaps } from '../packages/sdk/src/sourcemaps/plugin.mjs';
import { startTestWorker } from './worker.mjs';
import { signIn, browserSignIn } from './auth.mjs';
import { launchBrowser } from './browser-launch.mjs';
import { sourceMapCli } from '../packages/sdk/src/sourcemaps/cli.mjs';
import { parseEnvelope, objectJson } from '../src/domain/sentry/wire.ts';
const require=createRequire(import.meta.url),temporary=await mkdtemp(resolve(tmpdir(),'spool-sentry-sdk-'));
let worker,browser,application,collector;
const captures=[];
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(`http://127.0.0.1:${server.address().port}`)));
const close=server=>server?new Promise(resolve=>server.close(resolve)):Promise.resolve();
try{
  worker=await startTestWorker(15521);const {origin}=worker,cookie=await signIn(origin);
  const request=async(path,method='GET',body)=>{const response=await fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,...body?{'Content-Type':'application/json'}:{}},...body?{body:JSON.stringify(body)}:{}});assert.ok(response.ok,`${method} ${path}: HTTP ${response.status}`);return response.json()};
  const project=await request('/api/projects','POST',{id:'sdk',name:'SDK compatibility'});
  const deploy=await request('/api/projects/sdk/keys','POST',{kind:'deploy'});
  const sdkConfig={release:'browser@1.0.0',dist:'build-1',environment:'compatibility'};
  const source=await readFile('tests/runtimes/browser/app.js','utf8');
  const expectedLine=source.split('\n').findIndex(line=>line.includes('return account.address.city'))+1;
  const entry=resolve(temporary,'checkout.js'),bundle=resolve(temporary,'app.js');await writeFile(entry,source);
  process.env.SPOOL_FIXTURE_DEPLOY_KEY=deploy.key;
  await viteBuild({configFile:false,root:temporary,logLevel:'silent',plugins:[spoolSourceMaps({endpoint:origin,project:'sdk',release:sdkConfig.release,build:sdkConfig.dist,keyEnv:'SPOOL_FIXTURE_DEPLOY_KEY'})],build:{outDir:temporary,emptyOutDir:false,sourcemap:true,minify:'esbuild',lib:{entry,formats:['es'],fileName:()=> 'app.js'},rollupOptions:{external:['@sentry/browser']}}});
  assert.ok(!(await readFile(bundle,'utf8')).includes(deploy.key),'deploy credential stays out of browser bundle');
  await build({stdin:{contents:"export * from '@sentry/browser';",resolveDir:process.cwd()},outfile:resolve(temporary,'sdk.js'),bundle:true,minify:true,format:'esm',platform:'browser'});
  const uploaded=await sourceMapCli(['--endpoint',origin,'--project','sdk','--release',sdkConfig.release,'--build',sdkConfig.dist,'--key-env','SPOOL_FIXTURE_DEPLOY_KEY',bundle]);assert.equal(uploaded.uploaded,1);
  await sourceMapCli(['--endpoint',origin,'--project','sdk','--release',sdkConfig.release,'--build',sdkConfig.dist,'--key-env','SPOOL_FIXTURE_DEPLOY_KEY',bundle]);
  delete process.env.SPOOL_FIXTURE_DEPLOY_KEY;
  collector=createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin','*');const chunks=[];for await(const chunk of req)chunks.push(chunk);const compressed=Buffer.concat(chunks);const data=req.headers['content-encoding']==='gzip'?gunzipSync(compressed):compressed;const envelope=parseEnvelope(data);captures.push({gzip:req.headers['content-encoding']==='gzip',envelope});res.setHeader('Content-Type','application/json');res.end('{}')});
  const referenceOrigin=await listen(collector),referenceDsn=referenceOrigin.replace('://','://reference@')+'/1';
  const dsns={reference:referenceDsn,spool:project.dsn};
  assert.ok(project.dsn,'Project creation returns numeric scoped DSN');
  application=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(loaderPage(url,res,dsns.loader))return;if(url.pathname==='/empty'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Navigation complete</title>');return}if(url.pathname==='/app.js'||url.pathname==='/sdk.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(resolve(temporary,url.pathname.slice(1))));return}const dsn=dsns[url.searchParams.get('target')];if(!dsn){res.writeHead(404);res.end();return}res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>Unmodified SDK application</title><button>Throw checkout exception</button><script>globalThis.__DSN__=${JSON.stringify(dsn)};globalThis.__SDK_CONFIG__=${JSON.stringify(sdkConfig)}</script><script type="importmap">{"imports":{"@sentry/browser":"/sdk.js"}}</script><script type="module" src="/app.js"></script>`)}catch{res.writeHead(500);res.end()}});
  const applicationOrigin=await listen(application);await request('/api/projects/sdk/browser-origins','POST',{origin:applicationOrigin});
  browser=await launchBrowser();
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
    const rejectedProject=`unregistered-${width}`;
    dsns.rejected=(await request('/api/projects','POST',{id:rejectedProject,name:'Release rejection'})).dsn;
    await request(`/api/projects/${rejectedProject}/release-policy`,'PUT',{revision:0,policy:{version:1,order:'registered',pattern:'*'}});
    await request(`/api/projects/${rejectedProject}/browser-origins`,'POST',{origin:applicationOrigin});
    await page.goto(applicationOrigin+'/?target=rejected');await page.waitForFunction(()=>window.__SDK_READY__);await page.getByRole('button',{name:'Throw checkout exception',exact:true}).click();
    let rejectedReceipt;
    for(let attempt=0;attempt<100;attempt++){rejectedReceipt=(await request(`/api/projects/${rejectedProject}/outcomes`)).rows.find(row=>row.reason==='unregistered_release_or_build');if(rejectedReceipt)break;await new Promise(r=>setTimeout(r,50))}
    assert.ok(rejectedReceipt,'real SDK rejection persists its reason');
    const rejectionOwner=await context.newPage();await browserSignIn(rejectionOwner,origin);await rejectionOwner.goto(`${origin}/projects/${rejectedProject}/capture`);
    await rejectionOwner.getByRole('link',{name:'Register the release and build'}).click();await rejectionOwner.waitForURL(`${origin}/projects/${rejectedProject}/releases`);
    assert.equal((await request(`/api/projects/${rejectedProject}/issues`)).length,0,'Register navigation does not fabricate acceptance');await rejectionOwner.close();
    const referenceCount=captures.flatMap(c=>c.envelope.items).filter(i=>i.header.type==='event').length;
    const beforeGroups=await request('/api/projects/sdk/issues');const beforeCount=beforeGroups.reduce((sum,row)=>sum+row.count,0);
    await page.goto(applicationOrigin+'/?target=reference');await page.waitForFunction(()=>window.__SDK_READY__);await page.getByRole('button',{name:'Throw checkout exception',exact:true}).click();
    for(let attempt=0;attempt<100&&captures.flatMap(c=>c.envelope.items).filter(i=>i.header.type==='event').length<=referenceCount;attempt++)await new Promise(r=>setTimeout(r,50));
    assert.ok(captures.flatMap(c=>c.envelope.items).filter(i=>i.header.type==='event').length>referenceCount,'this reference throw reached the network collector');
    const reference=captures.flatMap(c=>c.envelope.items).filter(i=>i.header.type==='event').map(i=>objectJson(i.bytes)).at(-1);assert.ok(reference?.debug_meta?.images?.length,'unmodified SDK emits debug metadata');assert.ok(reference.sdk.integrations.length>1,'default integrations remain active');
    await page.goto(applicationOrigin+'/?target=spool');await page.waitForFunction(()=>window.__SDK_READY__);await page.getByRole('button',{name:'Throw checkout exception',exact:true}).click();
    let issue,packet;
    for(let attempt=0;attempt<100;attempt++){issue=(await request('/api/projects/sdk/issues')).find(row=>row.title.includes('TypeError'));if(issue){packet=await request(`/api/projects/sdk/issues/${issue.id}/packet`);if(issue.count>beforeCount&&packet.events.some(e=>e.event.environment==='compatibility'))break}await new Promise(r=>setTimeout(r,100))}
    assert.ok(issue?.count>beforeCount,'this browser throw was admitted');
    assert.ok(issue,'browser default global handler creates a native issue');const captured=packet.events.find(e=>e.event.environment==='compatibility');assert.equal(captured.atAdmission[0].status,'mapped');assert.equal(captured.atAdmission[0].original.line,expectedLine);assert.equal(captured.event.release,reference.release);assert.equal(captured.event.build,reference.dist);
    const owner=await context.newPage();await browserSignIn(owner,origin);await owner.goto(`${origin}/projects/sdk/issues/${issue.id}`);await owner.getByText(new RegExp(`checkout\\.js:${expectedLine}:`)).first().waitFor();
    await page.evaluate(({id,width})=>window.sendFeedback(`Checkout report ${width}: payment confirmation never appeared`,id),{id:captured.id,width});
    await owner.getByRole('button',{name:'Refresh feedback',exact:true}).click();
    await owner.getByText(`Checkout report ${width}: payment confirmation never appeared`,{exact:true}).waitFor();
    const feedback=await request('/api/projects/sdk/feedback');assert.ok(feedback.items.some(row=>row.eventId===captured.id&&row.issueId===issue.id));assert.ok(!JSON.stringify(feedback).includes('feedback-private@example.com'));assert.ok(!JSON.stringify(feedback).includes('Private Feedback Name'));
    assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await context.close();
  }
  await qualifyBrowser({browser,origin,cookie,request,applicationOrigin,dsns,expectedLine,upload:async project=>{
    process.env.SPOOL_FIXTURE_DEPLOY_KEY=(await request(`/api/projects/${project}/keys`,'POST',{kind:'deploy'})).key;
    try{await sourceMapCli(['--endpoint',origin,'--project',project,'--release',sdkConfig.release,'--build',sdkConfig.dist,'--key-env','SPOOL_FIXTURE_DEPLOY_KEY',bundle])}finally{delete process.env.SPOOL_FIXTURE_DEPLOY_KEY}
  }});
  await loaderFlow({browser,origin,cookie,request,applicationOrigin,dsns});
  await sdkInboundFilterFlow({request,origin,browser,temporary,require,applicationOrigin,dsns});
  const nodeEntry=resolve(temporary,'node-client.mjs');
  // This exact program/config runs twice. Only the DSN environment value differs.
  await writeFile(nodeEntry,`import * as Sentry from ${JSON.stringify(require.resolve('@sentry/node'))};\nSentry.init({dsn:process.env.FIXTURE_DSN,release:'node@1.0.0',dist:'node-build',environment:'compatibility'});\nSentry.setContext('sized',{value:'x'.repeat(40000)});\ntry{const account={};account.address.city}catch(error){const eventId=Sentry.captureException(error);await Sentry.flush(10000);Sentry.captureFeedback({message:'Node checkout feedback',associatedEventId:eventId,email:'node-feedback-private@example.com'})}\nconst flushed=await Sentry.flush(10000);await Sentry.close(10000);if(!flushed)process.exitCode=1;\n`);
  await request('/api/projects/sdk/releases','POST',{name:'node@1.0.0',build:'node-build'});
  for(const dsn of [referenceDsn,project.dsn])await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[nodeEntry],{env:{...process.env,FIXTURE_DSN:dsn},stdio:['ignore','ignore','ignore']});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`Node SDK exited ${code}`)))});
  assert.ok(captures.some(c=>c.gzip&&c.envelope.items.some(i=>i.header.type==='event')),'real Node SDK uses gzip for its large enriched event');
  const issues=await request('/api/projects/sdk/issues');let nodeEvent;for(const issue of issues){const packet=await request(`/api/projects/sdk/issues/${issue.id}/packet`);nodeEvent??=packet.events.find(event=>event.event.release==='node@1.0.0')}
  assert.ok((await request('/api/projects/sdk/feedback')).items.some(row=>row.message==='Node checkout feedback'&&row.issueId),'real Node SDK feedback attaches to its occurrence');assert.ok(nodeEvent,'real Node capture+close reaches native evidence');assert.ok(nodeEvent.event.sentry.contexts.sized.value.startsWith('x'));assert.ok(nodeEvent.event.sentry.contexts.sized.value.includes('[truncated]'));assert.ok(nodeEvent.event.sentry.truncation.some(row=>row.path==='contexts.sized.value'&&row.reason==='value_bytes'));
  console.log(JSON.stringify({passed:true,browser:require('@sentry/browser/package.json').version,node:require('@sentry/node/package.json').version,proof:'Unmodified SDK programs/configs with DSN switched only: browser 1440/390 original source line through build plugin and CLI, Node gzip capture+flush.'}));
}finally{delete process.env.SPOOL_FIXTURE_DEPLOY_KEY;await browser?.close();await close(application);await close(collector);await worker?.stop();await rm(temporary,{recursive:true,force:true})}
