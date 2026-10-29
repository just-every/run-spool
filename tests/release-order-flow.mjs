import {openSection} from './navigation.mjs';
import assert from 'node:assert/strict';
import {releaseOrderProperties,releaseOrderAgreement} from './release-order-properties.mjs';
import {mkdir} from 'node:fs/promises';
import {archiveProjection} from './archive.mjs';
import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';
import {runCli} from './sentry-cli/cli.mjs';
export async function releaseOrderFlow({req,json,db,origin,cookie,browser}) {
 const project=await json('/api/projects','POST',{id:'release-total-order',name:'Checkout mixed release history'}),base='/api/projects/'+project.id,dsn=new URL(project.dsn),path=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 let serial=0;const send=async release=>{const r=await req(path,'POST','{}\n{"type":"event"}\n'+JSON.stringify({event_id:(++serial).toString(16).padStart(32,'0'),release,exception:{values:[{type:'CheckoutError',value:'Checkout failed',stacktrace:{frames:[{filename:'/checkout.py',function:'checkout',lineno:12}]}}]}}));assert.equal(r.status,200)};
 const original=['1.2.0','abc123','1.10.0','1.2.0-rc.1','def456'];for(const name of original)await send(name);
 const names=async()=>(await json(base+'/releases')).map(r=>r.name),issue=async()=>(await json(base+'/issues'))[0];assert.deepEqual(await names(),original,'REL-001 default is global first seen');
 const metadata=await json(base+'/releases');
 const deploy=await json(base+'/keys','POST',{kind:'deploy'}),sessionTime=Date.now()-60000;
 for(const [index,release] of original.entries()){
  const response=await json(path,'POST','{}\n{"type":"session"}\n'+JSON.stringify({sid:(index+1).toString(16).padStart(32,'0'),started:new Date(sessionTime).toISOString(),status:'exited',attrs:{release,environment:'production'}}));assert.equal(response.sessions.session_stored,1);
 }
 const surfaces=async expected=>{
  const healthExpected=expected.filter(name=>original.includes(name));
  assert.deepEqual(await names(),expected,'native release list uses the chosen order');
  for(const door of [`/api/0/organizations/synthetic-spool/releases/`,`/api/0/projects/synthetic-spool/${project.id}/releases/`]){
   const rows=await json(door,'GET',undefined,{Cookie:'',Authorization:'Bearer '+deploy.key});assert.deepEqual(rows.map(r=>r.version),expected,'Sentry-compatible release list uses the chosen order');
  }
  const cli=await runCli(['releases','list'],{origin,token:deploy.key,project:project.id,org:'synthetic-spool'});assert.equal(cli.code,0,cli.output);assert.deepEqual(cli.output.replace(/\x1b\[[0-9;]*m/g,'').split(/\r?\n/).flatMap(line=>line.split(/[|│\s]+/).filter(cell=>expected.includes(cell))),expected,'the unmodified release-list CLI preserves the chosen order');
  const window=`?from=${sessionTime-1000}&to=${sessionTime+1000}`;
  for(const suffix of ['', '&download=1']){const health=await json(base+'/release-health'+window+suffix);assert.deepEqual(health.rows.map(r=>r.release),healthExpected,'health list and downloaded comparison use the chosen order');assert.equal(health.denominators.sessionsSeen,5)}
  const current=await issue(),view=await json(base+'/suspects/issues/'+current.id);assert.deepEqual(view.comparison.rows.map(r=>r.release),expected,'release comparison uses the same ascending order');assert.equal(view.comparison.rows.reduce((sum,r)=>sum+r.occurrences,0),current.count);
  assert.deepEqual(JSON.parse(current.releases),expected,'issue release chips follow the project rule');
  const search=await json(base+'/issue-search');assert.deepEqual(search.facets.releases.map(row=>row.value),expected,'release filter choices follow the project rule');assert.deepEqual(JSON.parse(search.rows[0].releases),expected);
  const exported=await json(base+'/issue-export?format=json');assert.deepEqual(JSON.parse(exported.rows[0].releases),expected,'issue JSON exports preserve the release list order');
  const reportPath=`/api/reports?projects=${project.id}&from=${sessionTime-1000}&to=${Date.now()+1000}`;
  for(const suffix of ['', '&format=json']){const report=await json(reportPath+suffix);assert.deepEqual(report.releaseStability.errorRows.map(row=>row.release),expected);assert.deepEqual(report.releaseStability.rows.map(row=>row.release),healthExpected)}
  const csv=await req(reportPath+'&format=csv');assert.equal(csv.status,200);assert.deepEqual((await csv.text()).split(/\r?\n/).flatMap(line=>/^"releaseStability\.errorRows\.\d+\.release","([^"]*)"$/.exec(line)?.slice(1)??[]),expected,'report CSV exports preserve the release comparison order');
  for(const door of [base+'/occurrences',base+'/issues/'+current.id+'/occurrences',base+'/issues/'+current.id+'/events']){
   const matches=await json(door+'?q='+encodeURIComponent('release:latest'));assert.ok(matches.rows.length>0);assert.ok(matches.rows.every(row=>row.release===expected.at(-1)),'latest occurrence reads use the final release');
  }
  for(const door of ['issue-search','issue-export'])assert.equal((await json(base+'/'+door+'?q=release:latest')).total,1,'latest search and export find the populated issue');
  const native=await json(base+'/releases'),archive=await archiveProjection(await req('/api/archive')),archived=archive.data.releases.filter(row=>row.project===project.id);assert.deepEqual(archived.map(row=>row.name),expected,'private archive release rows use the snapshot project rule');
  assert.deepEqual(archived,native.map(({project,name,seq,build,created})=>({project,name,seq,build,created})),'ordered archive preserves every release field, including its immutable registration identity');
  if(expected[0]==='1.2.0-rc.1'){
   const restored=await startTestWorker(15554);
   try{
    const restoredCookie=await signIn(restored.origin),headers={Cookie:restoredCookie,Origin:restored.origin};const response=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{...headers,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:archive.text});assert.equal(response.status,200,await response.text());
    const rows=await fetch(restored.origin+base+'/releases',{headers}).then(r=>r.json());assert.deepEqual(rows.map(row=>row.name),expected,'restored releases retain their order and first-seen metadata');
    const copied=await archiveProjection(await fetch(restored.origin+'/api/archive',{headers}));for(const table of ['releases','release_metadata','release_builds','release_policies','events','health_sessions'])assert.deepEqual(copied.data[table],archive.data[table],`ordered archive round trip preserves every ${table} row`);
   }finally{await restored.stop()}
  }
 };
 await surfaces(original);
 const screens=async(label,expected)=>{
  await mkdir('.artifacts/release-order',{recursive:true});
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000}});await context.addCookies(cookie.split('; ').map(value=>({name:value.slice(0,value.indexOf('=')),value:value.slice(value.indexOf('=')+1),url:origin})));const page=await context.newPage();
   try{
    await page.goto(origin+'/projects/'+project.id+'/releases');await page.getByRole('heading',{name:'Release history',exact:true}).waitFor();const history=page.locator('section').filter({has:page.getByRole('heading',{name:'Release history',exact:true})});await history.locator('.data-row').last().waitFor();
    if(width===1440)assert.deepEqual(await history.locator('.data-row th strong').allTextContents(),expected,'rendered release history uses the chosen order');
    await page.screenshot({path:`.artifacts/release-order/${label}-history-${width}.png`,fullPage:true});
    await page.goto(origin+'/projects/'+project.id+'/issues/'+(await issue()).id);const panel=page.getByRole('region',{name:'Suspect changes',exact:true});await openSection(page,'Suspect changes');await panel.getByRole('heading',{name:'Release comparison',exact:true}).waitFor();await panel.screenshot({path:`.artifacts/release-order/${label}-comparison-${width}.png`});
   }finally{await context.close()}
  }
 };
 await screens('first-seen',original);
 for(const order of ['sentry','first_seen','registered'])releaseOrderProperties(metadata,original,order);
 const current=await issue();await json(base+'/issues/'+current.id,'PATCH',{revision:current.revision,state:'resolved',resolution:'current'});await send('abc123');assert.equal((await issue()).state,'resolved','REL-001 delayed older first-seen capture cannot regress');
 const policy={version:1,order:'semver',pattern:'*'},preview=await json(base+'/release-policy/preview','POST',{policy});await json(base+'/release-policy','PUT',{revision:preview.revision,policy});
 const semantic=['1.2.0-rc.1','1.2.0','1.10.0','abc123','def456'];for(let i=0;i<3;i++)assert.deepEqual(await names(),semantic,'REL-001 repeat list uses one mixed transitive order');
 releaseOrderProperties(metadata,semantic,'semver');
 await surfaces(semantic);
 await screens('semver',semantic);
 const latest=await json(base+'/issues/'+current.id+'/events?q='+encodeURIComponent('release:latest'));assert.ok(latest.rows.length>0);assert.ok(latest.rows.every(r=>r.release==='def456'),'REL-001 latest shares the final list element');
 await send('1.99.0');assert.equal((await issue()).state,'resolved','REL-001 a later-seen semantic release still precedes existing non-semver names');await send('next-checkout');assert.equal((await issue()).state,'open','REL-001 newer release regresses once');
 assert.equal((await json(base+'/alerts')).filter(r=>r.kind==='regression').length,1);
 for(const order of ['first_seen','registered']){
  const policy={version:1,order,pattern:'*'},preview=await json(base+'/release-policy/preview','POST',{policy});await json(base+'/release-policy','PUT',{revision:preview.revision,policy});
  for(let repeat=0;repeat<3;repeat++)assert.deepEqual(await names(),[...original,'1.99.0','next-checkout']);
  await surfaces([...original,'1.99.0','next-checkout']);
 }
 await registeredRefusals({req,json});
 await changedBoundaries({req,json});
 await releaseOrderTies({json,db});
}

