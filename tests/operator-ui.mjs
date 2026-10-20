import assert from 'node:assert/strict';
/** Runs inside the existing triage browser and uses actual IssueView/ReleasesView. */
export async function operatorUi({page,api,origin,project,issue,capture}){
 await page.goto(`${origin}/projects/${project}/issues/${issue}`);
 await page.getByRole('heading',{name:'Operator decisions',exact:true}).waitFor();
 await page.getByLabel('Assigned operator label',{exact:true}).fill('Browser operator');
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
 await page.getByRole('button',{name:'Details: Correct grouping',exact:true}).click();await page.getByRole('dialog').getByRole('checkbox').first().check();
 const [preview]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/corrections/preview')&&r.request().method()==='POST'),page.getByRole('button',{name:'Preview selected-event split',exact:true}).click()]);
 assert.equal(preview.status(),201,JSON.stringify(await preview.json()));assert.equal((await preview.json()).plan.moves.length,1);
 await page.getByRole('heading',{name:'Review exact moves',exact:true}).waitFor();const before=await api(`/api/projects/${project}/issues/${issue}/packet`);assert.ok(before.events.length);await capture('operator-preview');
 await Promise.all([page.waitForResponse(r=>/\/corrections\/[^/]+\/apply$/.test(r.url())&&r.status()===200),page.getByRole('button',{name:'Apply reviewed correction',exact:true}).click()]);
 const after=await api(`/api/projects/${project}/issues/${issue}/packet`);assert.equal(after.issue.count,before.issue.count-1);
 await page.getByRole('heading',{name:'Operator decisions',exact:true}).waitFor();await capture('operator-applied');
 await page.getByRole('button',{name:'Details: Correct grouping',exact:true}).click();
 await page.getByRole('button',{name:'Details: split · applied',exact:true}).click();
 await Promise.all([page.waitForResponse(r=>/\/corrections\/[^/]+\/undo$/.test(r.url())&&r.status()===200),page.getByRole('button',{name:'Undo this correction',exact:true}).click()]);
 const undone=await api(`/api/projects/${project}/issues/${issue}/packet`);assert.equal(undone.issue.count,before.issue.count);await page.getByRole('heading',{name:'Operator decisions',exact:true}).waitFor();await capture('operator-undone');
 // Agent proposals use real grants and owner review controls; no application response is substituted.
 const root=`/api/projects/${project}`,endpoint=root+'/grouping-proposals';
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
 // Expire the browser authority at the real auth boundary while leaving the owner API harness intact.
 await page.context().clearCookies();await page.getByRole('button',{name:'Refresh grouping proposals',exact:true}).click();await page.getByRole('link',{name:'Sign in again',exact:true}).waitFor();await capture('grouping-proposal-denied');

}
