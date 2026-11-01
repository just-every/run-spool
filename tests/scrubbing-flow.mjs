// SDK-003: the unmodified Node SDK, owner settings and every evidence/export door.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startTestWorker} from './worker.mjs';
import {signIn,browserSignIn} from './auth.mjs';
import {archiveProjection} from './archive.mjs';
import {issueDetails,run} from './runtimes/harness.mjs';

const empty=()=>({version:1,sensitiveFields:[],safeFields:[],rules:[]});
const rule=(id,selector)=>({id,selector,pattern:'regex',regex:'synthetic-spool-private-',method:'mask'});
const fields=['message','tag','extra','context','tenant','installation','local'];
const values=phase=>Object.fromEntries(fields.map(field=>[field,`synthetic-spool-private-${phase}-${field}-${crypto.randomUUID().replace(/[0-9]/g,'a')}`]));
const protectedValues=value=>fields.map(field=>value[field]);
const absent=(value,needles,door)=>{const text=typeof value==='string'?value:JSON.stringify(value);for(const needle of needles)assert.ok(!text.includes(needle),`SDK-003 ${door} excludes a matched value`)};

export async function scrubbingFlow({browser,origin,cookie,request,temporary,require}){
 const project=await request('/api/projects','POST',{id:'synthetic-spool-scrubbing',name:'synthetic-spool-scrubbing'}),base='/api/projects/'+project.id,root=base+'/scrubbing';
 const raw=(path,method='GET',body,headers={})=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,...body?{'Content-Type':'application/json'}:{},...headers},...body?{body:JSON.stringify(body)}:{}});
 const save=async(path,policy)=>{const preview=await request(path+'/preview','POST',{policy});assert.equal(preview.refusal,null);assert.ok(preview.token);return request(path,'PUT',{revision:preview.revision,policy,token:preview.token})};
 const denied=async(path,method,body,headers,status)=>{const response=await raw(path,method,body,headers);assert.equal(response.status,status);await response.body?.cancel()};
 const entry=resolve(temporary,'synthetic-spool-scrubbing.mjs');
 await writeFile(entry,`import * as Sentry from ${JSON.stringify(require.resolve('@sentry/node'))};
 const input=JSON.parse(process.env.SPOOL_SCRUBBING_CASE);
 Sentry.init({dsn:input.dsn,release:'synthetic-spool-scrubbing@1',environment:'compatibility',enableLogs:true});
 const id=Sentry.captureEvent(input.event);if(input.log)Sentry.logger.info(input.log.body,input.log.attributes);const flushed=await Sentry.flush(10000);await Sentry.close(10000);
 if(!flushed)process.exitCode=1;process.stdout.write(JSON.stringify({id}));\n`);
 const send=async(dsn,event,log)=>{
  const result=await run(process.execPath,[entry],{cwd:temporary,env:{SPOOL_SCRUBBING_CASE:JSON.stringify({dsn,event,log})}});
  assert.equal(result.code,0,'SDK-003 real Node SDK flush and close succeed');const {id}=JSON.parse(result.stdout);assert.ok(id);return id;
 };
 const event=value=>({message:value.message,tags:{checkout_note:value.tag},extra:{checkout_note:value.extra,tenant_private:value.tenant,order_note:'synthetic-spool-approved-order',quantity:3},contexts:{checkout:{note:value.context,order_note:value.local,ordinary:'synthetic-spool-ordinary-context'},installation:{note:value.installation}}});
 const read=async(project,id)=>{
  const details=await issueDetails({json:request},project),issue=details.find(issue=>issue.events.some(event=>event.id===id));
  assert.ok(issue,'SDK-003 capture is retained through the owner event door');return {issue:issue.issue,detail:issue.events.find(event=>event.id===id)};
 };
 const seed=values('before'),seedId=await send(project.dsn,event(seed)),before=await read(project.id,seedId);
 for(const needle of protectedValues(seed))assert.ok(JSON.stringify(before.detail).includes(needle),'the seed proves the custom value survives default scrubbing');
 const initial=await request('/api/scrubbing'),installation={...initial.policy,sensitiveFields:[...initial.policy.sensitiveFields,'tenant_private'],rules:[...initial.policy.rules,rule('synthetic-spool-installation','$contexts.installation.note')]};
 const policy={...empty(),sensitiveFields:['order_note'],safeFields:['$extra.order_note'],rules:[rule('synthetic-spool-message','$message'),rule('synthetic-spool-tag','$tags.checkout_note'),rule('synthetic-spool-extra','$extra.checkout_note'),rule('synthetic-spool-context','$contexts.checkout.note')]};
 const staleInstallation=await request(root+'/preview','POST',{policy});assert.ok(staleInstallation.token);
 const installationPreview=await request('/api/scrubbing/preview','POST',{policy:installation});
 assert.ok(installationPreview.coverage.scanned>0);assert.ok(installationPreview.sample.length>0);absent(installationPreview,[seed.tenant,seed.installation],'installation preview');
 assert.ok(installationPreview.matches.some(match=>match.selector==='$contexts.installation.note'&&match.fields>0));
 await request('/api/scrubbing','PUT',{revision:installationPreview.revision,policy:installation,token:installationPreview.token});
 await denied(root,'PUT',{revision:staleInstallation.revision,policy,token:staleInstallation.token},{},409);
 for(const selector of ['$extra.tenant_private','$contexts.installation.note']){
  const refused=await request(root+'/preview','POST',{policy:{...policy,safeFields:[...policy.safeFields,selector]}});
  assert.ok(refused.refusal,'SDK-003 project safe fields cannot bypass installation fields or rules');assert.equal(refused.token,null);
 }
 const grant=await request(base+'/keys','POST',{kind:'agent'});
 for(const path of [root,'/api/scrubbing']){
  await denied(path,'GET',undefined,{Cookie:''},401);
  await denied(path,'PUT',{revision:0,policy,token:'synthetic-spool-denied'},{Cookie:'',Authorization:'Bearer '+grant.key},403);
 }
 await mkdir('.artifacts/scrubbing',{recursive:true});const captures=[];
 const previewSafe=preview=>{
  assert.equal(preview.refusal,null);assert.ok(preview.token);assert.ok(preview.coverage.scanned>0);assert.ok(preview.sample.length>0);
  absent(preview,protectedValues(seed),'project preview');
  for(const selector of policy.rules.map(rule=>rule.selector))assert.ok(preview.matches.some(match=>match.selector===selector&&match.fields>0),'SDK-003 preview counts each matched custom selector');
  assert.ok(preview.sample.every(sample=>sample.fields.every(field=>field.path!=='sentry.extra.order_note')),'the safe field is absent from matched sample fields');
 };
 const capture=async(page,name,width)=>{
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`SDK-003 ${name} at ${width}: no horizontal overflow`);
  const path=`.artifacts/scrubbing/${name}-${width}.png`;await page.screenshot({path,fullPage:true});captures.push(path);
 };
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  try{
   await browserSignIn(page,origin);await page.goto(origin+`/projects/${project.id}/settings`);
   const panel=page.getByRole('region',{name:'Server scrubbing',exact:true});await panel.getByLabel('Additional sensitive fields',{exact:true}).waitFor();
   await panel.getByLabel('Rule scope',{exact:true}).selectOption('project');
   if(width===1440){
    await panel.getByLabel('Additional sensitive fields',{exact:true}).fill(policy.sensitiveFields.join('\n'));
    await panel.getByLabel('Safe fields',{exact:true}).fill(policy.safeFields.join('\n'));
    for(const [index,rule] of policy.rules.entries()){
     await panel.getByRole('button',{name:'Add scrubbing rule',exact:true}).click();const row=panel.getByRole('group',{name:`Scrubbing rule ${index+1}`,exact:true});
     await row.getByLabel('Rule selector',{exact:true}).fill(rule.selector);await row.getByLabel('Rule pattern',{exact:true}).selectOption('regex');
     await row.getByLabel('Custom regular expression',{exact:true}).fill(rule.regex);await row.getByLabel('Scrubbing method',{exact:true}).selectOption('mask');
    }
   }
   const draftSensitive=await panel.getByLabel('Additional sensitive fields',{exact:true}).inputValue();
   await panel.getByLabel('Additional sensitive fields',{exact:true}).fill(draftSensitive+'\nsynthetic_spool_draft');
   await panel.getByLabel('Rule scope',{exact:true}).selectOption('installation');
   await panel.getByLabel('Additional sensitive fields',{exact:true}).waitFor();
   await panel.getByLabel('Rule scope',{exact:true}).selectOption('project');
   assert.equal(await panel.getByLabel('Additional sensitive fields',{exact:true}).inputValue(),draftSensitive+'\nsynthetic_spool_draft','scrubbing draft survives a scope round trip');
   await panel.getByLabel('Additional sensitive fields',{exact:true}).fill(draftSensitive);
   assert.equal(await panel.getByRole('button',{name:'Save scrubbing rules',exact:true}).isDisabled(),true,'a fresh preview is required');
   const pending=page.waitForResponse(response=>new URL(response.url()).pathname===root+'/preview'&&response.request().method()==='POST');
   await panel.getByRole('button',{name:'Preview scrubbing',exact:true}).click();const preview=await (await pending).json();previewSafe(preview);
   await panel.locator('[aria-label="Scrubbing preview"] [aria-label="Sample matched fields"]').first().waitFor();
   assert.deepEqual(await panel.locator('[data-field-path]').evaluateAll(rows=>rows.map(row=>row.dataset.fieldPath)),preview.sample.flatMap(sample=>sample.fields.slice(0,10).map(field=>field.path)),'sample lists exactly the matched API paths');
   await capture(page,'settings-preview',width);
   if(width===1440){
    const saved=page.waitForResponse(response=>new URL(response.url()).pathname===root&&response.request().method()==='PUT');
    await panel.getByRole('button',{name:'Save scrubbing rules',exact:true}).click();assert.equal((await saved).status(),200);
    const actual=(await request(root)).policy;assert.deepEqual(actual.sensitiveFields,policy.sensitiveFields);assert.deepEqual(actual.safeFields,policy.safeFields);
    assert.deepEqual(actual.rules.map(({id,...rule})=>rule),policy.rules.map(({id,...rule})=>rule),'owner settings save the previewed selectors, patterns and methods');
   }
   await panel.getByLabel('Rule scope',{exact:true}).selectOption('installation');
   await panel.getByLabel('Additional sensitive fields',{exact:true}).waitFor();
   const installationResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/scrubbing/preview'&&response.request().method()==='POST');
   await panel.getByRole('button',{name:'Preview scrubbing',exact:true}).click();const installationSample=await (await installationResponse).json();assert.equal(installationSample.refusal,null);absent(installationSample,[seed.tenant,seed.installation],'installation Settings preview');
   await panel.locator('[aria-label="Scrubbing preview"] [aria-label="Sample matched fields"]').first().waitFor();await capture(page,'installation-preview',width);
   await panel.getByLabel('Rule scope',{exact:true}).selectOption('project');
   await panel.getByRole('button',{name:'Add scrubbing rule',exact:true}).click();
   const badRow=panel.getByRole('group',{name:/Scrubbing rule/}).last();
   await badRow.getByLabel('Rule selector',{exact:true}).fill('$tags.tenant');
   await badRow.getByLabel('Rule pattern',{exact:true}).selectOption('regex');
   await badRow.getByLabel('Custom regular expression',{exact:true}).fill('acme-[0-9]+');
   const refusedResponse=page.waitForResponse(response=>new URL(response.url()).pathname===root+'/preview'&&response.request().method()==='POST');
   await panel.getByRole('button',{name:'Preview scrubbing',exact:true}).click();
   const refused=await (await refusedResponse).json();
   assert.equal(refused.coverage,null,'a refused preview has unavailable coverage');
   await badRow.getByRole('alert').waitFor();
   assert.doesNotMatch(await badRow.getByRole('alert').innerText(),/[a-z]+(_[a-z]+)+/,'refusal is a sentence under its rule');
   assert.equal(await panel.locator('[aria-label="Scrubbing preview"] [aria-label="Sample matched fields"]').count(),0,'refusal has no sample');
   assert.ok(!(await panel.locator('[aria-label="Scrubbing preview"]').innerText()).includes('Coverage:'),'refusal has no coverage block');
   await badRow.getByRole('button',{name:/Remove rule/}).click();

  }finally{await context.close()}
 }
 const current=(await request(root)).policy,staleProject=await request(root+'/preview','POST',{policy:current});
 await save(root,{...current,sensitiveFields:[...current.sensitiveFields,'synthetic_spool_stale']});
 await denied(root,'PUT',{revision:staleProject.revision,policy:current,token:staleProject.token},{},409);
 const logRule=rule('synthetic-spool-log','$log.attributes.order_note');await save(root,{...(await request(root)).policy,rules:[...(await request(root)).policy.rules,logRule]});
 const pairTag='synthetic-spool-private-pair-tag-'+crypto.randomUUID(),pairHeader='synthetic-spool-private-pair-header-'+crypto.randomUUID(),pairHeaderDuplicate='synthetic-spool-private-pair-header-duplicate-'+crypto.randomUUID(),pairHeaderRepeated='synthetic-spool-private-pair-header-repeated-'+crypto.randomUUID(),pairNamed='synthetic-spool-private-pair-named-'+crypto.randomUUID(),pairDefault='synthetic-spool-private-pair-default-'+crypto.randomUUID();
 const withPairRules=(await request(root)).policy;
 await save(root,{...withPairRules,sensitiveFields:[...withPairRules.sensitiveFields,'gate_named'],rules:[...withPairRules.rules,{...rule('synthetic-spool-pair-header','$request.headers.x-private'),method:'remove'}]});
 const pairId=crypto.randomUUID().replaceAll('-',''),dsn=new URL(project.dsn);
 const pairResponse=await fetch(origin+'/api'+dsn.pathname+'/envelope/?sentry_version=7&sentry_key='+encodeURIComponent(dsn.username),{method:'POST',body:'{}\n{"type":"event"}\n'+JSON.stringify({event_id:pairId,message:'Synthetic pair-array control',tags:[['checkout_note',pairTag],['gate_named',pairNamed],['api_key',pairDefault]],request:{headers:[['x-private',pairHeader],['X-Private',pairHeaderDuplicate],['x-private',pairHeaderRepeated]]}})});
 assert.equal(pairResponse.status,200,'accepted Sentry pair-array event');await pairResponse.body.cancel();
 const pairDetail=(await read(project.id,pairId)).detail;
 absent(pairDetail,[pairTag,pairHeader,pairHeaderDuplicate,pairHeaderRepeated,pairNamed,pairDefault],'pair-array owner event door');
 const after=values('after'),logValue='synthetic-spool-private-log-note',logBody='synthetic-spool-private-log-body',logId='synthetic-spool-located-log';
 const afterId=await send(project.dsn,event(after),{body:logBody,attributes:{'code.file.path':'synthetic-spool-log.js','code.function.name':'writeLog','code.line.number':1,'code.column.number':1,'spool.event_id':logId,'spool.build':'synthetic-spool-build','order_note':logValue}}),{issue,detail}=await read(project.id,afterId);
 const logDetail=(await read(project.id,logId)).detail;absent(logDetail,[logValue,logBody],'real SDK log storage');assert.equal(logDetail.event.sentry.extra.log_attributes.order_note,'[redacted]');
 absent(detail,protectedValues(after),'later owner detail');const sentry=detail.event.sentry;
 assert.equal(detail.event.message,'[redacted]');assert.equal(sentry.tags.checkout_note,'[redacted]');assert.equal(sentry.extra.checkout_note,'[redacted]');
 assert.equal(sentry.contexts.checkout.note,'[redacted]');assert.equal(sentry.contexts.checkout.order_note,'[redacted]');assert.equal(sentry.contexts.installation.note,'[redacted]');assert.equal(sentry.extra.tenant_private,'[redacted]');
 assert.equal(sentry.extra.order_note,'synthetic-spool-approved-order');assert.equal(sentry.extra.quantity,3);assert.equal(sentry.contexts.checkout.ordinary,'synthetic-spool-ordinary-context');
 const packet=await raw(base+`/issues/${issue.id}/packet`,'GET',undefined,{Cookie:'',Authorization:'Bearer '+grant.key});assert.equal(packet.status,200);absent(await packet.json(),protectedValues(after),'agent packet');
 const other=await request('/api/projects','POST',{id:'synthetic-spool-scrubbing-other',name:'synthetic-spool-scrubbing-other'}),otherValues=values('other');
 const otherId=await send(other.dsn,{message:'synthetic-spool-other-project',extra:{tenant_private:otherValues.tenant,order_note:'synthetic-spool-other-order'},contexts:{installation:{note:otherValues.installation}}}),otherDetail=(await read(other.id,otherId)).detail;
 absent(otherDetail,[otherValues.tenant,otherValues.installation],'second project owner detail');assert.equal(otherDetail.event.sentry.extra.order_note,'synthetic-spool-other-order','project sensitive fields do not leak into another project');
 assert.deepEqual((await read(project.id,seedId)).detail.event,before.detail.event,'policy activation leaves earlier retained evidence unchanged');
 const rejectedRule=await request(root+'/preview','POST',{policy:{...current,rules:[{id:'synthetic-spool-weaken',selector:'$contexts.installation.note',pattern:'regex',regex:'.',method:'replace',replacement:'synthetic-spool-open'}]}});assert.ok(rejectedRule.refusal);assert.equal(rejectedRule.token,null);
 for(const regex of ['(a+)+','(a)\\1','a*a*']){const refused=await request(root+'/preview','POST',{policy:{...current,rules:[{id:'synthetic-spool-unsafe',selector:'$message',pattern:'regex',regex,method:'mask'}]}});assert.ok(refused.refusal);assert.equal(refused.token,null)}
 const exported=await request(base+'/issue-export?format=json');absent(exported,protectedValues(after),'project issue export');assert.ok(JSON.stringify(exported).includes(seed.message),'earlier issue title remains unchanged in project export');
 const archiveResponse=await raw('/api/archive');assert.equal(archiveResponse.status,200);const archive=await archiveProjection(archiveResponse);
 absent(archive.text,[...protectedValues(after),otherValues.tenant,otherValues.installation,pairTag,pairHeader,pairHeaderDuplicate,pairHeaderRepeated,pairNamed,pairDefault],'private archive');
 assert.ok(archive.data.events.some(row=>row.project===project.id&&row.id===seedId&&JSON.stringify(row).includes(seed.extra)),'private export retains the pre-policy occurrence unchanged');
 const restored=await startTestWorker(15592);
 try{
  const restoredCookie=await signIn(restored.origin),response=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Origin:restored.origin,Cookie:restoredCookie,'Content-Type':'application/x-ndjson','x-confirm-restore':'yes'},body:archive.text});
  assert.equal(response.status,200,'SDK-003 populated policy archive restores');await response.body.cancel();
  for(const path of ['/api/scrubbing',root]){const r=await fetch(restored.origin+path,{headers:{Cookie:restoredCookie}});assert.equal(r.status,200);assert.deepEqual((await r.json()).policy,(await request(path)).policy)}
 }finally{await restored.stop()}
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  try{
   await browserSignIn(page,origin);await page.goto(origin+`/projects/${project.id}/issues/${issue.id}?event=${afterId}&occurrence=${encodeURIComponent(detail.occurrence)}`);
   await page.locator('.issue').getByText(afterId,{exact:true}).waitFor();await page.locator('.event-diagnostic').waitFor();
   for(const name of ['Tags','Contexts','Extra'])await page.locator('.event-sections summary').filter({hasText:new RegExp('^'+name+'$')}).click();
   const extra=page.locator('.event-sections details').filter({has:page.locator('summary').filter({hasText:/^Extra$/})});
   await extra.getByText('synthetic-spool-approved-order',{exact:false}).waitFor();absent(await page.content(),protectedValues(after),'masked issue screen');
   await capture(page,'masked-issue',width);
  }finally{await context.close()}
 }
 return {passed:true,captures,proof:'SDK-003 real Node SDK custom rules, installation protection, safe fields, masked previews, stale saves, immutable earlier evidence, owner/agent/export/archive reads and 1440/390 settings/issues'};
}
