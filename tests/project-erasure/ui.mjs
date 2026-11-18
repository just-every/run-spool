import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import {expect} from '@playwright/test';
import {openGate} from '../auth.mjs';
import {scanText} from './scan.mjs';

async function check(page,directory,width,name,captures,needles,projectName=''){
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${name} at ${width}: no horizontal overflow`);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(row=>row.id),[],`${name} at ${width}: axe`);
 // Only the selected project name belongs in the preview; all captured personal values remain absent.
 const section=page.locator('section[aria-labelledby^="erasure"]'),panel=await section.innerText();assert.deepEqual(scanText(panel.replace(`This deletes ${projectName}:`,'This deletes the selected project:'),needles),[],`${name} at ${width}: no personal value`);
 const path=`${directory}/erasure-${name}-${width}.png`;await section.screenshot({path});captures.push(path);
}
// Preview, typed confirmation and receipt by clicking in the Settings panel.
export async function erasePanel(app,browser,directory,{project,width,needles}){
 const captures=[],context=await browser.newContext({viewport:{width,height:900}});
 try{
  await openGate(context,app.origin);
  await context.addCookies(app.cookie.split('; ').filter(Boolean).map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:app.origin})));
  const currentProjects=await (await context.request.get(app.origin+'/api/projects')).json(),projectName=currentProjects.find(row=>row.id===project)?.name;
  assert.equal(typeof projectName,'string');
  const page=await context.newPage();await page.goto(`${app.origin}/projects/${project}/settings#settings-data`);
  await page.getByRole('heading',{name:'Erase this project',exact:true}).waitFor();
  // Let the initial Settings reads finish before binding its destructive preview.
  await page.waitForLoadState('networkidle');
  await page.getByRole('button',{name:'Preview erasure',exact:true}).click();
  await page.getByRole('status').filter({hasText:'This deletes'}).waitFor();if(width===1440)assert.ok((await page.getByRole('status').filter({hasText:'This deletes'}).innerText()).includes(projectName),'preview identifies the selected project by its actual name');if(width===1440)assert.equal(await page.getByRole('button',{name:'Download a backup first',exact:true}).isEnabled(),true);await page.locator('section[aria-labelledby="erasure-title"] details > summary').click();await check(page,directory,width,'preview',captures,needles,projectName);
  const erase=page.getByRole('button',{name:'Delete project',exact:true});
  assert.equal(await erase.isDisabled(),true,'erase stays disabled before typed confirmation');
  await page.getByLabel(`Type ${project} to confirm`,{exact:true}).fill(project.slice(0,-1));assert.equal(await erase.isDisabled(),true,'a partial identifier does not confirm');
  await page.getByLabel(`Type ${project} to confirm`,{exact:true}).fill(project);await check(page,directory,width,'confirmation',captures,needles,projectName);
  let release;const follow= new Promise(resolve=>{release=resolve});
  await page.route('**/api/erasures/*/resume',async route=>{await follow;await route.continue()});
  const started=Date.now();
  const submit=async()=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/projects/${project}/erasure`&&r.request().method()==='POST');await erase.click();return response;};
  // Send an obsolete review hash to the real server: no fixture replaces its refusal.
  if(width===1440)await page.route(app.origin+`/api/projects/${project}/erasure`,async route=>{
   assert.equal(route.request().method(),'POST');
   const reviewed=route.request().postDataJSON();
   await route.continue({postData:JSON.stringify({...reviewed,planHash:'0'.repeat(64)})});
  },{times:1});
  let answer=await submit();
  if(width===1440)assert.equal(answer.status(),409,'an obsolete preview cannot erase under the old confirmation');
  if(answer.status()===409){
   assert.equal((await answer.json()).error,'plan_changed');
   await expect(page.getByRole('alert').filter({hasText:'This project changed.'})).toBeVisible();
   const confirmation=page.getByLabel(`Type ${project} to confirm`,{exact:true});
   await expect(confirmation).toHaveValue('');await expect(erase).toBeDisabled();
   const projects=await app.json('/api/projects');assert.ok(projects.some(row=>row.id===project),'stale confirmation deletes no project');
   if(width===1440){for(const screen of [1440,390]){await page.setViewportSize({width:screen,height:900});const path=`${directory}/erasure-updated-preview-${screen}.png`;await page.locator('section[aria-labelledby="erasure-title"]').screenshot({path});captures.push(path);}await page.setViewportSize({width,height:900});}
   await confirmation.fill(project);answer=await submit();
  }
  const status=answer.status();assert.equal(status,202,`the reviewed erase returns an accepted job (${status===202?'accepted':await answer.text()})`);
  await page.getByRole('heading',{name:'Erasure continuing',exact:true}).waitFor();
  await check(page,directory,width,'progress',captures,needles);
  release();
  await page.waitForFunction(()=>document.querySelector('#erasure-receipt')?.textContent==='Project erased'||document.querySelector('section[aria-labelledby="erasure-receipt"] [role="alert"]'),{},{timeout:300_000});
  assert.equal(await page.locator('section[aria-labelledby="erasure-receipt"] [role="alert"]').count(),0,'the accepted job continues without an error');
  await page.getByRole('heading',{name:'Project erased',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'erasure-receipt','focus moves to the receipt');
  await check(page,directory,width,'receipt',captures,needles);
  const projects=await (await context.request.get(app.origin+'/api/projects')).json();assert.ok(!projects.some(row=>row.id===project),'the project is gone');
  // No reload: the app has already left the erased project. It lands on the remaining project's Issues, or on the start of a new project, and the switcher no longer offers the erased one.
  if(projects.length){await page.waitForURL(`**/projects/${projects[0].id}/issues`);assert.ok(!(await page.locator('.project-picker select option').evaluateAll(options=>options.map(option=>option.value))).includes(project),'the project switcher no longer offers the erased project');}
  else{await page.getByRole('heading',{name:'Create your first project',exact:true}).waitFor();}
  assert.equal(await page.getByRole('heading',{name:'This project is unavailable'}).count(),0,'the app never says the erased project is unavailable');
  return {captures,ms:Date.now()-started};
 }finally{await context.close();}
}
