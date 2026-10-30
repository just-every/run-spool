import {createHash} from 'node:crypto';
import {canonical} from '../src/domain/privacy.ts';
import {archiveProjection} from './archive.mjs';
import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';
import {followErasure} from './project-erasure/follow.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
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
 const fixtures={entry:{program,fn:'syntheticCheckout'},refund:{program:program.replaceAll('syntheticCheckout','syntheticRefund'),fn:'syntheticRefund'},receipt:{program:program.replaceAll('syntheticCheckout','syntheticReceipt'),fn:'syntheticReceipt'}};
 // Webpack maps the failing expression to its return statement; the other minifiers retain the property token.
 const originalColumns={esbuild:41,webpack:18,rollup:41,vite:41};
 const inputs=root=>Object.fromEntries(Object.keys(fixtures).map(name=>[name,resolve(root,name+'.mjs')]));
 // Move the same application's source in each release so another release's map cannot satisfy the lookup.
 const prepare=async(root,version=1)=>{await mkdir(root,{recursive:true});for(const [name,fixture] of Object.entries(fixtures))await writeFile(resolve(root,name+'.mjs'),'\n'.repeat(version-1)+fixture.program);};
 const external=new RegExp(sdkPath.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').split('/build/')[0]);
 const builders={
  async esbuild(root,config){await esbuild({entryPoints:inputs(root),outdir:resolve(root,'out'),outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',minify:true,sourcemap:true,external:[sdkPath],logLevel:'silent',plugins:[(await plugin('esbuild')).spoolSourceMaps(config)]});},
  async webpack(root,config){const compiler=webpack({mode:'production',context:root,entry:inputs(root),target:'node',devtool:'source-map',experiments:{outputModule:true},externals:[({request},callback)=>external.test(request)?callback(null,'module '+request):callback()],output:{path:resolve(root,'out'),filename:'[name].[contenthash].mjs',module:true,chunkFormat:'module'},plugins:[new (await plugin('webpack')).SpoolSourceMapsPlugin(config)]});try{await new Promise((done,fail)=>compiler.run((error,stats)=>error?fail(error):stats.hasErrors()?fail(new Error(stats.toString('errors-only'))):done()));}finally{await new Promise((done,fail)=>compiler.close(error=>error?fail(error):done()));}},
  async rollup(root,config){const bundle=await rollup({input:inputs(root),external:[external],plugins:[{name:'synthetic-minify',async renderChunk(code,chunk){const output=await transform(code,{minify:true,sourcemap:true,sourcefile:chunk.fileName,format:'esm',target:'es2022'});return {code:output.code,map:JSON.parse(output.map)};}},(await plugin('vite')).spoolSourceMaps(config)]});try{await bundle.write({dir:resolve(root,'out'),format:'es',sourcemap:true,entryFileNames:'[name].mjs'});}finally{await bundle.close();}},
  async vite(root,config){await vite({root,configFile:false,logLevel:'silent',plugins:[(await plugin('vite')).spoolSourceMaps(config)],build:{outDir:resolve(root,'out'),sourcemap:true,minify:true,lib:{entry:inputs(root),formats:['es'],fileName:(_format,name)=>name+'.mjs'},rollupOptions:{external:[external]}}});},
 };
 // Owner event detail enumerates the complete retained set, beyond the bounded agent packet.
 const events=async(read=request)=>{
  const rows=[];let cursor;
  do{const page=await read(base+'/occurrences'+(cursor?'?cursor='+encodeURIComponent(cursor):''));rows.push(...page.rows);cursor=page.next;if(!cursor)assert.equal(rows.length,page.total,'every retained occurrence is enumerated');}while(cursor);
  assert.equal(new Set(rows.map(row=>row.occurrence)).size,rows.length);
  return Promise.all(rows.map(row=>read(base+'/issues/'+row.issue+'/events/'+row.id+'?occurrence='+encodeURIComponent(row.occurrence))));
 };
 const releases=[];
 const reconcile=async()=>{
  const status=await request(base+'/sentry-uploads');
  const archive=await archiveProjection(await fetch(origin+'/api/archive',{headers:{Cookie:cookie}}));
  for(const release of releases){
   const names=release.maps.map(map=>map.name).sort();
   const declared=archive.data.source_map_builds.find(row=>row.project==='synthetic-spool-17'&&row.release===release.name&&row.build==='b1');
   assert.deepEqual(JSON.parse(declared.expected),names,release.name+': every emitted map is declared');
   const files=archive.data.source_map_build_files.filter(row=>row.project==='synthetic-spool-17'&&row.release===release.name&&row.build==='b1');
   assert.deepEqual(files.map(({name,debug,digest})=>({name,debug,digest})).sort((a,b)=>a.name.localeCompare(b.name)),release.maps.map(({name,debug,digest})=>({name,debug,digest})).sort((a,b)=>a.name.localeCompare(b.name)),release.name+': all declared names retain exact debug IDs and checksums');
   const artifacts=status.artifacts.filter(row=>row.release===release.name&&row.build==='b1');
   assert.equal(artifacts.length,release.maps.length,release.name+': no emitted artifact is missing');
   for(const map of release.maps)assert.equal(artifacts.find(row=>row.debug===map.debug)?.digest,map.digest,release.name+': stored checksum matches the final emitted map');
   assert.deepEqual(status.builds.find(row=>row.release===release.name),{release:release.name,build:'b1',state:'complete',missing:[]});
  }
 };
 try{
 const oversized=await fetch(origin+base+'/releases',{method:'POST',headers:{Authorization:'Bearer '+deploy.key,'Content-Type':'application/json'},body:JSON.stringify({name:'synthetic-oversized@1',build:'b1',requiredArtifacts:Array.from({length:400},(_,n)=>`synthetic-spool-${n}-`+'x'.repeat(980)+'.map')})});
 assert.equal(oversized.status,400,'[SRC-001] a declaration too large for portable custody is rejected');await oversized.body?.cancel();
 assert.equal((await request(base+'/releases')).some(row=>row.name==='synthetic-oversized@1'),false,'a rejected declaration registers no partial release');
 for(const [name,build] of Object.entries(builders)){
  const root=resolve(app,'synthetic-'+name);
  for(const version of [1,2,3]){
   const release={name:'synthetic-'+name+'@'+version,maps:[]};
   await prepare(root,version);
   await rm(resolve(root,'out'),{recursive:true,force:true});
   await build(root,{...options,release:release.name});
   const names=(await readdir(resolve(root,'out'))).filter(file=>file.endsWith('.map')).sort();
   assert.equal(names.length,Object.keys(fixtures).length,name+': every independent entry map is emitted');
   for(const mapName of names){
    const built=resolve(root,'out',mapName.slice(0,-4)),code=await readFile(built,'utf8');
    const {debug_id:snake,debugId:camel,...payload}=JSON.parse(await readFile(built+'.map','utf8')),debug=snake??camel;
    assert.match(debug,/^[a-f0-9-]{36}$/i);assert.ok(code.includes(debug));assert.ok(!code.includes(deploy.key),'deploy authority never enters emitted JavaScript');
    const source=Object.keys(fixtures).find(key=>payload.sources.some(path=>path.endsWith('/'+key+'.mjs')||path===key+'.mjs'));
    assert.ok(source,name+': emitted map retains its original entry source');
    assert.ok(releases.filter(prior=>prior.name.startsWith('synthetic-'+name+'@')).every(prior=>prior.maps.every(map=>map.debug!==debug)),release.name+': changed source has a distinct debug ID from earlier releases');
    release.maps.push({name:mapName,debug,digest:createHash('sha256').update(canonical(payload)).digest('hex'),source,fn:fixtures[source].fn,line:version+3,column:originalColumns[name]});
    await runNode(built,{DSN:project.dsn,REL:release.name});
   }
   releases.push(release);
   await reconcile();
   const captured=await events();
   assert.equal(captured.length,releases.reduce((total,row)=>total+row.maps.length,0),'all built failures, including earlier releases, remain visible');
   for(const prior of releases){
    const matching=captured.filter(row=>row.release===prior.name);assert.equal(matching.length,prior.maps.length,prior.name+': every map produces one retained failure');
    for(const map of prior.maps){
     const matches=matching.filter(row=>row.event.frames.some(frame=>frame.debugId===map.debug));assert.equal(matches.length,1,prior.name+': exact emitted debug ID selects its failure');
     const event=matches[0];assert.equal(event.event.release,prior.name);assert.equal(event.event.build,'b1');
     const frame=event.atAdmission.find(row=>row.generated.debugId===map.debug);assert.equal(frame?.status,'mapped',prior.name+': real built error maps');
     assert.ok(frame.original.file.endsWith(map.source+'.mjs'));assert.equal(frame.original.line,map.line,prior.name+': original line selects this release rather than another release');assert.equal(frame.original.column,map.column,prior.name+': original column');assert.equal(frame.original.function,map.fn);assert.equal(frame.artifactDigest,map.digest);
     assert.deepEqual(event.currentLookup,event.atAdmission,prior.name+': current lookup preserves earlier release coordinates');
    }
   }
  }
  const refusedRoot=resolve(app,'synthetic-refused-'+name);await prepare(refusedRoot);
  await assert.rejects(build(refusedRoot,{...options,release:'incomplete-'+name+'@1',requiredMaps:['withheld.js.map']}),/withheld\.js\.map/);
  const refusedFiles=await readdir(resolve(refusedRoot,'out')).catch(error=>{assert.equal(error.code,'ENOENT');return[]});assert.ok(!refusedFiles.some(file=>/\.[cm]?js$/.test(file)),'a rejected '+name+' build publishes no JavaScript');
 }
 // A caller using write:false must receive the stamped text as well as bytes.
 const memoryRoot=resolve(app,'synthetic-esbuild-memory');await mkdir(memoryRoot);await writeFile(resolve(memoryRoot,'entry.mjs'),program);
 const memory=await esbuild({entryPoints:[resolve(memoryRoot,'entry.mjs')],outfile:resolve(memoryRoot,'out/entry.mjs'),bundle:true,platform:'node',format:'esm',minify:true,sourcemap:true,external:[sdkPath],logLevel:'silent',write:false,plugins:[(await plugin('esbuild')).spoolSourceMaps({...options,release:'synthetic-memory@1'})]});
 for(const file of memory.outputFiles){assert.equal(file.text,new TextDecoder().decode(file.contents),'esbuild text and bytes describe the same stamped file');await mkdir(dirname(file.path),{recursive:true});await writeFile(file.path,file.text);}
 await runNode(resolve(memoryRoot,'out/entry.mjs'),{DSN:project.dsn,REL:'synthetic-memory@1'});
 const memoryEvents=(await events()).filter(row=>row.release==='synthetic-memory@1');
 assert.equal(memoryEvents.length,1);assert.ok(memoryEvents[0].atAdmission.some(row=>row.status==='mapped'&&row.original.line===4),'in-memory esbuild output maps the original frame');
 const incomplete=(await request(base+'/sentry-uploads')).builds.filter(row=>row.state==='incomplete');assert.equal(incomplete.length,4);assert.ok(incomplete.every(row=>row.missing.includes('withheld.js.map')));
 const context=await browser.newContext(),page=await context.newPage();await browserSignIn(page,origin);
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.goto(origin+'/projects/synthetic-spool-17/releases');await page.getByText('incomplete-esbuild@1 / b1: incomplete',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual((await new AxeBuilder({page}).analyze()).violations.filter(row=>['serious','critical'].includes(row.impact)),[]);const out=process.env.SPOOL_PROOF_DIR?resolve(process.env.SPOOL_PROOF_DIR,'../src001'):'.artifacts/src001';await mkdir(out,{recursive:true});await page.screenshot({path:resolve(out,'incomplete-'+width+'.png'),fullPage:true});await page.locator('#source-map-setup-heading').evaluate(node=>node.scrollIntoView({block:'start'}));await page.screenshot({path:resolve(out,'incomplete-view-'+width+'.png')});}
 const before=(await request(base+'/sentry-uploads')).artifacts;
 const {sourceMapCli}=await import('../packages/sdk/src/sourcemaps/cli.mjs');
 const late=resolve(app,'withheld.js');await writeFile(late,'throw new Error("synthetic-spool-17");');await writeFile(late+'.map',JSON.stringify({version:3,sources:['src/late.js'],sourcesContent:['throw new Error("synthetic-spool-17");'],names:[],mappings:'AAAA'}));
 const declared=(await archiveProjection(await fetch(origin+'/api/archive',{headers:{Cookie:cookie}}))).data.source_map_builds;
 for(const row of incomplete)await sourceMapCli(['--endpoint',origin,'--project','synthetic-spool-17','--release',row.release,'--build','b1','--key-env','SYNTHETIC_SPOOL_BUILD',...JSON.parse(declared.find(set=>set.project==='synthetic-spool-17'&&set.release===row.release&&set.build===row.build).expected).flatMap(name=>['--required-map',name]),late]);
 const completed=await request(base+'/sentry-uploads');assert.ok(completed.builds.every(row=>row.state==='complete'));for(const row of before)assert.ok(completed.artifacts.some(after=>after.release===row.release&&after.debug===row.debug&&after.digest===row.digest),'late maps preserve earlier identities');
 // A corrupted checksum is refused by name through the authenticated native upload door.
 const tampered=await fetch(origin+base+'/artifacts',{method:'POST',headers:{Authorization:'Bearer '+deploy.key,'Content-Type':'application/json'},body:JSON.stringify({release:'synthetic-esbuild@1',build:'b1',debugId:'00000000-0000-4000-8000-000000000017',file:'tampered.js.map',checksum:'0'.repeat(64),map:{version:3,sources:['a.js'],names:[],mappings:'AAAA'}})});assert.equal(tampered.status,400);assert.match((await tampered.json()).error,/tampered\.js\.map: checksum mismatch/);
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.reload();await page.getByText('incomplete-esbuild@1 / b1: complete',{exact:true}).waitFor();const out=process.env.SPOOL_PROOF_DIR?resolve(process.env.SPOOL_PROOF_DIR,'../src001'):'.artifacts/src001';await page.screenshot({path:resolve(out,'complete-'+width+'.png'),fullPage:true});await page.locator('#source-map-setup-heading').evaluate(node=>node.scrollIntoView({block:'start'}));await page.screenshot({path:resolve(out,'complete-view-'+width+'.png')});}
 await context.close();
 // Exercise the native deployment doors against a populated, fully mapped build.
 const grantRequest=(endpoint,path,method,key,body)=>fetch(endpoint+path,{method,headers:{Connection:'close',...key?{Authorization:'Bearer '+key}:{},...body?{'Content-Type':'application/json'}:{}},...body?{body:JSON.stringify(body)}:{}});
 const custodyTables=['releases','release_builds','artifacts','source_map_builds','source_map_build_files','artifact_storage_settings','events','issues'];
 const custody=data=>Object.fromEntries(custodyTables.map(table=>[table,data[table].filter(row=>row.project==='synthetic-spool-17').map(canonical).sort()]));
 const agent=await request(base+'/keys','POST',{kind:'agent'}),foreign=await request('/api/projects/synthetic-spool-16/keys','POST',{kind:'deploy'}),revoked=await request(base+'/keys','POST',{kind:'deploy'});
 await request(base+'/keys/'+revoked.hash,'DELETE');
 const protectedState=await archiveProjection(await fetch(origin+'/api/archive',{headers:{Cookie:cookie}}));
 const sample=protectedState.data.artifacts.find(row=>row.project==='synthetic-spool-17'&&row.release===releases[0].name);
 assert.ok(sample,'authority probes use an existing private map');
 const sampleFile=protectedState.data.source_map_build_files.find(row=>row.project===sample.project&&row.release===sample.release&&row.debug===sample.debug);
 const upload={release:sample.release,build:sample.build,debugId:sample.debug,file:sampleFile.name,checksum:sample.digest,map:JSON.parse(sample.payload)};
 const verify={release:sample.release,build:sample.build};
 const verified=await grantRequest(origin,base+'/artifact-builds/verify','POST',deploy.key,verify);
 assert.equal(verified.status,200);assert.deepEqual(await verified.json(),{...verify,state:'complete',missing:[]},'the exact deploy grant verifies a complete set');
 for(const [label,key,status] of [['absent',null,401],['ingest',project.ingestKey,401],['agent',agent.key,403],['foreign',foreign.key,403],['revoked',revoked.key,401]]){
  for(const [path,body] of [['/releases',{name:'synthetic-spool-denied-'+label,build:'b1',requiredArtifacts:[sampleFile.name]}],['/artifacts',upload],['/artifact-builds/verify',verify]]){
   const response=await grantRequest(origin,base+path,'POST',key,body);
   assert.equal(response.status,status,label+': native '+path+' refuses without deploy authority');await response.body?.cancel();
  }
 }
 for(const [path,method,body] of [[base+'/sentry-uploads','GET'],[base+'/issues','GET'],['/api/archive','GET'],[base+'/keys','POST',{kind:'agent'}],[base+'/artifact-storage','PUT',{revision:0,artifact_storage_cap:0}],[base+'/retention','POST',{cutoff:Date.now(),apply:true}]]){
  const response=await grantRequest(origin,path,method,deploy.key,body);
  assert.equal(response.status,401,'deploy authority cannot reach '+path);await response.body?.cancel();
 }
 await request(base+'/keys/'+deploy.hash,'DELETE');
 for(const [path,body] of [['/releases',{name:'synthetic-spool-revoked-replay',build:'b1'}],['/artifacts',upload],['/artifact-builds/verify',verify]]){
  const response=await grantRequest(origin,base+path,'POST',deploy.key,body);assert.equal(response.status,401,'revocation immediately denies a previously successful deploy grant');await response.body?.cancel();
 }
 const currentDeploy=await request(base+'/keys','POST',{kind:'deploy'});
 const currentVerification=await grantRequest(origin,base+'/artifact-builds/verify','POST',currentDeploy.key,verify);assert.equal(currentVerification.status,200);await currentVerification.body?.cancel();
 const archived=await archiveProjection(await fetch(origin+'/api/archive',{headers:{Cookie:cookie}}));
 assert.deepEqual(custody(archived.data),custody(protectedState.data),'all refused reads and writes leave complete build, event and issue custody unchanged');
 for(const secret of [deploy.key,currentDeploy.key,agent.key,foreign.key,revoked.key,project.ingestKey])assert.equal(archived.text.includes(secret),false,'private archives exclude every project credential');
 const coordinates=rows=>rows.map(({id,occurrence,release,event,atAdmission,currentLookup})=>({id,occurrence,release,build:event.build,atAdmission,currentLookup})).sort((a,b)=>a.occurrence.localeCompare(b.occurrence));
 const archivedCoordinates=coordinates(await events());
 assert.ok(archived.data.artifacts.some(row=>JSON.parse(row.payload).ignoreList?.length),'[SRC-004] private ignore lists survive export');
 const target=await startTestWorker(15562);
 try{
  const targetCookie=await signIn(target.origin);
  const restored=await fetch(target.origin+'/api/restore',{method:'POST',headers:{Cookie:targetCookie,Origin:target.origin,'Content-Type':'application/x-ndjson','x-confirm-restore':'yes'},body:archived.text});assert.equal(restored.status,200,await restored.text());
  const read=async path=>(await fetch(target.origin+path,{headers:{Cookie:targetCookie}})).json();
  assert.equal((await read('/api/projects/synthetic-spool-16/artifact-storage')).artifact_storage_cap,archived.data.artifact_storage_settings.find(row=>row.project==='synthetic-spool-16').artifact_storage_cap);
  assert.deepEqual((await read(base+'/sentry-uploads')).builds,completed.builds,'[SRC-001] declared map sets restore complete');
  assert.deepEqual((await read(base+'/sentry-uploads')).artifacts,completed.artifacts,'[SRC-001] all three releases retain their complete artifact identities on independent restore');
  assert.deepEqual(coordinates(await events(read)),archivedCoordinates,'[SRC-001] every restored failure retains its release and original admission and current coordinates');
  for(const [path,method,body] of [[base+'/artifact-builds/verify','POST',verify],[base+'/artifacts','POST',upload],[base+'/sentry-uploads','GET']]){
   const response=await grantRequest(target.origin,path,method,currentDeploy.key,body);assert.equal(response.status,401,'restore never reactivates a source deploy credential');await response.body?.cancel();
  }
  const restoredIngest=await grantRequest(target.origin,'/api/ingest/synthetic-spool-17','POST',project.ingestKey,{version:1});assert.equal(restoredIngest.status,401,'restore never reactivates a source ingest credential');await restoredIngest.body?.cancel();
  const freshDeploy=await fetch(target.origin+base+'/keys',{method:'POST',headers:{Cookie:targetCookie,Origin:target.origin,'Content-Type':'application/json'},body:JSON.stringify({kind:'deploy'})});assert.equal(freshDeploy.status,201);const fresh=(await freshDeploy.json()).key;
  for(const release of releases){
   const response=await grantRequest(target.origin,base+'/artifact-builds/verify','POST',fresh,{release:release.name,build:'b1'});assert.equal(response.status,200);assert.deepEqual(await response.json(),{release:release.name,build:'b1',state:'complete',missing:[]},'fresh destination authority verifies every restored release');
  }
  assert.deepEqual(custody((await archiveProjection(await fetch(target.origin+'/api/archive',{headers:{Cookie:targetCookie}}))).data),custody(archived.data),'restored credential refusals and successful verification change no product custody');
 }finally{await target.stop();}
 for(const id of ['synthetic-spool-16','synthetic-spool-17']){
  const path='/api/projects/'+id+'/erasure',preview=await request(path);await followErasure(request,await request(path,'POST',{confirm:id,planHash:preview.planHash}));
 }
 for(const [path,method,key,body] of [[base+'/artifacts','POST',currentDeploy.key,upload],[base+'/artifact-builds/verify','POST',currentDeploy.key,verify],[base+'/sentry-uploads','GET',currentDeploy.key],['/api/ingest/synthetic-spool-17','POST',project.ingestKey,{version:1}]]){
  const response=await grantRequest(origin,path,method,key,body);assert.equal(response.status,401,'erasure cannot be reversed by replaying an old project credential');await response.body?.cancel();
 }
 const erased=await archiveProjection(await fetch(origin+'/api/archive',{headers:{Cookie:cookie}}));
 for(const table of ['artifact_storage_settings','source_map_builds','source_map_build_files','artifacts'])assert.ok(erased.data[table].every(row=>!['synthetic-spool-16','synthetic-spool-17'].includes(row.project)),table+': project erasure removes custody');
 console.log('[SRC-001] Packed Vite, Rollup, webpack and esbuild: three emitted maps used in each of three consecutive releases at b1; all 36 mapped failures with distinct source positions and earlier artifact sets reconciled across event pages; withheld map fails all four without output; late artifacts complete unchanged identities; independent restore preserves every failure coordinate; wrong-scope, revoked and restored credential refusals preserve custody; erasure replay and checksum tampering refusal passed; 1440 and 390 overflow and Axe passed.');
 }finally{delete process.env.SYNTHETIC_SPOOL_BUILD;}
}
