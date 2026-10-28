import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {signIn,openGate} from './auth.mjs';
import {launchBrowser} from './browser-launch.mjs';
import {startTestWorker} from './worker.mjs';
export async function reviewInboxFlow({req,json,origin}){
 const p='synthetic-spool-20',base=`/api/projects/${p}`,project=await json('/api/projects','POST',{id:p,name:p});
 await json(base+'/releases','POST',{name:'r1',build:'b1'});
 const event=(id,type,release='r1',build='b1')=>({version:1,eventId:id,release,build,environment:'test',type,message:'synthetic-spool-20',frames:[{file:'https://app.example/app.js',function:type,line:1,column:0}],breadcrumbs:[]});
 let serial=0;const send=(type,release,build)=>json(`/api/ingest/${p}`,'POST',event('synthetic-spool-'+(++serial),type,release,build),{Cookie:'',Authorization:'Bearer '+project.ingestKey});
 await send('FirstError');await send('SecondError');
 const search=()=>json(base+'/issue-search?q=review:pending'),all=await search();assert.equal(all.total,2);assert.equal(all.reviewPending,2);
 const selected=all.rows.map(({id,revision})=>({id,revision}));
 const mark=async issues=>{const input={action:'reviewed',issues,apply:false},preview=await json(base+'/bulk-triage','POST',input);return {input,preview,apply:()=>json(base+'/bulk-triage','POST',{...input,apply:true,preview:preview.preview})}};
 let pending=await mark(selected);assert.equal((await search()).total,2,'[FIND-001] preview changes nothing');
 await json(base+'/issues/'+selected[0].id,'PATCH',{state:'acknowledged',revision:selected[0].revision});
 assert.equal((await req(base+'/bulk-triage','POST',{...pending.input,apply:true,preview:pending.preview.preview})).status,409);assert.equal((await search()).total,2,'[FIND-001] stale selection is atomic');
 let before=(await json(base+'/issue-search')).rows,current=before.map(({id,revision})=>({id,revision}));pending=await mark([current[0]]);assert.equal((await pending.apply()).changed,1);assert.equal((await search()).total,1);assert.deepEqual((await json(base+'/issue-search')).rows.map(({review_pending,...row})=>row),before.map(({review_pending,...row})=>row),'[FIND-001] review changes no issue field');
 pending=await mark(current);assert.equal((await pending.apply()).changed,1);assert.equal((await search()).total,0);
 pending=await mark(current);assert.equal((await pending.apply()).changed,0,'already reviewed selection is a no-op');
 const first=(await json(base+'/issues')).find(row=>row.title.startsWith('FirstError'));
 await json(base+'/issues/'+first.id,'PATCH',{state:'resolved',revision:first.revision});await json(base+'/releases','POST',{name:'r2',build:'b2'});await send('FirstError','r2','b2');assert.equal((await search()).total,1,'[FIND-001] regression returns to review inbox');
 const viewQuery={q:'review:pending environment:test',status:'all',release:'all',sort:'latest'},view=await json(base+'/review/views','POST',viewQuery);assert.deepEqual(view.query,viewQuery);
 for(const bad of [{...viewQuery,q:'user.email:someone'},{...viewQuery,owner:'someone'},{...viewQuery,q:'token=synthetic-spool-20'}]){const response=await req(base+'/review/views','POST',bad);assert.equal(response.status,400);await response.body?.cancel()}
 assert.equal((await req(base+'/review/views','GET',undefined,{Cookie:''})).status,401);assert.equal((await req(base+'/issue-search?q='+encodeURIComponent(viewQuery.q),'GET',undefined,{Cookie:''})).status,401,'deep query link confers no authority');
 const agent=await json(base+'/keys','POST',{kind:'agent'});assert.equal((await req(base+'/review/views','GET',undefined,{Cookie:'',Authorization:'Bearer '+agent.key})).status,403);
 for(let n=1;n<25;n++)await json(base+'/review/views','POST',{...viewQuery,q:`environment:synthetic-spool-${n}`});assert.equal((await json(base+'/review/views')).views.length,25);assert.equal((await req(base+'/review/views','POST',viewQuery)).status,409);
 await json(base+'/review/views/'+(await json(base+'/review/views')).views.find(v=>v.id!==view.id).id,'DELETE');
 const cookie=await signIn(origin),browser=await launchBrowser();await mkdir('.artifacts/find001',{recursive:true});
 try{for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:1000}});try{
  await openGate(context,origin);await context.addCookies(cookie.split('; ').filter(Boolean).map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:origin})));const page=await context.newPage();await page.goto(origin+`/projects/${p}/issues`);await page.getByRole('button',{name:'Show pending review',exact:true}).click();await page.getByRole('searchbox',{name:'Search issues',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('.issue-browser')?.getAttribute('aria-busy')==='false');
  await page.getByLabel('Saved views',{exact:true}).selectOption(view.id);await page.waitForFunction(()=>document.querySelector('.issue-browser')?.getAttribute('aria-busy')==='false');
  assert.equal(await page.getByRole('searchbox',{name:'Search issues',exact:true}).inputValue(),viewQuery.q);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const box=page.locator('.issue-browser input[type="checkbox"]').first();await box.check();await page.getByLabel('Bulk action',{exact:true}).selectOption('reviewed');await page.getByRole('button',{name:'Preview triage',exact:true}).click();await page.getByRole('heading',{name:'Review 1 issue',exact:true}).waitFor();const axe=await new AxeBuilder({page}).include('.issue-browser').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>v.id),[]);await page.screenshot({path:`.artifacts/find001/review-preview-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Cancel preview',exact:true}).click();await page.getByRole('button',{name:'Clear selection',exact:true}).click();
 }finally{await context.close()}}}finally{await browser.close()}
 const archive=await(await req('/api/archive')).text(),target=await startTestWorker(15547);
 try{
  const cookie=await signIn(target.origin,{choosePolicy:false}),r=(path,method='GET',body)=>fetch(target.origin+path,{method,headers:{Origin:target.origin,Cookie:cookie,...body?{'content-type':'application/json','x-confirm-restore':'yes'}:{}},...body?{body:typeof body==='string'?body:JSON.stringify(body)}:{}}),j=async(...args)=>{const res=await r(...args);assert.ok(res.ok,`[FIND-001] round trip ${args[0]} ${res.status}`);return res.json()};await j('/api/restore','POST',archive);assert.deepEqual((await j(base+'/review/views')).views,(await json(base+'/review/views')).views);assert.equal((await j(base+'/issue-search?q=review:pending')).total,1);
  const plan=await j(base+'/erasure');let receipt=await j(base+'/erasure','POST',{confirm:p,planHash:plan.planHash});for(let n=0;n<50&&receipt.phase!=='complete';n++)receipt=await j(`/api/erasures/${receipt.id}/resume`,'POST',{});assert.equal(receipt.phase,'complete');for(const table of ['review_stamps','review_views'])assert.equal((await(await target.db()).prepare('SELECT COUNT(*) n FROM '+table+' WHERE project=?').bind(p).first()).n,0,'[FIND-001] erasure deletes '+table);
 }finally{await target.stop()}
 console.log('[FIND-001] pending count, one/selection review, atomic preview, unchanged issue data, regression, owner views, query validation, 25-view cap, stranger links, archive/restore/erasure and 1440/390 UI passed');
}
