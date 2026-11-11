import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {startTestWorker} from '/workspace/run-spool/tests/worker.mjs';
import {signIn,browserSignIn} from '/workspace/run-spool/tests/auth.mjs';
import {launchBrowser} from '/workspace/run-spool/tests/browser-launch.mjs';
const run=promisify(execFile),root='/workspace/run-spool',packet=process.env.HOME+'/rer-consolidation/work/main-spool-releases-plain-1/packet';
const mode=process.argv[2]??'before',dir=await mkdtemp('/tmp/spool-release-probe-');
let worker,browser;
try{
 const {stdout}=await run(process.execPath,['packages/sdk/build.mjs','--pack'],{cwd:root});
 const {tarball}=JSON.parse(stdout.trim().split('\n').at(-1));
 await writeFile(dir+'/package.json','{"private":true,"type":"module"}');
 await run('npm',['install',tarball,'--offline','--ignore-scripts','--no-audit','--no-fund'],{cwd:dir});
 worker=await startTestWorker(15699);const {origin}=worker,cookie=await signIn(origin);
 const req=async(path,method='GET',body)=>{const r=await fetch(origin+path,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.ok(r.ok,`${path}: ${r.status}`);return r.json()};
 await req('/api/projects','POST',{id:'synthetic-spool-23',name:'Synthetic storefront'});
 await req('/api/projects/synthetic-spool-23/releases','POST',{name:'storefront@2.3.0',build:'b2301'});
 const key=await req('/api/projects/synthetic-spool-23/keys','POST',{kind:'deploy'});
 await writeFile(dir+'/app.js','throw new Error("synthetic checkout");');
 await writeFile(dir+'/app.js.map',JSON.stringify({version:3,sources:['src/checkout.js'],sourcesContent:['throw new Error("synthetic checkout");'],names:[],mappings:'AAAA'}));
 const args=['--endpoint',origin,'--project','synthetic-spool-23','--release','storefront@2.3.0','--build','b2301','--key-env','SYNTHETIC_SPOOL_DEPLOY',dir+'/app.js'];
 const bin=dir+'/node_modules/.bin/spool-sourcemaps';
 const invoke=async extra=>{try{const r=await run(bin,[...args.map(arg=>extra.includes('--required-map')&&arg==='storefront@2.3.0'?'storefront@2.3.1':arg),...extra],{env:{...process.env,SYNTHETIC_SPOOL_DEPLOY:key.key}});return {exit:0,stdout:r.stdout.trim(),stderr:r.stderr.trim()}}catch(e){return {exit:e.code,stdout:e.stdout?.trim(),stderr:e.stderr?.trim()}}};
 const cli=await invoke([]),json=mode==='after'?await invoke(['--json']):null;
 const failure=await invoke(['--required-map','missing.js.map']);
 browser=await launchBrowser();const page=await browser.newPage();await browserSignIn(page,origin);
 const screens=[];let history;
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.goto(origin+'/projects/synthetic-spool-23/releases');
  const section=page.locator('section').filter({has:page.getByRole('heading',{name:'Release history',exact:true})});
  await section.getByText('storefront@2.3.0',{exact:true}).waitFor();
  history=await section.innerText();await section.scrollIntoViewIfNeeded();
  await page.screenshot({path:packet+`/${mode}-history-${width}.png`});
  await page.getByLabel(/^Your bundler/).selectOption('esbuild');
  await page.getByRole('heading',{name:'3. Build, stamp and upload',exact:true}).scrollIntoViewIfNeeded();
  if(mode==='after'&&width===390)await page.getByText('On success, the CLI prints a summary for the number of maps uploaded, for example:',{exact:true}).evaluate(node=>node.scrollIntoView({block:'center'}));
  await page.screenshot({path:packet+`/${mode}-step3-${width}.png`});
  screens.push({width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
 }
 if(mode==='after'){
  assert.equal(cli.exit,0);assert.match(cli.stdout,/^Uploaded 1 source map\.?$/);assert.throws(()=>JSON.parse(cli.stdout));
  assert.deepEqual(JSON.parse(json.stdout),{uploaded:1});assert.equal(json.exit,0);
  assert.equal(failure.exit,1);assert.match(failure.stderr,/missing\.js\.map/);
  assert.match(history,/Environment: not reported/);assert.ok(!history.split('\n').includes('unknown'));assert.ok(screens.every(x=>!x.overflow));
 }
 const result={mode,cli,json,failure,history,screens};await writeFile(packet+`/${mode}-receipt.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser?.close();await worker?.stop();await rm(dir,{recursive:true,force:true})}
