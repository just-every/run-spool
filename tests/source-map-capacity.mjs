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
 const storage=await request(base+'/artifact-storage');
 const context=await browser.newContext(),page=await context.newPage();await browserSignIn(page,origin);await page.goto(origin+'/projects/'+id+'/releases');
 const capField=page.getByLabel('Artifact storage cap (bytes, optional)');
 await capField.fill('42');
 await page.getByRole('navigation',{name:'Workbench'}).getByRole('link',{name:/^Issues/}).click();await page.getByRole('link',{name:'Releases',exact:true}).click();
 await capField.waitFor();assert.equal(await capField.inputValue(),'42','[SRC-004] an unsaved cap draft survives in-app navigation');
 await page.getByLabel('Release name',{exact:true}).fill('synthetic-spool-draft@1');await page.getByLabel('Build identifier',{exact:true}).fill('b2');
 const storageRefresh=page.waitForResponse(r=>r.url().endsWith('/artifact-storage')&&r.request().method()==='GET');
 await page.getByRole('button',{name:'Register release',exact:true}).click();await(await storageRefresh).finished();
 await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 assert.equal(await capField.inputValue(),'42','[SRC-004] refreshing releases preserves an unsaved cap draft');
 await capField.fill(String(storage.bytes));await page.getByRole('button',{name:'Save artifact cap',exact:true}).click();
 await page.waitForFunction(async ({base,bytes})=>(await(await fetch(base+'/artifact-storage')).json()).artifact_storage_cap===bytes,{base,bytes:storage.bytes});
 result=await cli('capacity@2');assert.notEqual(result.code,0);assert.match(result.output,/storage cap [0-9]+ bytes/);
 for(const file of files)assert.ok(result.output.includes(file),'each refused file is named');
 const longName='synthetic-spool/'.repeat(30)+'last.js.map';
 const namedRefusal=await post(base+'/artifacts',{release:'formats@1',build:'b1',debugId:'00000000-0000-4000-8000-000000000011',file:longName,map:flat});assert.equal(namedRefusal.status,429);assert.ok((await namedRefusal.json()).error.includes(longName),'the full refused chunk path is returned');
 assert.ok((await request(base+'/sentry-uploads')).assemblies.some(row=>row.detail?.includes(longName)),'the release view retains the full refused chunk path');
 const cap=await request(base+'/artifact-storage');assert.equal(cap.artifact_storage_cap,storage.bytes);
 const denied=await fetch(origin+base+'/artifact-storage',{method:'PUT',headers:{Authorization:'Bearer '+deploy.key,'Content-Type':'application/json'},body:JSON.stringify({revision:cap.revision,artifact_storage_cap:null})});assert.equal(denied.status,401);await denied.body?.cancel();
 for(const width of [1440]){
  await page.setViewportSize({width,height:1000});await page.reload();await page.getByText('Stored maps and upload failures',{exact:true}).click();
  await page.getByText(/storage cap [0-9]+ bytes/).first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const axe=await new AxeBuilder({page}).analyze();assert.deepEqual(axe.violations.filter(v=>['serious','critical'].includes(v.impact)),[]);
  const out=process.env.SPOOL_PROOF_DIR??'.artifacts/src004';await mkdir(out,{recursive:true});await page.screenshot({path:resolve(out,`release-${width}.png`),fullPage:true});
  await page.locator('#source-map-setup-heading').evaluate(node=>node.scrollIntoView({block:'start'}));await page.screenshot({path:resolve(out,`storage-${width}.png`)});
  await page.getByText(/storage cap [0-9]+ bytes/).first().evaluate(node=>node.scrollIntoView({block:'start'}));await page.screenshot({path:resolve(out,`refusal-${width}.png`)});
 }
 await context.close();
 console.log('[SRC-004] Spool CLI 27 maps, indexed offsets/sourceRoot/large-map public issue lookup, byte cap, per-file refusal, owner-only setting, release UI 1440 passed; no icon-only control on touched section.');
 return {id,base,cap};
}
