import {untippedIconButtons,openSection} from './navigation.mjs';
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
 const before=(await archiveProjection(await req('/api/archive'))).data;
 await mkdir('.artifacts/rel002',{recursive:true});
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  try{
   await browserSignIn(page,origin);await page.goto(`${origin}/projects/${p.id}/issues/${issue.id}`);
   const panel=page.getByRole('region',{name:'Suspect changes',exact:true});await openSection(page,'Suspect changes');await panel.getByRole('heading',{name:'Release comparison',exact:true}).waitFor();
   const reject=panel.locator('article').filter({has:page.getByRole('heading',{name:new RegExp(falseSha.slice(0,12))})}),confirm=panel.locator('article').filter({has:page.getByRole('heading',{name:new RegExp(trueSha.slice(0,12))})});
   if(width===1440){
    await reject.getByLabel('Evidence note for '+falseSha.slice(0,12),{exact:true}).fill('The layout change does not touch payment confirmation. Older clients show a separate basket failure.');await reject.getByRole('button',{name:'Reject suspect',exact:true}).click();await reject.getByText(/Engineer judgment: rejected/).waitFor();
    await confirm.getByLabel('Evidence note for '+trueSha.slice(0,12),{exact:true}).fill('The first retained failure follows this release. Reproduction evidence is still needed to demonstrate cause.');await confirm.getByRole('button',{name:'Confirm suspect',exact:true}).click();await confirm.getByText(/Engineer judgment: confirmed/).waitFor();
   }else{await panel.getByText(/Engineer judgment: rejected/).waitFor();await panel.getByText(/Engineer judgment: confirmed/).waitFor()}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'suspect view reflows');
   assert.deepEqual((await new AxeBuilder({page}).include('[aria-label="Suspect changes"]').analyze()).violations.filter(v=>['serious','critical'].includes(v.impact)),[]);
   assert.deepEqual(await untippedIconButtons(page),[],'every icon-only control on the touched screen carries the shared tooltip');
   await panel.screenshot({path:`.artifacts/rel002/suspect-judgments-${width}.png`});
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
 console.log('[REL-002] first-release candidates, deployment reason, older-release spike comparison, audited reject/confirm without occurrence changes, restore and erasure; 1440/390 passed');
}
