import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';
import {launchBrowser} from './browser-launch.mjs';
import {archiveProjection,nativeArchive} from './archive.mjs';
import {followErasure} from './project-erasure/follow.mjs';

export async function auditJourney() {
// Independent transport connections also make the explicit runtime restart unambiguous.
const client=(origin,cookie)=>{
 const req=(path,method='GET',value,headers={})=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,Connection:'close',...value!==undefined?{'Content-Type':'application/json'}:{},...headers},...value!==undefined?{body:typeof value==='string'?value:JSON.stringify(value)}:{}});
 return {req,json:async(...args)=>{const r=await req(...args);assert.ok(r.ok,`${args[0]} HTTP ${r.status}`);return r.json()}};
};
const strip=({sequence,...row})=>row;
const app=await startTestWorker(15555),origin=app.origin;let browser,target;
try {
 const cookie=await signIn(origin),{req,json}=client(origin,cookie);
 const facts=async()=>(await json('/api/audit/export?format=json')).rows;
 // The window excludes the history reads themselves (audit.read/audit.export).
 const since=async work=>{const mark=(await facts()).length;await work();return (await facts()).slice(mark).filter(row=>!row.action.startsWith('audit.'));};
 const committed=(rows,action)=>rows.filter(row=>row.source==='transaction'&&row.action===action);

 // Each committed owner change records exactly one transaction fact, naming the new project's alias.
 const canary='private-audit-canary';let project;
 let rows=await since(async()=>{project=await json('/api/projects','POST',{id:canary,name:'Private audit project canary'})});
 const p='/api/projects/'+project.id,[created]=committed(rows,'project.create');
 assert.equal(committed(rows,'project.create').length,1);assert.equal(created.actor_kind,'owner');assert.equal(created.subject_kind,'project');assert.ok(created.project_label);
 const projectLabel=created.project_label,owner=created.actor_label;
 rows=await since(async()=>{const destination=await json(p+'/alerting/destinations','POST',{label:'Audit owner mailbox',recipient:'audit-owner@example.test'});await json(p+'/alerting/destinations/'+destination.id+'/test','POST',{});project.destination=destination.id});
 assert.equal(committed(rows,'alert.destination.create').length,1);assert.equal(committed(rows,'alert.destination.test').length,1);
 assert.deepEqual(rows.filter(r=>r.action==='notification.attempt').map(r=>[r.source,r.actor_kind,r.outcome]),[['service','service','started'],['service','service','suppressed']]);
 const agent=await json(p+'/keys','POST',{kind:'agent'}),deploy=await json(p+'/keys','POST',{kind:'deploy'});

 // Denied and stale attempts are observed with truthful outcomes and never claim a committed change.
 rows=await since(async()=>{for(const headers of [{Cookie:''},{Cookie:'',Authorization:'Bearer '+agent.key},{Origin:'https://foreign.example'}])assert.ok([401,403].includes((await req(p+'/releases','POST',{name:'denied',build:'b1'},headers)).status))});
 assert.deepEqual(rows.map(r=>[r.source,r.outcome]),[['request','denied'],['request','denied'],['request','denied']]);
 assert.deepEqual([...new Set(rows.map(r=>r.actor_kind))].sort(),['agent','anonymous','owner']);
 // Unauthenticated refusals bind no alias for the identifiers they name, and repeating them adds no permanent rows.
 const stored=async()=>{const db=await app.db();return Object.fromEntries(await Promise.all(['spool_audit_events','audit_actor_links'].map(async table=>[table,(await db.prepare(`SELECT COUNT(*) n FROM ${table}`).first()).n])))};
 const refuse=async count=>{for(let i=0;i<count;i++)assert.equal((await req('/api/sandbox/runs/'+crypto.randomUUID(),'GET',undefined,{Cookie:''})).status,401)};
 const unrefused=await stored();await refuse(10);const sampled=await stored();await refuse(120);
 assert.equal(sampled.audit_actor_links,unrefused.audit_actor_links,'refused unauthenticated requests bind no alias');
 assert.deepEqual(await stored(),sampled,'repeated unauthenticated refusals add no permanent rows');
 rows=await since(async()=>{assert.ok((await req(p+'/releases','POST',{name:'audit@1.0.0',build:'web'},{Cookie:'',Authorization:'Bearer '+deploy.key})).ok);await json(p+'/releases','POST',{name:'audit@1.0.1',build:'web'})});
 assert.deepEqual(committed(rows,'release.register').map(r=>[r.actor_kind,r.project_label]),[['deploy',projectLabel],['owner',projectLabel]]);
 rows=await since(async()=>{await json(p+'/release-policy','PUT',{revision:0,policy:{version:1,order:'semver',pattern:'*'}});assert.equal((await req(p+'/release-policy','PUT',{revision:0,policy:{version:1,order:'semver',pattern:'*'}})).status,409)});
 assert.equal(committed(rows,'release.policy').length,1,'AUDIT-001 a stale write commits no fact');assert.ok(rows.some(r=>r.source==='request'&&r.action==='release.policy'&&r.outcome==='conflict'));

 // Ingest, deploy and agent doors: attributed to their grants; the deployment run commits with its fact.
 rows=await since(async()=>{project.issue=(await json('/api/ingest/'+project.id,'POST',{version:1,eventId:'audit-event',release:'audit@1.0.0',build:'web',environment:'production',type:'TypeError',message:'Audit capture',frames:[{file:'https://audit.example/app.js',function:'run',line:1,column:1}],breadcrumbs:[]},{Cookie:'',Authorization:'Bearer '+project.ingestKey})).issue});
 assert.ok(committed(rows,'capture.native').length>=1&&committed(rows,'capture.native').every(r=>r.actor_kind==='ingest'&&r.project_label===projectLabel));
 const now=Date.now(),sha='a'.repeat(40),prior='b'.repeat(40);
 rows=await since(async()=>{assert.equal((await req(p+'/deployments','POST',{id:'audit-run',release:'audit@1.0.0',build:'web',environment:'production',repository:'https://example.test/audit',commitSha:sha,previousCommit:prior,includedCommits:[prior,sha],startedAt:new Date(now-60000).toISOString(),deadline:new Date(now+3600000).toISOString(),destination:project.destination},{Cookie:'',Authorization:'Bearer '+deploy.key})).status,201)});
 assert.deepEqual(committed(rows,'deployment.start').map(r=>r.actor_kind),['deploy']);
 rows=await since(async()=>{assert.equal((await req(p+'/issues/'+project.issue+'/packet','GET',undefined,{Cookie:'',Authorization:'Bearer '+agent.key})).status,200)});
 assert.deepEqual(rows.map(r=>[r.source,r.actor_kind,r.action,r.outcome]),[['request','agent','evidence.packet','succeeded']]);
 const issue=(await json(p+'/issues')).find(row=>row.id===project.issue);
 rows=await since(async()=>{await json(p+'/issues/'+issue.id,'PATCH',{state:'acknowledged',revision:issue.revision});assert.equal((await req(p+'/issues/'+issue.id,'PATCH',{state:'resolved',revision:issue.revision})).status,409)});
 assert.equal(committed(rows,'issue.triage').length,1);
 rows=await since(async()=>{assert.equal((await json(p+'/retention','POST',{cutoff:Date.now(),apply:true})).events,1)});
 assert.equal(committed(rows,'retention.preview_or_apply').length,1);

 // Organization history: fixed snapshot cursor, JSON/CSV export, owner-only.
 for(const grant of [agent.key,deploy.key])assert.equal((await req('/api/audit','GET',undefined,{Cookie:'',Authorization:'Bearer '+grant})).status,401);
 assert.equal((await req('/api/audit?cursor=invalid')).status,400);
 let first=await json('/api/audit?limit=3');assert.ok(first.next);const fixed=first.highWater,history=[...first.rows];let cursor=first.next;
 await json(p+'/releases','POST',{name:'later',build:'later'});
 while(cursor){const next=await json('/api/audit?limit=3&cursor='+encodeURIComponent(cursor));assert.equal(next.highWater,fixed);history.push(...next.rows);cursor=next.next}
 assert.equal(new Set(history.map(r=>r.id)).size,history.length);assert.ok(history.every(r=>r.sequence<=fixed));
 const exported=await json('/api/audit/export?format=json&highWater='+fixed);assert.deepEqual(exported.rows,history.toReversed());
 const csv=await (await req('/api/audit/export?format=csv&highWater='+fixed)).text();assert.equal(csv.trim().split('\n').length,history.length+1);
 for(const needle of [canary,project.ingestKey,agent.key,agent.hash,deploy.key,deploy.hash,'Private audit project canary','audit-owner@example.test','audit@1.0.0']){assert.ok(!JSON.stringify(exported).includes(needle),needle);assert.ok(!csv.includes(needle),needle)}
 assert.ok(exported.rows.filter(r=>r.actor_kind==='owner').every(r=>r.actor_label===owner),'one permanent owner alias');
 const permanent=await json('/api/audit/export?format=json');await app.restart();assert.deepEqual((await json('/api/audit/export?format=json&highWater='+permanent.highWater)).rows,permanent.rows,'AUDIT-001 restart preserves safe facts');

 // The private archive carries safe history as a payload and never the private links; the journal row stays as written.
 rows=await since(async()=>{project.archive=await archiveProjection(await req('/api/archive'))});
 const archive=project.archive,source=await facts(),exportStarted=source.find(r=>r.action==='archive.export'&&r.outcome==='started').sequence;
 // The payload is produced before the export records that it started.
 const carried=source.filter(r=>r.sequence<exportStarted);
 assert.ok(!Object.hasOwn(archive.data,'audit_actor_links')&&!Object.hasOwn(archive.data,'spool_audit_events')&&!Object.hasOwn(archive.data,'audit_context'));
 assert.deepEqual(archive.manifest.payloads.map(x=>x.name),['safe_audit']);
 assert.deepEqual(archive.data.audit.filter(r=>r.kind==='retention_gap').map(r=>JSON.parse(r.detail).removed),[1],'AUDIT-001 retention journal written once');
 assert.deepEqual(rows.filter(r=>r.action==='archive.export').map(r=>[r.source,r.outcome]),[['request','started'],['request','succeeded'],['request','succeeded']]);

 // Restore appends the archived chronology after the destination's own, then records the restore.
 target=await startTestWorker(15556);
 const restoreCookie=await signIn(target.origin),restored=client(target.origin,restoreCookie);
 const own=(await restored.json('/api/audit/export?format=json')).rows;assert.ok(own.length);
 assert.equal((await restored.req('/api/restore','POST',archive.text,{'Content-Type':'application/x-ndjson','x-confirm-restore':'yes'})).status,200);
 const appended=(await restored.json('/api/audit/export?format=json')).rows;
 assert.deepEqual(appended.slice(0,own.length),own,'AUDIT-001 restore keeps the destination chronology');
 const at=appended.findIndex(r=>r.id===carried[0].id);assert.ok(at>=own.length);
 assert.deepEqual(appended.slice(at,at+carried.length).map(strip),carried.map(strip),'AUDIT-001 restore appends archived facts unchanged, never re-attributed');
 const restoreFact=appended[at+carried.length],observed=appended.at(-1);
 assert.deepEqual([restoreFact.source,restoreFact.actor_kind,restoreFact.action],['transaction','owner','archive.restore']);
 assert.deepEqual([observed.source,observed.action,observed.outcome,observed.actor_label],['request','archive.restore','succeeded',restoreFact.actor_label]);
 assert.ok(own.some(r=>r.actor_kind==='owner'&&r.actor_label===restoreFact.actor_label),'AUDIT-001 sign-in is attributed to the owner it admitted');
 await target.stop();
 // A previous (native v2) archive format has no safe history: each restored journal row gets one value-free legacy fact at its own time.
 target=await startTestWorker(15557);
 const previous=client(target.origin,await signIn(target.origin));
 assert.equal((await previous.req('/api/restore','POST',nativeArchive(archive.data),{'x-confirm-restore':'yes'})).status,200);
 const legacy=(await previous.json('/api/audit/export?format=json')).rows.filter(r=>r.source==='legacy'),journal=nativeArchive(archive.data).data.audit.toSorted((a,b)=>a.created-b.created||(a.id<b.id?-1:1));
 assert.ok(journal.length);assert.deepEqual(legacy.map(r=>r.created),journal.map(r=>r.created),'AUDIT-001 legacy chronology is kept, never rewritten');
 assert.ok(legacy.every(r=>r.actor_kind==='unknown'&&r.outcome==='succeeded'&&!JSON.stringify(r).includes(canary)));
 await target.stop();target=undefined;

 browser=await launchBrowser();await mkdir('.artifacts/AUDIT-001',{recursive:true});
 for(const width of [1440]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.addCookies(cookie.split('; ').map(v=>({name:v.slice(0,v.indexOf('=')),value:v.slice(v.indexOf('=')+1),url:origin})));
  const page=await context.newPage();await page.goto(origin+'/projects/'+project.id+'/settings');
  const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'Organization audit',exact:true})});
  const shot=async name=>{await panel.evaluate(element=>element.scrollIntoView({block:'start'}));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`.artifacts/AUDIT-001/${name}-${width}.png`})};
  const refresh=()=>panel.getByRole('button',{name:'Refresh history',exact:true}).click();
  await panel.getByRole('list',{name:'Audit entries'}).waitFor();await shot('history');
  const download=page.waitForEvent('download');await panel.getByRole('link',{name:'Export CSV',exact:true}).click();assert.ok((await download).suggestedFilename().endsWith('.csv'));
  await panel.getByRole('button',{name:'Export JSON',exact:true}).click();await panel.getByRole('status').filter({hasText:'JSON audit export prepared.'}).waitFor();await shot('export');
  await page.route('**/api/audit',route=>route.abort());await refresh();await panel.getByRole('alert').waitFor();await shot('error');await page.unroute('**/api/audit');
  // A refused history read is a lost session: the workspace leaves the signed-in view instead of showing stale history.
  await page.route('**/api/audit',route=>route.fulfill({status:401,json:{error:'Owner session required'}}));await refresh();await panel.waitFor({state:'detached'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`.artifacts/AUDIT-001/denied-${width}.png`});await page.unroute('**/api/audit');
  await page.reload();await panel.getByRole('list',{name:'Audit entries'}).waitFor();
  await page.route('**/api/audit',route=>route.fulfill({json:{version:1,scope:'organization',rows:[],highWater:0,next:null,coverage:first.coverage}}));await refresh();await panel.getByText('No audit entries have been recorded.',{exact:true}).waitFor();await shot('empty');await page.unroute('**/api/audit');
  await refresh();await panel.getByRole('status').filter({hasText:'Showing the latest organization history.'}).waitFor();await context.close();
 }

 // Project erasure removes private attribution links; the chronology before it is unchanged and the completion is recorded.
 const beforeErasure=await json('/api/audit/export?format=json'),plan=await json(p+'/erasure');await followErasure(json,await json(p+'/erasure','POST',{confirm:project.id,planHash:plan.planHash}));
 const after=await json('/api/audit/export?format=json');
 assert.deepEqual(after.rows.slice(0,beforeErasure.rows.length),beforeErasure.rows,'AUDIT-001 project erasure leaves safe chronology immutable');
 assert.ok(after.rows.some(r=>r.source==='service'&&r.action==='erasure.complete'&&r.outcome==='succeeded'));
 assert.ok(!JSON.stringify(after).includes(canary));
 rows=await since(async()=>{await json('/api/projects','POST',{id:'audit-successor',name:'Successor'})});
 assert.notEqual(committed(rows,'project.create')[0].project_label,projectLabel,'AUDIT-001 a later project never inherits an erased alias');
 console.log('AUDIT-001 passed: atomic owner/deploy/ingest transaction facts, denied/stale request outcomes, agent and notification facts, fixed snapshot cursor/JSON/CSV, restart, archive payload append restore, previous-format legacy facts, project erasure and 1440 history/export/error/denied/empty.');
} finally {await browser?.close();await target?.stop();await app.stop()}

}