async function changedBoundaries({req,json}) {
 const project=await json('/api/projects','POST',{id:'synthetic-spool-order-boundary',name:'Release policy boundary preview'}),base='/api/projects/'+project.id,dsn=new URL(project.dsn),path=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 let serial=0;const send=async release=>{const response=await req(path,'POST','{}\n{"type":"event"}\n'+JSON.stringify({event_id:(++serial).toString(16).padStart(32,'0'),release,message:'Synthetic boundary capture'}));assert.equal(response.status,200)},issue=async()=>(await json(base+'/issues'))[0];
 await send('1.2.0');await send('1.2.0-rc.1');let row=await issue();await json(base+'/issues/'+row.id,'PATCH',{revision:row.revision,state:'resolved',resolution:'current'});
 const before=await issue(),policy={version:1,order:'semver',pattern:'*'},preview=await json(base+'/release-policy/preview','POST',{policy});assert.deepEqual(preview.rows.map(row=>({issue:row.issue,boundary:row.boundary,changed:row.changedReleaseComparisons})),[{issue:before.id,boundary:'1.2.0-rc.1',changed:['1.2.0']}]);assert.deepEqual(await issue(),before,'preview moves no issue boundary or state');
 await json(base+'/release-policy','PUT',{revision:preview.revision,policy});assert.deepEqual(await issue(),{...before,releases:JSON.stringify(['1.2.0-rc.1','1.2.0'])},'saving a rule changes release presentation but never replays history or changes the resolved issue');await send('1.2.0-rc.1');assert.equal((await issue()).state,'resolved');await send('1.2.0');assert.equal((await issue()).state,'open');
 await send('1.1.0');row=await issue();await json(base+'/issues/'+row.id,'PATCH',{revision:row.revision,state:'resolved',resolution:'next'});await send('1.1.0');assert.equal((await issue()).state,'resolved','next resolves above semantic latest, not the last registered sequence');await send('1.3.0');assert.equal((await issue()).state,'open');
 assert.equal((await json(base+'/alerts')).filter(row=>row.kind==='regression').length,2,'each actual newer recurrence raises one regression');
 const archive=await archiveProjection(await req('/api/archive'));assert.equal(archive.data.audit.filter(row=>row.project===project.id&&row.kind==='release_policy_changed').length,1,'the applied rule is audited once');
}

