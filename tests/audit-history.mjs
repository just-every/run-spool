import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';
import {launchBrowser} from './browser-launch.mjs';
import {archiveProjection} from './archive.mjs';
import {followErasure} from './project-erasure/follow.mjs';
const app=await startTestWorker(15555),origin=app.origin;let browser;
try {
 const cookie=await signIn(origin),req=(path,method='GET',value,headers={})=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,...value?{'Content-Type':'application/json'}:{},...headers},...value?{body:JSON.stringify(value)}:{}}),json=async(...args)=>{const r=await req(...args);assert.ok(r.ok,`${args[0]} HTTP ${r.status}`);return r.json()};
 const canary='private-audit-canary',project=await json('/api/projects','POST',{id:canary,name:'Private audit project canary'}),p='/api/projects/'+project.id;
 const destination=await json(p+'/alerting/destinations','POST',{label:'Audit owner mailbox',recipient:'audit-owner@example.test'});await json(p+'/alerting/destinations/'+destination.id+'/test','POST',{});
 const agent=await json(p+'/keys','POST',{kind:'agent'}),deploy=await json(p+'/keys','POST',{kind:'deploy'});
 for(const headers of [{Cookie:''},{Cookie:'',Authorization:'Bearer '+agent.key},{Origin:'https://foreign.example'}])assert.ok([401,403].includes((await req(p+'/releases','POST',{name:'denied',build:'b1'},headers)).status));
 await json(p+'/releases','POST',{name:'audit@1.0.0',build:'web'});await json(p+'/release-policy','PUT',{revision:0,policy:{version:1,order:'semver',pattern:'*'}});assert.equal((await req(p+'/release-policy','PUT',{revision:0,policy:{version:1,order:'semver',pattern:'*'}})).status,409);
 for(const [grant,status] of [[agent.key,401],[deploy.key,401]])assert.equal((await req('/api/audit','GET',undefined,{Cookie:'',Authorization:'Bearer '+grant})).status,status);
 assert.equal((await req('/api/audit?cursor=invalid')).status,400);
 let first=await json('/api/audit?limit=3');assert.ok(first.next);const fixed=first.highWater,rows=[...first.rows];let cursor=first.next;
 await json(p+'/releases','POST',{name:'later',build:'later'});
 while(cursor){const next=await json('/api/audit?limit=3&cursor='+encodeURIComponent(cursor));assert.equal(next.highWater,fixed);rows.push(...next.rows);cursor=next.next}
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);assert.ok(rows.every(r=>r.sequence<=fixed));
 const exported=await json('/api/audit/export?format=json&highWater='+fixed);assert.deepEqual(exported.rows,rows.toReversed());
 const csv=await (await req('/api/audit/export?format=csv&highWater='+fixed)).text();assert.equal(csv.trim().split('\n').length,rows.length+1);
 for(const needle of [canary,project.ingestKey,agent.key,agent.hash,deploy.key,deploy.hash,'Private audit project canary']){assert.ok(!JSON.stringify(exported).includes(needle));assert.ok(!csv.includes(needle))}
 assert.ok(exported.rows.some(r=>r.outcome==='denied'));assert.ok(exported.rows.some(r=>r.outcome==='conflict'));assert.ok(exported.rows.some(r=>r.actor_kind==='owner'));assert.ok(exported.rows.some(r=>r.actor_kind==='agent'));assert.ok(exported.rows.some(r=>r.actor_kind==='service'&&r.action==='notification.attempt'&&r.outcome==='suppressed'));
 const permanent=await json('/api/audit/export?format=json');await app.restart();assert.deepEqual((await json('/api/audit/export?format=json&highWater='+permanent.highWater)).rows,permanent.rows,'AUDIT-001 restart preserves safe facts');
 const archive=await archiveProjection(await req('/api/archive'));assert.ok(!Object.hasOwn(archive.data,'audit_actor_links'));assert.ok(!Object.hasOwn(archive.data,'spool_audit_events'),'AUDIT-001 partial: private archive append restore remains unimplemented; safe history is explicitly exported separately');
 browser=await launchBrowser();await mkdir('.artifacts/AUDIT-001',{recursive:true});
 for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:900}});await context.addCookies(cookie.split('; ').map(v=>({name:v.slice(0,v.indexOf('=')),value:v.slice(v.indexOf('=')+1),url:origin})));const page=await context.newPage();await page.goto(origin+'/projects/'+project.id+'/settings');const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'Organization audit',exact:true})});await panel.getByRole('list',{name:'Audit entries'}).waitFor();await panel.evaluate(element=>element.scrollIntoView({block:'start'}));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`.artifacts/AUDIT-001/history-${width}.png`});const download=page.waitForEvent('download');await panel.getByRole('link',{name:'Export CSV',exact:true}).click();assert.ok((await download).suggestedFilename().endsWith('.csv'));await panel.getByRole('button',{name:'Export JSON',exact:true}).click();await panel.getByRole('status').filter({hasText:'JSON audit export prepared.'}).waitFor();await page.screenshot({path:`.artifacts/AUDIT-001/export-${width}.png`});await page.route('**/api/audit',route=>route.abort());await panel.getByRole('button',{name:'Refresh history',exact:true}).click();await panel.getByRole('alert').waitFor();await page.screenshot({path:`.artifacts/AUDIT-001/error-${width}.png`});await page.unroute('**/api/audit');await panel.getByRole('button',{name:'Refresh history',exact:true}).click();await panel.getByRole('status').filter({hasText:'Showing the latest organization history.'}).waitFor();await context.close()}
 const beforeErasure=await json('/api/audit/export?format=json'),plan=await json(p+'/erasure');await followErasure(json,await json(p+'/erasure','POST',{confirm:project.id,planHash:plan.planHash}));const after=await json('/api/audit/export?format=json&highWater='+beforeErasure.highWater);assert.deepEqual(after.rows,beforeErasure.rows,'AUDIT-001 project erasure removes private attribution links and leaves safe chronology immutable');
 console.log('AUDIT-001 partial passed: safe owner/service aliases, denied/stale HTTP outcomes, fixed snapshot cursor/JSON/CSV, restart, project erasure and 1440/390 history/export/error. Remaining: atomic facts for every writer, complete asynchronous service coverage, append-preserving private archive restore.');
} finally {await browser?.close();await app.stop()}
