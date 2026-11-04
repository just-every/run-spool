import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {injectDebugId} from '../../packages/sdk/src/sourcemaps/inject.mjs';
import {sourceMapCli} from '../../packages/sdk/src/sourcemaps/cli.mjs';
import {launchBrowser} from '../browser-launch.mjs';

/** Node's real ESM stack, captured before its application map is uploaded. */
export async function nodeRuntimeFramesFlow({json,origin,cookie,browser:showBrowser=true,widths=[1440]}) {
 const project=await json('/api/projects','POST',{id:'synthetic-spool-node-map',name:'Harbor Pine Node checkout'}),p='/api/projects/'+project.id;
 await json(p+'/releases','POST',{name:'node-checkout@1.0.0',build:'server'});
 const deploy=await json(p+'/keys','POST',{kind:'deploy'}),temporary=await mkdtemp(resolve(tmpdir(),'spool-node-map-'));
 const keyEnv='SPOOL_NODE_MAP_DEPLOY_KEY',bundle=resolve(temporary,'capture.mjs');let browser;
 try{
  const sdk=resolve('packages/sdk/src/node.ts');
  await writeFile(resolve(temporary,'capture-source.mjs'),`import {init} from ${JSON.stringify(sdk)};\nconst spool = init({...JSON.parse(process.env.SPOOL_NODE_FIXTURE_OPTIONS),onOutcome:result=>console.log(JSON.stringify(result))});\ntry {\n JSON.parse('{broken checkout');\n} catch(error) { await spool.captureException(error); }\nspool.close();\n`);
  await build({entryPoints:[resolve(temporary,'capture-source.mjs')],outfile:bundle,bundle:true,platform:'node',format:'esm',minify:true,sourcemap:'external'});
  const injected=injectDebugId(await readFile(bundle,'utf8'),JSON.parse(await readFile(bundle+'.map','utf8')));
  await writeFile(bundle,injected.code);await writeFile(bundle+'.map',JSON.stringify(injected.map));
  const result=await new Promise((done,reject)=>{
   const child=spawn(process.execPath,[bundle],{env:{...process.env,SPOOL_NODE_FIXTURE_OPTIONS:JSON.stringify({endpoint:origin,project:project.id,ingestKey:project.ingestKey,release:'node-checkout@1.0.0',build:'server'})},stdio:['ignore','pipe','pipe']});
   let stdout='',stderr='';child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);child.once('error',reject);child.once('exit',code=>code===0?done(JSON.parse(stdout.trim())):reject(new Error('Node fixture failed: '+stderr)));
  });
  assert.equal(result.outcome,'accepted');
  const packetPath=p+'/issues/'+result.issue+'/packet',before=await json(packetPath),receipt=before.events[0].atAdmission;
  assert.ok(before.events[0].event.frames.filter(frame=>frame.file.startsWith('node:')).length>=2,'Node supplied real runtime frames');
  process.env[keyEnv]=deploy.key;
  await sourceMapCli(['--endpoint',origin,'--project',project.id,'--release','node-checkout@1.0.0','--build','server','--key-env',keyEnv,bundle]);
  delete process.env[keyEnv];
  const packet=await json(packetPath),event=packet.events[0];
  assert.deepEqual(event.atAdmission,receipt,'late map upload preserves the receipt');
  assert.equal(event.currentLookup[0].status,'mapped');assert.match(event.currentLookup[0].original.file,/capture-source\.mjs$/);assert.equal(event.currentLookup[0].original.line,4);
  const internal=event.currentLookup.filter(row=>row.generated.file.startsWith('node:'));
  assert.ok(internal.every(row=>row.status==='missing_debug_id'),'runtime evidence remains available');
  const missing=await json('/api/ingest/'+project.id,'POST',{...event.event,eventId:'node-missing-application-map',frames:[{...event.event.frames[0],file:'file:///app/unmapped-checkout.mjs',debugId:'synthetic-spool-missing-app'},...event.event.frames.slice(1)]},{Cookie:'',Authorization:'Bearer '+project.ingestKey});
  if(showBrowser){
   browser=await launchBrowser();await mkdir('.artifacts/grouping',{recursive:true});
   for(const width of widths){
    const context=await browser.newContext({viewport:{width,height:1000}});
    await context.addCookies(cookie.split('; ').map(value=>({name:value.slice(0,value.indexOf('=')),value:value.slice(value.indexOf('=')+1),url:origin})));
    const page=await context.newPage();await page.goto(origin+'/projects/'+project.id+'/issues/'+result.issue);await page.locator('.mapped-frame').first().waitFor();
    assert.equal(await page.locator('.missing-map').count(),0,'mapped Node app has no inapplicable upload warning');
    assert.ok(await page.locator('.frame-coordinate').filter({hasText:'node:internal/'}).count()>=2,'runtime frames remain inspectable');
    await page.screenshot({path:'.artifacts/grouping/node-mapped-'+width+'.png',fullPage:true});
    await page.goto(origin+'/projects/'+project.id+'/issues/'+missing.issue);await page.locator('.missing-map').waitFor();
    assert.match(await page.locator('.missing-map strong').innerText(),/one frame/,'only the unresolved application needs a map');
    await page.getByRole('button',{name:'Upload map',exact:true}).click();assert.equal(await page.getByLabel('Bundle debug ID',{exact:true}).inputValue(),'synthetic-spool-missing-app');
    await context.close();
   }
  }
  return {project:project.id,issue:result.issue};
 }finally{delete process.env[keyEnv];if(browser)await browser.close();await rm(temporary,{recursive:true,force:true});}
}
