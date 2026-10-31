import {traceProposalFixture} from './operator-flow.mjs';
import {testAndReview} from './alerts/runtime.mjs';
import assert from 'node:assert/strict';
/** Runs inside the existing triage browser and uses actual IssueView/ReleasesView. */
export async function operatorUi({page,api,origin,project,issue,capture}){
 const root='/api/projects/'+project;
 const groupingSnapshot=async()=>{const {data}=await api('/api/archive');return Object.fromEntries(['events','issues','event_grouping'].map(table=>[table,data[table].filter(row=>row.project===project)]));};
 const assertMoves=(before,after,plan,undo=false)=>{
  assert.deepEqual(after.events,before.events.map(event=>{
   const move=plan.moves.find(move=>move.event===event.id&&move.occurrence===event.occurrence);
   return move?{...event,issue:undo?move.from:move.to}:event;
  }),'Only the reviewed occurrence memberships change; captured provenance stays immutable');
  for(const planned of plan.issues){
   const saved=after.issues.find(row=>row.id===planned.id);
   assert.equal(saved.count,undo?planned.count:planned.after);
   assert.equal(saved.revision,planned.revision+(undo?2:1));
  }
 };
 const assertProvenance=async(before,plan)=>{
  for(const move of plan.moves){
   const original=before.events.find(row=>row.id===move.event&&row.occurrence===move.occurrence);
   const packet=await api(root+'/issues/'+move.to+'/packet'),event=packet.events.find(row=>row.id===move.event);
   assert.equal(event.originalGrouping.issue,original.issue,'The original issue remains inspectable after apply');
   assert.equal(event.currentGrouping.issue,move.to);
   assert.equal(event.currentGrouping.correction,plan.id);
  }
 };

 await page.goto(`${origin}/projects/${project}/issues/${issue}`);
 await page.getByRole('heading',{name:'Operator decisions',exact:true}).waitFor();
 await page.getByLabel('Assigned to',{exact:true}).fill('Browser operator');
 const [assigned]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/assignment')&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Save assignment',exact:true}).click()]);
 assert.equal(assigned.status(),200);assert.equal((await assigned.json()).label,'Browser operator');
 await page.waitForFunction(()=>{const input=document.querySelector('input[maxlength="80"]');return input&&!input.disabled&&input.value==='Browser operator';});
 const [unassigned]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/assignment')&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Unassign',exact:true}).click()]);
 assert.equal(unassigned.status(),200);assert.equal((await unassigned.json()).label,null);
 await page.waitForFunction(()=>{const input=document.querySelector('input[maxlength="80"]');return input&&!input.disabled&&input.value==='';});
 await page.getByRole('button',{name:'Details: Suppression policies',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
 await dialog.getByRole('button',{name:'Add suppression policy',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('dialog[open]')?.textContent?.includes('Enabled'));
 await dialog.getByRole('button',{name:'Disable policy',exact:true}).click();await page.waitForFunction(()=>document.querySelector('dialog[open]')?.textContent?.includes('Disabled'));
 await page.keyboard.press('Escape');
 const beforeSplitPreview=await groupingSnapshot();
 await page.getByRole('button',{name:'Details: Correct grouping',exact:true}).click();await page.getByRole('dialog').getByRole('checkbox').first().check();
 const [preview]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/corrections/preview')&&r.request().method()==='POST'),page.getByRole('button',{name:'Preview selected-event split',exact:true}).click()]);
 assert.equal(preview.status(),201,JSON.stringify(await preview.json()));assert.equal((await preview.json()).plan.moves.length,1);
 const splitPreview=await preview.json();
 assert.deepEqual(await groupingSnapshot(),beforeSplitPreview,'Issue-view split preview moves no occurrences and changes no aggregates or revisions');

 await page.getByRole('heading',{name:'Review exact moves',exact:true}).waitFor();const before=await api(`/api/projects/${project}/issues/${issue}/packet`);assert.ok(before.events.length);await capture('operator-preview');
 await Promise.all([page.waitForResponse(r=>/\/corrections\/[^/]+\/apply$/.test(r.url())&&r.status()===200),page.getByRole('button',{name:'Apply reviewed correction',exact:true}).click()]);
 assertMoves(beforeSplitPreview,await groupingSnapshot(),splitPreview.plan);
 await assertProvenance(beforeSplitPreview,{...splitPreview.plan,id:splitPreview.id});
 const after=await api(`/api/projects/${project}/issues/${issue}/packet`);assert.equal(after.issue.count,before.issue.count-1);
 await page.getByRole('heading',{name:'Operator decisions',exact:true}).waitFor();await capture('operator-applied');
 assert.equal(await page.getByRole('dialog',{name:'Correct grouping',exact:true}).isVisible(),true,'Applying a correction keeps its review dialog open');
 await page.getByRole('button',{name:'Details: split · applied',exact:true}).click();
 await Promise.all([page.waitForResponse(r=>/\/corrections\/[^/]+\/undo$/.test(r.url())&&r.status()===200),page.getByRole('button',{name:'Undo this correction',exact:true}).click()]);
 const undone=await api(`/api/projects/${project}/issues/${issue}/packet`);assert.equal(undone.issue.count,before.issue.count);await page.getByRole('heading',{name:'Operator decisions',exact:true}).waitFor();await capture('operator-undone');
 const splitUndone=await groupingSnapshot();
 assertMoves(beforeSplitPreview,splitUndone,splitPreview.plan,true);
 for(const original of beforeSplitPreview.events){
  const restored=(await api(root+'/issues/'+original.issue+'/packet')).events.find(event=>event.id===original.id);
  assert.equal(restored.originalGrouping.issue,original.issue,'Original membership stays inspectable after split undo');
 }
 // Merge real captured issues using only the rendered review, apply and undo controls.
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 await page.goto(origin+'/projects/'+project+'/issues/'+issue);
 await page.getByRole('heading',{name:'Operator decisions',exact:true}).waitFor();
 const mergeTarget=(await api(root+'/issues')).find(row=>row.id!==issue&&row.count>0);
 assert.ok(mergeTarget,'A distinct captured failure is available as the merge target');
 const beforeMergePreview=await groupingSnapshot();
 await page.getByRole('button',{name:'Details: Correct grouping',exact:true}).click();
 await page.getByLabel('Merge into issue ID',{exact:true}).fill(mergeTarget.id);
 const [mergeResponse]=await Promise.all([page.waitForResponse(response=>response.url().endsWith('/corrections/preview')&&response.request().method()==='POST'),page.getByRole('button',{name:'Preview issue merge',exact:true}).click()]);
 assert.equal(mergeResponse.status(),201);
 const mergePreview=await mergeResponse.json();
 assert.equal(mergePreview.plan.moves.length,beforeMergePreview.issues.find(row=>row.id===issue).count);
 assert.deepEqual(await groupingSnapshot(),beforeMergePreview,'Issue-view merge preview moves no occurrences and changes no aggregates or revisions');
 await page.getByRole('heading',{name:'Review exact moves',exact:true}).waitFor();
 const reviewText=await page.locator('.correction-review').innerText();
 for(const move of mergePreview.plan.moves)for(const value of [move.event,move.occurrence,move.from,move.to])assert.ok(reviewText.includes(value),'The rendered review names the exact move');
 await capture('operator-merge-preview');
 await Promise.all([page.waitForResponse(response=>response.url().endsWith('/corrections/'+mergePreview.id+'/apply')&&response.status()===200),page.getByRole('button',{name:'Apply reviewed correction',exact:true}).click()]);
 assertMoves(beforeMergePreview,await groupingSnapshot(),mergePreview.plan);
 await assertProvenance(beforeMergePreview,{...mergePreview.plan,id:mergePreview.id});
 await page.getByRole('button',{name:'Details: merge · applied',exact:true}).waitFor();
 await capture('operator-merge-applied');
 await page.getByRole('button',{name:'Details: merge · applied',exact:true}).click();
 await Promise.all([page.waitForResponse(response=>response.url().endsWith('/corrections/'+mergePreview.id+'/undo')&&response.status()===200),page.getByRole('button',{name:'Undo this correction',exact:true}).click()]);
 await page.getByRole('button',{name:'Details: merge · undone',exact:true}).waitFor();
 const mergeUndone=await groupingSnapshot();assertMoves(beforeMergePreview,mergeUndone,mergePreview.plan,true);
 for(const original of beforeMergePreview.events){
  const restored=(await api(root+'/issues/'+original.issue+'/packet')).events.find(event=>event.id===original.id);
  assert.equal(restored.originalGrouping.issue,original.issue,'Original membership stays inspectable after merge undo');
 }
 await capture('operator-merge-undone');
 // Agent proposals use real grants and owner review controls; no application response is substituted.
 const endpoint=root+'/grouping-proposals';
 const contextPacket=await api(`${root}/issues/${issue}/packet`);
 await api(`${root}/issues/${issue}/assignment`,'PATCH',{revision:contextPacket.issue.revision,label:'Dispatch on-call'});
 const repair=await api(root+'/repairs','POST',{issue,link:'https://code.example.test/dispatch/repair',note:'Compare the rebuilt dispatch failure before changing its group.'});
 await api(`${root}/repairs/${repair.id}/facts`,'POST',{revision:repair.revision,fact:'deployed',release:contextPacket.events[0].event.release});
 const destination=await api(root+'/alerting/destinations','POST',{label:'Dispatch on-call',recipient:'dispatch-alerts@example.test'});
 await testAndReview(api,root+'/alerting',destination.id);
 await api(root+'/alerting/rules','POST',{name:'Dispatch recurrence window',enabled:true,channel:'mail',destination:destination.id,kinds:['spike'],windowMs:60000,threshold:2});
 const grant=await api(root+'/keys','POST',{kind:'agent'});
 const propose=async(kind='split')=>{
  const packet=await api(`${root}/issues/${issue}/packet`),now=Date.now();
  const change=kind==='split'?{events:[packet.events[0].id]}:{policy:{version:1,stack:'',fingerprint:'message:* -> operator-proposal'},policyRevision:(await api(root+'/grouping-rules')).revision};
  const response=await fetch(origin+endpoint,{method:'POST',headers:{Authorization:`Bearer ${grant.key}`,'Content-Type':'application/json'},body:JSON.stringify({kind,source:issue,revision:packet.issue.revision,...change,variants:[{stack:'prepareDelivery at dispatch.js',release:'autumn-deliveries',route:'/checkout'}],rationale:'Compare rebuilt delivery failures and look-alike routes before changing grouping.',window:{start:now-86400000,end:now}})});
  assert.equal(response.status,201,'Agent can propose without moving retained events');return response.json();
 };
 const review=async proposal=>{await page.getByRole('button',{name:'Refresh grouping proposals',exact:true}).click();await page.getByRole('button',{name:`Review grouping proposal ${proposal.id}`,exact:true}).click();await page.getByRole('article',{name:'Grouping proposal review',exact:true}).getByText(proposal.id,{exact:true}).waitFor();};
 const proposalPanel=page.locator('.grouping-proposals');
 const proposalReview=page.getByRole('article',{name:'Grouping proposal review',exact:true});
 await page.goto(`${origin}/projects/${project}/settings`);
 await page.getByRole('heading',{name:'Agent grouping proposals',exact:true}).waitFor();await page.getByText('No agent grouping proposals yet.',{exact:true}).waitFor();await capture('grouping-proposal-empty');
 const rejected=await propose();await review(rejected);
 await proposalReview.getByRole('heading',{name:'Counterexamples inside the group',exact:true}).waitFor();assert.match(await proposalReview.innerText(),/proposed by agent /);
 const explained=await api(endpoint+'/'+rejected.id);assert.ok(explained.explanation.counterexamples.inside.length,'Real retained variants provide counterexamples');assert.ok(explained.explanation.counterexamples.outside.length,'Look-alike retained events remain visible');
 await capture('grouping-proposal-proposed');
 await proposalReview.getByRole('button',{name:'Reject grouping proposal',exact:true}).click();await proposalReview.getByRole('heading',{name:'split proposal · rejected',exact:true}).waitFor();await capture('grouping-proposal-rejected');
 assert.equal((await api(endpoint+'/'+rejected.id)).state,'rejected');
 const candidate=await propose();await review(candidate);const originalPacket=await api(`${root}/issues/${issue}/packet`),originalCount=originalPacket.issue.count;
 await proposalReview.getByRole('button',{name:'Approve proposal and open preview',exact:true}).click();await proposalReview.getByRole('heading',{name:'Review exact moves',exact:true}).waitFor();
 assert.equal((await api(`${root}/issues/${issue}/packet`)).issue.count,originalCount,'Approval only opens a preview');await capture('grouping-proposal-approved');
 await proposalReview.getByRole('button',{name:'Apply reviewed correction',exact:true}).click();await proposalReview.getByRole('heading',{name:'split proposal · applied',exact:true}).waitFor();assert.equal((await api(`${root}/issues/${issue}/packet`)).issue.count,originalCount-1);await capture('grouping-proposal-applied');
 await proposalReview.getByRole('button',{name:'Details: split · applied',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Undo this correction',exact:true}).click();await proposalReview.getByRole('heading',{name:'split proposal · undone',exact:true}).waitFor();
 await page.keyboard.press('Escape');assert.equal((await api(`${root}/issues/${issue}/packet`)).issue.count,originalCount);await capture('grouping-proposal-undone');
 const restored=await api(`${root}/issues/${issue}/packet`);for(const event of originalPacket.events){assert.deepEqual(restored.events.find(row=>row.id===event.id).event,event.event,'Undo preserves captured originals');}
 const rule=await propose('rule');await review(rule);await proposalReview.getByRole('button',{name:'Approve proposal and open preview',exact:true}).click();
 await page.getByText('Approved agent rule proposal opened for review. Save grouping rules explicitly to change later intake.',{exact:true}).waitFor();assert.equal((await api(endpoint+'/'+rule.id)).state,'approved');await capture('grouping-rule-approved');
 await page.getByRole('button',{name:'Save grouping rules',exact:true}).click();await page.getByRole('status').filter({hasText:'Grouping rules saved at revision'}).waitFor();assert.equal((await api(endpoint+'/'+rule.id)).state,'applied');await capture('grouping-rule-applied');
 await page.getByLabel('Previous grouping policy',{exact:true}).selectOption('0');await page.getByRole('button',{name:'Preview grouping rules',exact:true}).click();await page.getByText('Grouping preview complete. No occurrences moved.',{exact:true}).waitFor();await page.getByRole('button',{name:'Save grouping rules',exact:true}).click();await page.getByRole('status').filter({hasText:'Grouping rules saved at revision'}).waitFor();
 assert.equal((await api(endpoint+'/'+rule.id)).state,'undone');await capture('grouping-rule-undone');
 const stale=await propose();await review(stale);const current=await api(`${root}/issues/${issue}/packet`);await api(`${root}/issues/${issue}/assignment`,'PATCH',{revision:current.issue.revision,label:'Newer operator decision'});
 await proposalReview.getByRole('button',{name:'Approve proposal and open preview',exact:true}).click();await proposalReview.getByRole('heading',{name:'split proposal · stale',exact:true}).waitFor();await capture('grouping-proposal-stale');assert.equal((await api(endpoint+'/'+stale.id)).state,'stale');
 // The retained-Sentry comparison is visible beside the existing variants.
 const traceRequest=(path,method='GET',value,headers={})=>fetch(origin+path,{method,headers:{'Content-Type':'application/json',...headers},...(value?{body:JSON.stringify(value)}:{})});
 const traceJson=async(path,method,value,headers)=>{if(!headers)return api(path,method,value);const response=await traceRequest(path,method,value,headers);assert.ok(response.ok);return response.json();};
 const traceFixture=await traceProposalFixture({req:traceRequest,json:traceJson},'synthetic-spool-ui-traces'),traceProposal=(await traceFixture.submit()).proposal;
 await page.goto(origin+'/projects/'+traceFixture.project.id+'/settings');
 await page.getByRole('button',{name:'Review grouping proposal '+traceProposal.id,exact:true}).click();
 await proposalReview.getByRole('heading',{name:'Trace comparison',exact:true}).waitFor();
 const traceAffected=proposalReview.locator('.grouping-explanation > ol > li'),firstTrace=traceAffected.nth(0),differentTrace=traceAffected.nth(2);
 const traceInside=proposalReview.getByRole('heading',{name:'Counterexamples inside the group',exact:true}).locator('+ ul');
 const traceOutside=proposalReview.getByRole('heading',{name:'Look-alike events outside the group',exact:true}).locator('+ ul');
 if(page.viewportSize().width===1440){
 assert.equal(await traceAffected.count(),8);
 assert.ok((await firstTrace.innerText()).includes(traceFixture.traceA));assert.match(await firstTrace.innerText(),/same as reference/);
 assert.ok((await differentTrace.innerText()).includes(traceFixture.traceB));assert.match(await differentTrace.innerText(),/different from reference/);
 assert.match(await traceAffected.nth(3).innerText(),/unavailable: no retained trace context/);assert.match(await traceAffected.nth(5).innerText(),/unavailable: trace identity is not a nonzero/);
 assert.ok(!(await proposalReview.innerText()).includes(traceFixture.privateContext));
 assert.match(await traceInside.innerText(),/Differs in: trace/);assert.ok((await traceInside.innerText()).includes(traceFixture.ids[2]));
 for(const id of traceFixture.ids.slice(8))assert.ok((await traceOutside.innerText()).includes(id));
 assert.match(await traceOutside.innerText(),/native event has no Sentry trace context/);
 }
 await proposalReview.getByRole('heading',{name:'Trace comparison',exact:true}).evaluate(element=>element.scrollIntoView({block:'start'}));await capture('operator-trace-comparison');
 await firstTrace.evaluate(element=>element.scrollIntoView({block:'start'}));await capture('operator-trace-affected');
 await traceAffected.nth(3).evaluate(element=>element.scrollIntoView({block:'start'}));await capture('operator-trace-unavailable');
 await traceInside.evaluate(element=>element.scrollIntoView({block:'start'}));await capture('operator-trace-counterexamples');
 await traceOutside.evaluate(element=>element.scrollIntoView({block:'start'}));await capture('operator-trace-outside');
 for(const control of await proposalReview.getByRole('button').all())if(!await control.innerText())assert.ok(await control.getAttribute('aria-label'),'Icon controls retain an accessible label');
 console.log('PROBE CTX-001 UI: owner Settings proposal review -> affected traces, trace-only counterexample, outside look-alikes and explicit native or missing reasons visible.');
 // Expire the browser authority at the real auth boundary while leaving the owner API harness intact.
 await page.context().clearCookies();await page.getByRole('button',{name:'Refresh grouping proposals',exact:true}).click();await page.getByRole('link',{name:'Sign in again',exact:true}).waitFor();await capture('grouping-proposal-denied');

}
