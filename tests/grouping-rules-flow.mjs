import {followErasure} from './project-erasure/follow.mjs';
import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchBrowser} from './browser-launch.mjs';
import {archiveProjection} from './archive.mjs';

export async function groupingRulesFlow({req,json,origin,cookie}){
 const created=await json('/api/projects','POST',{id:'group-rules',name:'Cedar checkout grouping'}),base='/api/projects/group-rules',root=base+'/grouping-rules';
 await json(base+'/releases','POST',{name:'checkout@1.2.0',build:'web'});
 const dsn=new URL(created.dsn),path=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 let serial=0;
 const event=(type='KeyError',module='vendor.checkout',line=9)=>({event_id:(++serial).toString(16).padStart(32,'0'),release:'checkout@1.2.0',dist:'web',platform:'python',level:'error',logger:'checkout',sdk:{name:'sentry.python',version:'2.0'},exception:{values:[{type,value:'Account unavailable',stacktrace:{frames:[{filename:'/app/account.py',module:'cedar.account',function:'load',lineno:4,in_app:true},{filename:'/app/vendor.py',module,function:'wrap',lineno:line,in_app:true},{filename:'/app/hidden.py',function:'hidden',lineno:100,vars:{__traceback_hide__:true}}]}}]},tags:{tenant:'cedar'}});
 const send=async e=>{const r=await req(path,'POST','{}\n{"type":"event"}\n'+JSON.stringify(e));assert.equal(r.status,200,await r.text());return e};
 const original=await send(event()),second=await send(event('KeyError','vendor.payments',20));
 assert.equal((await json(base+'/issues')).length,2);
 const policy={version:1,stack:'stack.module:vendor.* -app\nstack.function:hidden -group',fingerprint:'error.type:KeyError tags.tenant:cedar -> checkout-account'};
 const preview=await json(root+'/preview','POST',{policy});assert.equal(preview.scanned,2);assert.ok(preview.rows.every(r=>r.changed));assert.equal(new Set(preview.rows.map(r=>r.destination)).size,1);
 assert.equal((await json(base+'/issues')).length,2,'preview leaves evidence unchanged');
 for(const [headers,status] of [[{Cookie:''},401],[{Origin:'https://foreign.invalid'},403]])assert.equal((await req(root,'PUT',{revision:0,policy},headers)).status,status);
 const grant=await json(base+'/keys','POST',{kind:'agent'});assert.equal((await req(root,'GET',undefined,{Cookie:'',Authorization:'Bearer '+grant.key})).status,403);
 assert.equal((await req(root,'PUT',{revision:0,policy:{...policy,stack:'stack.unknown:x -group'}})).status,400,'unknown matcher refused');
 await json(root,'PUT',{revision:0,policy});assert.equal((await req(root,'PUT',{revision:0,policy})).status,409);
 const later=await send(event()),different=await send(event('KeyError','vendor.new',45));
 let groups=await json(base+'/issues');assert.equal(groups.length,3);const destination=groups.find(i=>i.count===2);assert.ok(destination);
 const detail=async(issue,id)=>{const rows=await json(base+'/issues/'+issue+'/events');const selected=rows.rows.find(r=>r.id===id);return json(base+'/issues/'+issue+'/events/'+id+'?occurrence='+selected.occurrence)};
 const info=await detail(destination.id,later.event_id);assert.equal(info.grouping.revision,1);assert.equal(info.grouping.projectFingerprintRule,1);assert.equal(info.grouping.exceptions[0].frames[1].inApp,false);assert.equal(info.grouping.exceptions[0].frames[2].hidden,true);
 const oldIssue=groups.find(i=>i.id!==destination.id&&i.count===1);const oldEvent=(await json(base+'/issues/'+oldIssue.id+'/events')).rows[0];assert.equal((await detail(oldIssue.id,oldEvent.id)).grouping.revision,0,'activation preserves immutable old grouping');
 const stackOnly={...policy,fingerprint:''};await json(root,'PUT',{revision:1,policy:stackOnly});
 await send(event('TypeError','vendor.checkout',9));await send(event('TypeError','vendor.other',42));
 groups=await json(base+'/issues');assert.ok(groups.some(i=>i.count===2&&i.title.startsWith('TypeError')),'stack rules remove vendor-frame grouping noise');
 const archived=await archiveProjection(await req('/api/archive'));assert.equal(archived.data.grouping_policies.find(r=>r.project==='group-rules').revision,2);
 const restored=await startTestWorker(15524);try{
  const restoreCookie=await signIn(restored.origin);const result=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Origin:restored.origin,Cookie:restoreCookie,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:archived.text});assert.ok(result.ok,await result.text());
  const policyResponse=await fetch(restored.origin+root,{headers:{Cookie:restoreCookie}});assert.equal((await policyResponse.json()).revision,2);
  const restoredArchive=await archiveProjection(await fetch(restored.origin+'/api/archive',{headers:{Cookie:restoreCookie}}));assert.deepEqual(restoredArchive.data.grouping_policies,archived.data.grouping_policies);
 }finally{await restored.stop()}
 // The browser uses only the owner cookie; no private dev URL enters screenshots.
 const browser=await launchBrowser();
 try{await mkdir('.artifacts/grouping-rules',{recursive:true});for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.addCookies(cookie.split('; ').map(v=>({name:v.slice(0,v.indexOf('=')),value:v.slice(v.indexOf('=')+1),url:origin})));
  const page=await context.newPage();await page.goto(origin+'/projects/group-rules/settings');const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'Project grouping rules',exact:true})});try{await panel.getByLabel('Stack trace rules',{exact:true}).waitFor({timeout:10000})}catch(e){await page.screenshot({path:'.artifacts/grouping-rules/unavailable.png',fullPage:true});throw e}
  await panel.getByLabel('Fingerprint rules',{exact:true}).fill('error.type:KeyError -> checkout-account');await panel.getByRole('button',{name:'Preview grouping rules',exact:true}).click();await panel.getByRole('heading',{name:'Retained-event preview'}).waitFor();assert.ok((await panel.innerText()).includes('6 scanned'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await panel.screenshot({path:`.artifacts/grouping-rules/preview-${width}.png`});
  await panel.getByRole('button',{name:'Save grouping rules',exact:true}).click();await panel.getByRole('status').filter({hasText:'Grouping rules saved'}).waitFor();await panel.screenshot({path:`.artifacts/grouping-rules/saved-${width}.png`});
  await page.goto(origin+'/projects/group-rules/issues/'+destination.id);await page.getByText('Related Exceptions',{exact:true}).waitFor();await page.locator('.metadata').filter({hasText:'Selected event'}).waitFor();await page.getByRole('button',{name:'Details: Event grouping information',exact:true}).click();await page.getByRole('dialog').waitFor();assert.ok((await page.getByRole('dialog').innerText()).includes('custom fingerprint'));await page.screenshot({path:`.artifacts/grouping-rules/explanation-${width}.png`});await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await context.close();
 }}finally{await browser.close()}
 const erasure=await json(base+'/erasure');assert.equal(erasure.deleted.grouping_policies,1);await followErasure(json,await json(base+'/erasure','POST',{confirm:'group-rules',planHash:erasure.planHash}));assert.ok(!(await archiveProjection(await req('/api/archive'))).data.grouping_policies.some(row=>row.project==='group-rules'));
 console.log('Grouping rules public flow passed: exact-project authority, preview/no mutation, future routing, revision conflicts, immutable explanations, archive policy and responsive save/detail.');
}
