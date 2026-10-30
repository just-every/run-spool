// [REL-002] Labelled correlations and owner judgments through the existing issue surface.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {archiveProjection} from './archive.mjs';
import {browserSignIn,signIn} from './auth.mjs';
import {startTestWorker} from './worker.mjs';
import {followErasure} from './project-erasure/follow.mjs';
export async function suspectFlow({req,json,origin,browser}) {
 const p=await json('/api/projects','POST',{id:'synthetic-spool-suspects',name:'Checkout suspect changes'}),base=`/api/projects/${p.id}`;
 const old='synthetic-spool-checkout@1',current='synthetic-spool-checkout@2',falseSha='a'.repeat(40),trueSha='b'.repeat(40),priorSha='c'.repeat(40),time=Date.now();
 await json(base+'/releases','POST',{name:old,build:'web-1',commits:[{sha:priorSha,message:'Keep older checkout clients running'}]});
 await json(base+'/releases','POST',{name:current,build:'web-2',commits:[{sha:falseSha,message:'Adjust checkout layout'},{sha:trueSha,message:'Change payment confirmation'}]});
 const destination=await json(base+'/alerting/destinations','POST',{label:'Synthetic release owner',recipient:'synthetic-spool-release@example.test'});
 await json(base+'/deployments','POST',{id:'synthetic-spool-rollout',release:current,build:'web-2',environment:'production',repository:'https://example.test/synthetic-spool/checkout',commitSha:trueSha,previousCommit:priorSha,includedCommits:[falseSha,trueSha],startedAt:new Date(time-60000).toISOString(),deadline:new Date(time+3600000).toISOString(),destination:destination.id});
 const send=async(id,release,message,line)=>{const r=await req(`/api/ingest/${p.id}`,'POST',{version:1,eventId:id,release,build:release===old?'web-1':'web-2',environment:'production',type:'TypeError',message,frames:[{file:'checkout.js',line,column:0,function:line===12?'confirm':'legacyCart'}],breadcrumbs:[]},{Cookie:'',Authorization:`Bearer ${p.ingestKey}`});assert.equal(r.status,201)};
 await send('synthetic-spool-new',current,'Payment confirmation never appeared',12);
 for(let i=0;i<5;i++)await send('synthetic-spool-old-'+i,old,'Older checkout basket unavailable',30);
 const issue=(await json(base+'/issues')).find(i=>i.title.includes('Payment confirmation')),path=base+'/suspects/issues/'+issue.id;
 let view=await json(path);assert.equal(view.candidates.length,2);assert.ok(view.candidates.every(c=>c.reason[0].kind==='first_retained_occurrence'&&c.reason[0].record.id==='synthetic-spool-new'&&c.deployments.some(d=>d.id==='synthetic-spool-rollout')&&!c.changedSource.available));
 assert.deepEqual(view.comparison.rows.map(r=>[r.release,r.occurrences,r.issues]).sort(),[[old,5,1],[current,1,1]].sort());
 const reactivation=await reactivationFixture({req,json,old,current,falseSha,trueSha,priorSha,time});
 const comparison=await comparableFixture({req,json,old,current,falseSha,trueSha});
 const before=(await archiveProjection(await req('/api/archive'))).data;
 await mkdir('.artifacts/rel002',{recursive:true});
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  try{
   await browserSignIn(page,origin);await page.goto(`${origin}/projects/${p.id}/issues/${issue.id}`);
   const panel=page.getByRole('region',{name:'Suspect changes',exact:true});await panel.getByRole('heading',{name:'Release comparison',exact:true}).waitFor();
   const reject=panel.locator('article').filter({has:page.getByRole('heading',{name:new RegExp(falseSha.slice(0,12))})}),confirm=panel.locator('article').filter({has:page.getByRole('heading',{name:new RegExp(trueSha.slice(0,12))})});
   if(width===1440){
    await reject.getByLabel('Evidence note for '+falseSha.slice(0,12),{exact:true}).fill('The layout change does not touch payment confirmation. Older clients show a separate basket failure.');await reject.getByRole('button',{name:'Reject suspect',exact:true}).click();await reject.getByText(/Engineer judgment: rejected/).waitFor();
    await confirm.getByLabel('Evidence note for '+trueSha.slice(0,12),{exact:true}).fill('The first retained failure follows this release. Reproduction evidence is still needed to demonstrate cause.');await confirm.getByRole('button',{name:'Confirm suspect',exact:true}).click();await confirm.getByText(/Engineer judgment: confirmed/).waitFor();
   }else{await panel.getByText(/Engineer judgment: rejected/).waitFor();await panel.getByText(/Engineer judgment: confirmed/).waitFor()}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'suspect view reflows');
   assert.deepEqual((await new AxeBuilder({page}).include('[aria-label="Suspect changes"]').analyze()).violations.filter(v=>['serious','critical'].includes(v.impact)),[]);
   assert.deepEqual(await page.locator('button').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&!n.textContent.trim()).map(n=>n.getAttribute('aria-label'))),[],'no icon-only control on the touched screen');
   await panel.screenshot({path:`.artifacts/rel002/suspect-judgments-${width}.png`});
   await page.goto(`${origin}/projects/${reactivation.project}/issues/${reactivation.issue}`);
   const regressed=page.getByRole('region',{name:'Suspect changes',exact:true});
   await regressed.getByRole('heading',{name:'Release comparison',exact:true}).waitFor();
   await regressed.getByText(`Reactivation · ${displayTime(reactivation.alert.created)} · record ${reactivation.alert.id}`,{exact:true}).first().waitFor();
   if(width===1440){
    assert.equal(await regressed.locator('article').count(),3,'older first occurrence and both newer commits remain visible');
    for(const sha of [falseSha,trueSha]){
     const card=regressed.locator('article').filter({has:page.getByRole('heading',{name:`${current} · ${sha.slice(0,12)}`,exact:true})});
     assert.deepEqual(await card.locator('h3').allTextContents(),[`${current} · ${sha.slice(0,12)}`]);
     assert.deepEqual(await card.locator('li').allTextContents(),[
      `Reactivation · ${displayTime(reactivation.alert.created)} · record ${reactivation.alert.id}`,
      `Recorded deployment ${reactivation.deployment.id} · production · ${displayTime(time-60000)} to ${displayTime(time+3600000)} (owner deadline)`
     ],'each commit displays the exact regression record and recorded deployment window');
     assert.equal(await card.getByText('Correlation, not a demonstrated cause.',{exact:true}).count(),1);
    }
    assert.equal(await regressed.getByText('No observed sessions in this window; rates are unavailable.',{exact:true}).count(),1);
    assert.ok((await regressed.innerText()).includes('Device adoption, comparable cohorts and causal attribution remain unavailable.'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'reactivated suspect view reflows');
    assert.deepEqual((await new AxeBuilder({page}).include('[aria-label="Suspect changes"]').analyze()).violations.filter(v=>['serious','critical'].includes(v.impact)),[]);
   }
   await regressed.screenshot({path:`.artifacts/rel002/suspect-reactivation-${width}.png`});
   await page.goto(`${origin}/projects/${comparison.project}/issues/${comparison.issue}`);
   const compared=page.getByRole('region',{name:'Suspect changes',exact:true});
   await compared.getByRole('heading',{name:'Release comparison',exact:true}).waitFor();
   await compared.getByText(/Engineer judgment: rejected/).waitFor();
   await compared.locator('summary').filter({hasText:'Comparable cohorts and loss'}).click();
   if(width===1440){
    assert.equal(await compared.getByText(/Observed rate increase/).count(),2);
    assert.ok((await compared.innerText()).includes('2 issue events, 4 observed sessions, 2 unhealthy; adoption 28.6%'));
    assert.ok((await compared.innerText()).includes('Impact attribution is withheld.'));
    assert.ok((await compared.innerText()).includes('Changed path checkout.js'));
    assert.deepEqual((await new AxeBuilder({page}).include('[aria-label="Suspect changes"]').analyze()).violations.filter(v=>['serious','critical'].includes(v.impact)),[]);
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'cohort comparison reflows');
   await compared.screenshot({path:`.artifacts/rel002/suspect-comparison-${width}.png`});
  }finally{await context.close()}
 }
 const after=(await archiveProjection(await req('/api/archive'))).data;
 for(const table of ['events','issues'])assert.deepEqual(after[table],before[table],`judgment changes no ${table}`);
 assert.deepEqual(after.suspect_decisions.filter(r=>r.project===p.id).map(r=>r.judgment).sort(),['confirmed','rejected']);
 assert.equal(after.audit.filter(r=>r.kind==='suspect_judged'&&r.project===p.id).length,2,'one audited entry per judgment');
 const denied=await json(base+'/keys','POST',{kind:'agent'});
 assert.equal((await req(path,'PUT',{release:current,sha:falseSha,judgment:'confirmed',note:'denied',revision:1},{Cookie:'',Authorization:`Bearer ${denied.key}`})).status,403);
 const snapshot=await archiveProjection(await req('/api/archive'));let restored;
 try{restored=await startTestWorker(15554);const cookie=await signIn(restored.origin);const r=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Cookie:cookie,Origin:restored.origin,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:snapshot.text});assert.ok(r.ok,await r.text());const copied=await archiveProjection(await fetch(restored.origin+'/api/archive',{headers:{Cookie:cookie}}));assert.deepEqual(copied.data.suspect_decisions,snapshot.data.suspect_decisions,'restore preserves both judgments as inert records');
 const restoredRead=await fetch(restored.origin+comparison.path+`?from=${comparison.view.comparison.from}&to=${comparison.view.comparison.to}`,{headers:{Cookie:cookie}}).then(r=>r.json());
 assert.deepEqual(restoredRead.comparison.cohorts,comparison.view.comparison.cohorts,'private restore preserves exact recorded cohort denominators and loss');
 const copiedPacket=await fetch(restored.origin+comparison.base+'/issues/'+comparison.issue+'/packet',{headers:{Cookie:cookie}}).then(r=>r.json());
 const historicalSuspects=structuredClone(comparison.packet.suspects);for(const candidate of historicalSuspects.candidates)for(const deployment of candidate.deployments)deployment.historical=1;
 assert.deepEqual(copiedPacket.suspects,historicalSuspects,'private restore preserves judgment provenance with explicitly inert deployment history');
 for(const table of ['suspect_commit_files','health_session_cohorts'])assert.deepEqual(copied.data[table],snapshot.data[table],'private archive retains '+table);
 const cutoff=Date.now(),retained=await fetch(restored.origin+comparison.base+'/retention',{method:'POST',headers:{Cookie:cookie,Origin:restored.origin,'Content-Type':'application/json'},body:JSON.stringify({cutoff,apply:true})});assert.equal(retained.status,200,await retained.text());
 const expired=await archiveProjection(await fetch(restored.origin+'/api/archive',{headers:{Cookie:cookie}}));
 for(const table of ['suspect_commit_files','health_session_cohorts'])assert.ok(!expired.data[table].some(row=>row.project===comparison.project),'retention removes '+table);
 const expiredView=await fetch(restored.origin+comparison.path,{headers:{Cookie:cookie}}).then(r=>r.json());
 assert.deepEqual(expiredView.comparison.cohorts.rows,[]);assert.ok(expiredView.comparison.cohorts.loss.retention.length>0,'expired evidence is a visible comparison gap');
 assert.ok(expiredView.candidates.every(candidate=>!candidate.changedSource.available),'expired paths cannot establish source overlap')}finally{await restored?.stop()}
 const plan=await json(base+'/erasure');assert.equal(plan.deleted.suspect_decisions,2);await followErasure(json,await json(base+'/erasure','POST',{confirm:p.id,planHash:plan.planHash}));
 assert.ok(!(await archiveProjection(await req('/api/archive'))).data.suspect_decisions.some(r=>r.project===p.id));
 const comparisonPlan=await json(comparison.base+'/erasure');
 assert.equal(comparisonPlan.deleted.suspect_commit_files,2);assert.equal(comparisonPlan.deleted.health_session_cohorts,37);
 await followErasure(json,await json(comparison.base+'/erasure','POST',{confirm:comparison.project,planHash:comparisonPlan.planHash}));
 assert.equal((await req(comparison.path)).status,404);
 for(const table of ['suspect_commit_files','health_session_cohorts','suspect_decisions'])assert.ok(!(await archiveProjection(await req('/api/archive'))).data[table].some(row=>row.project===comparison.project),'erasure removes '+table);
 console.log('[REL-002] first-release and reactivation candidates, exact regression alert and two commits with recorded deployment window, older-release spike comparison, audited reject and confirm without occurrence changes, restore and erasure; desktop and phone passed');
}

