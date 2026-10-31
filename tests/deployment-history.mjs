import {suspectFlow} from './suspect-flow.mjs';
import {releaseOrderFlow} from './release-order-flow.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';
import {archiveProjection} from './archive.mjs';
import {launchBrowser} from './browser-launch.mjs';
import {followErasure} from './project-erasure/follow.mjs';

// [REL-001] [REL-002]: real emitted Worker, owner/deploy HTTP doors, native scheduled event and browser UI.
const app=await startTestWorker(15553),origin=app.origin;
let browser;
try {
 const cookie=await signIn(origin),req=(path,method='GET',body,headers={})=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,...body?{'Content-Type':typeof body==='string'?'application/x-ndjson':'application/json'}:{},...headers},...body?{body:typeof body==='string'?body:JSON.stringify(body)}:{}});
 const json=async(...args)=>{const r=await req(...args);assert.ok(r.ok,`${args[0]} ${r.status}: ${await r.clone().text()}`);return r.json()};
 browser=await launchBrowser();
 await releaseOrderFlow({req,json,db:await app.db(),origin,cookie,browser});
 const project=await json('/api/projects','POST',{id:'deployment-history',name:'Cedar checkout deployment history'}),base='/api/projects/'+project.id;
 await json(base+'/releases','POST',{name:'checkout@1.0.0',build:'web-1'});await json(base+'/releases','POST',{name:'checkout@2.0.0',build:'web-2'});
 const deploy=await json(base+'/keys','POST',{kind:'deploy'}),agent=await json(base+'/keys','POST',{kind:'agent'}),service={Cookie:'',Authorization:'Bearer '+deploy.key};
 const dest=await json(base+'/alerting/destinations','POST',{label:'Release owner',recipient:'release-owner@example.test'});
 const root=base+'/deployments',now=Date.now(),sha='a'.repeat(40),prior='b'.repeat(40);
 const start=(id,more={})=>({id,release:'checkout@2.0.0',build:'web-2',environment:'production',repository:'https://example.test/cedar/checkout',commitSha:sha,previousCommit:prior,includedCommits:[prior,sha],startedAt:new Date(now-60000).toISOString(),deadline:new Date(now+3600000).toISOString(),destination:dest.id,...more});
 const callback=(state,exposure=100,more={})=>({callback:state,state,exposure,at:new Date(now).toISOString(),...more});
 assert.deepEqual((await json(root)).rows,[]);
 await mkdir('.artifacts/REL-001',{recursive:true});
 const screens=async(label)=>{for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:900}});await context.addCookies(cookie.split('; ').map(v=>({name:v.slice(0,v.indexOf('=')),value:v.slice(v.indexOf('=')+1),url:origin})));const page=await context.newPage();await page.goto(origin+'/projects/'+project.id+'/releases');const panel=page.locator('#deployment-history');await panel.getByRole('heading',{name:'Deployment history',exact:true}).waitFor();await panel.getByText(label==='empty'?'No deployment runs recorded.':'Caller recorded; repository ancestry has not been read back.',{exact:true}).first().waitFor({state:label==='empty'?'visible':'attached'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'REL-001 responsive history');await panel.screenshot({path:`.artifacts/REL-001/${label}-${width}.png`});if(label!=='empty')for(const card of await panel.locator('article').all()){const id=(await card.locator('h3').innerText()).split(' · ')[0];await card.locator('summary').click();assert.deepEqual(await card.locator('details li').allTextContents(),[prior,sha]);await card.screenshot({path:`.artifacts/REL-001/${id}-${width}.png`})}await context.close()}};
 await screens('empty');
 await json(root,'POST',start('deploy-only'),service);assert.equal((await req(root,'POST',start('deploy-only'),service)).status,200);
 await json(root+'/deploy-only/callbacks','POST',callback('progress',10),service);await json(root+'/deploy-only/callbacks','POST',callback('progress',50,{callback:'half'}),service);
 await json(root+'/deploy-only/callbacks','POST',callback('succeeded'),service);
 const completed=(await json(root)).rows.find(r=>r.id==='deploy-only');
 assert.deepEqual(completed.steps.map(s=>[s.state,s.exposure]),[['started',0],['progress',10],['progress',50],['succeeded',100]],'CI history preserves ordered states and progressive exposure');
 assert.deepEqual(completed.includedCommits,[prior,sha],'completed CI run retains its included commits');
 assert.match(completed.actor,/^actor-/,'CI authority has a safe permanent actor alias');
 assert.ok(completed.steps.every(s=>s.actor===completed.actor),'every CI step retains the deployment actor');
 const repeats=await Promise.all([req(root+'/deploy-only/callbacks','POST',callback('succeeded'),service),req(root+'/deploy-only/callbacks','POST',callback('succeeded'),service)]);assert.ok(repeats.every(r=>r.status===200));
 assert.equal((await req(root+'/deploy-only/callbacks','POST',callback('succeeded',80),service)).status,409);assert.equal((await req(root+'/deploy-only/callbacks','POST',callback('failed'),service)).status,409);
 assert.deepEqual((await json(root)).rows.find(r=>r.id==='deploy-only'),completed,'idempotent retries and conflicting terminal callbacks leave CI history unchanged');
 await json(root,'POST',start('deploy-failed'),service);
 await json(root+'/deploy-failed/callbacks','POST',callback('failed',20),service);
 const failed=(await json(root)).rows.find(r=>r.id==='deploy-failed');
 assert.deepEqual(failed.steps.map(s=>[s.state,s.exposure]),[['started',0],['failed',20]],'a separate CI-authorized failure reads back as failed');
 assert.deepEqual(failed.includedCommits,[prior,sha],'failed CI run retains its included commits');
 assert.equal(failed.actor,completed.actor,'the same deploy key retains its actor across CI runs');
 assert.ok(failed.steps.every(s=>s.actor===completed.actor),'failed CI steps retain their deploy-key actor');
 await json(root,'POST',start('owner-started',{environment:'staging'}));await json(root,'POST',start('owner-failed'));await json(root+'/owner-failed/callbacks','POST',callback('failed',20));
 assert.notEqual((await json(root)).rows.find(r=>r.id==='owner-failed').actor,failed.actor,'owner and CI authority have distinct actor aliases');
 await json(root,'POST',start('owner-rollback'));await json(root+'/owner-rollback/callbacks','POST',callback('succeeded'));await json(root+'/owner-rollback/callbacks','POST',callback('rolled_back',0,{rollbackRelease:'checkout@1.0.0'}));
 await json(root,'POST',start('owner-abandoned',{deadline:new Date(now-1).toISOString()}));await json(root,'POST',start('owner-late',{deadline:new Date(now-1).toISOString()}));
 for(let i=0;i<2;i++){const tick=await fetch(origin+'/cdn-cgi/local/scheduled?cron=*+*+*+*+*&format=json');assert.ok(tick.ok,await tick.text())}
 let history=(await json(root)).rows;const abandoned=history.find(r=>r.id==='owner-abandoned');assert.equal(abandoned.steps.filter(s=>s.state==='timed_out').length,1);assert.equal(abandoned.notice.state,'suppressed_locally');assert.equal(history.find(r=>r.id==='deploy-only').steps.length,4);assert.equal(history.find(r=>r.id==='owner-rollback').steps.at(-1).rollback_release,'checkout@1.0.0');
 assert.deepEqual(history.find(r=>r.id==='owner-rollback').steps.map(s=>[s.state,s.exposure]),[['started',0],['succeeded',100],['rolled_back',0]],'production rollback preserves its complete state and exposure history');
 await json(root+'/owner-late/callbacks','POST',callback('succeeded',100,{at:new Date(Date.now()).toISOString()}));assert.ok((await json(root)).rows.find(r=>r.id==='owner-late').steps.some(s=>s.state==='timed_out'),'late outcome appends without deleting overdue history');
 await screens('all-states');
 // Use the owner form to record a run and its completion.
 const context=await browser.newContext({viewport:{width:390,height:900}});await context.addCookies(cookie.split('; ').map(v=>({name:v.slice(0,v.indexOf('=')),value:v.slice(v.indexOf('=')+1),url:origin})));const page=await context.newPage();await page.goto(origin+'/projects/'+project.id+'/releases');const panel=page.locator('#deployment-history');await panel.getByLabel('Deployment ID',{exact:true}).fill('owner-ui');await panel.getByLabel('Deployment release',{exact:true}).selectOption('checkout@2.0.0');await panel.getByLabel('Repository HTTPS URL',{exact:true}).fill('https://example.test/cedar/checkout');await panel.getByLabel('Deployment commit SHA',{exact:true}).fill(sha);await panel.getByLabel('Included commit SHAs, oldest first',{exact:true}).fill(sha);await panel.getByLabel('Owner deadline',{exact:true}).fill(await page.evaluate(()=>{const dt=new Date(Date.now()+3600000);return new Date(dt.getTime()-dt.getTimezoneOffset()*60000).toISOString().slice(0,16)}));await panel.getByLabel('Deadline email destination',{exact:true}).selectOption(dest.id);await panel.getByRole('button',{name:'Start deployment',exact:true}).click();await panel.getByRole('status').filter({hasText:'Deployment started.'}).waitFor();await panel.getByLabel('Deployment to update',{exact:true}).selectOption('owner-ui');await panel.getByLabel('Deployment outcome',{exact:true}).selectOption('succeeded');await panel.getByLabel('Exposure percent',{exact:true}).fill('100');await panel.getByRole('button',{name:'Record deployment outcome',exact:true}).click();await panel.getByRole('status').filter({hasText:'Deployment outcome recorded.'}).waitFor();await context.close();
 await suspectFlow({req,json,origin,browser});
 const other=await json('/api/projects','POST',{id:'deployment-foreign',name:'Isolated service'});
 await json('/api/projects/'+other.id+'/releases','POST',{name:'checkout@2.0.0',build:'web-2'});const otherDestination=await json('/api/projects/'+other.id+'/alerting/destinations','POST',{label:'Other release owner',recipient:'other-release-owner@example.test'});await json('/api/projects/'+other.id+'/deployments','POST',start('owner-abandoned',{deadline:new Date(now-1).toISOString(),destination:otherDestination.id}));assert.ok((await fetch(origin+'/cdn-cgi/local/scheduled?cron=*+*+*+*+*&format=json')).ok);const notices=(await json('/api/audit/export?format=json')).rows.filter(r=>r.action==='notification.attempt'&&r.outcome==='started');assert.equal(notices.length,3);assert.equal(new Set(notices.map(r=>r.subject_label)).size,3,'REL-001 equal deployment IDs in different projects are separate notification identities');
 for(const headers of [{Cookie:''},{Cookie:'',Authorization:'Bearer '+agent.key},{Origin:'https://foreign.example'}])assert.ok([401,403].includes((await req(root,'POST',start('denied'),headers)).status));
 assert.equal((await req('/api/projects/'+other.id+'/deployments','POST',start('foreign'),service)).status,403);
 await json(base+'/keys/'+deploy.hash,'DELETE');assert.equal((await req(root+'/deploy-only/callbacks','POST',callback('succeeded'),service)).status,401);
 // Auto-created release enrichment preserves first-seen; native history never invents ancestry.
 const dsn=new URL(project.dsn),envelope=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 await req(envelope,'POST','{}\n{"type":"event"}\n'+JSON.stringify({event_id:'c'.repeat(32),release:'auto@1.2.0',exception:{values:[{type:'CheckoutError',value:'Checkout unavailable'}]}}));
 const before=(await json(base+'/releases')).find(r=>r.name==='auto@1.2.0');assert.equal(before.auto_created,1);await json(base+'/releases','POST',{name:before.name,build:'web-auto'});await json(root,'POST',start('auto-enriched',{release:before.name,build:'web-auto'}));const after=(await json(base+'/releases')).find(r=>r.name===before.name);assert.equal(after.first_seen,before.first_seen);assert.equal(after.seq,before.seq);assert.equal(after.auto_created,0);
 assert.equal((await json(base+'/releases')).filter(r=>r.name===before.name).length,1,'native deployment enrichment keeps one release under the original name');
 const archive=await archiveProjection(await req('/api/archive'));assert.ok(archive.data.deployment_runs.every(r=>r.historical===1&&r.destination===''));assert.ok(!Object.hasOwn(archive.data,'deployment_actors'));
 const restored=await startTestWorker(15554);try{const copiedCookie=await signIn(restored.origin);const r=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Origin:restored.origin,Cookie:copiedCookie,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:archive.text});assert.ok(r.ok,await r.text());const read=()=>fetch(restored.origin+root,{headers:{Cookie:copiedCookie}}).then(r=>r.json());const copied=await read();assert.equal(copied.rows.length,(await json(root)).rows.length);const tick=await fetch(restored.origin+'/cdn-cgi/local/scheduled?cron=*+*+*+*+*&format=json');assert.ok(tick.ok);assert.deepEqual(await read(),copied,'REL-001 restore cannot replay timeout or notice');const refused=await fetch(restored.origin+root+'/owner-started/callbacks',{method:'POST',headers:{Cookie:copiedCookie,Origin:restored.origin,'Content-Type':'application/json'},body:JSON.stringify(callback('succeeded'))});assert.equal(refused.status,409)}finally{await restored.stop()}
 const plan=await json(base+'/erasure');for(const table of ['deployment_runs','deployment_steps','deployment_notices','deployment_actors'])assert.ok(plan.deleted[table]>0);await followErasure(json,await json(base+'/erasure','POST',{confirm:project.id,planHash:plan.planHash}));
 console.log('REL-001 passed: CI and owner start/progress/success/failure/rollback, idempotency/conflicts, one overdue notice over two ticks, environments, enrichment, denials, inert restore, erasure and 1440/390.');
} finally {await browser?.close();await app.stop()}
