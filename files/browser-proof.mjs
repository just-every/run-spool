import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
const root=process.cwd(), base=process.env.PROOF_PACKET;
const {alertRuntime,setup,event}=await import(root+'/tests/alerts/runtime.mjs');
const {receiver}=await import(root+'/tests/alerts/receiver.mjs');
const {launchBrowser}=await import(root+'/tests/browser-launch.mjs');
const {workbenchLink}=await import(root+'/tests/navigation.mjs');
const mode=process.env.PROOF_MODE||'before';
const temp=await mkdtemp(resolve(tmpdir(),'silent-save-proof-'));let app,browser;
const receipt={mode,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),widths:[],checks:['Refused assignment returns a reason visible beside retained text','Plain name saves with confirmation and survives reload','Reviewed test plus valid form names the preview step once','Preview enables Create rule and persistence succeeds']};
try{
 const inbox=await receiver(resolve(temp,'receiver.sqlite'));
 try{
  app=await alertRuntime(inbox);const auth=await setup(app);
  const admitted=await app.json('/api/ingest/web','POST',event('synthetic-spool-silent-save'),auth);
  const issues=await app.json('/api/projects/web/issues');const issue=admitted.issue??issues[0].id;
  browser=await launchBrowser();
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000}});await context.addCookies([{name:app.cookie.split('=')[0],value:app.cookie.split('=')[1],url:app.origin}]);
   const page=await context.newPage();page.setDefaultTimeout(15000);
   const assignment=async(label)=>{
    await page.getByLabel('Assigned to',{exact:true}).fill(label);
    const [response]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/assignment')&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Save assignment',exact:true}).click()]);
    return {status:response.status(),body:await response.json()};
   };
   await page.goto(`${app.origin}/projects/web/issues/${issue}`);
   const refused=await assignment('dev.lead@example.com');
   await page.getByRole('heading',{name:'Operator decisions',exact:true}).scrollIntoViewIfNeeded();
   if(mode==='after'){
    assert.equal(refused.status,400);assert.ok(refused.body.error);await page.getByRole('alert').filter({hasText:refused.body.error}).waitFor();
    assert.equal(await page.getByLabel('Assigned to',{exact:true}).inputValue(),'dev.lead@example.com');
   }
   await page.screenshot({path:`${base}/${mode}-assignment-refused-${width}.png`});
   const saved=await assignment('Priya Nair');assert.equal(saved.status,200);
   if(mode==='after')await page.locator('[role=status]').filter({hasText:'Assignment saved'}).waitFor();
   await page.screenshot({path:`${base}/${mode}-assignment-saved-${width}.png`});
   await page.reload();await page.waitForFunction(()=>document.querySelector('input[maxlength="80"]')?.value==='Priya Nair');
   await (await workbenchLink(page,'Alerts')).click();await page.getByRole('button',{name:'Rules',exact:true}).click();
   await page.getByLabel('Destination name',{exact:true}).fill(`On call ${width}`);await page.getByLabel('Destination email',{exact:true}).fill(`oncall-${width}@example.com`);await page.getByRole('button',{name:'Add destination',exact:true}).click();
   await page.getByRole('button',{name:`Test On call ${width}`,exact:true}).click();await page.getByRole('button',{name:`Review passing test for On call ${width}`,exact:true}).click();await page.locator('.alert-records>li').filter({has:page.getByRole('button',{name:`Test On call ${width}`,exact:true})}).getByText('Passing result reviewed',{exact:true}).waitFor();
   await page.getByLabel('Rule name',{exact:true}).fill(`Regression ${width}`);await page.getByRole('combobox',{name:'Destination',exact:true}).selectOption({label:`On call ${width} · Email`});await page.getByLabel('Regression',{exact:true}).check();
   const create=page.getByRole('button',{name:'Create rule',exact:true});const disabled=await create.isDisabled();
   if(mode==='after'){
    const hint=page.locator('#rule-readiness');await hint.waitFor();assert.match(await hint.innerText(),/preview/i);assert.equal(await hint.count(),1);await page.locator('.alert-rules').screenshot({path:`${base}/${mode}-rules-needs-preview-${width}.png`});
    await page.getByRole('button',{name:'Preview rule',exact:true}).click();await page.getByRole('region',{name:'Rule preview',exact:true}).waitFor();assert.equal(await create.isEnabled(),true);await page.locator('.alert-rules').screenshot({path:`${base}/${mode}-rules-ready-${width}.png`});await create.click();await page.getByRole('button',{name:`Edit Regression ${width}`,exact:true}).waitFor();
   }
   const boxes=await page.locator('.alert-rules h3, .alert-rules .form-field').evaluateAll(nodes=>nodes.slice(0,3).map(n=>({text:n.textContent,top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom})));
   await page.getByRole('heading',{name:'Per-project rules',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:`${base}/${mode}-rules-${width}.png`,fullPage:true});
   receipt.widths.push({width,refused,saved,createDisabledBeforePreview:disabled,boxes});await context.close();
  }
 }finally{await browser?.close();await app?.close();await inbox.close();}
 receipt.status='passed';
}finally{await writeFile(`${base}/${mode}-browser-receipt.json`,JSON.stringify(receipt,null,2)+'\n');await rm(temp,{recursive:true,force:true});}
console.log(JSON.stringify(receipt));