async function registeredRefusals({req,json}) {
 const project=await json('/api/projects','POST',{id:'synthetic-spool-strict',name:'Registered release intake'}),base='/api/projects/'+project.id,dsn=new URL(project.dsn),path=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 const name='synthetic-spool-1';await json(base+'/releases','POST',{name,build:'synthetic-spool-1'});
 const policy={version:1,order:'registered',pattern:'synthetic-spool-*'},preview=await json(base+'/release-policy/preview','POST',{policy});await json(base+'/release-policy','PUT',{revision:preview.revision,policy});
 let serial=0;const event=(release,dist)=>({event_id:(++serial).toString(16).padStart(32,'0'),release,dist,message:'Synthetic strict release capture'}),wire=(type,payload)=>'{}\n'+JSON.stringify({type})+'\n'+JSON.stringify(payload);
 const before=await json(base+'/releases');
 for(const [payload,reason] of [[event(),'missing_release_register_required'],[event('synthetic-spool-2'),'unregistered_release_or_build'],[event(name,'unregistered-dist'),'unregistered_release_or_build']]){
  const response=await req(path,'POST',wire('event',payload));assert.equal(response.status,422);const body=await response.json();assert.equal(body.reason,reason);assert.equal(body.register,'/projects/'+project.id+'/releases');
 }
 const time=new Date(Date.now()-1000).toISOString(),session=(release)=>({sid:(++serial).toString(16).padStart(32,'0'),started:time,status:'exited',attrs:{release}});
 for(const [payload,reason] of [[session(),'missing_release_register_required'],[session('synthetic-spool-2'),'unregistered_release_or_build']]){
  const body=await json(path,'POST',wire('session',payload));assert.equal(body.sessions[reason],1);assert.equal(body.register,'/projects/'+project.id+'/releases');
 }
 assert.deepEqual(await json(base+'/releases'),before,'refusals create no release or build');assert.deepEqual(await json(base+'/issues'),[],'refusals create no issue');assert.equal((await json(base+'/occurrences')).total,0);assert.equal((await json(base+'/release-health')).denominators.sessionsSeen,0);
 const outcomes=async()=>Object.fromEntries((await json(base+'/outcomes')).rows.map(r=>[r.reason,r.count]));
 const counts=await outcomes();assert.equal(counts.missing_release_register_required,2);assert.equal(counts.unregistered_release_or_build,3);assert.equal(counts.session_missing_release,1);assert.equal(counts.session_release_refused,1);
 const usage=(await json('/api/organization/usage')).usage.filter(row=>row.project===project.id);for(const reason of ['missing_release_register_required','unregistered_release_or_build'])assert.equal(usage.find(r=>r.reason===reason)?.count,counts[reason],'usage reconciles exact named refusal counts');
 const key=(await json(base+'/keys')).find(row=>row.kind==='ingest');await json(base+'/keys/'+key.hash,'DELETE');assert.equal((await req(path,'POST',wire('session',session(name)))).status,401);assert.deepEqual(await outcomes(),counts,'revoked intake attributes no refusal counts');
 // A fresh grant and explicit registration recover the supported strict path.
 const fresh=await json(base+'/keys','POST',{kind:'ingest'}),active=path.replace(dsn.username,fresh.key);await json(base+'/releases','POST',{name:'synthetic-spool-2',build:'synthetic-spool-1'});
 const accepted=await req(active,'POST',wire('event',event('synthetic-spool-2','synthetic-spool-1')));assert.equal(accepted.status,200,await accepted.text());
 assert.equal((await json(base+'/occurrences')).total,1);const final=await outcomes();assert.equal(final.accepted,1);for(const reason of ['missing_release_register_required','unregistered_release_or_build'])assert.equal(final[reason],counts[reason]);
 await json(base+'/releases','POST',{name:'synthetic-spool-3',build:'[sentry:no-dist]'});const valid=await json(active,'POST',wire('session',session('synthetic-spool-3')));assert.equal(valid.sessions.session_stored,1);assert.equal((await json(base+'/release-health')).denominators.sessionsSeen,1,'strict sessions recover after explicit registration');
}

