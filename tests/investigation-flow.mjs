// [API-001] Retained records through versioned, exact-project read doors.
import { recordReadFlow } from './records-flow.mjs';
import { repositorySourceFlow } from './repository-source-flow.mjs';
import { bulkTriageFlow } from './bulk-triage-flow.mjs';
import assert from 'node:assert/strict';
import {launchBrowser} from './browser-launch.mjs';
import {signIn} from './auth.mjs';
export async function investigationFlow({req,json,origin}){
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
 await recordReadFlow({req,json});
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
  const scopedCsv=await req(`${base}/issue-export?format=csv&q=${encodeURIComponent(q)}`,'GET',undefined,auth);assert.equal(scopedCsv.status,200);assert.equal((await scopedCsv.text()).split('\r\n').length,1,'Agent CSV queries cannot match frame locals or source lines absent from packets');
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
