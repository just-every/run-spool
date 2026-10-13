import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import {openGate} from '../auth.mjs';
import {scanText} from './scan.mjs';

async function check(page,directory,width,name,captures,needles){
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${name} at ${width}: no horizontal overflow`);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(row=>row.id),[],`${name} at ${width}: axe`);
 // The panel shows counts and times, never a stored personal value.
 const panel=await page.locator('section[aria-labelledby^="erasure"]').innerText();assert.deepEqual(scanText(panel,needles),[],`${name} at ${width}: no personal value`);
 const path=`${directory}/erasure-${name}-${width}.png`;await page.screenshot({path,fullPage:true});captures.push(path);
}
// Preview, typed confirmation and receipt by clicking in the Settings panel.
export async function erasePanel(app,browser,directory,{project,width,needles}){
 const captures=[],context=await browser.newContext({viewport:{width,height:900}});
 try{
  await openGate(context,app.origin);
  await context.addCookies(app.cookie.split('; ').filter(Boolean).map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:app.origin})));
  const page=await context.newPage();await page.goto(`${app.origin}/projects/${project}/settings`);
  await page.getByRole('heading',{name:'Erase this project',exact:true}).waitFor();
  await page.getByRole('button',{name:'Preview erasure',exact:true}).click();
  await page.getByText(/rows will be deleted\./).waitFor();await check(page,directory,width,'preview',captures,needles);
  const erase=page.getByRole('button',{name:'Erase project',exact:true});
  assert.equal(await erase.isDisabled(),true,'erase stays disabled before typed confirmation');
  await page.getByLabel(`Type ${project} to confirm`,{exact:true}).fill(project.slice(0,-1));assert.equal(await erase.isDisabled(),true,'a partial identifier does not confirm');
  await page.getByLabel(`Type ${project} to confirm`,{exact:true}).fill(project);await check(page,directory,width,'confirmation',captures,needles);
  const started=Date.now(),response=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/projects/${project}/erasure`&&r.request().method()==='POST',{timeout:300_000});
  await erase.click();const status=(await response).status();assert.equal(status,200,'the erase completes within the request');
  await page.getByRole('heading',{name:'Project erased',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'erasure-receipt','focus moves to the receipt');
  await check(page,directory,width,'receipt',captures,needles);
  const projects=await (await context.request.get(app.origin+'/api/projects')).json();assert.ok(!projects.some(row=>row.id===project),'the project is gone');
  return {captures,ms:Date.now()-started};
 }finally{await context.close();}
}
