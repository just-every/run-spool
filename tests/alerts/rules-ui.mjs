import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

// This is part of the existing Alerts browser journey. Assertions use 1440;
// the same states at 390 supply the retained phone proof.
export async function rulesUI(page,app,width){
 const base='/api/projects/web/alerting',name=`Filtered rule ${width}`,check=width===1440;
 const evidence=process.env.SPOOL_ALERT_PROOF_DIR??'.artifacts/alerts/alert001';await mkdir(evidence,{recursive:true});
 const capture=async()=>{
  const key=await app.json('/api/projects/web/keys','POST',{kind:'ingest'}),dsn=new URL(key.dsn),ids=[];
  for(let i=0;i<2;i++){
   const event_id=crypto.randomUUID().replaceAll('-','');ids.push(event_id);
   const event={event_id,environment:'fixture',level:'error',tags:{tenant:'acme'},exception:{values:[{type:'CheckoutError',value:'Payment confirmation failed',stacktrace:{frames:[{filename:'checkout.js',function:'confirmPayment',lineno:42,colno:1}]}}]}};
   const response=await app.request('/api'+dsn.pathname+'/envelope/?sentry_version=7&sentry_key='+dsn.username,'POST','{}\n{"type":"event"}\n'+JSON.stringify(event));if(!response.ok)throw new Error('Preview fixture capture failed');await response.json();
  }
  return ids;
 };
 const ids=await capture(),windowMs=300000;
 await app.db.batch(ids.map(id=>app.db.prepare('UPDATE events SET received=? WHERE id=?').bind(Math.floor(Date.now()/windowMs)*windowMs-windowMs+100,id)));
 await page.getByRole('button',{name:'Rules',exact:true}).click();
 const discard=page.getByRole('button',{name:'Discard edit',exact:true});if(await discard.isVisible()){page.once('dialog',dialog=>dialog.accept());await discard.click()}
 await page.getByLabel('Rule name',{exact:true}).fill(name);await page.getByRole('combobox',{name:'Destination',exact:true}).selectOption('mail-v1');
 for(const [label,checked] of [['New issue',true],['Regression',true],['Reactivation',true],['Volume spike',true]])await page.getByRole('checkbox',{name:label,exact:true}).setChecked(checked);
 await page.getByLabel('Enabled',{exact:true}).check();await page.getByLabel('Spike metric',{exact:true}).selectOption('users');
 await page.getByLabel('Affected user threshold (more than)',{exact:true}).fill('2');
 await page.locator('details.form-more > summary').click();
 await page.getByLabel('Environment',{exact:true}).fill('fixture');await page.getByLabel('Severity',{exact:true}).selectOption('error');await page.getByLabel('Release filter',{exact:true}).selectOption('none');
 await page.getByLabel('Allowed tag keys',{exact:true}).fill('tenant');await page.getByLabel('Tag tenant',{exact:true}).fill('acme');
 const create=page.getByRole('button',{name:'Create rule',exact:true}),region=page.getByRole('region',{name:'Rule preview',exact:true});
 async function preview(){
  const response=page.waitForResponse(r=>r.url().endsWith(base+'/rules/preview')&&r.request().method()==='POST');await page.getByRole('button',{name:'Preview rule',exact:true}).click();const r=await response;if(!r.ok())throw new Error('Rule preview failed');await region.waitFor();return r.json();
 }
 if(check)assert.ok(await create.isDisabled(),'enabling requires the reviewed draft');
 const refused=await preview();await region.getByRole('alert').waitFor();if(check)assert.ok(refused.refusal&&!refused.token&&await create.isDisabled(),'dropped identity refuses the user condition');
 await region.screenshot({path:`${evidence}/refusal-${width}.png`});
 await page.getByLabel('Spike metric',{exact:true}).selectOption('count');const accepted=await preview();
 if(check){
  assert.ok(accepted.token&&accepted.transitions.length,'filtered retained history is previewed');
  const text=await region.innerText(),choice=await page.getByRole('combobox',{name:'Destination',exact:true}).locator('option:checked').innerText();
  assert.ok(text.includes(choice),'preview names the destination label and kind');
  const issues=await app.json('/api/projects/web/issues');assert.ok(accepted.transitions.every(row=>text.includes(issues.find(i=>i.id===row.issue).short_id)),'preview names issue short ids');
  assert.doesNotMatch(text,/[0-9a-f]{64}/,'issue hashes are not headings');
 }
 await region.screenshot({path:`${evidence}/preview-${width}.png`});await create.click();await page.getByRole('button',{name:`Edit ${name}`,exact:true}).waitFor();
 const rule=(await app.json(base+'/rules')).find(r=>r.name===name),saved=page.locator('.alert-records > li').filter({has:page.getByRole('button',{name:`Edit ${name}`,exact:true})});
 if(check){const text=await saved.innerText();assert.ok(text.includes('fixture')&&text.includes('acme')&&!text.includes('{"'),'saved filters read as words');}
 await saved.screenshot({path:`${evidence}/saved-${width}.png`});
 const cursor=await app.db.prepare('SELECT next_start FROM alert_cursors WHERE rule_id=?').bind(rule.id).first();
 const future=await capture();await app.db.batch(future.map(id=>app.db.prepare('UPDATE events SET received=? WHERE id=?').bind(cursor.next_start+100,id)));
 await app.schedule(cursor.next_start+windowMs);
 const later=await capture();await app.db.batch(later.map((id,i)=>app.db.prepare('UPDATE events SET received=? WHERE id=?').bind(cursor.next_start+windowMs*(i+1)+100,id)));
 await app.schedule(cursor.next_start+2*windowMs);
 await page.getByRole('button',{name:'Refresh alerts',exact:true}).click();
 const recorded=page.locator('details').filter({has:page.locator(':scope > summary').filter({hasText:/^Recorded window decisions/})});await recorded.locator(':scope > summary').click();
 if(check){const rows=(await app.json(base+'/decisions')).filter(r=>r.rule_id===rule.id);assert.ok(rows.some(r=>r.fired)&&rows.some(r=>!r.fired),'recorded decisions explain fired and withheld windows');assert.doesNotMatch(await recorded.innerText(),/[0-9a-f]{64}/);}
 await recorded.screenshot({path:`${evidence}/decisions-${width}.png`});
}
