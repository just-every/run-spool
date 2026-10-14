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
}
