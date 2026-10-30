import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import {openGate} from '../auth.mjs';
import {captureApp} from './capture.mjs';
// Part 5: every verdict state reached by clicking, at 1440, in a project of its own.
async function prepare(app,browser,project){
 await app.json('/api/projects','POST',{id:project,name:'Cedar Dispatch '+project});
 const old={name:'2026.10.1',build:'b1'},release={name:'2026.10.2',build:'b2'};
 await app.json(`/api/projects/${project}/releases`,'POST',old);
 const capture=await captureApp(app,browser,project,old.name,old.build),first=await capture.throw(old.name,old.build);
 const packet=await app.json(`/api/projects/${project}/issues/${first.issue}/packet`);
 await app.json(`/api/projects/${project}/issues/${first.issue}`,'PATCH',{state:'resolved',revision:packet.issue.revision});
 await app.json(`/api/projects/${project}/releases`,'POST',release);
 return {capture,issue:first.issue,old,release};
}
async function check(page,directory,width,name,captures){
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${name} at ${width}: no horizontal overflow`);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(row=>row.id),[],`${name} at ${width}: axe`);
 const path=`${directory}/repair-${name}-${width}.png`;await page.screenshot({path,fullPage:true});captures.push(path);
}
const focusVisible=page=>page.evaluate(()=>{
 const field=document.activeElement;
 if(!(field instanceof HTMLElement)||!field.matches(':focus-visible'))return false;
 const visible=(width,style,color)=>parseFloat(width)>0&&!['none','hidden'].includes(style)&&color!=='transparent'&&!/^rgba\([^)]*,\s*0(?:\.0*)?\)$|\/\s*0(?:\.0*)?%?\)$/.test(color);
 const style=getComputedStyle(field);
 if(visible(style.outlineWidth,style.outlineStyle,style.outlineColor))return true;
 if(!field.matches('input,textarea,select'))return false;
 const borders=()=>{const style=getComputedStyle(field);return ['Top','Right','Bottom','Left'].map(side=>({width:style['border'+side+'Width'],style:style['border'+side+'Style'],color:style['border'+side+'Color']}));};
 const focused=borders();
 try{
  field.blur();const unfocused=borders();
  return focused.some((border,index)=>visible(border.width,border.style,border.color)&&(border.width!==unfocused[index].width||border.color!==unfocused[index].color));
 }finally{field.focus({preventScroll:true});}
});
async function verdict(page,text){await page.locator('.repairs .verdict').filter({hasText:text}).first().waitFor();}
async function refresh(page){await page.waitForResponse(response=>response.url().includes('/repairs?issue=')&&response.ok(),{timeout:30000});}
export async function repairPanel(app,browser,directory){
 const captures=[];
 for(const width of [1440]){
  const project='ui'+width,{capture,issue,old,release}=await prepare(app,browser,project);
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   await openGate(context,app.origin);
   await context.addCookies(app.cookie.split('; ').filter(Boolean).map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:app.origin})));
   const page=await context.newPage();await page.goto(`${app.origin}/projects/${project}/issues/${issue}`);
   await page.getByText('A repair is a change someone proposed').waitFor();await check(page,directory,width,'empty',captures);
   // Keyboard only: reach the form by Tab, type, and submit with Enter.
   let reached=false;for(let n=0;n<120&&!reached;n++){await page.keyboard.press('Tab');reached=await page.evaluate(()=>document.activeElement?.matches('.repairs input[type=url]')??false);}
   assert.ok(reached,'repair link field reachable by keyboard');assert.ok(await focusVisible(page),'visible focus on the link field');
   await page.keyboard.type('https://github.example/cedar/dispatch/pull/7');await page.keyboard.press('Tab');await page.keyboard.type('Guard the missing delivery address');
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Record repair');assert.ok(await focusVisible(page),'visible focus on Record repair');
   await page.keyboard.press('Enter');await page.locator('.repairs .repair').waitFor();
   await page.getByLabel('Check name',{exact:true}).fill('Unit tests');await page.getByRole('combobox',{name:/^Outcome/}).selectOption('passed');await page.getByLabel('Check note',{exact:true}).fill('pnpm test passed');
   await page.getByRole('button',{name:'Add check',exact:true}).click();await page.getByText('Unit tests',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Mark approved',exact:true}).click();await page.getByRole('button',{name:'Mark approved',exact:true}).waitFor({state:'detached'});
   await page.getByRole('button',{name:'Mark merged',exact:true}).click();await page.getByRole('button',{name:'Mark merged',exact:true}).waitFor({state:'detached'});
   await page.getByRole('combobox',{name:/^Deployed in release/}).selectOption(release.name);await page.getByRole('button',{name:'Mark deployed',exact:true}).click();
   await verdict(page,'No event at all has arrived from release');await check(page,directory,width,'a-deployed-no-events',captures);
   await capture.throw(release.name,release.build,'Track delivery');await app.json(`/api/projects/${project}/artifacts`,'POST',{release:release.name,build:release.build,debugId:'dispatch-map',map:capture.map});
   await refresh(page);await verdict(page,'No one has recorded that the affected flow was exercised');await page.locator('.repairs .verdict').filter({hasText:'No event at all has arrived'}).waitFor({state:'detached'});
   await check(page,directory,width,'b-no-exercise',captures);
   await page.getByLabel(`How the flow was exercised in ${release.name}`,{exact:true}).fill('Prepared delivery for the North Market order');
   await page.getByRole('button',{name:'Record flow exercised in this release',exact:true}).click();
   await verdict(page,'Verdict: No recurrence after the flow was exercised');await check(page,directory,width,'c-no-recurrence',captures);
   const older=await capture.throw(old.name,old.build);await refresh(page);await verdict(page,'Not counted: 1 event');await verdict(page,'Verdict: No recurrence after the flow was exercised');
   assert.ok((await page.locator('.repairs .verdict').innerText()).includes(older.eventId));await check(page,directory,width,'e-older-release',captures);
   for(let n=0;n<3;n++){const response=await app.request(`/api/ingest/${project}`,'POST',{version:1,eventId:'invalid-'+n},{agent:capture.ingestKey});assert.equal(response.status,400);await response.body?.cancel();}
   await refresh(page);await verdict(page,'Verdict: Inconclusive');await verdict(page,'invalid 3');await check(page,directory,width,'f-rejected-spike',captures);
   const recurred=await capture.throw(release.name,release.build);await refresh(page);await verdict(page,'Verdict: Recurred');
   assert.ok((await page.locator('.repairs .verdict').innerText()).includes(recurred.eventId),'recurring event named');await page.locator('.state-chip.open').waitFor();
   await check(page,directory,width,'d-recurred',captures);
  }finally{await context.close();await capture.stop();}
 }
 return captures;
}

export async function restoredRepairPanel(app,browser,directory,issue){
 const captures=[];
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   await openGate(context,app.origin);await context.addCookies(app.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:app.origin})));
   const page=await context.newPage();await page.goto(`${app.origin}/projects/a/issues/${issue}`);
   const repair=page.locator('section.repairs article.repair').first();await repair.getByText('Historical verdict: Recurred',{exact:true}).waitFor();
   await repair.getByText(/It does not establish current repair proof/).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'restored repair fits');
   const audit=await new AxeBuilder({page}).include('section.repairs').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(row=>row.id),[]);
   const path=`${directory}/restored-repair-${width}.png`;await repair.screenshot({path});captures.push(path);
  }finally{await context.close();}
 }
 return captures;
}
