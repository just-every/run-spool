import {openSection} from './navigation.mjs';
import {createHash} from 'node:crypto';
import {canonical} from '../src/domain/privacy.ts';
import {archiveProjection} from './archive.mjs';
import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';
import {followErasure} from './project-erasure/follow.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build as esbuild,transform} from 'esbuild';
import {build as vite} from 'vite';
import {rollup} from 'rollup';
import webpack from 'webpack';
import {sdkPath,runNode} from './sentry-cli/sdk.mjs';
import {browserSignIn} from './auth.mjs';
import AxeBuilder from '@axe-core/playwright';

export async function sourceMapPlugins({origin,request,app,browser,cookie}){
 const project=await request('/api/projects','POST',{id:'synthetic-spool-17',name:'Synthetic bundlers'}),base='/api/projects/synthetic-spool-17';
 const deploy=await request(base+'/keys','POST',{kind:'deploy'});
 process.env.SYNTHETIC_SPOOL_BUILD=deploy.key;
 const options={endpoint:origin,project:'synthetic-spool-17',build:'b1',keyEnv:'SYNTHETIC_SPOOL_BUILD'};
 const plugin=async name=>import(pathToFileURL(resolve(app,'node_modules/@just-every/spool/dist',name+'.js')));
 const program=`import * as Sentry from ${JSON.stringify(sdkPath)};\nSentry.init({dsn:process.env.DSN,release:process.env.REL,dist:'b1',environment:'test',defaultIntegrations:false});\nfunction syntheticCheckout(){\n const account={};return account.address.city;\n}\ntry{syntheticCheckout()}catch(error){Sentry.captureException(error)}\nawait Sentry.flush(5000);\n`;
 const external=new RegExp(sdkPath.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').split('/build/')[0]);
 const builders={
  async esbuild(root,config){await esbuild({entryPoints:[resolve(root,'entry.mjs')],outfile:resolve(root,'out/entry.mjs'),bundle:true,platform:'node',format:'esm',minify:true,sourcemap:true,external:[sdkPath],logLevel:'silent',plugins:[(await plugin('esbuild')).spoolSourceMaps(config)]});},
  async webpack(root,config){const compiler=webpack({mode:'production',context:root,entry:'./entry.mjs',target:'node',devtool:'source-map',experiments:{outputModule:true},externals:[({request},callback)=>external.test(request)?callback(null,'module '+request):callback()],output:{path:resolve(root,'out'),filename:'entry.[contenthash].mjs',module:true,chunkFormat:'module'},plugins:[new (await plugin('webpack')).SpoolSourceMapsPlugin(config)]});try{await new Promise((done,fail)=>compiler.run((error,stats)=>error?fail(error):stats.hasErrors()?fail(new Error(stats.toString('errors-only'))):done()));}finally{await new Promise((done,fail)=>compiler.close(error=>error?fail(error):done()));}const emitted=(await readdir(resolve(root,'out'))).find(name=>name.endsWith('.mjs'));assert.ok(emitted);return resolve(root,'out',emitted);},
  async rollup(root,config){const bundle=await rollup({input:resolve(root,'entry.mjs'),external:[external],plugins:[{name:'synthetic-minify',async renderChunk(code,chunk){const output=await transform(code,{minify:true,sourcemap:true,sourcefile:chunk.fileName,format:'esm',target:'es2022'});return {code:output.code,map:JSON.parse(output.map)};}},(await plugin('vite')).spoolSourceMaps(config)]});try{await bundle.write({dir:resolve(root,'out'),format:'es',sourcemap:true,entryFileNames:'entry.mjs'});}finally{await bundle.close();}},
  async vite(root,config){await vite({root,configFile:false,logLevel:'silent',plugins:[(await plugin('vite')).spoolSourceMaps(config)],build:{outDir:resolve(root,'out'),sourcemap:true,minify:true,lib:{entry:resolve(root,'entry.mjs'),formats:['es'],fileName:()=> 'entry.mjs'},rollupOptions:{external:[external]}}});},
 };
 try{
 const oversized=await fetch(origin+base+'/releases',{method:'POST',headers:{Authorization:'Bearer '+deploy.key,'Content-Type':'application/json'},body:JSON.stringify({name:'synthetic-oversized@1',build:'b1',requiredArtifacts:Array.from({length:400},(_,n)=>`synthetic-spool-${n}-`+'x'.repeat(980)+'.map')})});
 assert.equal(oversized.status,400,'[SRC-001] a declaration too large for portable custody is rejected');await oversized.body?.cancel();
 assert.equal((await request(base+'/releases')).some(row=>row.name==='synthetic-oversized@1'),false,'a rejected declaration registers no partial release');
 for(const [name,build] of Object.entries(builders)){
  const root=resolve(app,'synthetic-'+name);await mkdir(root);await writeFile(resolve(root,'entry.mjs'),program);
  const release='synthetic-'+name+'@1',built=await build(root,{...options,release})??resolve(root,'out/entry.mjs');
  const finalMap=JSON.parse(await readFile(built+'.map','utf8')),{debug_id:snake,debugId:camel,...payload}=finalMap;
  const stored=(await request(base+'/sentry-uploads')).artifacts.find(row=>row.release===release&&row.debug===(snake??camel));
  assert.equal(stored.digest,createHash('sha256').update(canonical(payload)).digest('hex'),name+': stored checksum matches the final emitted map, including hashed output names');
  await runNode(built,{DSN:project.dsn,REL:release});
  const packets=await Promise.all((await request(base+'/issues')).map(issue=>request(base+'/issues/'+issue.id+'/packet')));
  const event=packets.flatMap(row=>row.events).find(row=>row.release.name===release);
  assert.ok(event,name+': real built error arrived');const frame=event.atAdmission.find(row=>row.status==='mapped');assert.ok(frame,name+': original source resolved');assert.equal(frame.original.line,4);assert.equal(frame.original.function,'syntheticCheckout');
  assert.equal((await request(base+'/sentry-uploads')).builds.find(row=>row.release===release).state,'complete');
  const refusedRoot=resolve(app,'synthetic-refused-'+name);await mkdir(refusedRoot);await writeFile(resolve(refusedRoot,'entry.mjs'),program);
  await assert.rejects(build(refusedRoot,{...options,release:'incomplete-'+name+'@1',requiredMaps:['withheld.js.map']}),/withheld\.js\.map/);
  const refusedFiles=await readdir(resolve(refusedRoot,'out')).catch(error=>{assert.equal(error.code,'ENOENT');return[]});assert.ok(!refusedFiles.some(file=>/\.[cm]?js$/.test(file)),'a rejected '+name+' build publishes no JavaScript');
 }
 // A caller using write:false must receive the stamped text as well as bytes.
 const memoryRoot=resolve(app,'synthetic-esbuild-memory');await mkdir(memoryRoot);await writeFile(resolve(memoryRoot,'entry.mjs'),program);
 const memory=await esbuild({entryPoints:[resolve(memoryRoot,'entry.mjs')],outfile:resolve(memoryRoot,'out/entry.mjs'),bundle:true,platform:'node',format:'esm',minify:true,sourcemap:true,external:[sdkPath],logLevel:'silent',write:false,plugins:[(await plugin('esbuild')).spoolSourceMaps({...options,release:'synthetic-memory@1'})]});
 for(const file of memory.outputFiles){assert.equal(file.text,new TextDecoder().decode(file.contents),'esbuild text and bytes describe the same stamped file');await mkdir(dirname(file.path),{recursive:true});await writeFile(file.path,file.text);}
 await runNode(resolve(memoryRoot,'out/entry.mjs'),{DSN:project.dsn,REL:'synthetic-memory@1'});
 const memoryEvents=(await Promise.all((await request(base+'/issues')).map(issue=>request(base+'/issues/'+issue.id+'/packet')))).flatMap(row=>row.events).filter(row=>row.release.name==='synthetic-memory@1');
 assert.equal(memoryEvents.length,1);assert.ok(memoryEvents[0].atAdmission.some(row=>row.status==='mapped'&&row.original.line===4),'in-memory esbuild output maps the original frame');
 const incomplete=(await request(base+'/sentry-uploads')).builds.filter(row=>row.state==='incomplete');assert.equal(incomplete.length,4);assert.ok(incomplete.every(row=>row.missing.includes('withheld.js.map')));
 const context=await browser.newContext(),page=await context.newPage();await browserSignIn(page,origin);
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.goto(origin+'/projects/synthetic-spool-17/releases');await openSection(page,'Set up original-source mapping');await page.getByText('incomplete-esbuild@1 / b1: incomplete',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual((await new AxeBuilder({page}).analyze()).violations.filter(row=>['serious','critical'].includes(row.impact)),[]);const out=process.env.SPOOL_PROOF_DIR?resolve(process.env.SPOOL_PROOF_DIR,'../src001'):'.artifacts/src001';await mkdir(out,{recursive:true});await page.screenshot({path:resolve(out,'incomplete-'+width+'.png'),fullPage:true});await page.locator('#source-map-setup-heading').evaluate(node=>node.scrollIntoView({block:'start'}));await page.screenshot({path:resolve(out,'incomplete-view-'+width+'.png')});}
 const before=(await request(base+'/sentry-uploads')).artifacts;
 const {sourceMapCli}=await import('../packages/sdk/src/sourcemaps/cli.mjs');
 const late=resolve(app,'withheld.js');await writeFile(late,'throw new Error("synthetic-spool-17");');await writeFile(late+'.map',JSON.stringify({version:3,sources:['src/late.js'],sourcesContent:['throw new Error("synthetic-spool-17");'],names:[],mappings:'AAAA'}));
 const declared=(await archiveProjection(await fetch(origin+'/api/archive',{headers:{Cookie:cookie}}))).data.source_map_builds;
 for(const row of incomplete)await sourceMapCli(['--endpoint',origin,'--project','synthetic-spool-17','--release',row.release,'--build','b1','--key-env','SYNTHETIC_SPOOL_BUILD',...JSON.parse(declared.find(set=>set.project==='synthetic-spool-17'&&set.release===row.release&&set.build===row.build).expected).flatMap(name=>['--required-map',name]),late]);
 const completed=await request(base+'/sentry-uploads');assert.ok(completed.builds.every(row=>row.state==='complete'));for(const row of before)assert.ok(completed.artifacts.some(after=>after.release===row.release&&after.debug===row.debug&&after.digest===row.digest),'late maps preserve earlier identities');
 // A corrupted checksum is refused by name through the authenticated native upload door.
 const tampered=await fetch(origin+base+'/artifacts',{method:'POST',headers:{Authorization:'Bearer '+deploy.key,'Content-Type':'application/json'},body:JSON.stringify({release:'synthetic-esbuild@1',build:'b1',debugId:'00000000-0000-4000-8000-000000000017',file:'tampered.js.map',checksum:'0'.repeat(64),map:{version:3,sources:['a.js'],names:[],mappings:'AAAA'}})});assert.equal(tampered.status,400);assert.match((await tampered.json()).error,/tampered\.js\.map: checksum mismatch/);
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.reload();await openSection(page,'Set up original-source mapping');await page.getByText('incomplete-esbuild@1 / b1: complete',{exact:true}).waitFor();const out=process.env.SPOOL_PROOF_DIR?resolve(process.env.SPOOL_PROOF_DIR,'../src001'):'.artifacts/src001';await page.screenshot({path:resolve(out,'complete-'+width+'.png'),fullPage:true});await page.locator('#source-map-setup-heading').evaluate(node=>node.scrollIntoView({block:'start'}));await page.screenshot({path:resolve(out,'complete-view-'+width+'.png')});}
 await context.close();
 const archived=await archiveProjection(await fetch(origin+'/api/archive',{headers:{Cookie:cookie}}));
 assert.ok(archived.data.artifacts.some(row=>JSON.parse(row.payload).ignoreList?.length),'[SRC-004] private ignore lists survive export');
 const target=await startTestWorker(15562);
 try{
  const targetCookie=await signIn(target.origin);
  const restored=await fetch(target.origin+'/api/restore',{method:'POST',headers:{Cookie:targetCookie,Origin:target.origin,'Content-Type':'application/x-ndjson','x-confirm-restore':'yes'},body:archived.text});assert.equal(restored.status,200,await restored.text());
  const read=async path=>(await fetch(target.origin+path,{headers:{Cookie:targetCookie}})).json();
  assert.equal((await read('/api/projects/synthetic-spool-16/artifact-storage')).artifact_storage_cap,archived.data.artifact_storage_settings.find(row=>row.project==='synthetic-spool-16').artifact_storage_cap);
  assert.deepEqual((await read(base+'/sentry-uploads')).builds,completed.builds,'[SRC-001] declared map sets restore complete');
 }finally{await target.stop();}
 for(const id of ['synthetic-spool-16','synthetic-spool-17']){
  const path='/api/projects/'+id+'/erasure',preview=await request(path);await followErasure(request,await request(path,'POST',{confirm:id,planHash:preview.planHash}));
 }
 const erased=await archiveProjection(await fetch(origin+'/api/archive',{headers:{Cookie:cookie}}));
 for(const table of ['artifact_storage_settings','source_map_builds','source_map_build_files','artifacts'])assert.ok(erased.data[table].every(row=>!['synthetic-spool-16','synthetic-spool-17'].includes(row.project)),table+': project erasure removes custody');
 console.log('[SRC-001] Packed Vite/Rollup/webpack/esbuild real builds map errors; withheld map fails all four without output; late artifacts complete unchanged identities; checksum tampering refused by file; 1440/390 overflow and Axe passed.');
 }finally{delete process.env.SYNTHETIC_SPOOL_BUILD;}
}
