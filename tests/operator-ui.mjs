import {testAndReview} from './alerts/runtime.mjs';
import {reviewRule} from './alerts/preview-rule.mjs';
import assert from 'node:assert/strict';
/** Runs inside the existing triage browser and uses actual IssueView/ReleasesView. */
export async function operatorUi({page,api,origin,project,issue,capture}){
 const root='/api/projects/'+project;
 await api(root+'/alerting/digest-settings','PUT',{timezone:'America/New_York',destination:null,daily:false,weekly:false,personal_daily:false,personal_weekly:false,hour:9,quiet_start:null,quiet_end:null});
 const readable=async locator=>assert.doesNotMatch(await locator.innerText(),/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b|\b[0-9a-f]{24,}\b|\{\s*"(?:id|plan|moves)"/i,'Readable grouping content excludes storage identities and JSON');
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
 const assignment=page.getByLabel('Assigned to',{exact:true});
 if(page.viewportSize().width===1440){
 const beforeAssignment=await api(root+'/operator-state');
 await assignment.fill('dev.lead@example.com');
 const [refused]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/assignment')&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Save assignment',exact:true}).click()]);
 assert.equal(refused.status(),400);const refusal=await refused.json();assert.match(refusal.error,/email/i,'The public route explains why the value is refused');
 await page.getByRole('alert').filter({hasText:refusal.error}).waitFor();
 assert.equal(await assignment.inputValue(),'dev.lead@example.com','A refused assignment preserves the draft');
 assert.equal(await assignment.getAttribute('aria-invalid'),'true');
 assert.deepEqual((await api(root+'/operator-state')).assignments,beforeAssignment.assignments,'Refused private data changes no assignment');
 }
 await assignment.fill('Browser operator');
 const [assigned]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/assignment')&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Save assignment',exact:true}).click()]);
 assert.equal(assigned.status(),200);assert.equal((await assigned.json()).label,'Browser operator');
 if(page.viewportSize().width===1440)await page.getByRole('status').filter({hasText:/assignment.*saved/i}).waitFor();
 await page.waitForFunction(()=>{const input=document.querySelector('input[maxlength="80"]');return input&&!input.disabled&&input.value==='Browser operator';});
 if(page.viewportSize().width===1440){await page.reload();await page.waitForFunction(()=>{const input=document.querySelector('input[maxlength="80"]');return input&&!input.disabled&&input.value==='Browser operator';});}
 const [unassigned]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/assignment')&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Unassign',exact:true}).click()]);
 assert.equal(unassigned.status(),200);assert.equal((await unassigned.json()).label,null);
 await page.waitForFunction(()=>{const input=document.querySelector('input[maxlength="80"]');return input&&!input.disabled&&input.value==='';});
 await page.getByRole('button',{name:'Details: Suppression policies',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
 await dialog.getByRole('button',{name:'Add suppression policy',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('dialog[open]')?.textContent?.includes('Enabled'));
 await dialog.getByRole('button',{name:'Disable policy',exact:true}).click();await page.waitForFunction(()=>document.querySelector('dialog[open]')?.textContent?.includes('Disabled'));
 await page.keyboard.press('Escape');
 const beforeSplitList=await api(root+'/issue-search');
 const beforeSplitOwnership=(await api('/api/reports?projects='+project)).ownership.unowned;
 const beforeSplitPreview=await groupingSnapshot();
 await page.getByRole('button',{name:'Details: Correct grouping',exact:true}).click();await page.getByRole('dialog').getByRole('checkbox').first().check();
 const [preview]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/corrections/preview')&&r.request().method()==='POST'),page.getByRole('button',{name:'Preview selected-event split',exact:true}).click()]);
 assert.equal(preview.status(),201,JSON.stringify(await preview.json()));assert.equal((await preview.json()).plan.moves.length,1);
 const splitPreview=await preview.json();
 assert.deepEqual(await groupingSnapshot(),beforeSplitPreview,'Issue-view split preview moves no occurrences and changes no aggregates or revisions');

 await page.getByRole('heading',{name:'Review exact moves',exact:true}).waitFor();
 if(page.viewportSize().width===1440){
  await readable(page.getByRole('dialog',{name:'Correct grouping',exact:true}));
  const current=await api(root+'/issues/'+issue+'/packet');
  assert.ok((await page.locator('.correction-review').innerText()).includes(current.issue.short_id));
  const selected=current.events.find(event=>event.id===splitPreview.plan.moves[0].event);
  assert.ok((await page.locator('.correction-review').innerText()).includes(selected.event.release));
  const href=await page.locator('.correction-review ol a').first().getAttribute('href');
  assert.equal(new URL(href,origin).searchParams.get('occurrence'),selected.occurrence);
  assert.equal(new URL(href,origin).searchParams.get('event'),selected.id);
  assert.ok((await page.getByRole('dialog',{name:'Correct grouping',exact:true}).locator('fieldset').innerText()).includes('America/New_York'),'The picker uses the project timezone');
  const record=await page.context().newPage();await record.goto(origin+href);await record.locator(`.metadata[data-event-id="${selected.id}"]`).waitFor();assert.equal(new URL(record.url()).searchParams.get('occurrence'),selected.occurrence);await record.close();
 }
 const before=await api(`/api/projects/${project}/issues/${issue}/packet`);assert.ok(before.events.length);await capture('operator-preview');
 await Promise.all([page.waitForResponse(r=>/\/corrections\/[^/]+\/apply$/.test(r.url())&&r.status()===200),page.getByRole('button',{name:'Apply reviewed correction',exact:true}).click()]);
 assertMoves(beforeSplitPreview,await groupingSnapshot(),splitPreview.plan);
 await assertProvenance(beforeSplitPreview,{...splitPreview.plan,id:splitPreview.id});
 const after=await api(`/api/projects/${project}/issues/${issue}/packet`);assert.equal(after.issue.count,before.issue.count-1);
 await page.getByRole('heading',{name:'Operator decisions',exact:true}).waitFor();await capture('operator-applied');
 assert.equal(await page.getByRole('dialog',{name:'Correct grouping',exact:true}).isVisible(),true,'Applying a correction keeps its review dialog open');
 await page.getByRole('button',{name:'Details: split · applied',exact:true}).click();
 if(page.viewportSize().width===1440){
  const history=page.getByRole('dialog',{name:'split · applied',exact:true});await readable(history);
  assert.equal(await history.locator('pre').count(),0);
  const native=(await api(root+'/operator-state')).audit.find(row=>row.kind==='grouping_applied'&&JSON.parse(row.detail).correction===splitPreview.id);
  assert.ok((await history.innerText()).includes(native.personActor.person.name),'History names the actual person who applied this correction');
  await history.getByRole('button',{name:'Copy details',exact:true}).click();
  assert.equal(JSON.parse(await page.evaluate(()=>navigator.clipboard.readText())).id,splitPreview.id,'Copy details preserves the exact raw record');
 }

 await Promise.all([page.waitForResponse(r=>/\/corrections\/[^/]+\/undo$/.test(r.url())&&r.status()===200),page.getByRole('button',{name:'Undo this correction',exact:true}).click()]);
 const undone=await api(`/api/projects/${project}/issues/${issue}/packet`);assert.equal(undone.issue.count,before.issue.count);await page.getByRole('heading',{name:'Operator decisions',exact:true}).waitFor();await capture('operator-undone');
 const splitUndone=await groupingSnapshot();
 assertMoves(beforeSplitPreview,splitUndone,splitPreview.plan,true);
 for(const original of beforeSplitPreview.events){
  const restored=(await api(root+'/issues/'+original.issue+'/packet')).events.find(event=>event.id===original.id);
  assert.equal(restored.originalGrouping.issue,original.issue,'Original membership stays inspectable after split undo');
 }
 if(page.viewportSize().width===1440){
  const list=await api(root+'/issue-search');
  assert.equal(list.total,beforeSplitList.total,'undo restores the ordinary issue count');
  assert.deepEqual(list.facets.statuses,beforeSplitList.facets.statuses,'undo restores open issue counts');
  assert.equal((await api('/api/reports?projects='+project)).ownership.unowned,beforeSplitOwnership,'undo restores unowned counts');
  assert.ok(!list.rows.some(row=>row.id===splitPreview.plan.target));
  await page.goto(origin+'/projects/'+project+'/issues');
  await page.locator('.issue-counts').waitFor();
  await page.waitForFunction(()=>!document.querySelector('.issue-counts')?.textContent.includes('…'));
  assert.equal(await page.locator('.issue-open').count(),list.rows.length);
  assert.equal(await page.locator('.issue-counts').getByText('Open',{exact:true}).locator('..').locator('strong').textContent(),String(list.facets.statuses.find(row=>row.value==='open')?.count??0));
  await capture('operator-undone-list');
 }
 // Merge real captured issues using only the rendered review, apply and undo controls.
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 await page.goto(origin+'/projects/'+project+'/issues/'+issue);
 await page.getByRole('heading',{name:'Operator decisions',exact:true}).waitFor();
 const mergeTarget=(await api(root+'/issues')).find(row=>row.id!==issue&&row.count>0);
 assert.ok(mergeTarget,'A distinct captured failure is available as the merge target');
 const beforeMergePreview=await groupingSnapshot();
 await page.getByRole('button',{name:'Details: Correct grouping',exact:true}).click();
 await page.getByLabel('Merge into issue ID',{exact:true}).fill(mergeTarget.short_id);
 const [mergeResponse]=await Promise.all([page.waitForResponse(response=>response.url().endsWith('/corrections/preview')&&response.request().method()==='POST'),page.getByRole('button',{name:'Preview issue merge',exact:true}).click()]);
 assert.equal(mergeResponse.status(),201);
 const mergePreview=await mergeResponse.json();
 assert.equal(mergePreview.plan.moves.length,beforeMergePreview.issues.find(row=>row.id===issue).count);
 assert.deepEqual(await groupingSnapshot(),beforeMergePreview,'Issue-view merge preview moves no occurrences and changes no aggregates or revisions');
 await page.getByRole('heading',{name:'Review exact moves',exact:true}).waitFor();
 const reviewText=await page.locator('.correction-review').innerText();
 if(page.viewportSize().width===1440){
  await readable(page.locator('.correction-review'));
  for(const planned of mergePreview.plan.issues){const packet=await api(root+'/issues/'+planned.id+'/packet');assert.ok(reviewText.includes(packet.issue.short_id),'The review identifies each real issue');}
  const links=await page.locator('.correction-review ol a').evaluateAll(rows=>rows.map(row=>row.href));
  for(const move of mergePreview.plan.moves)assert.ok(links.some(href=>{const url=new URL(href);return url.searchParams.get('event')===move.event&&url.searchParams.get('occurrence')===move.occurrence}),'Each readable move links the exact occurrence');
 }
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
 await api(root+'/alerting/rules','POST',await reviewRule(api,root+'/alerting/rules','POST',{name:'Dispatch recurrence window',enabled:true,channel:'mail',destination:destination.id,kinds:['spike'],windowMs:60000,threshold:2}));
 const grant=await api(root+'/keys','POST',{kind:'agent'});
 const propose=async(kind='split')=>{
  const packet=await api(`${root}/issues/${issue}/packet`),now=Date.now();
  const change=kind==='split'?{events:[packet.events[0].id]}:{policy:{version:1,stack:'',fingerprint:'message:* -> operator-proposal'},policyRevision:(await api(root+'/grouping-rules')).revision};
  const response=await fetch(origin+endpoint,{method:'POST',headers:{Authorization:`Bearer ${grant.key}`,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({kind,source:issue,revision:packet.issue.revision,...change,variants:[{stack:'prepareDelivery at dispatch.js',release:'autumn-deliveries',route:'/checkout'}],rationale:'Compare rebuilt delivery failures and look-alike routes before changing grouping.',window:{start:now-86400000,end:now}})});
  assert.equal(response.status,201,'Agent can propose without moving retained events');return response.json();
 };
 // The section reads quietly and again on return to the tab; a window focus is that return.
 const review=async proposal=>{await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator(`[data-proposal-id="${proposal.id}"]`).getByRole('button',{name:/^Review (split|merge|rule) proposal/}).click();await page.locator(`article[data-proposal-id="${proposal.id}"]`).waitFor();};
 const proposalPanel=page.locator('.grouping-proposals');
 const proposalReview=page.getByRole('article',{name:'Grouping proposal review',exact:true});
 await page.goto(`${origin}/projects/${project}/settings#settings-processing`);
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
 await page.getByText('Approved agent rule proposal opened for review. Apply grouping rules explicitly to change later intake.',{exact:true}).waitFor();assert.equal((await api(endpoint+'/'+rule.id)).state,'approved');await capture('grouping-rule-approved');
 await page.getByRole('button',{name:'Apply grouping rules',exact:true}).click();await page.locator('.save-mark[data-state="saved"]').waitFor();assert.equal((await api(endpoint+'/'+rule.id)).state,'applied');await capture('grouping-rule-applied');
 await page.getByLabel('Previous grouping policy',{exact:true}).selectOption('0');await page.getByRole('button',{name:'Preview grouping rules',exact:true}).click();await page.getByText('Grouping preview complete. No occurrences moved.',{exact:true}).waitFor();await page.getByRole('button',{name:'Apply grouping rules',exact:true}).click();await page.locator('.save-mark[data-state="saved"]').waitFor();
 assert.equal((await api(endpoint+'/'+rule.id)).state,'undone');await capture('grouping-rule-undone');
 const stale=await propose();await review(stale);const current=await api(`${root}/issues/${issue}/packet`);await api(`${root}/issues/${issue}/assignment`,'PATCH',{revision:current.issue.revision,label:'Newer operator decision'});
 await proposalReview.getByRole('button',{name:'Approve proposal and open preview',exact:true}).click();await proposalReview.getByRole('heading',{name:'split proposal · stale',exact:true}).waitFor();await capture('grouping-proposal-stale');assert.equal((await api(endpoint+'/'+stale.id)).state,'stale');
 // Expire the browser authority at the real auth boundary while leaving the owner API harness intact.
 await page.context().clearCookies();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('link',{name:'Sign in again',exact:true}).waitFor();await capture('grouping-proposal-denied');

}
