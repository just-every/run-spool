import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {followErasure} from './project-erasure/follow.mjs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';

async function reportWorkbench(origin,project,from,to){
 const browser=await chromium.launch({headless:true});
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),cookie=await signIn(origin,{bootstrap:false});
  await context.addCookies(cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:origin})));
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/projects/'+project+'/settings');const configuration=page.getByRole('region',{name:'Reports, dashboards and query tables',exact:true});
  await configuration.getByLabel('View name',{exact:true}).fill('Retained impact comparison');
  const widgets=configuration.locator('.reports-widget'),date=value=>new Date(value).toISOString().slice(0,16);
  for(let n=0;n<2;n++){await widgets.nth(n).getByLabel('Window start (UTC)',{exact:true}).fill(date(from));await widgets.nth(n).getByLabel('Window end (UTC)',{exact:true}).fill(date(to))}
  const created=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/reporting/items'&&response.request().method()==='POST'&&response.status()===201);await configuration.getByRole('button',{name:'Save dashboard',exact:true}).click();const item=await(await created).json();
  await configuration.locator('summary').filter({hasText:'Share this view'}).click();await configuration.getByRole('combobox',{name:'Share audience',exact:true}).selectOption('role');await configuration.getByRole('combobox',{name:'Role',exact:true}).selectOption('read-only');await configuration.getByRole('button',{name:'Add audience',exact:true}).click();
  const sharing=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/'+item.id+'/shares')&&response.status()===200);await configuration.getByRole('button',{name:'Save sharing',exact:true}).click();await sharing;
  await configuration.getByRole('link',{name:'Open this saved view',exact:true}).click();const dashboard=page.getByRole('region',{name:'Saved reports and dashboards',exact:true});await dashboard.locator('article.reports-widget').nth(1).waitFor();assert.equal(await dashboard.locator('article.reports-widget').count(),2);assert.equal(await dashboard.locator('article.reports-widget').first().locator('dd').innerText(),'4');
  const table=page.getByRole('region',{name:'Query table',exact:true});await table.getByLabel('Window start (UTC)',{exact:true}).fill(date(from));await table.getByLabel('Window end (UTC)',{exact:true}).fill(date(to));
  const run=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/reporting/table-preview'&&response.request().method()==='POST'&&response.status()===200);await table.getByRole('button',{name:'Run query',exact:true}).click();assert.equal((await(await run).json()).total,4);await table.locator('tbody tr').nth(3).waitFor();assert.equal(await table.locator('tbody tr').count(),4);
  const saved=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/review/views')&&response.request().method()==='POST'&&response.status()===201);await table.getByRole('button',{name:/^Save query/}).click();await saved;
  const download=page.waitForEvent('download');await dashboard.getByRole('link',{name:'Export view JSON',exact:true}).click();assert.equal(await(await download).failure(),null);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual((await new AxeBuilder({page}).include('main').analyze()).violations.filter(row=>['serious','critical'].includes(row.impact)),[]);assert.deepEqual(errors,[]);
  await context.close();
 }finally{await browser.close()}
}

