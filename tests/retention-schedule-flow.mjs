import {mkdir} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {launchBrowser} from './browser-launch.mjs';
import assert from 'node:assert/strict';
import {startTestWorker} from './worker.mjs';
import {signIn,openGate,testDevKey} from './auth.mjs';
import {agedRetentionArchive} from './retention-archive.mjs';
import {archiveProjection} from './archive.mjs';
export async function retentionScheduleFlow(){
 const admissionKey=testDevKey;
 let worker=await startTestWorker(15548,{RER_DEV_KEY:admissionKey});
 try{
  let cookie=await signIn(worker.origin);
  const request=(path,method='GET',body,headers={})=>fetch(worker.origin+path,{method,headers:{Origin:worker.origin,Cookie:cookie,...body?{'Content-Type':typeof body==='string'?'application/x-ndjson':'application/json'}:{},...headers},...body?{body:typeof body==='string'?body:JSON.stringify(body)}:{}}),json=async(...args)=>{const response=await request(...args);assert.ok(response.ok,`[GOV-003] ${args[0]} HTTP ${response.status}`);return response.json()};
  const p='synthetic-spool-18',held='synthetic-spool-19',projects={};
  for(const id of [p,held]){projects[id]=await json('/api/projects','POST',{id,name:id});await json(`/api/projects/${id}/releases`,'POST',{name:'r1',build:'b1'})}
  const event=n=>({version:1,eventId:'synthetic-spool-'+n,type:'Error',message:'synthetic-spool-18',release:'r1',build:'b1',environment:'test',frames:[{file:'https://app.example/app.js',line:1,column:0,function:'syntheticSpool'}],breadcrumbs:[]});
  const ingest=(id,n,fresh=false)=>json(`/api/ingest/${id}`,'POST',{...event(n),...fresh?{frames:[{...event(n).frames[0],function:'syntheticSpoolFresh'}]}:{}},{Cookie:'',Authorization:'Bearer '+projects[id].ingestKey});
  for(let n=0;n<62;n++)await ingest(p,n);
  const textCommit='f'.repeat(40);await json(`/api/projects/${p}/releases`,'POST',{name:'r2',build:'b2',commits:[...Array.from({length:51},(_,n)=>(n+1).toString(16).padStart(40,'0')),{sha:textCommit,message:'synthetic-spool-18 retained commit text',author:{name:'synthetic-spool-18'}}]});
  await ingest(held,100);const policy=await json(`/api/projects/${held}/retention-policy`);await json(`/api/projects/${held}/retention-policy/hold`,'PUT',{held:true,reason:'synthetic-spool-19 preservation',revision:policy.revision});
  const time=Date.now(),fixture=await agedRetentionArchive(await request('/api/archive'),p,held,time);
  await worker.stop();worker=await startTestWorker(15548,{RER_DEV_KEY:admissionKey});cookie=await signIn(worker.origin);
  await json('/api/restore','POST',fixture.text,{'x-confirm-restore':'yes'});
  const restored=await archiveProjection(await request('/api/archive'));
  assert.deepEqual(restored.data.events,fixture.events,'[GOV-003] validated restore preserves the exact aged and recent corpus');
  for(const id of [p,held])projects[id].ingestKey=(await json(`/api/projects/${id}/keys`,'POST',{kind:'ingest'})).key;
  const before=await json(`/api/projects/${p}/issues`),heldBefore=await json(`/api/projects/${held}/issues`);
  const records=async id=>{const rows=[];let cursor=null,total;do{const page=await json(`/api/projects/${id}/occurrences?order=oldest${cursor?'&cursor='+encodeURIComponent(cursor):''}`);total=page.total;rows.push(...page.rows);cursor=page.next;}while(cursor);assert.equal(rows.length,total);return rows};
  assert.equal((await records(p)).length,62);
  const [tick,intake,heldIntake]=await Promise.all([worker.scheduled(time),ingest(p,62,true),ingest(held,101)]);assert.ok(tick.ok);await tick.body?.cancel();assert.equal(intake.outcome,'accepted','[GOV-003] fresh same-project intake is accepted during expiry');assert.equal(heldIntake.outcome,'accepted');
  const fresh=await json(`/api/projects/${p}/issues/${intake.issue}/events`);assert.equal(fresh.total,1);assert.equal(fresh.rows[0].id,'synthetic-spool-62','[GOV-003] fresh capture is immediately searchable');
  const searchPath=`/api/projects/${p}/issue-search?q=`+encodeURIComponent('function:syntheticSpoolFresh');
  const firstSearch=await json(searchPath);assert.equal(firstSearch.total,1);assert.deepEqual(firstSearch.rows.map(row=>({id:row.id,count:row.count})),[{id:intake.issue,count:1}],'[GOV-003] search finds the brand-new crash after the first expiry batch');
  const expiredCommit=await(await worker.db()).prepare('SELECT sha,message,author_name,author_email,expired FROM commits WHERE project=? AND sha=?').bind(p,textCommit).first();assert.equal(expiredCommit.sha,textCommit);assert.equal(expiredCommit.message,null);assert.equal(expiredCommit.author_name,null);assert.ok(expiredCommit.expired,'[GOV-003] bare SHAs cannot starve later eligible commit text');
  let state=await json(`/api/projects/${p}/retention-policy`);assert.equal(state.lastRun.status,'pending');assert.equal(state.lastRun.remaining,10,'bounded first batch leaves ten old occurrences');
  const first=await records(p),firstOld=first.filter(row=>fixture.agedIds.includes(row.id));assert.equal(firstOld.length,10);assert.equal(first.length,13);assert.deepEqual(first.filter(row=>!fixture.agedIds.includes(row.id)).map(row=>row.id).sort(),[...fixture.recentIds,'synthetic-spool-62'].sort());
  let issues=await json(`/api/projects/${p}/issues`);assert.equal(issues.find(row=>row.id===before[0].id).count,12);assert.equal(issues.find(row=>row.id===intake.issue).count,1);assert.equal(issues.reduce((n,row)=>n+row.count,0),first.length);
  assert.equal((await json(`/api/projects/${held}/issues`))[0].count,2,'[GOV-003] held project and concurrent intake survive');
  const heldRows=await records(held);assert.deepEqual(heldRows.map(row=>row.id).sort(),['synthetic-spool-100','synthetic-spool-101']);assert.equal(heldRows.find(row=>row.id==='synthetic-spool-100').received,fixture.events.find(row=>row.project===held).received);
  const firstPacket=await json(`/api/projects/${p}/issues/${before[0].id}/packet`),firstGap=firstPacket.gaps.find(g=>g.code==='retention_gap');assert.deepEqual(firstGap.rows.map(row=>row.detail.removed),[50]);assert.equal(firstGap.rows[0].detail.cutoff,time-90*86400000);assert.equal(firstGap.rows[0].detail.dedupHorizon,time-90*86400000);
  const [resume,secondIntake]=await Promise.all([worker.scheduled(time),ingest(p,63,true)]);assert.ok(resume.ok);await resume.body?.cancel();assert.equal(secondIntake.outcome,'accepted');assert.equal(secondIntake.issue,intake.issue);
  state=await json(`/api/projects/${p}/retention-policy`);assert.equal(state.lastRun.status,'complete');assert.equal(state.lastRun.remaining,0);
  const finalRows=await records(p);assert.deepEqual(finalRows.map(row=>row.id).sort(),[...fixture.recentIds,'synthetic-spool-62','synthetic-spool-63'].sort(),'[GOV-003] exactly sixty old events expire; recent and fresh captures survive every resumed batch');
  assert.deepEqual(finalRows.filter(row=>fixture.recentIds.includes(row.id)),first.filter(row=>fixture.recentIds.includes(row.id)),'[GOV-003] recent retained occurrences are unchanged');
  issues=await json(`/api/projects/${p}/issues`);assert.equal(issues.find(row=>row.id===before[0].id).count,2);assert.equal(issues.find(row=>row.id===intake.issue).count,2);assert.equal(issues.reduce((n,row)=>n+row.count,0),4);
  const finalSearch=await json(searchPath);assert.equal(finalSearch.total,1);assert.deepEqual(finalSearch.rows.map(row=>({id:row.id,count:row.count})),[{id:intake.issue,count:2}]);
  const freshAfterResume=await json(`/api/projects/${p}/issues/${intake.issue}/events`);assert.equal(freshAfterResume.total,2);assert.deepEqual(freshAfterResume.rows.map(row=>row.id).sort(),['synthetic-spool-62','synthetic-spool-63'],'[GOV-003] both concurrent captures remain searchable on their original issue after resume');
  const packet=await json(`/api/projects/${p}/issues/${before[0].id}/packet`);assert.deepEqual(packet.events.map(row=>row.id).sort(),fixture.recentIds);const gap=packet.gaps.find(g=>g.code==='retention_gap');assert.deepEqual(gap.rows.map(row=>row.detail.removed).sort((a,b)=>a-b),[10,50]);assert.equal(gap.rows.reduce((n,row)=>n+row.detail.removed,0),60);
  assert.deepEqual(await records(held),heldRows);assert.equal((await json(`/api/projects/${held}/issues`))[0].id,heldBefore[0].id);assert.equal((await json(`/api/projects/${held}/retention-policy`)).held,true);
  const db=await worker.db(),facts=await db.prepare("SELECT COUNT(*) n FROM audit WHERE project=? AND kind='retention_gap'").bind(p).first();assert.equal(facts.n,2);assert.ok((await db.prepare("SELECT COUNT(*) n FROM spool_audit_events WHERE action='retention.scheduled' AND actor_kind='service' AND outcome='succeeded'").first()).n>=2);
  const serviceFacts=await db.prepare("SELECT id FROM spool_audit_events WHERE action='retention.scheduled' AND actor_kind='service' AND outcome='succeeded' ORDER BY id").all();assert.equal(serviceFacts.results.length,2,'[GOV-003] one successful service audit per destructive batch');
  const next=await worker.scheduled(time);assert.ok(next.ok);await next.body?.cancel();assert.deepEqual(await db.prepare("SELECT COUNT(*) n FROM audit WHERE project=? AND kind='retention_gap'").bind(p).first(),facts,'[GOV-003] completed same-day rerun is a no-op');
  assert.deepEqual(await records(p),finalRows);assert.deepEqual(await records(held),heldRows);assert.deepEqual(await json(`/api/projects/${p}/issues`),issues);assert.deepEqual((await json(`/api/projects/${p}/issues/${before[0].id}/packet`)).gaps,packet.gaps);assert.deepEqual((await db.prepare("SELECT id FROM spool_audit_events WHERE action='retention.scheduled' AND actor_kind='service' AND outcome='succeeded' ORDER BY id").all()).results,serviceFacts.results);
  await mkdir('.artifacts/gov003',{recursive:true});const browser=await launchBrowser();try{for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:1000}});try{await openGate(context,worker.origin,admissionKey);await context.addCookies(cookie.split('; ').filter(Boolean).map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:worker.origin})));const page=await context.newPage();await page.goto(worker.origin+`/projects/${p}/settings`);const panel=page.getByRole('region',{name:'Project retention'});await panel.getByText(/Last expiry run:.*complete.*0 rows pending/).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);const axe=await new AxeBuilder({page}).include('[aria-label="Project retention"]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>v.id),[]);await panel.screenshot({path:`.artifacts/gov003/last-run-${width}.png`})}finally{await context.close()}}}finally{await browser.close()}
  console.log('[GOV-003] restored 60 aged and 2 recent events: same-project fresh intake survives 50-row expiry and 10-row resume; exact search, issue counts, gap quantities, held project, service audit and same-day no-op passed');
 }finally{await worker.stop()}
}
