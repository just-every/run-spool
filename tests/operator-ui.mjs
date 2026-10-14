import assert from 'node:assert/strict';
/** Runs inside the existing triage browser and uses actual IssueView/ReleasesView. */
export async function operatorUi({page,api,origin,project,issue,capture}){
 await page.goto(`${origin}/projects/${project}/issues/${issue}`);
 await page.getByRole('heading',{name:'Operator decisions',exact:true}).waitFor();
 await page.getByLabel('Assigned operator label',{exact:true}).fill('Browser operator');await Promise.all([page.waitForResponse(r=>r.url().endsWith('/assignment')&&r.request().method()==='PATCH'&&r.status()===200),page.getByRole('button',{name:'Save assignment',exact:true}).click()]);
 await page.getByLabel('Assigned operator label',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Unassign',exact:true}).click();await page.waitForFunction(()=>document.querySelector('input[maxlength="80"]')?.value==='');
 await page.getByRole('button',{name:'Details: Suppression policies',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
 await dialog.getByRole('button',{name:'Add suppression policy',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('dialog[open]')?.textContent?.includes('Enabled'));
 await dialog.getByRole('button',{name:'Disable policy',exact:true}).click();await page.waitForFunction(()=>document.querySelector('dialog[open]')?.textContent?.includes('Disabled'));
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Details: Correct grouping',exact:true}).click();await page.getByRole('dialog').getByRole('checkbox').first().check();await page.getByRole('button',{name:'Preview selected-event split',exact:true}).click();
 await page.getByRole('heading',{name:'Review exact moves',exact:true}).waitFor();const before=await api(`/api/projects/${project}/issues/${issue}/packet`);assert.ok(before.events.length);await capture('operator-preview');
 await Promise.all([page.waitForResponse(r=>/\/corrections\/[^/]+\/apply$/.test(r.url())&&r.status()===200),page.getByRole('button',{name:'Apply reviewed correction',exact:true}).click()]);
 const after=await api(`/api/projects/${project}/issues/${issue}/packet`);assert.equal(after.issue.count,before.issue.count-1);
 await page.getByRole('heading',{name:'Operator decisions',exact:true}).waitFor();await capture('operator-applied');
 await page.getByRole('button',{name:'Details: Correct grouping',exact:true}).click();
 await page.getByRole('button',{name:'Details: split · applied',exact:true}).click();
 await Promise.all([page.waitForResponse(r=>/\/corrections\/[^/]+\/undo$/.test(r.url())&&r.status()===200),page.getByRole('button',{name:'Undo this correction',exact:true}).click()]);
 const undone=await api(`/api/projects/${project}/issues/${issue}/packet`);assert.equal(undone.issue.count,before.issue.count);await page.getByRole('heading',{name:'Operator decisions',exact:true}).waitFor();await capture('operator-undone');
}
