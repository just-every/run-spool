import {followErasure} from './project-erasure/follow.mjs';
import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchBrowser} from './browser-launch.mjs';
import {archiveProjection} from './archive.mjs';

export async function groupingRulesFlow({req,json,origin,cookie}){
 // GROUP-001: real native HTTP admissions use the same owner policy door as Sentry.
 const nativeProjects=[];
 for(const language of ['javascript','python','go']){
  const created=await json('/api/projects','POST',{id:'group-native-'+language,name:'Native '+language+' grouping'}),p='/api/projects/'+created.id,rules=p+'/grouping-rules';nativeProjects.push(created.id);
  await json(p+'/releases','POST',{name:'native-r1',build:'native-b1'});
  let serial=0;
  const input=(type='RuleError',line=10)=>({version:1,language,eventId:language+'-'+(++serial),release:'native-r1',build:'native-b1',environment:'production',type,message:'Checkout failed',frames:[{file:language==='javascript'?'/app/wrapper.js':language==='python'?'/app/wrapper.py':'/app/wrapper.go',function:'wrapper',line,column:0},{file:language==='javascript'?'/app/service.js':language==='python'?'/app/service.py':'/app/service.go',function:'checkout',line:40,column:0}],breadcrumbs:[],dropped:2});
  const admit=e=>json('/api/ingest/'+created.id,'POST',e,{Cookie:'',Authorization:'Bearer '+created.ingestKey});
  const old=input(),original=await admit(old),otherOld=input('RuleError',20),other=await admit(otherOld),unmatchedInput=input('OtherError',30),unmatched=await admit(unmatchedInput);
  assert.notEqual(original.issue,other.issue,'GROUP-001 no-rule native locations remain distinct');
  const policy={version:1,stack:'stack.function:wrapper -app',fingerprint:'family:'+language+' error.type:RuleError -> native-checkout'};
  const stable=async()=>{const data=(await archiveProjection(await req('/api/archive'))).data;return Object.fromEntries(['events','issues','audit','outcomes','grouping_policies','grouping_routes','grouping_corrections'].map(table=>[table,data[table].filter(row=>row.project===created.id)]))};
  const before=await stable(),preview=await json(rules+'/preview','POST',{policy});assert.equal(preview.scanned,3);assert.equal(preview.rows.find(row=>row.event===old.eventId).explanation.frames[0].inApp,false);assert.deepEqual(await stable(),before,'GROUP-001 native preview writes no rows, counters, routes or audit');
  const grant=await json(p+'/keys','POST',{kind:'agent'});
  for(const [path,method,body] of [[rules,'PUT',{revision:0,policy}],[rules+'/preview','POST',{policy}],[rules+'/versions','GET',undefined]])assert.ok([401,403].includes((await req(path,method,body,{Cookie:'',Authorization:'Bearer '+grant.key})).status),'GROUP-001 native policy doors deny project grants');
  const repair=await json(p+'/repairs','POST',{issue:original.issue,link:'https://example.test/pull/native',note:'Track native grouping coverage'});
  await json(p+'/repairs/'+repair.id+'/facts','POST',{revision:repair.revision,fact:'deployed',release:'native-r1'});
  await json(rules,'PUT',{revision:0,policy});assert.equal((await req(rules,'PUT',{revision:0,policy})).status,409);
  const one=input(),two=input('RuleError',25),a=await admit(one),b=await admit(two);assert.equal(a.issue,b.issue);const noFingerprint=await admit(input('OtherError',33));assert.notEqual(noFingerprint.issue,a.issue,'GROUP-001 unmatched native fingerprint does not join matched group');assert.notEqual(a.issue,original.issue,'GROUP-001 activation changes later admissions only');
  const forwardObservation=(await json(p+'/repairs?issue='+original.issue)).repairs.find(row=>row.id===repair.id).observation;assert.ok(forwardObservation.reasons.some(reason=>reason.code==='grouping_changed'),'GROUP-001 forward policy activation cannot imply healthy repair coverage');
  // An unmatched fingerprint still follows the explicit stack rule; preserve default when no stack rule matches.
  const stackOnly={version:1,stack:'stack.function:wrapper -app',fingerprint:''};
  await json(rules,'PUT',{revision:1,policy:stackOnly});
  const c=await admit(input('OtherError',31)),d=await admit(input('OtherError',32));assert.equal(c.issue,d.issue,'GROUP-001 native stack rules exclude wrapper noise');
  const reset={version:1,stack:'',fingerprint:''};await json(rules,'PUT',{revision:2,policy:reset});
  assert.equal((await admit({...unmatchedInput,eventId:language+'-unmatched-again'})).issue,unmatched.issue,'GROUP-001 disabled rules restore native defaults');
  const detail=async(issue,id)=>{const rows=await json(p+'/issues/'+issue+'/events');const row=rows.rows.find(e=>e.id===id);return json(p+'/issues/'+issue+'/events/'+id+'?occurrence='+row.occurrence)};
  const retained=await detail(a.issue,one.eventId);assert.equal(retained.grouping.revision,1);assert.equal(retained.grouping.projectFingerprintRule,1);assert.ok(retained.grouping.frames.every(frame=>!frame.contributes));assert.equal((await detail(original.issue,old.eventId)).grouping.revision,0);
  const versions=(await json(rules+'/versions')).versions;assert.deepEqual(versions.map(v=>v.policy),[policy,stackOnly,reset],'GROUP-001 prior versions remain immutable after activation');
  const source=(await json(p+'/issues')).find(issue=>issue.id===a.issue),selected=one.eventId;
  const split=await json(p+'/corrections/preview','POST',{kind:'split',source:a.issue,revision:source.revision,events:[selected]});
  const quiet=await stable();await json(p+'/corrections/'+split.id+'/apply','POST',{confirm:true});
  const moved=await detail(split.plan.target,selected);assert.deepEqual(moved.grouping,retained.grouping,'GROUP-001 selected historical split preserves contribution snapshot');
  const applied=await stable();assert.deepEqual(applied.outcomes,quiet.outcomes);assert.deepEqual(applied.events.map(row=>({...row,issue:quiet.events.find(e=>e.id===row.id).issue})),quiet.events,'GROUP-001 correction retains occurrence, original payload and client loss');
  await json(p+'/corrections/'+split.id+'/undo','POST',{confirm:true});assert.deepEqual((await detail(a.issue,selected)).grouping,retained.grouping);
  const sourceIssue=(await json(p+'/issues')).find(issue=>issue.id===other.issue),targetIssue=(await json(p+'/issues')).find(issue=>issue.id===original.issue);
  const merge=await json(p+'/corrections/preview','POST',{kind:'merge',source:other.issue,revision:sourceIssue.revision,target:original.issue,targetRevision:targetIssue.revision});await json(p+'/corrections/'+merge.id+'/apply','POST',{confirm:true});await json(p+'/corrections/'+merge.id+'/undo','POST',{confirm:true});
  const observation=(await json(p+'/repairs?issue='+original.issue)).repairs.find(row=>row.id===repair.id).observation;assert.ok(observation.reasons.some(reason=>reason.code==='grouping_changed'),'GROUP-001 historical correction preserves repair coverage gap');
 }
 const created=await json('/api/projects','POST',{id:'group-rules',name:'Cedar checkout grouping'}),base='/api/projects/group-rules',root=base+'/grouping-rules';
 await json(base+'/releases','POST',{name:'checkout@1.2.0',build:'web'});
 const dsn=new URL(created.dsn),path=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 let serial=0;
 const event=(type='KeyError',module='vendor.checkout',line=9)=>({event_id:(++serial).toString(16).padStart(32,'0'),release:'checkout@1.2.0',dist:'web',platform:'python',level:'error',logger:'checkout',sdk:{name:'sentry.python',version:'2.0'},exception:{values:[{type,value:'Account unavailable',stacktrace:{frames:[{filename:'/app/account.py',module:'cedar.account',function:'load',lineno:4,in_app:true},{filename:'/app/vendor.py',module,function:'wrap',lineno:line,in_app:true},{filename:'/app/hidden.py',function:'hidden',lineno:100,vars:{__traceback_hide__:true}}]}}]},tags:{tenant:'cedar'}});
 const send=async e=>{const r=await req(path,'POST','{}\n{"type":"event"}\n'+JSON.stringify(e));assert.equal(r.status,200,await r.text());return e};
 const original=await send(event()),second=await send(event('KeyError','vendor.payments',20));
 assert.equal((await json(base+'/issues')).length,2);
 const policy={version:1,stack:'stack.module:vendor.* -app\nstack.function:hidden -group',fingerprint:'error.type:KeyError tags.tenant:cedar -> checkout-account'};
 const preview=await json(root+'/preview','POST',{policy});assert.equal(preview.scanned,2);assert.ok(preview.rows.every(r=>r.changed));assert.equal(new Set(preview.rows.map(r=>r.destination)).size,1);
 assert.equal((await json(base+'/issues')).length,2,'preview leaves evidence unchanged');
 for(const [headers,status] of [[{Cookie:''},401],[{Origin:'https://foreign.invalid'},403]])assert.equal((await req(root,'PUT',{revision:0,policy},headers)).status,status);
 const grant=await json(base+'/keys','POST',{kind:'agent'});assert.equal((await req(root,'GET',undefined,{Cookie:'',Authorization:'Bearer '+grant.key})).status,403);
 assert.equal((await req(root,'PUT',{revision:0,policy:{...policy,stack:'stack.unknown:x -group'}})).status,400,'unknown matcher refused');
 await json(root,'PUT',{revision:0,policy});assert.equal((await req(root,'PUT',{revision:0,policy})).status,409);
 const later=await send(event()),different=await send(event('KeyError','vendor.new',45));
 let groups=await json(base+'/issues');assert.equal(groups.length,3);const destination=groups.find(i=>i.count===2);assert.ok(destination);
 const detail=async(issue,id)=>{const rows=await json(base+'/issues/'+issue+'/events');const selected=rows.rows.find(r=>r.id===id);return json(base+'/issues/'+issue+'/events/'+id+'?occurrence='+selected.occurrence)};
 const info=await detail(destination.id,later.event_id);assert.equal(info.grouping.revision,1);assert.equal(info.grouping.projectFingerprintRule,1);assert.equal(info.grouping.exceptions[0].frames[1].inApp,false);assert.equal(info.grouping.exceptions[0].frames[2].hidden,true);
 const oldIssue=groups.find(i=>i.id!==destination.id&&i.count===1);const oldEvent=(await json(base+'/issues/'+oldIssue.id+'/events')).rows[0];assert.equal((await detail(oldIssue.id,oldEvent.id)).grouping.revision,0,'activation preserves immutable old grouping');
 const stackOnly={...policy,fingerprint:''};await json(root,'PUT',{revision:1,policy:stackOnly});
 await send(event('TypeError','vendor.checkout',9));await send(event('TypeError','vendor.other',42));
 groups=await json(base+'/issues');assert.ok(groups.some(i=>i.count===2&&i.title.startsWith('TypeError')),'stack rules remove vendor-frame grouping noise');
 const archived=await archiveProjection(await req('/api/archive'));assert.equal(archived.data.grouping_policies.find(r=>r.project==='group-rules').revision,2);
 const restored=await startTestWorker(15524);try{
  const restoreCookie=await signIn(restored.origin);const result=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Origin:restored.origin,Cookie:restoreCookie,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:archived.text});assert.ok(result.ok,await result.text());
  for(const project of nativeProjects){const response=await fetch(restored.origin+'/api/projects/'+project+'/grouping-rules/versions',{headers:{Cookie:restoreCookie}});assert.equal((await response.json()).versions.length,3,'GROUP-001 native immutable policies survive archive restore')}
  const policyResponse=await fetch(restored.origin+root,{headers:{Cookie:restoreCookie}});assert.equal((await policyResponse.json()).revision,2);
  const restoredArchive=await archiveProjection(await fetch(restored.origin+'/api/archive',{headers:{Cookie:restoreCookie}}));assert.deepEqual(restoredArchive.data.grouping_policies,archived.data.grouping_policies);
  const wireRefusals=archive=>archive.data.outcomes.filter(row=>['invalid_item','unsupported_content_encoding'].includes(row.reason));
  assert.deepEqual(wireRefusals(restoredArchive),wireRefusals(archived),'SDK-011 refusal counts survive private archive restore');
 }finally{await restored.stop()}
 // The browser uses only the owner cookie; no private dev URL enters screenshots.
 const browser=await launchBrowser();
 try{await mkdir('.artifacts/grouping-rules',{recursive:true});for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.addCookies(cookie.split('; ').map(v=>({name:v.slice(0,v.indexOf('=')),value:v.slice(v.indexOf('=')+1),url:origin})));
  const page=await context.newPage();await page.goto(origin+'/projects/group-rules/settings/grouping');const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'Project grouping rules',exact:true})});try{await panel.getByLabel('Stack trace rules',{exact:true}).waitFor({timeout:10000})}catch(e){await page.screenshot({path:'.artifacts/grouping-rules/unavailable.png',fullPage:true});throw e}
  await panel.getByLabel('Fingerprint rules',{exact:true}).fill('error.type:KeyError -> checkout-account');await panel.getByRole('heading',{name:'Retained-event preview'}).waitFor();assert.ok((await panel.innerText()).includes('6 scanned'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await panel.screenshot({path:`.artifacts/grouping-rules/preview-${width}.png`});
  await panel.getByRole('button',{name:'Save grouping rules',exact:true}).click();await panel.getByRole('status').filter({hasText:'Grouping rules saved'}).waitFor();await panel.screenshot({path:`.artifacts/grouping-rules/saved-${width}.png`});
  const active=await json(root);await json(root,'PUT',{revision:active.revision,policy:active.policy});await panel.getByLabel('Fingerprint rules',{exact:true}).fill('error.type:KeyError -> checkout-accounts');await panel.getByRole('heading',{name:'Retained-event preview'}).waitFor();await panel.getByRole('button',{name:'Save grouping rules',exact:true}).click();await panel.getByRole('alert').filter({hasText:'revision conflict'}).waitFor();await panel.screenshot({path:`.artifacts/grouping-rules/conflict-${width}.png`});
  await page.goto(origin+'/projects/group-rules/issues/'+destination.id);await page.getByText('Related Exceptions',{exact:true}).waitFor();await page.locator('.metadata[data-event-id]').waitFor();await page.getByRole('button',{name:'Details: Event grouping information',exact:true}).click();await page.getByRole('dialog').waitFor();assert.ok((await page.getByRole('dialog').innerText()).includes('custom fingerprint'));await page.screenshot({path:`.artifacts/grouping-rules/explanation-${width}.png`});await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);const native=archived.data.events.find(row=>row.project===nativeProjects[0]&&JSON.parse(row.payload).grouping?.revision===1&&JSON.parse(row.payload).type==='RuleError');await page.goto(origin+'/projects/'+native.project+'/issues/'+native.issue);await page.locator('.metadata[data-event-id]').waitFor();const library=page.locator('.readable-stack details').filter({has:page.getByText('Library frame · not in app',{exact:true})});await library.waitFor();assert.equal(await library.getAttribute('open'),null,'GROUP-001 native -app frame starts collapsed');await library.getByText('Library frame · not in app',{exact:true}).click();assert.ok((await library.innerText()).includes('wrapper'));await library.getByText('Library frame · not in app',{exact:true}).click();await page.getByRole('button',{name:'Details: Event grouping information',exact:true}).click();await page.getByRole('dialog').waitFor();assert.ok((await page.getByRole('dialog').innerText()).includes('custom fingerprint'));await page.screenshot({path:`.artifacts/grouping-rules/native-explanation-${width}.png`});await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.goto(origin+'/projects/'+native.project+'/settings/grouping');
  await panel.getByLabel('Stack trace rules',{exact:true}).fill('stack.function:wrapper -app');await panel.getByLabel('Fingerprint rules',{exact:true}).fill('family:javascript error.type:RuleError -> native-checkout');
  await panel.getByRole('heading',{name:'Retained-event preview'}).waitFor();assert.match(await panel.innerText(),/[1-9]\d* scanned/,'GROUP-001 native preview includes retained native occurrences');await panel.screenshot({path:`.artifacts/grouping-rules/native-preview-${width}.png`});
  await panel.getByRole('button',{name:'Save grouping rules',exact:true}).click();await panel.getByRole('status').filter({hasText:'Grouping rules saved'}).waitFor();await panel.screenshot({path:`.artifacts/grouping-rules/native-saved-${width}.png`});
  const nativeRoot='/api/projects/'+native.project+'/grouping-rules',nativePolicy=await json(nativeRoot);await json(nativeRoot,'PUT',{revision:nativePolicy.revision,policy:nativePolicy.policy});await panel.getByLabel('Fingerprint rules',{exact:true}).fill('family:javascript error.type:RuleError -> native-checkouts');await panel.getByRole('heading',{name:'Retained-event preview'}).waitFor();await panel.getByRole('button',{name:'Save grouping rules',exact:true}).click();await panel.getByRole('alert').filter({hasText:'revision conflict'}).waitFor();await panel.screenshot({path:`.artifacts/grouping-rules/native-conflict-${width}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await context.close();
 }}finally{await browser.close()}
 for(const project of nativeProjects){const p='/api/projects/'+project,plan=await json(p+'/erasure');await followErasure(json,await json(p+'/erasure','POST',{confirm:project,planHash:plan.planHash}));const erased=(await archiveProjection(await req('/api/archive'))).data;assert.ok(!erased.events.some(row=>row.project===project)&&!erased.audit.some(row=>row.project===project)&&!erased.grouping_policies.some(row=>row.project===project),'GROUP-001 erasure removes native snapshots, versions and active policy')}
 const erasure=await json(base+'/erasure');assert.equal(erasure.deleted.grouping_policies,1);await followErasure(json,await json(base+'/erasure','POST',{confirm:'group-rules',planHash:erasure.planHash}));assert.ok(!(await archiveProjection(await req('/api/archive'))).data.grouping_policies.some(row=>row.project==='group-rules'));
 console.log('GROUP-001 grouping rules public flow passed: exact-project authority, preview/no mutation, future routing, revision conflicts, immutable explanations, archive policy and responsive save/detail.');
}