// Fixture timestamps are relocated only after real public writes have produced
// events and their actual history. No app clock, transport or database is mocked.
export async function reportsFlow(context){
 let worker;
 try{
  if(!context){
   worker=await startTestWorker(15558);const cookie=await signIn(worker.origin);
   const req=(path,method='GET',body,headers={})=>fetch(worker.origin+path,{method,headers:{Origin:worker.origin,Cookie:cookie,...body?{'Content-Type':'application/json'}:{},...headers},...body?{body:typeof body==='string'?body:JSON.stringify(body)}:{}});
   const json=async(...args)=>{const response=await req(...args);assert.ok(response.ok,`Reports fixture HTTP ${response.status}`);return response.json()};
   context={req,json,origin:worker.origin,db:await worker.db()};
  }
  const {req,json}=context,db=typeof context.db==='function'?await context.db():context.db;
  assert.ok(db,'Reports journey needs its actual Worker D1 for timestamp fixtures');
  const p=await json('/api/projects','POST',{id:'synthetic-find002',name:'Synthetic reports'}),other=await json('/api/projects','POST',{id:'synthetic-find002-other',name:'Synthetic other reports'}),root='/api/projects/'+p.id;
  const me=await json('/api/organization/me');if(!me.organization)await json('/api/organization','POST',{id:'synthetic-find002-org',name:'Synthetic report organization'});
  await json('/api/organization/projects/'+p.id,'PUT',{team:'Synthetic reporting team'});
  await json('/api/organization/projects/'+other.id,'PUT',{team:'Synthetic other team'});
  const policy={id:'hash',email:'drop',username:'drop',ip_address:'drop'};
  for(const project of [p,other]){const base='/api/projects/'+project.id,current=await json(base+'/identity-policy'),preview=await json(base+'/identity-policy/preview','POST',{policy});await json(base+'/identity-policy','PUT',{revision:current.revision,policy,token:preview.token})}
  let serial=0;const sent=[];
  const send=async(project,type,value)=>{const d=new URL(project.dsn),response=await req(`/api${d.pathname}/envelope/?sentry_key=${d.username}&sentry_version=7`,'POST','{}\n'+JSON.stringify({type})+'\n'+JSON.stringify(value),{Cookie:''});assert.equal(response.status,200,'Synthetic Sentry envelope admitted');await response.body?.cancel()};
  const capture=async(project,type,release,user='synthetic-report-user')=>{const event_id=(++serial).toString(16).padStart(32,'0');await send(project,'event',{event_id,...release?{release}:{},platform:'python',environment:'test',...user?{user:{id:user}}:{},exception:{values:[{type,value:'Synthetic report evidence',stacktrace:{frames:[{filename:'/app/report.py',function:type,lineno:8,in_app:true}]}}]}});sent.push({project:project.id,event_id,type});return event_id};
  const issue=async(project,type)=>(await json('/api/projects/'+project.id+'/issues')).find(row=>row.title.startsWith(type+':'));
  const triage=async(type,state)=>{const current=await issue(p,type);await json(root+'/issues/'+current.id,'PATCH',{revision:current.revision,state,resolution:'plain'})};
  await capture(p,'ReportRecur','r1');await triage('ReportRecur','acknowledged');await triage('ReportRecur','resolved');
  await capture(p,'ReportRecur','r2');await triage('ReportRecur','acknowledged');await triage('ReportRecur','resolved');
  await capture(p,'ReportNoRelease',undefined,null);await capture(p,'ReportLegacy','r1');await capture(other,'ReportOther','r1');
  const a=await issue(p,'ReportRecur'),b=await issue(p,'ReportNoRelease'),legacy=await issue(p,'ReportLegacy'),foreign=await issue(other,'ReportOther');
  await json(root+'/issues/'+a.id+'/assignment','PATCH',{revision:a.revision,label:'Synthetic issue owner'});
  const selection={action:'reviewed',issues:[{id:b.id,revision:b.revision}],apply:false},review=await json(root+'/bulk-triage','POST',selection);await json(root+'/bulk-triage','POST',{...selection,apply:true,preview:review.preview});
  const session=(status)=>({sid:crypto.randomUUID().replaceAll('-',''),started:new Date().toISOString(),timestamp:new Date().toISOString(),status,errors:Number(status==='crashed'),did:'synthetic-report-user',attrs:{release:'r2',environment:'test'}});
  await send(p,'session',session('exited'));await send(p,'session',session('crashed'));await send(p,'session',{...session('exited'),attrs:{}});
  await send(p,'client_report',{timestamp:Date.now()/1000,discarded_events:[{reason:'sample_rate',category:'error',quantity:7}]});
  const from=Date.parse('2026-03-07T05:00:00Z'),to=Date.parse('2026-03-10T04:00:00Z'),hour=3600000,first=from+hour,regression=from+25*hour;
  const q=(sql,...args)=>db.prepare(sql).bind(...args),jobs=[];
  for(const [project,id,at] of [[p.id,a.id,first],[p.id,b.id,from+2*hour],[p.id,legacy.id,from+3*hour],[other.id,foreign.id,from+4*hour]])jobs.push(
   q('UPDATE issues SET first_seen=?,last_seen=? WHERE project=? AND id=?',at,at,project,id),
   q("UPDATE audit SET created=? WHERE project=? AND kind='capture_history_started' AND json_extract(detail,'$.issue')=?",at,project,id),
   q("UPDATE alerts SET created=? WHERE project=? AND issue=? AND kind='new_issue'",at,project,id));
  jobs.push(q("DELETE FROM audit WHERE project=? AND kind='capture_history_started' AND json_extract(detail,'$.issue')=?",p.id,legacy.id));
  const eventTimes=[first,regression,from+2*hour,from+3*hour,from+4*hour];
  sent.forEach((e,n)=>jobs.push(q('UPDATE events SET received=? WHERE project=? AND id=?',eventTimes[n],e.project,e.event_id)));
  jobs.push(q("UPDATE alerts SET created=? WHERE project=? AND issue=? AND kind='regression'",regression,p.id,a.id),q('UPDATE issues SET last_seen=? WHERE id=?',regression,a.id));
  const changes=(await q("SELECT id FROM audit WHERE project=? AND kind='triage' AND json_extract(detail,'$.issue')=? ORDER BY created,rowid",p.id,a.id).all()).results;
  assert.equal(changes.length,4);[first+hour,first+5*hour,regression+2*hour,regression+6*hour].forEach((at,n)=>jobs.push(q('UPDATE audit SET created=? WHERE id=?',at,changes[n].id)));
  jobs.push(q('UPDATE review_stamps SET reviewed=? WHERE project=?',from+3*hour,p.id),q('UPDATE health_sessions SET started=? WHERE project=?',regression,p.id),q('UPDATE outcomes SET window=? WHERE project IN (?,?)',from,p.id,other.id));
  await db.batch(jobs);
  const url=(zone='America/New_York',projects=p.id)=>'/api/reports?'+new URLSearchParams({projects,from:String(from),to:String(to),timeZone:zone});
  let report=await json(url()),utc=await json(url('UTC'));
  assert.equal(report.volume.events,4);assert.equal(report.volume.issues,3);assert.equal(report.volume.affectedUsers,1);assert.equal(report.volume.unattributedEvents,1);assert.equal(report.volume.noReleaseEvents,1);assert.equal(report.volume.sessions,2);
  assert.deepEqual(report.volume,utc.volume,'Changing time zone preserves the instant window and all totals');
  assert.deepEqual(report.buckets.map(row=>(row.to-row.from)/hour),[24,23,24],'Daily boundaries observe spring daylight saving');assert.equal(report.buckets.reduce((n,r)=>n+r.events,0),4);assert.equal(utc.buckets.reduce((n,r)=>n+r.events,0),4);
  assert.equal(report.backlog.newIssues,2);assert.equal(report.backlog.regressions,1);assert.equal(report.backlog.resolutions,2);assert.equal(report.backlog.end.resolved,1);assert.equal(report.backlog.end.open,1);assert.equal(report.backlog.end.excluded,1);assert.equal(report.backlog.excludedIssues[0].issue,legacy.id);
  assert.equal(report.durations.acknowledge.count,2);assert.equal(report.durations.acknowledge.medianMs,1.5*hour);assert.equal(report.durations.acknowledge.p90Ms,2*hour);assert.equal(report.durations.repair.medianMs,5.5*hour);assert.equal(report.durations.repair.p90Ms,6*hour);assert.ok(report.durations.acknowledge.excludedIssues.some(row=>row.issue===b.id));assert.equal(report.review.reviewed,1);
  assert.equal(report.ownership.owned,1);assert.equal(report.ownership.unowned,2);assert.equal(report.ownership.teams[0].issues,3);
  assert.equal(report.releaseStability.errorRows.reduce((n,r)=>n+r.events,0),3);assert.ok(report.releaseStability.errorRows.every(r=>r.release));assert.equal(report.releaseStability.noReleaseEvents,1);
  assert.equal(report.releaseStability.rows[0].sessions,2);assert.equal(report.releaseStability.rows[0].crashFreeSessionRate,.5);assert.equal(report.releaseStability.rows[0].crashFreeUserRate,0);assert.equal(report.releaseStability.projects[0].denominators.releaseLess,1);assert.equal(report.metadata.dropped.clientDiscardedErrors,7);
  const both=await json(url('UTC',p.id+','+other.id));assert.equal(both.volume.events,5);assert.equal(both.volume.affectedUsers,2,'Project hashes never merge people across projects');assert.equal((await json(url('UTC',p.id+','+other.id)+'&team='+encodeURIComponent('Synthetic reporting team'))).volume.events,4);
  const wire=JSON.stringify(report);assert.ok(!wire.includes('synthetic-report-user'));assert.ok(!wire.includes('user_key'));
  const exported=await req(url()+'&format=json&download=1');assert.ok(exported.headers.get('content-disposition'));assert.deepEqual((await exported.json()).volume,report.volume);const csv=await req(url()+'&format=csv');assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);assert.ok((await csv.text()).includes('"volume.events","4"'));
  for(const [field,value] of [['timeZone','not-a-zone'],['from','-1'],['to',String(from)]]){const query=new URL(url(),'https://synthetic.test');query.searchParams.set(field,value);const response=await req(query.pathname+query.search);assert.equal(response.status,400);await response.body?.cancel()}
  assert.equal((await req(url(),'GET',undefined,{Cookie:''})).status,401);const agent=await json(root+'/keys','POST',{kind:'agent'});assert.equal((await req(url(),'GET',undefined,{Cookie:'',Authorization:'Bearer '+agent.key})).status,403);
  await reportWorkbench(context.origin,p.id,from,to);
  const allDrop={id:'drop',email:'drop',username:'drop',ip_address:'drop'},current=await json(root+'/identity-policy'),preview=await json(root+'/identity-policy/preview','POST',{policy:allDrop});await json(root+'/identity-policy','PUT',{revision:current.revision,policy:allDrop,token:preview.token});report=await json(url());assert.equal(report.volume.events,4);assert.equal(report.volume.affectedUsers,null);assert.equal(report.volume.unattributedEvents,4);assert.match(report.users.projects[0].reason,/policy: drop/);
  // Timestamp fixtures are synthetic historical probes; retire their projects
  // through the public custody door before another journey archives this Worker.
  for(const project of [p,other]){const base='/api/projects/'+project.id,plan=await json(base+'/erasure');await followErasure(json,await json(base+'/erasure','POST',{confirm:project.id,planHash:plan.planHash}))}
  console.log('[FIND-002] exact retained totals, DST calendar buckets, history exclusions, acknowledgement/resolution quantiles, ownership, SDK-008 identity/drop, SDK-005 health, no-release, discards and JSON/CSV public report doors passed');
 }finally{await worker?.stop()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await reportsFlow();