const displayTime=time=>new Date(time).toLocaleString('en-GB',{timeZone:'UTC',hour12:false})+' UTC';
async function reactivationFixture({req,json,old,current,falseSha,trueSha,priorSha,time}) {
 const p=await json('/api/projects','POST',{id:'synthetic-spool-reactivation',name:'Checkout reactivation correlation'}),base=`/api/projects/${p.id}`;
 await json(base+'/releases','POST',{name:old,build:'web-1',commits:[{sha:priorSha,message:'Older checkout confirmation'}]});
 await json(base+'/releases','POST',{name:current,build:'web-2',commits:[{sha:falseSha,message:'Adjust checkout layout'},{sha:trueSha,message:'Change payment confirmation'}]});
 const destination=await json(base+'/alerting/destinations','POST',{label:'Synthetic reactivation owner',recipient:['synthetic-spool-reactivation','example.test'].join('@')});
 const deployment={id:'synthetic-spool-reactivation-rollout',release:current,build:'web-2',environment:'production',repository:'https://example.test/synthetic-spool/checkout',commitSha:trueSha,previousCommit:priorSha,includedCommits:[falseSha,trueSha],startedAt:new Date(time-60000).toISOString(),deadline:new Date(time+3600000).toISOString(),destination:destination.id};
 await json(base+'/deployments','POST',deployment);
 const send=async(eventId,release)=>{
  const response=await req(`/api/ingest/${p.id}`,'POST',{version:1,eventId,release,build:release===old?'web-1':'web-2',environment:'production',type:'TypeError',message:'Checkout confirmation receipt missing',frames:[{file:'checkout.js',line:12,column:0,function:'confirm'}],breadcrumbs:[]},{Cookie:'',Authorization:`Bearer ${p.ingestKey}`});
  assert.equal(response.status,201,await response.text());
 };
 await send('synthetic-spool-resolved-old',old);
 const issues=await json(base+'/issues');assert.equal(issues.length,1);const issue=issues[0],path=base+'/suspects/issues/'+issue.id;
 assert.equal((await json(base+'/alerts')).filter(a=>a.kind==='regression').length,0);
 assert.deepEqual((await json(path)).candidates.map(c=>[c.release,c.sha]),[[old,priorSha]],'a recorded newer deployment alone does not establish a reactivation');
 await json(base+'/issues/'+issue.id,'PATCH',{revision:issue.revision,state:'resolved',resolution:'current'});
 const resolved=(await json(base+'/issues'))[0],releases=await json(base+'/releases');
 assert.equal(resolved.state,'resolved');assert.equal(resolved.resolved_seq,releases.find(r=>r.name===old).seq,'resolution freezes the older release');
 assert.ok(releases.find(r=>r.name===current).seq>resolved.resolved_seq,'recurrence uses a strictly later release');
 await send('synthetic-spool-recurred-new',current);
 const reopened=(await json(base+'/issues'))[0];assert.equal(reopened.id,issue.id);assert.equal(reopened.state,'open');assert.equal(reopened.count,2);
 const alerts=(await json(base+'/alerts')).filter(a=>a.kind==='regression');assert.equal(alerts.length,1);const alert=alerts[0];
 assert.equal(alert.issue,issue.id);assert.equal(JSON.parse(alert.payload).release.name,current);
 const history=(await json(base+'/deployments')).rows;assert.equal(history.length,1);
 assert.deepEqual(history[0].includedCommits,[falseSha,trueSha]);
 assert.equal(history[0].release,current);assert.equal(history[0].started_at,time-60000);assert.equal(history[0].deadline,time+3600000);
 const view=await json(path),candidates=view.candidates.filter(c=>c.release===current);
 assert.equal(view.bounds.reactivationsIncluded,1);assert.equal(view.candidates.length,3);
 assert.deepEqual(candidates.map(c=>c.sha).sort(),[falseSha,trueSha].sort(),'both recorded commits become reactivation candidates');
 for(const candidate of candidates){
  assert.equal(candidate.inclusion.sha,candidate.sha);
  assert.deepEqual(candidate.reason,[{kind:'reactivation',record:{alertId:alert.id,received:alert.created,release:current}}]);
  assert.deepEqual(candidate.deployments,[{id:deployment.id,environment:'production',started:time-60000,deadline:time+3600000,historical:0}]);
  assert.equal(candidate.correlation,'Correlation, not a demonstrated cause.');
  assert.equal(candidate.changedSource.available,false);
 }
 assert.deepEqual(view.candidates.find(c=>c.release===old).reason.map(r=>[r.kind,r.record.id]),[['first_retained_occurrence','synthetic-spool-resolved-old']]);
 assert.deepEqual(view.comparison.rows.map(r=>[r.release,r.occurrences,r.issues]).sort(),[[old,1,1],[current,1,1]].sort());
 assert.deepEqual(view.comparison.health.rows,[],'no session denominator is invented for recurrence');
 return {project:p.id,issue:issue.id,alert,deployment};
}

