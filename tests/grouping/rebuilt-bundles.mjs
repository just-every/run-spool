import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {build} from 'vite';
import {spoolSourceMaps} from '../../packages/sdk/src/sourcemaps/plugin.mjs';
import {frames} from '../../src/domain/capture.ts';

/** One real Vite application, rebuilt with and without maps through public intake. */
export async function rebuiltBundlesFlow({json,origin}) {
 const project=await json('/api/projects','POST',{id:'synthetic-spool-rebuilds',name:'Harbor Pine Storefront'}),p='/api/projects/'+project.id;
 const deploy=await json(p+'/keys','POST',{kind:'deploy'}),keyEnv='SPOOL_REBUILT_BUNDLES_DEPLOY_KEY';
 const temporary=await realpath(await mkdtemp(resolve(tmpdir(),'spool-rebuilds-')));
 process.env[keyEnv]=deploy.key;
 const identities={},generated=[],sources=[];
 try{
  await mkdir(resolve(temporary,'src'));
  await writeFile(resolve(temporary,'index.html'),'<script type="module" src="/src/main.js"></script>');
  const account='export function shippingLabel(account) {\n return account.address.street;\n}\n';
  await writeFile(resolve(temporary,'src/checkout.js'),`export function giftCard(id) {\n throw new RangeError('Gift card '+id+' has no balance record');\n}\nexport function payment() {\n throw new Error('Payment declined');\n}\nexport function otherPayment() {\n throw new Error('Payment declined');\n}\n`);
  for(const [index,release] of ['storefront@2.3.0','storefront@2.4.0','storefront@2.4.1','storefront@2.5.0','storefront@2.5.2'].entries()){
   await writeFile(resolve(temporary,'src/account.js'),account+(index>=2?'export function accountSummary(account) { return account.name + account.email; }\nglobalThis.accountSummary = accountSummary;\n':''));
   await writeFile(resolve(temporary,'src/main.js'),`import {shippingLabel} from './account.js';\nimport {giftCard,payment,otherPayment} from './checkout.js';\n${index>=3?'globalThis.storefrontBuild = [1,2,3,4,5,6].map(value => value * 2);\n':''}globalThis.spoolRebuildFixture = {shippingLabel,giftCard,payment,otherPayment};\n`);
   if(index===0)await json(p+'/releases','POST',{name:release,build:'web'});
   await build({configFile:false,root:temporary,logLevel:'silent',plugins:index?[spoolSourceMaps({endpoint:origin,project:project.id,release,build:'web',keyEnv})]:[],build:{outDir:'dist',minify:true,sourcemap:!!index,modulePreload:false}});
   const assets=resolve(temporary,'dist/assets'),file=(await readdir(assets)).find(file=>file.endsWith('.js'));
   const errors=await new Promise((done,reject)=>{
    const source=`await import(${JSON.stringify(pathToFileURL(resolve(assets,file)).href)});const errors={};for(const name of ['shippingLabel','giftCard','payment','otherPayment']){try{globalThis.spoolRebuildFixture[name](name==='shippingLabel'?{}:${JSON.stringify(index<2?'101':String(101+index))})}catch(error){errors[name]={name:error.name,message:error.message,stack:error.stack}}}console.log(JSON.stringify(errors));`;
    const child=spawn(process.execPath,['--input-type=module','-e',source],{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);child.once('error',reject);child.once('exit',code=>code===0?done(JSON.parse(stdout.trim())):reject(new Error('Vite fixture failed: '+stderr)));
   });
   const map=index?JSON.parse(await readFile(resolve(assets,file+'.map'),'utf8')):null;
   for(const name of ['shippingLabel','giftCard','payment',...index?['otherPayment']:[]]){
    const error=errors[name];assert.ok(error);
    const reported=frames(error.stack,map?.debug_id).filter(frame=>frame.file.includes('/dist/assets/'));
    // Keep the actual Vite filename while simulating the browser's public origin.
    for(const frame of reported)frame.file='https://storefront.example/assets/'+file;
    const event={version:1,eventId:'rebuild-'+index+'-'+name,release,build:'web',environment:'production',type:error.name,message:error.message,frames:reported,breadcrumbs:[]};
    const accepted=await json('/api/ingest/'+project.id,'POST',event,{Cookie:'',Authorization:'Bearer '+project.ingestKey});
    if(identities[name])assert.equal(accepted.issue,identities[name],name+' keeps its issue across rebuilt bundles');
    else identities[name]=accepted.issue;
    if(name==='shippingLabel'){generated.push(reported[0]);if(index)sources.push(accepted.diagnostic[0].original);}
   }
   if(index===0){for(const issue of Object.values(identities)){const packet=await json(p+'/issues/'+issue+'/packet');await json(p+'/issues/'+issue,'PATCH',{state:'resolved',revision:packet.issue.revision});}}
  }
  assert.ok(new Set(generated.map(frame=>frame.file)).size>2,'the app was actually rebuilt');
  assert.ok(generated.some(frame=>frame.line!==generated[0].line||frame.function!==generated[0].function),'generated names or positions changed');
  assert.ok(sources.every(source=>source.file===sources[0].file&&source.line===sources[0].line&&source.column===sources[0].column),'the original failing position did not change');
  assert.notEqual(identities.payment,identities.otherPayment,'identical exception values at different original positions remain separate');
  const alerts=await json(p+'/alerts');
  for(const name of ['shippingLabel','giftCard','payment']){
   assert.equal(alerts.filter(row=>row.issue===identities[name]&&row.kind==='new_issue').length,1);
   assert.equal(alerts.filter(row=>row.issue===identities[name]&&row.kind==='regression').length,1);
  }
  return {project:project.id,identities};
 }finally{delete process.env[keyEnv];delete globalThis.spoolRebuildFixture;delete globalThis.accountSummary;delete globalThis.storefrontBuild;await rm(temporary,{recursive:true,force:true});}
}
