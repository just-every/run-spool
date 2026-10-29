import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,lstat,access,rm,symlink,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {commandCheckout} from './command-runner.mjs';
import {journeyDiagnostics,finishJourney} from './command-diagnostics.mjs';
import {launchBrowser} from './browser-launch.mjs';
import {testOwner,gate} from './auth.mjs';
import {browserPreviewSession,previewOwnerSession} from './preview-session.mjs';
import {firstProjectJourney} from './setup-journey.mjs';
import {readArchive,makePart} from '../src/modules/portability/index.mjs';
import {ContentVerifier} from '../src/modules/portability/format.mjs';
const diagnostics=journeyDiagnostics();
let checkout,browser,failure;
try {
 checkout=await commandCheckout(diagnostics);const {root,command,ready}=checkout;
const origin='http://127.0.0.1:15530',previewOrigin='http://127.0.0.1:15531';
const exists=path=>access(resolve(root,path)).then(()=>true,()=>false);
const get=path=>readFile(resolve(root,path),'utf8');
// rer setup writes the checkout's local admission key.
const useCheckoutKey=async()=>{gate.key=/^RER_DEV_KEY=(\S+)$/m.exec(await get('.rer/local/dev-key.env'))[1];};
const put=(path,value)=>writeFile(resolve(root,path),value,{mode:0o600});
 diagnostics.stage('contract');
 await command(['check','--profile','first-party']);
 diagnostics.stage('legacy-state');
 await mkdir(resolve(root,'.wrangler/reference'),{recursive:true});await put('.wrangler/reference/preserve.txt','legacy-state-fixture');
 assert.notEqual((await command(['setup','--owner-email',testOwner],null)).code,0);assert.equal(await get('.wrangler/reference/preserve.txt'),'legacy-state-fixture');assert.equal(await exists('.dev.vars'),false);
 diagnostics.stage('linked-settings');
 await rm(resolve(root,'.wrangler/reference'),{recursive:true});await put('linked-settings-fixture.txt','private fixture bytes');await symlink('linked-settings-fixture.txt',resolve(root,'.dev.vars'));
 assert.notEqual((await command(['setup','--owner-email',testOwner],null)).code,0);assert.equal(await get('linked-settings-fixture.txt'),'private fixture bytes');await rm(resolve(root,'.dev.vars'));await rm(resolve(root,'linked-settings-fixture.txt'));
 diagnostics.stage('install');
 await command(['install']);
 diagnostics.stage('setup');
 await command(['setup','--owner-email',testOwner,'--port','15530']);await useCheckoutKey();
 const initialSettings=await get('.dev.vars');
 const generated=parseEnv(initialSettings);for(const file of await readdir(resolve(root,'dist'),{recursive:true})){const path=resolve(root,'dist',file);if((await lstat(path)).isFile()){const bytes=await readFile(path);for(const key of ['SESSION_SECRET','SETUP_TOKEN'])assert.equal(bytes.includes(Buffer.from(generated[key])),false,'private generated secret absent from build');}}
 assert.ok((await get('.dev.vars'))===initialSettings,'private settings preserved byte for byte');assert.equal(await fetch(origin+'/health').then(()=>true,()=>false),false,'setup stops its runtime');
 diagnostics.stage('owner-preservation');
 assert.notEqual((await command(['setup','--owner-email','different@spool.test'],null)).code,0);assert.ok((await get('.dev.vars'))===initialSettings,'private settings preserved byte for byte');
 diagnostics.stage('dev');
 const dev=await ready(['dev','--foreground','--port','15530'],origin);
 assert.notEqual((await command(['reset','--yes'],null)).code,0,'active reset refused');
 diagnostics.stage('desktop-sign-in');
 browser=await launchBrowser();const cookie=await firstProjectJourney(browser,origin,1440);
 const post=(path,value)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(value)});
 assert.equal((await post('/api/projects/journey/releases',{name:'r1',build:'b1'})).status,201);

 const previewCookies=await previewOwnerSession(origin,generated.SESSION_SECRET);
 dev.child.kill('SIGINT');assert.equal((await dev.closed).code,130);assert.equal(await fetch(origin+'/health').then(()=>true,()=>false),false);
 diagnostics.stage('preview');
 const preview=await ready(['preview','--port','15531'],previewOrigin);
 diagnostics.stage('preview-sign-in');
 const narrow=await browser.newContext({javaScriptEnabled:false,viewport:{width:1440,height:844}}),phone=await narrow.newPage();
 await browserPreviewSession(phone,previewOrigin,preview.output(),previewCookies);
 assert.equal((await narrow.request.get(previewOrigin+'/setup',{maxRedirects:0})).headers().location,'/');
 assert.equal(new URL(phone.url()).pathname,'/projects');assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await narrow.close();await browser.close();browser=null;await command(['preview','--stop']);assert.equal((await preview.closed).code,0);
 assert.ok((await get('.dev.vars'))===initialSettings,'requested ports only override runtime settings');
 diagnostics.stage('resume');
 await command(['setup','--owner-email',testOwner]);assert.ok((await get('.dev.vars'))===initialSettings,'resume preserves settings');
 diagnostics.stage('export');
 await mkdir(resolve(root,'exports'),{recursive:true});await command(['export','--output','exports/data.jsonl']);
 const archive=await get('exports/data.jsonl'),records=[];for await(const record of readArchive(new Response(archive).body))records.push(record);
 const manifest=records[0];assert.ok(manifest.tables.find(t=>t.name==='projects').count>0);assert.ok(manifest.excludedTables.includes('credentials'));assert.ok(manifest.excludedTables.includes('oa_operators'));assert.ok(manifest.excludedTables.includes('rer_mail_development_outbox'));
 assert.notEqual((await command(['import','--input','exports/data.jsonl','--yes'],null)).code,0,'nonempty restore refused');
 diagnostics.stage('reset');
 await mkdir(resolve(root,'.rer/deploy'),{recursive:true});await put('.rer/deploy/owner-kept.txt','owner custody');
 assert.notEqual((await command(['reset'],null)).code,0);await command(['reset','--yes']);assert.equal(await exists('.dev.vars'),false);assert.equal(await exists('.wrangler/state'),false);assert.equal(await get('.rer/deploy/owner-kept.txt'),'owner custody');assert.ok((await get('exports/data.jsonl'))===archive,'export preserved byte for byte');
 // Recompute every integrity layer: semantic policy must still refuse unsafe
 // telemetry through the public CLI, proving callbacks reached its worker.
 diagnostics.stage('restore-policy');
 const poisoned=structuredClone(records);const part=poisoned.find(r=>r.kind==='part'&&r.items.some(i=>i.table==='projects'));part.items.find(i=>i.table==='projects').row.name='token=test-spool-private-restore-canary';
 const replaced=await makePart(part.index,part.items);Object.assign(part,replaced);const verifier=new ContentVerifier(poisoned[0]);for(const p of poisoned.filter(r=>r.kind==='part'))for(const item of p.items)verifier.add(item);poisoned.at(-1).contentHash=verifier.digest();await put('exports/unsafe.jsonl',poisoned.map(r=>JSON.stringify(r)).join('\n')+'\n');
 await put('exports/truncated.jsonl',records.slice(0,-1).map(r=>JSON.stringify(r)).join('\n')+'\n');assert.notEqual((await command(['import','--input','exports/truncated.jsonl','--yes'],null)).code,0);
 assert.notEqual((await command(['import','--input','exports/unsafe.jsonl','--yes'],null)).code,0);await command(['import','--input','exports/data.jsonl','--yes']);await command(['export','--output','exports/restored.jsonl']);
 diagnostics.stage('restore');
 const restored=[];for await(const record of readArchive(new Response(await get('exports/restored.jsonl')).body))restored.push(record);// AUDIT-001: the restore appends one attributed fact to the carried safe history,
 // so the re-export keeps every row and object and every original fact, then that fact.
 const items=rs=>rs.filter(r=>r.kind==='part').flatMap(r=>r.items);
 const content=rs=>items(rs).filter(i=>i.kind!=='payload').map(i=>JSON.stringify(i));
 const facts=rs=>Buffer.concat(items(rs).filter(i=>i.kind==='payload'&&i.name==='safe_audit').sort((a,b)=>a.offset-b.offset).map(i=>Buffer.from(i.data,'base64'))).toString('utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line));
 assert.deepEqual(content(restored),content(records),'restore keeps every row and object');
 const carried=facts(records),kept=facts(restored);assert.ok(carried.length>0,'the archive carries safe audit history');
 assert.deepEqual(kept.slice(0,carried.length),carried,'restore keeps the carried audit history');
 assert.deepEqual(kept.slice(carried.length).map(fact=>[fact.action,fact.outcome]),[['archive.restore','succeeded']],'restore appends one attributed fact');
 await command(['setup','--owner-email',testOwner,'--port','15530']);
 diagnostics.stage('deploy-dry-run');
 await put('.test-no-provider.cjs',`const fs=require('node:fs');const loopback=value=>{try{const host=typeof value==='string'||value instanceof URL?new URL(value).hostname:value?.url?new URL(value.url).hostname:value?.hostname??value?.host;return ['localhost','127.0.0.1','::1','[::1]'].includes(host)}catch{return false}};const reject=()=>{fs.appendFileSync(process.env.SPOOL_PROVIDER_ATTEMPTS,'attempt\\n');throw Error('Provider transport forbidden in dry-run')};const originalFetch=globalThis.fetch;globalThis.fetch=(url,...rest)=>loopback(url)?originalFetch(url,...rest):reject();for(const name of ['node:http','node:https']){const module=require(name);for(const key of ['request','get']){const original=module[key];module[key]=function(input,...rest){return loopback(input)?original.call(this,input,...rest):reject()};}}`);
 const previousNodeOptions=checkout.env.NODE_OPTIONS;checkout.env.NODE_OPTIONS=(previousNodeOptions??'')+' --require='+resolve(root,'.test-no-provider.cjs');checkout.env.SPOOL_PROVIDER_ATTEMPTS=resolve(root,'.test-provider-attempts');
 // Since rer 0.2.58 a credential-free dry run still builds, then refuses (exit 3) because it cannot read the target's
 // secret bindings, naming the Cloudflare inputs and everything else a real deploy needs, sign-in mail included.
 const unconfigured=await command(['deploy','--dry-run'],3);
 const localSettings=await get('.dev.vars');
 // Reserved fixture senders are refused before building, with no provider request.
 await put('.test-deploy.env','MAIL_FROM=synthetic-spool-1@example.test\nMAIL_API_KEY=synthetic-dry-run-provider-key\n');
 try { await command(['deploy','--dry-run','--env-file','.test-deploy.env'],4); } finally {await rm(resolve(root,'.test-deploy.env'));if(previousNodeOptions===undefined)delete checkout.env.NODE_OPTIONS;else checkout.env.NODE_OPTIONS=previousNodeOptions;delete checkout.env.SPOOL_PROVIDER_ATTEMPTS;}
 assert.equal(await get('.dev.vars'),localSettings,'production dry-run preserves local settings');
 assert.equal(await exists('.test-provider-attempts'),false,'deploy dry-run performs no provider HTTP calls');await rm(resolve(root,'.test-no-provider.cjs'));
 assert.equal(await get('.rer/deploy/owner-kept.txt'),'owner custody');
 diagnostics.stage('complete');
 console.log('Spool README commands passed: fresh-clone package bootstrap, frozen install, safe setup and owner preservation, foreground dev/preview, no-JS sign-in at 1440, ordinary owner session in production preview after restart, active reset refusal, validated CLI portability, deploy dry-run.');
}catch(error){console.error(JSON.stringify({type:error.name,transport:error.cause?.code,stack:error.stack?.split('\n').slice(1).filter(line=>line.includes('/tests/')).slice(0,3)}));failure=diagnostics.failure(error);}finally{await finishJourney(diagnostics,failure,browser,checkout);}
