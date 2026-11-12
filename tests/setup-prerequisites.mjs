import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
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
  console.log('Settings prerequisite guides passed: Slack, cron and Business trust links open locally and anonymously from the docs index.');
 } finally {await context.close();await browser.close();}
}
