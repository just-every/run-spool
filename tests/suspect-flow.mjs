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
  }finally{await context.close()}
 }
 const after=(await archiveProjection(await req('/api/archive'))).data;
 for(const table of ['events','issues'])assert.deepEqual(after[table],before[table],`judgment changes no ${table}`);
 assert.deepEqual(after.suspect_decisions.filter(r=>r.project===p.id).map(r=>r.judgment).sort(),['confirmed','rejected']);
 assert.equal(after.audit.filter(r=>r.kind==='suspect_judged'&&r.project===p.id).length,2,'one audited entry per judgment');
 const denied=await json(base+'/keys','POST',{kind:'agent'});
 assert.equal((await req(path,'PUT',{release:current,sha:falseSha,judgment:'confirmed',note:'denied',revision:1},{Cookie:'',Authorization:`Bearer ${denied.key}`})).status,403);
 const snapshot=await archiveProjection(await req('/api/archive'));let restored;
 try{restored=await startTestWorker(15554);const cookie=await signIn(restored.origin);const r=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Cookie:cookie,Origin:restored.origin,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:snapshot.text});assert.ok(r.ok,await r.text());const copied=await archiveProjection(await fetch(restored.origin+'/api/archive',{headers:{Cookie:cookie}}));assert.deepEqual(copied.data.suspect_decisions,snapshot.data.suspect_decisions,'restore preserves both judgments as inert records')}finally{await restored?.stop()}
 const plan=await json(base+'/erasure');assert.equal(plan.deleted.suspect_decisions,2);await followErasure(json,await json(base+'/erasure','POST',{confirm:p.id,planHash:plan.planHash}));
 assert.ok(!(await archiveProjection(await req('/api/archive'))).data.suspect_decisions.some(r=>r.project===p.id));
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
