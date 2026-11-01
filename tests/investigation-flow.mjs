import { reportsFlow } from './reports-flow.mjs';
import { prioritySearchFlow } from './priority-search-flow.mjs';
// [API-001] Retained records through versioned, exact-project read doors.
import { recordReadFlow } from './records-flow.mjs';
import { repositorySourceFlow } from './repository-source-flow.mjs';
import { bulkTriageFlow } from './bulk-triage-flow.mjs';
import assert from 'node:assert/strict';
import {launchBrowser} from './browser-launch.mjs';
import {signIn} from './auth.mjs';
export async function investigationFlow({req,json,origin,db}){
 await prioritySearchFlow({req,json,origin});
 const p=await json('/api/projects','POST',{id:'investigation',name:'Cedar checkout'}),base='/api/projects/investigation';
 await json(base+'/releases','POST',{name:'checkout-2026',build:'web'});
 for(let i=0;i<108;i++){
  const response=await req('/api/ingest/investigation','POST',{version:1,eventId:`checkout-${i}`,release:'checkout-2026',build:'web',environment:i%2?'production':'staging',type:'TypeError',message:i===0?'Historic checkout failure':'Checkout failure '+i,frames:[{file:'https://checkout.example/app.js',function:'checkout'+i,line:i+1,column:0}],breadcrumbs:[]},{Authorization:`Bearer ${p.ingestKey}`});
  assert.equal(response.status,201);
 }
 const first=await json(base+'/issue-search');assert.equal(first.total,108);assert.equal(first.rows.length,25);assert.ok(first.next);
 const seen=new Set(first.rows.map(r=>r.id));let cursor=first.next;
 while(cursor){const page=await json(base+'/issue-search?cursor='+encodeURIComponent(cursor));for(const r of page.rows){assert.ok(!seen.has(r.id),'cursor must not repeat an issue');seen.add(r.id)}cursor=page.next}assert.equal(seen.size,108);
 const query='q='+encodeURIComponent('Historic environment:staging function:checkout0');
 const found=await json(base+'/issue-search?'+query);assert.equal(found.total,1);assert.equal(found.rows[0].title,'TypeError: Historic checkout failure');assert.deepEqual(found.facets.environments,[{value:'staging',count:1}]);
 const all=await json(base+'/issue-search?q=environment:production');assert.equal(all.total,54);
 assert.equal((await req(base+'/issue-search?'+query+'&cursor='+encodeURIComponent(first.next))).status,400);
 const exported=await json(base+'/issue-export?'+query);assert.equal(exported.total,1);assert.equal(exported.bounds.complete,true);assert.equal(exported.rows[0].id,found.rows[0].id);
 const csv=await req(base+'/issue-export?'+query+'&format=csv');assert.equal(csv.status,200);assert.ok((await csv.text()).includes('Historic checkout failure'));
 assert.equal((await req(base+'/issue-search?q=user.email:someone')).status,400,'unavailable fields must be named, never silently ignored');
 assert.equal((await req(base+'/issue-search','GET',undefined,{Cookie:''})).status,401);
 const grant=await json(base+'/keys','POST',{kind:'agent'}),auth={Cookie:'',Authorization:`Bearer ${grant.key}`};
 assert.equal((await req(base+'/issue-search?'+query,'GET',undefined,auth)).status,200);
 assert.ok([401,403].includes((await req('/api/projects/wire/issue-export','GET',undefined,auth)).status));
 await dashboardFlow({req,json});
 await recordReadFlow({req,json});
 await reportsFlow({req,json,origin,db});
 await bulkTriageFlow({req,json,base,origin});
 await repositorySourceFlow({req,json});
 const browser=await launchBrowser();
 try{const cookie=await signIn(origin,{bootstrap:false});for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}});
  for(const part of cookie.split('; ')){const at=part.indexOf('=');await context.addCookies([{name:part.slice(0,at),value:part.slice(at+1),url:origin}])}
  const page=await context.newPage();await page.goto(origin+'/projects/investigation/issues');
  await page.getByRole('status').filter({hasText:'108 issues'}).waitFor();
  await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByText('Page 2 · 108 issues',{exact:true}).waitFor();
  await page.getByRole('searchbox',{name:'Search issues'}).fill('Historic environment:staging function:checkout0');
  await page.getByRole('status').filter({hasText:'1 issue matching'}).waitFor();
  assert.equal(await page.locator('tbody tr').count(),1);
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Preview triage',exact:true}).click();await page.getByRole('heading',{name:'Review 1 issue',exact:true}).waitFor();await page.getByRole('button',{name:'Cancel preview',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Apply to 1 issue',exact:true}).count(),0);await page.getByRole('button',{name:'Preview triage',exact:true}).click();await page.getByRole('button',{name:'Apply to 1 issue',exact:true}).click();await page.getByRole('status').filter({hasText:'1 issue acknowledged.'}).waitFor();
  assert.ok((await page.locator('tbody tr').innerText()).includes('Historic checkout failure'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Issue search reflows');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'Export CSV',exact:true}).click();const download=await downloadPromise;assert.equal(await download.failure(),null);
  await page.getByRole('searchbox',{name:'Search issues'}).fill('no-such-retained-event');await page.getByText('No issues match these filters.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();await page.getByRole('status').filter({hasText:'108 issues'}).waitFor();
  await context.close();
 }}finally{await browser.close()}
 // Frame locals and SDK source lines are owner evidence: an agent's query matches only what its packet shows.
 const dsn=new URL(p.dsn),store=`/api${dsn.pathname}/store/?sentry_key=${dsn.username}&sentry_version=7`,local='synthetic-spool-1',line='synthetic-spool-2';
 assert.equal((await req(store,'POST',{event_id:'7'.repeat(32),release:'checkout-2026',dist:'web',exception:{values:[{type:'LedgerError',value:'Ledger closed',stacktrace:{frames:[{filename:'https://checkout.example/ledger.js',function:'closeLedger',lineno:3,colno:5,pre_context:[line],context_line:line,post_context:[line],vars:{strategy:local}}]}}]}})).status,200);
 for(const q of [local,'stack:'+local,'function:'+local,line,'stack:'+line]){
  assert.equal((await json(base+'/issue-search?q='+encodeURIComponent(q))).total,1,'owner search reaches frame locals and source lines');
  for(const door of ['issue-search','issue-export'])assert.equal((await json(`${base}/${door}?q=${encodeURIComponent(q)}`,'GET',undefined,auth)).total,0,'agent search and export match only what the agent packet shows');
 }
 assert.equal((await json(base+'/issue-search?q='+encodeURIComponent('stack:closeLedger'),'GET',undefined,auth)).total,1,'agent search still matches packet frames');
 // Captured text stays inert in a spreadsheet: no exported cell opens as a formula, and each title keeps its text.
 const formulas=['=1+1&"','@SUM(1)','+1','-1',' =2','\t=3'];
 for(const [i,type] of formulas.entries())assert.equal((await req(store,'POST',{event_id:String(i+1).repeat(32),release:'checkout-2026',dist:'web',exception:{values:[{type,value:'synthetic-spool-3 confirmed"',stacktrace:{frames:[{filename:'https://checkout.example/sheet.js',function:'exportSheet',lineno:i+1,colno:1}]}}]}})).status,200);
 const sheet=(await (await req(base+'/issue-export?format=csv&q=synthetic-spool-3')).text()).split('\r\n').slice(1).map(row=>row.match(/"(?:[^"]|"")*"/g).map(cell=>cell.slice(1,-1).replaceAll('""','"')));
 assert.equal(sheet.length,formulas.length);
 for(const cell of sheet.flat())assert.doesNotMatch(cell,/^[\s\p{Cc}]*[=+\-@]/u,'exported cells never open as spreadsheet formulas');
 for(const type of formulas)assert.ok(sheet.some(row=>row[2].includes(type.trim()+': synthetic-spool-3 confirmed"')),'exported titles keep the captured text');
 console.log('Full-corpus search, query-wide facets, cursor pages, authorized JSON/CSV exports and scope passed.');
}