// One populated public journey qualifies the comparison and the provenance an engineer or agent reads.
async function comparableFixture({req,json,old,current,falseSha,trueSha}) {
 const p=await json('/api/projects','POST',{id:'synthetic-spool-comparison',name:'Comparable checkout rollout'}),base='/api/projects/'+p.id;
 await json(base+'/releases','POST',{name:old,build:'web-1'});
 await json(base+'/releases','POST',{name:current,build:'web-2',commits:[{sha:falseSha,files:['layout.js']},{sha:trueSha,files:['checkout.js']}]});
 const d=new URL(p.dsn),intake=`/api${d.pathname}/envelope/?sentry_key=${d.username}&sentry_version=7`;
 const send=async(type,value)=>{const response=await req(intake,'POST','{}\n'+JSON.stringify({type})+'\n'+JSON.stringify(value),{Cookie:''});assert.equal(response.status,200,await response.clone().text());return response.json()};
 const time=Date.now()-1000;
 const destination=await json(base+'/alerting/destinations','POST',{label:'Comparable rollout owner',recipient:['synthetic-spool-rollout','example.test'].join('@')});
 await json(base+'/deployments','POST',{id:'synthetic-spool-comparable-rollout',release:current,build:'web-2',environment:'production',repository:'https://example.test/synthetic-spool/checkout',commitSha:trueSha,includedCommits:[falseSha,trueSha],startedAt:new Date(time-60000).toISOString(),deadline:new Date(time+3600000).toISOString(),destination:destination.id});
 const session=async(release,os,device,status='exited',offset=0)=>send('session',{sid:crypto.randomUUID().replaceAll('-',''),started:new Date(time+offset).toISOString(),status,attrs:{release,environment:'production',user_agent:os==='Windows'?'Windows NT 10.0; Win64; x64':os==='Android'?'Linux; Android 14; Mobile':'synthetic-spool-unknown'}});
 for(let i=0;i<10;i++)await session(old,'Windows','desktop');
 for(let i=0;i<4;i++)await session(current,'Windows','desktop',i<2?'crashed':'exited');
 for(let i=0;i<20;i++)await session(current,'Android','mobile');
 for(let i=0;i<3;i++)await session(current,'unknown','unknown');
 await send('sessions',{attrs:{release:old,environment:'production'},aggregates:[{started:new Date(time).toISOString(),exited:5}]});
 let counter=0;
 const event=async(release,spike=false)=>send('event',{event_id:(++counter).toString(16).padStart(32,'0'),release,dist:release===old?'web-1':'web-2',environment:'production',contexts:{device:{family:'desktop'},os:{name:'Windows'}},exception:{values:[{type:'CheckoutError',value:spike?'Older basket spike':'Confirmation missing',stacktrace:{frames:[{filename:spike?'basket.js':'checkout.js',lineno:spike?30:12,colno:1,function:spike?'basket':'confirm',in_app:true}]}}]}});
 await event(old);
 let issue=(await json(base+'/issues'))[0];await json(base+'/issues/'+issue.id,'PATCH',{revision:issue.revision,state:'resolved',resolution:'current'});
 await event(current);await event(current);
 for(let i=0;i<4;i++)await event(old,true);
 await send('session',{attrs:{release:current}});
 await send('client_report',{timestamp:Date.now()/1000,discarded_events:[{reason:'before_send',category:'error',quantity:3},{reason:'before_send',category:'session',quantity:2}]});
 const path=base+'/suspects/issues/'+issue.id,view=await json(path),cohorts=view.comparison.cohorts;
 assert.deepEqual(view.comparison.rows.map(r=>[r.release,r.occurrences,r.issues]).sort(),[[old,5,2],[current,2,1]].sort(),'older-client unrelated spike remains in the same rollout window');
 const known=cohorts.rows.filter(r=>r.device==='desktop'&&r.os==='Windows');
 assert.deepEqual(known.map(r=>[r.release,r.sessions,r.issueEvents,r.unhealthy,r.adoptionShare]),[[old,10,1,0,10/14],[current,4,2,2,4/14]]);
 assert.ok(known.every(r=>r.comparable&&r.interval&&r.environment==='production'));
 assert.deepEqual(cohorts.contrasts.map(r=>[r.previousRelease,r.release,r.device,r.os,r.previousIssueRate,r.issueRate,r.issueRateChange,r.unhealthyRateChange]),[[old,current,'desktop','Windows',.1,.5,.4,.5]],'a new mobile cohort cannot be pooled into the existing desktop denominator');
 assert.equal(cohorts.loss.aggregateSessions,5);assert.equal(cohorts.loss.unknownCohortSessions,3);assert.equal(cohorts.loss.unreported,'unknown');
 for(const [reason,count] of [['session_invalid',1],['client_discarded:error:before_send',3],['client_discarded:session:before_send',2]])assert.equal(cohorts.loss.outcomes.find(r=>r.reason===reason)?.count,count);
 assert.ok(cohorts.loss.attribution.includes('withheld'));
 const candidates=view.candidates.filter(c=>c.release===current);assert.deepEqual(candidates.map(c=>c.sha).sort(),[falseSha,trueSha]);
 for(const c of candidates){assert.deepEqual(c.deployments.map(d=>[d.id,d.started,d.deadline]),[['synthetic-spool-comparable-rollout',time-60000,time+3600000]]);assert.ok(c.reason.some(r=>r.kind==='reactivation'));assert.ok(c.reason.some(r=>r.kind==='rate_change'&&r.record.previousRelease===old&&r.record.issueRateChange===.4));assert.equal(c.changedSource.available,true)}
 assert.deepEqual(candidates.find(c=>c.sha===falseSha).changedSource.matches,[],'an unrelated path is not a source match');
 assert.deepEqual(candidates.find(c=>c.sha===trueSha).changedSource.matches.map(m=>[m.event,m.frame,m.file,m.basis]).sort(),[['00000000000000000000000000000002',0,'checkout.js','reported_frame'],['00000000000000000000000000000003',0,'checkout.js','reported_frame']]);
 const beforeRepeat=(await json(base+'/issues')).map(row=>[row.id,row.count,row.state]);
 const replay={event_id:'00000000000000000000000000000003',release:current,dist:'web-2',environment:'production',contexts:{device:{family:'desktop'},os:{name:'Windows'}},exception:{values:[{type:'CheckoutError',value:'Confirmation missing',stacktrace:{frames:[{filename:'checkout.js',lineno:12,colno:1,function:'confirm',in_app:true}]}}]}};
 await send('event',replay);assert.deepEqual((await json(base+'/issues')).map(row=>[row.id,row.count,row.state]),beforeRepeat,'replayed capture does not create another occurrence or reactivation');
 await json(base+'/releases','POST',{name:current,build:'web-2',commits:[{sha:trueSha,files:['checkout.js']}]});
 const receiptBefore=(await archiveProjection(await req('/api/archive'))).data;
 assert.equal((await req(base+'/releases','POST',{name:current,build:'web-2',commits:[{sha:trueSha,files:['other.js']}]})).status,409,'a changed immutable receipt is refused');
 assert.equal((await req(base+'/releases','POST',{name:current,build:'web-2',commits:[{sha:trueSha,files:['../private.js']}]})).status,400,'traversing paths are refused before storage');
 for(const table of ['events','issues','commits','release_commits','suspect_commit_files'])assert.deepEqual((await archiveProjection(await req('/api/archive'))).data[table],receiptBefore[table],'refused receipt changes no '+table);
 const archiveBefore=(await archiveProjection(await req('/api/archive'))).data;
 await json(path,'PUT',{release:current,sha:falseSha,judgment:'rejected',note:'Layout is unrelated. Keep this rejected hypothesis visible.',revision:0});
 await json(path,'PUT',{release:current,sha:trueSha,judgment:'confirmed',note:'Recorded overlap and observed rate increase; reproduction is still required.',revision:0});
 const agent=await json(base+'/keys','POST',{kind:'agent'}),auth={Cookie:'',Authorization:'Bearer '+agent.key};
 const packet=await json(base+'/issues/'+issue.id+'/packet','GET',undefined,auth);
 assert.deepEqual(packet.suspects.candidates.filter(c=>c.release===current).map(c=>[c.sha,c.judgment.judgment,c.judgment.note]).sort(),[[falseSha,'rejected','Layout is unrelated. Keep this rejected hypothesis visible.'],[trueSha,'confirmed','Recorded overlap and observed rate increase; reproduction is still required.']]);
 assert.ok(packet.suspects.provenance.includes('never cause or execution authority'));assert.ok(packet.suspects.learning.includes('exact project'));
 assert.ok(!JSON.stringify(packet.suspects).includes('operator_id'));assert.ok(!JSON.stringify(packet.suspects).includes('layout.js'),'the packet does not disclose unmatched repository paths');
 for(const table of ['events','issues','health_sessions','health_aggregates'])assert.deepEqual((await archiveProjection(await req('/api/archive'))).data[table],archiveBefore[table],'judgment and packet reads leave '+table+' unchanged');
 const foreign=await json('/api/projects','POST',{id:'synthetic-spool-comparison-foreign',name:'Other comparison'}),foreignAgent=await json('/api/projects/'+foreign.id+'/keys','POST',{kind:'agent'});
 assert.equal((await req(base+'/issues/'+issue.id+'/packet','GET',undefined,{Cookie:'',Authorization:'Bearer '+foreignAgent.key})).status,403);
 await json(base+'/keys/'+agent.hash,'DELETE');assert.equal((await req(base+'/issues/'+issue.id+'/packet','GET',undefined,auth)).status,401);
 return {project:p.id,issue:issue.id,base,path,packet,view:await json(path)};
}
