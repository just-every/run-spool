import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {browserSignIn} from './auth.mjs';
import AxeBuilder from '@axe-core/playwright';

export async function sourceMapCapacity({origin,request,app,browser}) {
 const id='synthetic-spool-16',base='/api/projects/'+id;
 const project=await request('/api/projects','POST',{id,name:'Synthetic source maps'}),deploy=await request(base+'/keys','POST',{kind:'deploy'});
 const post=(path,body,key=deploy.key)=>fetch(origin+path,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const dir=resolve(app,'capacity');await mkdir(dir);
 for(let n=0;n<27;n++){
  const name='synthetic-spool-'+n;
  await writeFile(resolve(dir,name+'.js'),`throw new Error('${name}');\n//# sourceMappingURL=${name}.js.map\n`);
  await writeFile(resolve(dir,name+'.js.map'),JSON.stringify({version:3,sources:[`src/${name}.js`],sourcesContent:[`throw new Error('${name}');`],names:[],mappings:'AAAA'}));
 }
 const files=Array.from({length:27},(_,n)=>resolve(dir,`synthetic-spool-${n}.js`));
 const cli=release=>new Promise((done,fail)=>{const child=spawn(process.execPath,[resolve(app,'node_modules/@just-every/spool/dist/sourcemaps.js'),'--endpoint',origin,'--project',id,'--release',release,'--build','b1','--key-env','SYNTHETIC_SPOOL_DEPLOY',...files],{env:{...process.env,SYNTHETIC_SPOOL_DEPLOY:deploy.key},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('error',fail);child.on('close',code=>done({code,output}));});
 let result=await cli('capacity@1');assert.equal(result.code,0,result.output);
 assert.equal((await request(base+'/sentry-uploads')).artifacts.length,27,'[SRC-004] Spool CLI stores more than 25 maps');
 await request(base+'/releases','POST',{name:'formats@1',build:'b1'});
 const flat={version:3,sourceRoot:'src/original',sources:['checkout.js'],sourcesContent:['function checkout(){throw new Error("synthetic-spool-16")}'],ignoreList:[0],x_google_ignoreList:[0],names:[],mappings:'AAAA'};
 for(const [n,map,line,column] of [
  [1,{version:3,sections:[{offset:{line:2,column:5},map:flat}]},3,5],
  [2,flat,1,0],
  [13,{...flat,sourcesContent:null},1,0],
  [3,{...flat,sourcesContent:[flat.sourcesContent[0]+'/*'+'x'.repeat(300000)+'*/']},1,0],
 ]){
  const debugId=`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const uploaded=await post(base+'/artifacts',{release:'formats@1',build:'b1',debugId,map});assert.equal(uploaded.status,201,await uploaded.text());
  const admitted=await post('/api/ingest/'+id,{version:1,eventId:'synthetic-spool-'+n,release:'formats@1',build:'b1',environment:'test',type:'Error',message:'synthetic-spool-'+n,frames:[{file:'app.js',line,column,function:'checkout',debugId}],breadcrumbs:[]},project.ingestKey);
  assert.ok(admitted.ok,await admitted.text());
 }
 for(const issue of await request(base+'/issues')){
  const packet=await request(base+'/issues/'+issue.id+'/packet');
  for(const event of packet.events){assert.equal(event.atAdmission[0].status,'mapped');assert.equal(event.atAdmission[0].original.file,'src/original/checkout.js');assert.equal(event.atAdmission[0].original.line,1);}
 }
 // Probe the stored-byte ceiling independently of the old 256 KiB fixture.
 const ceiling={...flat,sourcesContent:['']};ceiling.sourcesContent[0]='x'.repeat(1048576-Buffer.byteLength(JSON.stringify(ceiling)));
 const atLimit=await post(base+'/artifacts',{release:'formats@1',build:'b1',debugId:'00000000-0000-4000-8000-000000000004',map:ceiling});assert.equal(atLimit.status,201,await atLimit.text());
 ceiling.sourcesContent[0]+='x';const overLimit=await post(base+'/artifacts',{release:'formats@1',build:'b1',debugId:'00000000-0000-4000-8000-000000000005',map:ceiling});assert.equal(overLimit.status,400);await overLimit.body?.cancel();
 // Reject malformed offsets and ignore indexes before parser allocation or persistence.
 const invalid=await post(base+'/artifacts',{release:'formats@1',build:'b1',debugId:'00000000-0000-4000-8000-000000000009',map:{version:3,sections:[{offset:{line:10000000,column:0},map:flat}]}});assert.equal(invalid.status,400);await invalid.body?.cancel();
 const longRoot=await post(base+'/artifacts',{release:'formats@1',build:'b1',debugId:'00000000-0000-4000-8000-000000000010',map:{version:3,sourceRoot:'x'.repeat(4096),sources:Array.from({length:1000},(_,i)=>'synthetic-spool-'+i+'.js'),names:[],mappings:'AAAA'}});assert.equal(longRoot.status,400,'[SRC-004] overlong source roots are refused before resolution can multiply them across sources');await longRoot.body?.cancel();
 const legacyRoot=await post(base+'/artifacts',{release:'formats@1',build:'b1',debugId:'00000000-0000-4000-8000-000000000012',map:{...flat,sourceRoot:'x'.repeat(4096)}});assert.equal(legacyRoot.status,201,'flat maps within the previous parser bounds retain their accepted path grammar');await legacyRoot.body?.cancel();
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();await browserSignIn(page,origin);await page.goto(origin+'/projects/'+id+'/releases');
 // Exercise the actual prepared-map picker, preserving drafts across invalid selections and navigation.
 const picker=page.getByLabel('Source map file · max 1 MiB',{exact:true}),releaseField=page.getByLabel('Release',{exact:true}),debugField=page.getByLabel('Bundle debug ID',{exact:true});
 const upload=page.getByRole('button',{name:'Upload matching map',exact:true});
 const choose=async(name,map)=>{await picker.setInputFiles({name,mimeType:'application/json',buffer:Buffer.isBuffer(map)?map:Buffer.from(JSON.stringify(map))});};
 const ready=async name=>page.getByText('Ready to upload: '+name,{exact:true}).waitFor();
 const inventory=async()=> (await request(base+'/sentry-uploads')).artifacts;
 const proof=async name=>{
  const out=process.env.SPOOL_PROOF_DIR??'.artifacts/src004';await mkdir(out,{recursive:true});
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   await page.locator('#upload-map').evaluate(node=>node.scrollIntoView({block:'start'}));
   await page.screenshot({path:resolve(out,`${name}-${width}.png`)});
  }
  await page.setViewportSize({width:1440,height:1000});
 };
 await releaseField.selectOption('formats@1');
 const pickerMaps=[
  {name:'synthetic-spool-indexed.js.map',debug:'00000000-0000-4000-8000-000000000021',map:{version:3,debug_id:'00000000-0000-4000-8000-000000000021',sections:[{offset:{line:2,column:5},map:flat}]},line:3,column:5},
  {name:'synthetic-spool-large.js.map',debug:'00000000-0000-4000-8000-000000000022',map:{...flat,debugId:'00000000-0000-4000-8000-000000000022',sourcesContent:['x'.repeat(300000)]},line:1,column:0},
  {name:'synthetic-spool-boundary.js.map',debug:'00000000-0000-4000-8000-000000000023',map:{...ceiling,sourcesContent:[ceiling.sourcesContent[0].slice(0,-1)]},line:1,column:0},
 ];
 assert.equal(Buffer.byteLength(JSON.stringify(pickerMaps[2].map)),1048576);
 for(const [index,item] of pickerMaps.entries()){
  await debugField.fill(index<2?'manual-debug-before-selection':item.debug);
  await choose(item.name,item.map);await ready(item.name);
  assert.equal(await debugField.inputValue(),item.debug,'the stamped or manually selected debug ID is preserved');
  if(index===0){
   const originalInventory=await inventory();
   // Both JSON and map-structure refusals keep the previously prepared map and its identity.
   for(const invalid of [Buffer.from('{'),{...flat,mappings:'!'}]){
    await choose('synthetic-spool-invalid.js.map',invalid);await page.locator('#map-error').waitFor();
    await ready(item.name);assert.equal(await debugField.inputValue(),item.debug);assert.equal(await releaseField.inputValue(),'formats@1');
    assert.deepEqual(await inventory(),originalInventory,'a malformed replacement stores nothing');
   }
   await page.getByRole('navigation',{name:'Workbench'}).getByRole('link',{name:/^Issues/}).click();await page.getByRole('link',{name:'Releases',exact:true}).click();
   await ready(item.name);assert.equal(await releaseField.inputValue(),'formats@1');assert.equal(await debugField.inputValue(),item.debug);
   const details=page.getByRole('button',{name:'Details: Source map requirements',exact:true});
   await details.focus();await page.keyboard.press('Enter');await page.getByRole('dialog').waitFor();
   assert.ok(await page.getByRole('dialog').evaluate(dialog=>dialog.contains(document.activeElement)));
   await page.keyboard.press('Escape');assert.equal(await details.evaluate(button=>document.activeElement===button),true);
   await proof('picker-malformed-draft');
  }
  if(index===2){
   await choose('synthetic-spool-over-boundary.js.map',Buffer.concat([Buffer.from(JSON.stringify(item.map)),Buffer.from(' ')]));
   await page.getByText('Map exceeds 1 MiB.',{exact:true}).waitFor();await ready(item.name);
   assert.equal(await debugField.inputValue(),item.debug,'oversized replacement preserves the boundary draft');
  }
  const response=page.waitForResponse(r=>r.url().endsWith(base+'/artifacts')&&r.request().method()==='POST');
  await upload.click();assert.equal((await response).status(),201);await page.getByRole('status').filter({hasText:'Source map uploaded'}).waitFor();
  assert.equal(await page.getByText('Ready to upload: '+item.name,{exact:true}).count(),0,'only a successful upload clears the map draft');
  const admitted=await post('/api/ingest/'+id,{version:1,eventId:'synthetic-spool-picker-'+index,release:'formats@1',build:'b1',environment:'test',type:'Error',message:'synthetic-spool-picker-'+index,frames:[{file:'picker.js',line:item.line,column:item.column,function:'checkout',debugId:item.debug}],breadcrumbs:[]},project.ingestKey);
  assert.equal(admitted.status,202);const {issue}=await admitted.json();
  const packet=await request(base+'/issues/'+issue+'/packet'),mapped=packet.events.find(event=>event.event.eventId==='synthetic-spool-picker-'+index).atAdmission[0];
  assert.equal(mapped.status,'mapped');assert.deepEqual({file:mapped.original.file,line:mapped.original.line,column:mapped.original.column},{file:'src/original/checkout.js',line:1,column:0});
 }
 await proof('picker-uploaded');
 const pickerStorage=await request(base+'/artifact-storage');
 const capField=page.getByLabel('Artifact storage cap (bytes, optional)');
 await capField.fill('42');
 await page.getByRole('navigation',{name:'Workbench'}).getByRole('link',{name:/^Issues/}).click();await page.getByRole('link',{name:'Releases',exact:true}).click();
 await capField.waitFor();assert.equal(await capField.inputValue(),'42','[SRC-004] an unsaved cap draft survives in-app navigation');
 await page.getByLabel('Release name',{exact:true}).fill('synthetic-spool-draft@1');await page.getByLabel('Build identifier',{exact:true}).fill('b2');
 const storageRefresh=page.waitForResponse(r=>r.url().endsWith('/artifact-storage')&&r.request().method()==='GET');
 await page.getByRole('button',{name:'Register release',exact:true}).click();await(await storageRefresh).finished();
 await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 assert.equal(await capField.inputValue(),'42','[SRC-004] refreshing releases preserves an unsaved cap draft');
 await capField.fill(String(pickerStorage.bytes));await page.getByRole('button',{name:'Save artifact cap',exact:true}).click();
 await page.waitForFunction(async ({base,bytes})=>(await(await fetch(base+'/artifact-storage')).json()).artifact_storage_cap===bytes,{base,bytes:pickerStorage.bytes});
 // A storage-cap refusal names the chosen file and leaves all upload and other unsaved drafts available.
 await releaseField.selectOption('formats@1');
 const refusedDebug='00000000-0000-4000-8000-000000000024',refusedName='synthetic-spool-cap-refused.js.map';
 await debugField.fill(refusedDebug);await choose(refusedName,flat);await ready(refusedName);
 await page.getByLabel('Release name',{exact:true}).fill('synthetic-spool-unsaved@1');
 await page.getByLabel('Build identifier',{exact:true}).fill('unsaved-b1');await capField.fill('42');
 const beforeRefusal=await inventory(),refusal=page.waitForResponse(r=>r.url().endsWith(base+'/artifacts')&&r.request().method()==='POST');
 await upload.click();const refused=await refusal;assert.equal(refused.status(),429);assert.match((await refused.json()).error,new RegExp(refusedName.replaceAll('.','\\.')+': storage cap'));
 await ready(refusedName);assert.equal(await releaseField.inputValue(),'formats@1');assert.equal(await debugField.inputValue(),refusedDebug);
 assert.equal(await page.getByLabel('Release name',{exact:true}).inputValue(),'synthetic-spool-unsaved@1');assert.equal(await page.getByLabel('Build identifier',{exact:true}).inputValue(),'unsaved-b1');assert.equal(await capField.inputValue(),'42');
 assert.deepEqual(await inventory(),beforeRefusal,'storage-cap refusal leaves the stored maps unchanged');
 const axe=await new AxeBuilder({page}).analyze();assert.deepEqual(axe.violations.filter(v=>['serious','critical'].includes(v.impact)),[]);
 await picker.focus();await page.keyboard.press('Tab');assert.equal(await upload.evaluate(button=>document.activeElement===button),true,'the keyboard reaches the upload action after the picker');
 await proof('picker-cap-refusal');
 await page.getByRole('navigation',{name:'Workbench'}).getByRole('link',{name:/^Issues/}).click();await page.getByRole('link',{name:'Releases',exact:true}).click();
 await ready(refusedName);assert.equal(await debugField.inputValue(),refusedDebug);assert.equal(await capField.inputValue(),'42');
 result=await cli('capacity@2');assert.notEqual(result.code,0);assert.match(result.output,/storage cap [0-9]+ bytes/);
 for(const file of files)assert.ok(result.output.includes(file),'each refused file is named');
 const longName='synthetic-spool/'.repeat(30)+'last.js.map';
 const namedRefusal=await post(base+'/artifacts',{release:'formats@1',build:'b1',debugId:'00000000-0000-4000-8000-000000000011',file:longName,map:flat});assert.equal(namedRefusal.status,429);assert.ok((await namedRefusal.json()).error.includes(longName),'the full refused chunk path is returned');
 assert.ok((await request(base+'/sentry-uploads')).assemblies.some(row=>row.detail?.includes(longName)),'the release view retains the full refused chunk path');
 const cap=await request(base+'/artifact-storage');assert.equal(cap.artifact_storage_cap,pickerStorage.bytes);
 const denied=await fetch(origin+base+'/artifact-storage',{method:'PUT',headers:{Authorization:'Bearer '+deploy.key,'Content-Type':'application/json'},body:JSON.stringify({revision:cap.revision,artifact_storage_cap:null})});assert.equal(denied.status,401);await denied.body?.cancel();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.reload();await page.getByText('Stored maps and upload failures',{exact:true}).click();
  await page.getByText(/storage cap [0-9]+ bytes/).first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const axe=await new AxeBuilder({page}).analyze();assert.deepEqual(axe.violations.filter(v=>['serious','critical'].includes(v.impact)),[]);
  const out=process.env.SPOOL_PROOF_DIR??'.artifacts/src004';await mkdir(out,{recursive:true});await page.screenshot({path:resolve(out,`release-${width}.png`),fullPage:true});
  await page.locator('#source-map-setup-heading').evaluate(node=>node.scrollIntoView({block:'start'}));await page.screenshot({path:resolve(out,`storage-${width}.png`)});
  await page.getByText(/storage cap [0-9]+ bytes/).first().evaluate(node=>node.scrollIntoView({block:'start'}));await page.screenshot({path:resolve(out,`refusal-${width}.png`)});
 }
 await context.close();
 console.log('[SRC-004] Spool CLI 27 maps, indexed offsets/sourceRoot/large-map public issue lookup, picker parity through 1 MiB with debug IDs and preserved malformed, oversized and capped drafts, byte cap, per-file refusal, owner-only setting, release UI 1440/390 passed; no icon-only control on touched section.');
 return {id,base,cap};
}
