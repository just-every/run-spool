import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchBrowser} from './browser-launch.mjs';
import {signIn} from './auth.mjs';

const projection=rows=>rows.map(({id,priority})=>({id,priority}));
const csvProjection=text=>{
 const [header,...lines]=text.split('\r\n'),keys=header.split(',');
 return lines.map(line=>{
  const cells=line.match(/"(?:[^"]|"")*"/g).map(cell=>cell.slice(1,-1).replaceAll('""','"'));
  return {id:cells[keys.indexOf('id')],priority:cells[keys.indexOf('priority')]};
 });
};

// One public journey covers the complete priority result, rather than just the
// first page or one matching issue. No search response supplies the expected IDs.
export async function prioritySearchFlow({req,json,origin}) {
 const project=await json('/api/projects','POST',{id:'synthetic-priority-search',name:'Synthetic priority search'}),base='/api/projects/'+project.id;
 const dsn=new URL(project.dsn),door=`/api${dsn.pathname}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 const buckets=new Map();
 let serial=0;
 for(let n=0;n<10;n++)for(const attention of ['regression','new_issue','none'])for(const [priority,level] of [['high','error'],['medium','warning'],['low','info']]){
  const type=`SyntheticPriority${serial}`,environment=n%2?'staging':'production';
  const send=async()=>{
   const response=await req(door,'POST','{}\n{"type":"event"}\n'+JSON.stringify({event_id:(++serial+50000).toString(16).padStart(32,'0'),release:'synthetic-priority-1',level,environment,exception:{values:[{type,value:'Synthetic priority ordering',stacktrace:{frames:[{filename:'/app/priority.js',function:type,lineno:10}]}}]}}),{Cookie:''});
   assert.equal(response.status,200,await response.text());
  };
  await send();
  let row=(await json(base+'/issues')).find(issue=>issue.title.startsWith(type+':'));
  assert.ok(row,'Public capture creates the distinct fixture issue');
  if(attention!=='new_issue'){
   await json(base+'/issues/'+row.id,'PATCH',{state:'resolved',resolution:'plain',revision:row.revision});
   if(attention==='regression')await send();
  }
  const priorityDoor=base+'/issues/'+row.id+'/priority',current=await json(priorityDoor);
  // Regression legitimately raises automatic priority. The native edit door
  // supplies controlled low and medium regressions without inventing alert rows.
  if(current.priority!==priority)await json(priorityDoor,'PUT',{priority,version:current.version});
  row=(await json(base+'/issues')).find(issue=>issue.id===row.id);
  assert.equal(row.priority,priority);
  assert.equal(row.attention?.kind??'none',attention);
  const fixture={id:row.id,priority,attention,environment,last_seen:row.last_seen};
  const key=priority+'-'+attention;
  if(!buckets.has(key))buckets.set(key,[]);
  buckets.get(key).push(fixture);
 }
 const expected=[];
 for(const priority of ['high','medium','low'])for(const attention of ['regression','new_issue','none']){
  const bucket=buckets.get(priority+'-'+attention);
  // Within a known priority and attention group, newer public receipts win;
  // equal receipts use descending byte order of the public issue identity.
  bucket.sort((a,b)=>b.last_seen-a.last_seen||(a.id<b.id?1:a.id>b.id?-1:0));
  expected.push(...bucket);
 }
 assert.equal(new Set(expected.map(row=>row.id)).size,90);
 const collect=async(q='',sort='priority')=>{
  const rows=[],pages=[],cursors=new Set();let cursor;
  do{
   const params=new URLSearchParams({q,sort,...cursor?{cursor}:{}}),page=await json(base+'/issue-search?'+params);
   pages.push(page);rows.push(...page.rows);
   assert.ok(rows.length<=page.total,'Pagination terminates within the full matching count');
   if(page.next){assert.ok(!cursors.has(page.next),'Cursor advances');cursors.add(page.next)}
   cursor=page.next;
  }while(cursor);
  assert.equal(rows.length,pages[0].total,'Every matching issue appears');
  assert.equal(new Set(rows.map(row=>row.id)).size,rows.length,'No issue repeats across pages');
  return {rows,pages};
 };
 for(const q of ['',...['high','medium','low'].map(priority=>'priority:'+priority),'priority:low environment:production','priority:medium environment:staging has:release','priority:high priority:low']){
  const wanted=expected.filter(row=>(!q.includes('priority:')||q.includes('priority:'+row.priority))&&(!q.includes('environment:')||q.includes('environment:'+row.environment)));
  const exact=q==='priority:high priority:low'?[]:wanted;
  const result=await collect(q),identities=projection(exact);
  assert.deepEqual(projection(result.rows),identities,'Complete priority ordering and combined predicates: '+q);
  const exported=await json(base+'/issue-export?'+new URLSearchParams({q,sort:'priority'}));
  assert.equal(exported.total,exact.length);assert.equal(exported.bounds.complete,true);
  assert.deepEqual(projection(exported.rows),identities,'JSON export preserves the complete ordered priority result');
  const csv=await req(base+'/issue-export?'+new URLSearchParams({q,sort:'priority',format:'csv'}));
  assert.equal(csv.status,200);
  assert.deepEqual(csvProjection(await csv.text()),identities,'CSV export preserves the complete ordered priority result');
  if(!q){assert.equal(result.pages.length,4);assert.deepEqual(result.pages.map(page=>page.rows.length),[25,25,25,15]);}
  else if(!q.includes(' '))assert.equal(result.pages.length,2,'Each priority itself crosses a page boundary');
 }
 const first=await json(base+'/issue-search'),cursor=first.next;
 for(const params of [{q:'priority:low'},{q:'environment:production'},{sort:'latest'},{sort:'occurrences'},{status:'open'},{release:'synthetic-priority-1'}]){
  const refused=await req(base+'/issue-search?'+new URLSearchParams({...params,cursor}));
  assert.equal(refused.status,400,'A cursor cannot be reused with a changed query: '+JSON.stringify(params));await refused.body?.cancel();
 }
 const other=await json('/api/projects','POST',{id:'synthetic-priority-other',name:'Other priority project'});
 const foreign=await req('/api/projects/'+other.id+'/issue-search?'+new URLSearchParams({cursor}));
 assert.equal(foreign.status,400,'A cursor cannot cross projects');await foreign.body?.cancel();
 for(const sort of ['latest','occurrences'])assert.notDeepEqual(projection((await collect('',sort)).rows),projection(expected),'Priority order is distinct from '+sort);
 for(const query of ['priority:urgent','priority:']){const invalid=await req(base+'/issue-search?'+new URLSearchParams({q:query}));assert.equal(invalid.status,400);await invalid.body?.cancel()}
 await prioritySearchScreen({origin,project:project.id,expected,width:1440});
 console.log('PROBE FIND-001 priority filtering and ordering: 90 captured issues, four cursor pages, three two-page priority filters, combined predicates, exact JSON and CSV identities and priorities, and changed-query cursor refusals passed.');
 return {project:project.id,expected};
}

export async function prioritySearchScreen({origin,project,expected,width}){
 const browser=await launchBrowser();
 try{
  const context=await browser.newContext({viewport:{width,height:900}}),cookie=await signIn(origin,{bootstrap:false});
  await context.addCookies(cookie.split('; ').map(part=>({name:part.slice(0,part.indexOf('=')),value:part.slice(part.indexOf('=')+1),url:origin})));
  const page=await context.newPage();await page.goto(origin+'/projects/'+project+'/issues');
  await page.getByRole('status').filter({hasText:'90 issues'}).waitFor();
  assert.equal(await page.getByRole('combobox',{name:'Sort',exact:true}).inputValue(),'priority');
  const pageRows=()=>page.locator('tbody tr').evaluateAll(rows=>rows.map(row=>({id:row.querySelector('.issue-open').getAttribute('href').split('/').at(-1),priority:row.querySelector('.priority-chip').textContent.toLowerCase()})));
  const wanted=projection;
  assert.deepEqual(await pageRows(),wanted(expected.slice(0,25)));
  const sort=page.getByRole('combobox',{name:'Sort',exact:true});
  await sort.selectOption({label:'Latest received'});
  const latest=[...expected].sort((a,b)=>b.last_seen-a.last_seen||(a.id<b.id?1:a.id>b.id?-1:0));
  await page.waitForFunction(id=>document.querySelector('.issue-open')?.getAttribute('href')?.endsWith(id),latest[0].id);
  assert.deepEqual(await pageRows(),wanted(latest.slice(0,25)),'Changing the visible sort changes the result');
  await sort.selectOption({label:'Highest priority'});
  await page.waitForFunction(id=>document.querySelector('.issue-open')?.getAttribute('href')?.endsWith(id),expected[0].id);
  const seen=[];
  for(let index=0;index<4;index++){
   await page.getByText(`Page ${index+1} · 90 issues`,{exact:true}).waitFor();
   await page.waitForFunction(id=>document.querySelector('.issue-open')?.getAttribute('href')?.endsWith(id),expected[index*25].id);
   const rows=await pageRows();
   assert.deepEqual(rows,wanted(expected.slice(index*25,(index+1)*25)),'The rendered page follows the complete priority order');
   seen.push(...rows);
   if(index<3)await page.getByRole('button',{name:'Next',exact:true}).click();
  }
  assert.deepEqual(seen,wanted(expected),'Every rendered issue appears once in priority order');
  assert.equal(await page.getByRole('button',{name:'Next',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Previous',exact:true}).click();
  await page.getByText('Page 3 · 90 issues',{exact:true}).waitFor();
  await page.waitForFunction(id=>document.querySelector('.issue-open')?.getAttribute('href')?.endsWith(id),expected[50].id);
  assert.deepEqual(await pageRows(),wanted(expected.slice(50,75)),'Previous returns to the same ordered page');
  // Export links retain the active page cursor. The downloaded result must still
  // contain the full query, including issues before and after the visible page.
  for(const format of ['JSON','CSV']){
   const downloadPromise=page.waitForEvent('download');
   await page.getByRole('link',{name:'Export '+format,exact:true}).click();
   const download=await downloadPromise;assert.equal(await download.failure(),null);
   const stream=await download.createReadStream(),chunks=[];
   for await(const chunk of stream)chunks.push(chunk);
   const text=Buffer.concat(chunks).toString();
   const exported=format==='JSON'?wanted(JSON.parse(text).rows):csvProjection(text);
   assert.deepEqual(exported,wanted(expected),'The actual '+format+' download preserves the whole priority query from page 3');
  }
  await mkdir('.artifacts/priority-search',{recursive:true});
  await page.screenshot({path:`.artifacts/priority-search/ordered-${width}.png`,fullPage:true});
  await page.getByRole('searchbox',{name:'Search issues'}).fill('priority:low environment:production');
  await page.getByRole('status').filter({hasText:'15 issues matching'}).waitFor();
  assert.equal(await page.getByRole('navigation',{name:'Issue pages'}).count(),0,'Changing filters clears the old page cursor');
  assert.deepEqual(await pageRows(),wanted(expected.filter(row=>row.priority==='low'&&row.environment==='production')));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Priority results reflow');
  await page.screenshot({path:`.artifacts/priority-search/filtered-${width}.png`,fullPage:true});
  await context.close();
 }finally{await browser.close()}
}
