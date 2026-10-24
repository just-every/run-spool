import {mkdir} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {launchBrowser} from './browser-launch.mjs';
import assert from 'node:assert/strict';
import {startTestWorker} from './worker.mjs';
import {signIn,openGate,testDevKey} from './auth.mjs';
export async function retentionScheduleFlow(){
 const admissionKey=testDevKey;
 const worker=await startTestWorker(15548,{RER_DEV_KEY:admissionKey});
 try{
  const cookie=await signIn(worker.origin),request=(path,method='GET',body,headers={})=>fetch(worker.origin+path,{method,headers:{Origin:worker.origin,Cookie:cookie,...body?{'Content-Type':'application/json'}:{},...headers},...body?{body:JSON.stringify(body)}:{}}),json=async(...args)=>{const response=await request(...args);assert.ok(response.ok,`[GOV-003] ${args[0]} HTTP ${response.status}`);return response.json()};
  const p='synthetic-spool-18',held='synthetic-spool-19',projects={};
  for(const id of [p,held]){projects[id]=await json('/api/projects','POST',{id,name:id});await json(`/api/projects/${id}/releases`,'POST',{name:'r1',build:'b1'})}
  const event=n=>({version:1,eventId:'synthetic-spool-'+n,type:'Error',message:'synthetic-spool-18',release:'r1',build:'b1',environment:'test',frames:[{file:'https://app.example/app.js',line:1,column:0,function:'syntheticSpool'}],breadcrumbs:[]});
  const ingest=(id,n)=>json(`/api/ingest/${id}`,'POST',event(n),{Cookie:'',Authorization:'Bearer '+projects[id].ingestKey});
  for(let n=0;n<60;n++)await ingest(p,n);
  const textCommit='f'.repeat(40);await json(`/api/projects/${p}/releases`,'POST',{name:'r2',build:'b2',commits:[...Array.from({length:51},(_,n)=>(n+1).toString(16).padStart(40,'0')),{sha:textCommit,message:'synthetic-spool-18 retained commit text',author:{name:'synthetic-spool-18'}}]});
  await ingest(held,100);const policy=await json(`/api/projects/${held}/retention-policy`);await json(`/api/projects/${held}/retention-policy/hold`,'PUT',{held:true,reason:'synthetic-spool-19 preservation',revision:policy.revision});
  const before=await json(`/api/projects/${p}/issues`),time=Date.now()+91*86400000;
  const [tick,intake]=await Promise.all([worker.scheduled(time),ingest(held,101)]);assert.ok(tick.ok);await tick.body?.cancel();assert.equal(intake.outcome,'accepted','[GOV-003] intake is unchanged during expiry');
  const expiredCommit=await(await worker.db()).prepare('SELECT sha,message,author_name,author_email,expired FROM commits WHERE project=? AND sha=?').bind(p,textCommit).first();assert.equal(expiredCommit.sha,textCommit);assert.equal(expiredCommit.message,null);assert.equal(expiredCommit.author_name,null);assert.ok(expiredCommit.expired,'[GOV-003] bare SHAs cannot starve later eligible commit text');
  let state=await json(`/api/projects/${p}/retention-policy`);assert.equal(state.lastRun.status,'pending');assert.equal(state.lastRun.remaining,10,'bounded first batch leaves ten occurrences');let issues=await json(`/api/projects/${p}/issues`);assert.equal(issues[0].count,10);assert.equal(issues[0].id,before[0].id);assert.equal((await json(`/api/projects/${held}/issues`))[0].count,2,'[GOV-003] held project and concurrent intake survive');
  let next=await worker.scheduled(time);assert.ok(next.ok);await next.body?.cancel();state=await json(`/api/projects/${p}/retention-policy`);assert.equal(state.lastRun.status,'complete');assert.equal(state.lastRun.remaining,0);const packet=await json(`/api/projects/${p}/issues/${before[0].id}/packet`);assert.equal(packet.events.length,0);assert.ok(packet.gaps.some(g=>g.code==='retention_gap'));
  const db=await worker.db(),facts=await db.prepare("SELECT COUNT(*) n FROM audit WHERE project=? AND kind='retention_gap'").bind(p).first();assert.equal(facts.n,2);assert.ok((await db.prepare("SELECT COUNT(*) n FROM spool_audit_events WHERE action='retention.scheduled' AND actor_kind='service' AND outcome='succeeded'").first()).n>=2);
  next=await worker.scheduled(time);assert.ok(next.ok);await next.body?.cancel();assert.deepEqual(await db.prepare("SELECT COUNT(*) n FROM audit WHERE project=? AND kind='retention_gap'").bind(p).first(),facts,'[GOV-003] completed same-day rerun is a no-op');
  await mkdir('.artifacts/gov003',{recursive:true});const browser=await launchBrowser();try{for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:1000}});try{await openGate(context,worker.origin,admissionKey);await context.addCookies(cookie.split('; ').filter(Boolean).map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:worker.origin})));const page=await context.newPage();await page.goto(worker.origin+`/projects/${p}/settings`);const panel=page.getByRole('region',{name:'Project retention'});await panel.getByText(/Last expiry run:.*complete.*0 rows pending/).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);const axe=await new AxeBuilder({page}).include('[aria-label="Project retention"]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>v.id),[]);await panel.screenshot({path:`.artifacts/gov003/last-run-${width}.png`})}finally{await context.close()}}}finally{await browser.close()}
  console.log('[GOV-003] native scheduled clock seam: concurrent intake, held project, fifty-row batch, remainder resume, named gap, service audit and same-day no-op passed');
 }finally{await worker.stop()}
}
