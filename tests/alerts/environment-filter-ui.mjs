import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {event} from './runtime.mjs';

export async function environmentFilterUI(page,app,auth,width,now){
 const name='Retained production count';
 await app.json('/api/ingest/web','POST',event('synthetic-spool-201',{environment:'production'}),auth);
 await app.json('/api/ingest/web','POST',event('synthetic-spool-202',{environment:'staging'}),auth);
 // Fixed fixture time places the public captures into the current preview window.
 await app.db.prepare("UPDATE events SET received=? WHERE project='web' AND id IN ('synthetic-spool-201','synthetic-spool-202')").bind(Math.floor(now/60000)*60000+1).run();
 await page.getByLabel('Rule name',{exact:true}).fill(name);
 await page.getByRole('combobox',{name:'Destination',exact:true}).selectOption({label:`On call ${width} · Email`});
 await page.getByLabel('New issue',{exact:true}).uncheck();
 await page.getByLabel('Regression',{exact:true}).uncheck();
 await page.getByLabel('Volume spike',{exact:true}).check();
 await page.getByLabel('Complete window (minutes)',{exact:true}).fill('1');
 await page.getByLabel('Accepted occurrence threshold',{exact:true}).fill('2');
 await page.locator('.form-more > summary').click();
 await page.getByLabel('Environment',{exact:true}).fill('production');
 const preview=page.getByRole('status',{name:'Count rule preview'});
 await page.getByRole('button',{name:'Preview rule',exact:true}).focus();await page.keyboard.press('Enter');
 await preview.getByRole('heading',{name:'Retained occurrence preview'}).waitFor();
 if(width===1440){
  assert.ok(await page.getByRole('button',{name:'Create rule',exact:true}).isEnabled());
  assert.ok((await preview.innerText()).includes('1 matching occurrences'));
  assert.ok((await preview.innerText()).includes('0 qualifying issues'));
  assert.ok((await preview.innerText()).includes('Installation owner'));
  assert.ok((await preview.innerText()).includes(`On call ${width} · Passing test reviewed`));
  const axe=await new AxeBuilder({page}).include('[aria-label="Count rule preview"]').analyze();assert.deepEqual(axe.violations,[]);
  await page.getByLabel('Environment',{exact:true}).fill('staging');
  assert.equal(await preview.count(),0,'changed predicate invalidates the reviewed counts');
  assert.ok(await page.getByRole('button',{name:'Create rule',exact:true}).isDisabled());
  await page.getByLabel('Environment',{exact:true}).fill('production');
  await page.getByRole('button',{name:'Preview rule',exact:true}).click();await preview.waitFor();
 }
 const proof=process.env.SPOOL_ALERT_PROOF_DIR??'.artifacts/alerts';await mkdir(proof,{recursive:true});
 await preview.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(proof,`count-preview-${width}.png`),fullPage:true});
 await page.getByRole('button',{name:'Create rule',exact:true}).click();await page.getByRole('button',{name:`Edit ${name}`,exact:true}).click();
 if(!await page.getByLabel('Environment',{exact:true}).isVisible())await page.locator('.form-more > summary').click();
 if(width===1440){assert.equal(await page.getByLabel('Environment',{exact:true}).inputValue(),'production');assert.ok(await page.getByRole('button',{name:'Save rule',exact:true}).isDisabled());}
 await page.getByRole('button',{name:'Preview rule',exact:true}).click();await preview.waitFor();
 await page.getByLabel('Environment',{exact:true}).fill('');
 await page.getByRole('button',{name:'Preview rule',exact:true}).click();await preview.waitFor();
 if(width===1440){assert.ok((await preview.innerText()).includes('All environments'));assert.ok((await preview.innerText()).includes('2 matching occurrences'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);}
 await page.getByRole('button',{name:'Save rule',exact:true}).click();await page.getByRole('button',{name:`Edit ${name}`,exact:true}).waitFor();
 console.log(`PROBE ALERT-001 controls: Rules at ${width} -> keyboard preview, exact environment draft, preview invalidation, persisted predicate and all-environment edit; count preview captured.`);
}