async function releaseOrderTies({json,db}) {
 const project=await json('/api/projects','POST',{id:'synthetic-spool-order-ties',name:'Release ordering ties'}),base='/api/projects/'+project.id;
 const firstSeen=['app@1.2.3+z','app@1.2.3+a','app@1.2.3+9','synthetic-spool-Z','synthetic-spool-z','synthetic-spool-é','synthetic-spool-\uE000','synthetic-spool-\u{10000}'];
 // Seed a bounded equal-time history through real registration, then fix only
 // fixture timestamps. No ordering implementation or public response is faked.
 for(const name of [...firstSeen].reverse())await json(base+'/releases','POST',{name,build:'synthetic-spool-1'});
 const instant=1800000000000;
 await db.batch(firstSeen.flatMap((name,index)=>{
  const time=index===0?instant-1:instant;
  return [db.prepare('UPDATE releases SET created=? WHERE project=? AND name=?').bind(instant+100,project.id,name),db.prepare('UPDATE release_metadata SET first_seen=? WHERE project=? AND release=?').bind(time,project.id,name)];
 }));
 // Equal semver precedence ignores build metadata; earlier first-seen wins
 // even when its name sorts later. Equal times then use UTF-8, not locale or UTF-16.
 const semantic=['app@1.2.3+z','app@1.2.3+9','app@1.2.3+a',...firstSeen.slice(3)];
 for(const order of ['sentry','first_seen','semver','registered']){
  const policy={version:1,order,pattern:'*'},preview=await json(base+'/release-policy/preview','POST',{policy});await json(base+'/release-policy','PUT',{revision:preview.revision,policy});
  const expected=order==='registered'?[...firstSeen].reverse():semantic;
  for(let repeat=0;repeat<3;repeat++){
   const rows=await json(base+'/releases');assert.deepEqual(rows.map(r=>r.name),expected,`${order}: first-seen, build metadata and byte-order ties through public SQL`);releaseOrderAgreement(rows,expected,order);
  }
 }
 // Legacy releases without metadata use their original registration time.
 await db.prepare('DELETE FROM release_metadata WHERE project=? AND release=?').bind(project.id,firstSeen[0]).run();
 const policy={version:1,order:'first_seen',pattern:'*'},preview=await json(base+'/release-policy/preview','POST',{policy});await json(base+'/release-policy','PUT',{revision:preview.revision,policy});
 const legacy=[...semantic.slice(1),firstSeen[0]],rows=await json(base+'/releases');assert.deepEqual(rows.map(r=>r.name),legacy);releaseOrderAgreement(rows,legacy,'first_seen');
}
