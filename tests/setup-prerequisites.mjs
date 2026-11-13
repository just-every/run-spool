import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {launchBrowser} from './browser-launch.mjs';
import {openGate} from './auth.mjs';

// Extend the existing runtime journey: follow each missing prerequisite from
// the owner's Settings surface into an anonymous, on-site Markdown guide.
export async function settingsPrerequisiteGuides(origin,cookie,project) {
 const browser=await launchBrowser(),context=await browser.newContext({viewport:{width:1440,height:900}});
 const directory='.artifacts/setup-prerequisites';await mkdir(directory,{recursive:true});
 try {
  await openGate(context,origin);
  await context.addCookies([{name:cookie.slice(0,cookie.indexOf('=')),value:cookie.slice(cookie.indexOf('=')+1),url:origin}]);
  const page=await context.newPage();await page.goto(`${origin}/projects/${project}/settings`);
  // Settings opens Organization; follow its section links to reveal each prerequisite.
  const sections=page.getByRole('navigation',{name:'Settings sections',exact:true});
  await sections.getByRole('link',{name:'Issue processing',exact:true}).click();
  const cron=page.getByRole('region',{name:'Cron check-ins',exact:true});
  const slack=page.getByRole('region',{name:'Slack destinations',exact:true});
  await cron.getByRole('status').waitFor();
  async function openGuide(link,scope,name) {
   const href=await link.getAttribute('href'),url=new URL(href,origin);
   assert.equal(url.origin,origin,`${name} stays on this installation`);
   assert.ok(url.pathname.startsWith('/docs/'),`${name} is a published guide`);
   assert.equal(await link.isVisible(),true,`${name} guide is visible at its prerequisite`);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${name} fits desktop`);
   await scope.screenshot({path:`${directory}/${name}-1440.png`});
   // Phone captures show the same changed states, without rerunning the journey.
   await page.setViewportSize({width:390,height:900});await scope.screenshot({path:`${directory}/${name}-390.png`});await page.setViewportSize({width:1440,height:900});
   const opened=context.waitForEvent('page');await link.click({modifiers:['ControlOrMeta']});const guide=await opened;
   try {
    await guide.locator('article').waitFor();
    assert.equal((await guide.locator('article').innerText()).trim().length>0,true,`${name} guide opens`);
    const anonymous=await fetch(url);assert.equal(anonymous.status,200,`${name} guide opens signed out`);await anonymous.body?.cancel();
    if(url.hash)assert.equal(await guide.locator('[id]').evaluateAll((nodes,id)=>nodes.some(node=>node.id===id),url.hash.slice(1)),true,`${name} anchor resolves`);
    const index=await context.request.get(origin+'/docs');assert.equal(index.status(),200);assert.ok((await index.text()).includes(`href="${url.pathname}"`),`${name} is reachable from docs index`);
    const links=await guide.locator('article a').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')).filter(href=>href?.startsWith('/docs')));
    for(const href of new Set(links)){const response=await fetch(new URL(href,origin));assert.equal(response.status,200,href);await response.body?.cancel();}
    if(name==='cron'||name==='slack') {
     const article=guide.locator('article');
     // A required source document must be a navigable link, never just an inline code path.
     const bare=await article.locator('p code,li code').evaluateAll(nodes=>nodes.filter(node=>/\.md(?:#\S*)?$/.test(node.textContent.trim())&&!node.closest('a')).map(node=>node.textContent));
     assert.deepEqual(bare,[],`${name}: required Markdown documents are linked`);
     const ownerSteps=article.getByRole('link',{name:/Base.*owner steps/i});
     assert.equal(await ownerSteps.count(),1,`${name}: Base's owner procedure is reachable`);
     const target=new URL(await ownerSteps.getAttribute('href'));
     const copy=JSON.parse(await readFile('base-copies.json','utf8')).copies.find(row=>row.path.endsWith('/egress-service'));
     assert.equal(target.origin,'https://github.com');
     assert.equal(target.pathname,`/runeditrun/base/blob/${copy.revision}/${copy.originPath}/OWNER-STEPS.md`,`${name}: procedure follows the installed module's source pin`);
     // Exercise the recipe copied from the public page, with private synthetic state.
     // Distinct random receipt fields catch a swapped source or provider identity.
     if(name==='cron') {
      const blocks=await article.locator('pre code').allTextContents();
      const recipe=blocks.map(code=>code.match(/node --input-type=module <<'NODE'\n([\s\S]*?)\nNODE/)).find(Boolean);
      assert.ok(recipe,'published guide provides a runnable receipt-to-binding recipe');
      const directory=await mkdtemp(join(tmpdir(),'spool-egress-guide-'));
      const hosts=['slack.com','synthetic-spool-uptime.example.com'];
      const receipt={source:{sha:randomBytes(20).toString('hex')},fingerprint:randomBytes(32).toString('hex'),provider:{versionId:randomUUID(),deploymentId:randomUUID(),etag:randomUUID()},config:{vars:{EGRESS_GRANTS:JSON.stringify([{entrypoint:'EgressService',allowedHosts:[]},{entrypoint:'EgressRestricted',allowedHosts:hosts}])}},privateValue:'synthetic-spool-private-not-for-binding'};
      try {
       await mkdir(join(directory,'.rer/deploy'),{recursive:true});
       await writeFile(join(directory,'.rer/deploy/egress-production.json'),JSON.stringify({receipt}),{mode:0o600});
       const output=execFileSync(process.execPath,['--input-type=module','--eval',recipe[1]],{cwd:directory,encoding:'utf8'});
       assert.deepEqual(JSON.parse(output),{services:[{binding:'INTEGRATION_EGRESS',project:'runeditrun/egress-service',entrypoint:'EgressRestricted',grant:{allowedHosts:hosts,sourceSha:receipt.source.sha,fingerprint:receipt.fingerprint,provider:receipt.provider}}]},'copied recipe emits only the exact service grant from the selected receipt');
      } finally {await rm(directory,{recursive:true,force:true});}
     }
    }
    await guide.screenshot({path:`${directory}/${name}-guide-1440.png`,fullPage:true});await guide.setViewportSize({width:390,height:900});await guide.screenshot({path:`${directory}/${name}-guide-390.png`,fullPage:true});
   } finally {await guide.close();for(const extra of context.pages())if(extra!==page)await extra.close();}
  }
  await openGuide(cron.getByRole('link',{name:/integration egress/i}),cron,'cron');
  await sections.getByRole('link',{name:'Alerts & integrations',exact:true}).click();
  await openGuide(slack.getByRole('link',{name:/integration egress/i}),slack,'slack');
  await sections.getByRole('link',{name:'Data & archive',exact:true}).click();
  const business=page.locator('section.evidence').filter({has:page.getByText('Business imports',{exact:true})});
  await business.getByRole('button',{name:/Details/}).click();const dialog=page.getByRole('dialog',{name:'Business imports',exact:true});
  await openGuide(dialog.getByRole('link',{name:/configure.*trust/i}),dialog,'business');
  await page.keyboard.press('Escape');
  console.log('Settings prerequisite guides passed: Slack and cron reach pinned Base owner steps and a working receipt-to-binding recipe; Business trust links open locally and anonymously from the docs index.');
 } finally {await context.close();await browser.close();}
}