// Persisted reporting uses real public capture, saved-query, session and export
// doors. Team role/erasure/restore coverage is composed by the parent journey.
export async function dashboardFlow({req,json}){
 const root='/api/reporting',p=await json('/api/projects','POST',{id:'synthetic-reporting-dash',name:'Synthetic dashboard project'}),base='/api/projects/'+p.id;
 const initialOrganization=await json('/api/organization/me');assert.ok(!initialOrganization.organization,'The dashboard fixture starts before organization creation');
 const preOrganization=await json(root+'/items','POST',{kind:'dashboard',name:'Owner-only before organization',widgets:[{project:p.id,name:'Initial volume',config:{metric:'count',q:'',from:Date.now()-60000,to:Date.now()+1000}}]});
 const me=await json('/api/organization/me');if(!me.organization)await json('/api/organization','POST',{id:'synthetic-reporting-org',name:'Synthetic reporting organization'});
 for(const name of ['dash-a','dash-b'])await json(base+'/releases','POST',{name,build:'web'});
 const from=Date.now()-60000,clients=['synthetic-client-aaaaaaaa','synthetic-client-bbbbbbbb'];
 for(let n=0;n<3;n++){
  const response=await req('/api/ingest/'+p.id,'POST',{version:1,eventId:'dashboard-event-'+n,release:n===1?'dash-b':'dash-a',build:'web',environment:n===1?'staging':'production',type:'SyntheticDashboardError',message:n===0?'=SUM(1)':'Synthetic dashboard evidence',frames:[{file:'https://synthetic.example/dashboard.js',function:'dashboard',line:12,column:0}],breadcrumbs:[],...n<2?{client:clients[n]}:{}},{Authorization:'Bearer '+p.ingestKey});
  assert.equal(response.status,201);await response.body?.cancel();
 }
 const d=new URL(p.dsn),envelope=`/api${d.pathname}/envelope/?sentry_key=${d.username}&sentry_version=7`;
 const send=async(type,value)=>{const response=await req(envelope,'POST','{}\n'+JSON.stringify({type})+'\n'+JSON.stringify(value),{Cookie:''});assert.equal(response.status,200);await response.body?.cancel()};
 await send('event',{event_id:'83'.repeat(16),platform:'python',environment:'production',exception:{values:[{type:'SyntheticNoReleaseDashboard',value:'Synthetic no-release dashboard',stacktrace:{frames:[{filename:'/app/dashboard.py',function:'dashboard',lineno:3}]}}]},tags:{os:'synthetic-dashboard-os'}});
 await send('session',{sid:'84'.repeat(16),started:new Date().toISOString(),timestamp:new Date().toISOString(),status:'exited',errors:0,attrs:{release:'dash-a',environment:'production'}});
 const to=Date.now()+1000,config=(metric,q='',groupBy)=>({metric,q,from,to,...groupBy?{groupBy}:{}}),widget=(metric,q='',groupBy)=>({project:p.id,name:metric,config:config(metric,q,groupBy)});
 const input={kind:'dashboard',name:'Synthetic retained dashboard',widgets:[widget('count','environment:production release:dash-b'),widget('rate'),widget('users'),widget('sessions'),widget('count','','release')]};
 let item=await json(root+'/items','POST',input),savedId=item.id;
 assert.equal(item.widgets[0].data.value,0,'Every query term must match the same occurrence');assert.equal(item.widgets[1].data.matchedEvents,4);
 assert.equal(item.widgets[1].data.value,4/((to-from)/60000));assert.equal(item.widgets[2].data.value,2);assert.equal(item.widgets[2].data.unattributed,2);assert.equal(item.widgets[3].data.value,1);
 assert.equal(item.widgets[4].data.noReleaseEvents,1);assert.ok(item.widgets[4].data.groups.every(row=>row.group),'Named release rows omit no-release occurrences');assert.equal(item.widgets[4].data.groups.reduce((n,row)=>n+row.count,0),3);
 assert.ok(item.widgets[1].data.metadata.sampling);assert.ok(item.widgets[1].data.metadata.retention);assert.ok(item.widgets[1].data.metadata.dropped);
 const persisted=await json(root+'/items/'+savedId);assert.equal(persisted.widgets[2].data.value,item.widgets[2].data.value);assert.ok(typeof persisted.author==='string'&&persisted.author);
 const before=JSON.stringify((await json(root+'/items/'+savedId)).widgets.map(row=>row.config));
 const stale=await req(root+'/items/'+savedId,'PUT',{...input,name:'Changed dashboard',revision:item.revision+1});assert.equal(stale.status,409);await stale.body?.cancel();
 const agent=await json(base+'/keys','POST',{kind:'agent'}),auth={Cookie:'',Authorization:'Bearer '+agent.key};
 for(const headers of [{Cookie:''},auth,{Origin:'https://synthetic-foreign.example'}]){
  const denied=await req(root+'/items/'+savedId,'PUT',{...input,name:'Denied dashboard',revision:item.revision},headers);assert.ok([401,403].includes(denied.status));await denied.body?.cancel();
 }
 assert.equal(JSON.stringify((await json(root+'/items/'+savedId)).widgets.map(row=>row.config)),before,'Denied writes leave the stored definition unchanged');
 assert.equal((await req(root+'/items/'+savedId+'/export','GET',undefined,auth)).status,403);
 item=await json(root+'/items/'+savedId+'/shares','PUT',{revision:item.revision,shares:[{kind:'role',target:'read-only'}]});assert.equal(item.shares.length,1);assert.equal(item.shares[0].active,true);
 const sharedRevision=item.revision,changed=await json(root+'/items/'+savedId,'PUT',{...input,name:'Changed dashboard',revision:sharedRevision});assert.equal(changed.revision,sharedRevision+1);
 const staleShare=await req(root+'/items/'+savedId+'/shares','PUT',{revision:sharedRevision,shares:[]});assert.equal(staleShare.status,409);await staleShare.body?.cancel();assert.equal((await json(root+'/items/'+savedId)).shares.length,1);
 const invalidSession=await req(root+'/preview','POST',{project:p.id,config:config('sessions','message:dashboard')});assert.equal(invalidSession.status,400);await invalidSession.body?.cancel();
 const invalidGroup=await req(root+'/preview','POST',{project:p.id,config:config('count','','priority')});assert.equal(invalidGroup.status,400);await invalidGroup.body?.cancel();
 const query={q:'environment:production',status:'all',release:'dash-a',sort:'priority'},view=await json(base+'/review/views','POST',query);
 const scopedQuery=`environment:production release:dash-a after:${new Date(from).toISOString()} before:${new Date(to).toISOString()}`;
 const metric=await json(root+'/preview','POST',{project:p.id,config:config('count',scopedQuery)}),stream=await json(base+'/issue-search?eventTotals=1&q='+encodeURIComponent(scopedQuery));assert.equal(metric.value,stream.matchingEvents,'Opt-in issue-stream occurrence totals run the same event query');
 let matched=0;for(const issue of stream.rows){matched+=(await json(base+'/issues/'+issue.id+'/events?q='+encodeURIComponent(scopedQuery))).total}assert.equal(matched,metric.value,'All Events uses the same occurrence predicates as dashboard metrics');
 const preview=await json(root+'/table-preview','POST',{project:p.id,query,from,to});assert.equal(preview.total,2);assert.ok(preview.rows.every(row=>row.release==='dash-a'&&row.environment==='production'));
 const tableInput={kind:'table',name:'Synthetic saved event table',widgets:[{project:p.id,name:'Synthetic events',viewId:view.id,config:{from,to}}]},table=await json(root+'/items','POST',tableInput);
 assert.deepEqual(table.widgets[0].data.query,query);assert.equal(table.widgets[0].data.total,2);
 const exported=await json(root+'/items/'+table.id+'/export?format=json');assert.equal(exported.widgets[0].data.total,2);assert.equal(exported.bounds.complete,true);
 const wire=JSON.stringify(exported);for(const client of clients)assert.ok(!wire.includes(client));assert.ok(!wire.includes('user_key'));assert.ok(!wire.includes('operator_id'));
 const csvResponse=await req(root+'/items/'+table.id+'/export?format=csv'),csv=await csvResponse.text();assert.equal(csvResponse.status,200);assert.ok(csv.includes('metadata'));assert.ok(csv.includes("'=SUM(1)"),'Captured spreadsheet formulas remain inert');
 const reportItem=await json(root+'/items','POST',{kind:'report',name:'Synthetic saved report',widgets:[{project:p.id,name:'Synthetic report',config:{from,to,timeZone:'UTC'}}]});assert.equal(reportItem.widgets[0].data.volume.events,4);
 const limits=(await json(root+'/items')).limits,oversize=await req(root+'/items','POST',{...input,widgets:Array.from({length:limits.widgetsPerItem+1},()=>widget('count'))});assert.equal(oversize.status,400);await oversize.body?.cancel();
 const filling=[];
 try{
  let summaries=await json(root+'/items'),count=summaries.items.filter(row=>row.kind==='dashboard'&&row.id!==preOrganization.id).length;
  for(;count<limits.itemsPerKindPerOrganization;count++){const fill=await json(root+'/items','POST',{kind:'dashboard',name:'Synthetic capacity '+count,widgets:[widget('count')]});filling.push(fill)}
  const full=await req(root+'/items','POST',{kind:'dashboard',name:'Synthetic overflow',widgets:[widget('count')]});assert.equal(full.status,409);assert.match((await full.json()).error,/reporting_item_limit/);
  const move=await req(root+'/items/'+preOrganization.id+'/shares','PUT',{revision:preOrganization.revision,shares:[{kind:'role',target:'read-only'}]});assert.equal(move.status,409);assert.match((await move.json()).error,/reporting_item_limit/);const unchanged=await json(root+'/items/'+preOrganization.id);assert.equal(unchanged.revision,preOrganization.revision);assert.deepEqual(unchanged.shares,[],'Capacity refusals cannot attach or share an owner-only definition');
 }finally{for(const fill of filling)await json(root+'/items/'+fill.id,'DELETE',{revision:fill.revision})}
 const groupLimit=item.widgets[1].data.bounds.groupLimit;
 for(let n=0;n<=groupLimit;n++)await send('event',{event_id:'85'+n.toString(16).padStart(30,'0'),release:'dash-a',environment:'production',exception:{values:[{type:'ReportingBound',value:'Reporting group bound',stacktrace:{frames:[{filename:'/app/bound.py',function:'bound',lineno:5}]}}]},tags:{cohort:'synthetic-'+n}});
 const grouped=await json(root+'/items','POST',{kind:'dashboard',name:'Explicit group bound',widgets:[{project:p.id,name:'Retained cohorts',config:{metric:'count',q:'error.type:ReportingBound',groupBy:'tag:cohort',from,to:Date.now()+1000}}]});assert.equal(grouped.widgets[0].data.bounds.complete,false);assert.equal(grouped.widgets[0].data.groups.length,groupLimit);
 for(const format of ['csv','json']){const refusal=await req(root+'/items/'+grouped.id+'/export?format='+format);assert.equal(refusal.status,413);assert.match((await refusal.json()).error,/reporting_export_limit/)}
 await json(root+'/items/'+grouped.id,'DELETE',{revision:grouped.revision});
 const attached=await json(root+'/items/'+preOrganization.id+'/shares','PUT',{revision:preOrganization.revision,shares:[{kind:'role',target:'read-only'}]});assert.ok(attached.shares[0].active);await json(root+'/items/'+attached.id,'DELETE',{revision:attached.revision});
 await json(base+'/review/views/'+view.id,'DELETE');assert.equal((await json(root+'/items/'+table.id)).widgets.length,0,'Deleting the referenced saved query removes its table widget');
 for(const id of [savedId,table.id,reportItem.id]){const current=await json(root+'/items/'+id);await json(root+'/items/'+id,'DELETE',{revision:current.revision});assert.equal((await req(root+'/items/'+id)).status,404)}
 console.log('[FIND-003] persisted metric widgets, same-occurrence queries, SDK008 counts, sessions, no-release, saved review tables, report definitions, revisions, sharing, bounded safe exports and capacity refusals passed');
}
