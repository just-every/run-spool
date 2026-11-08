import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import {objectJson} from '../../src/domain/sentry/wire.ts';
import {expectedOutcomes,issueDetails,outcomeMap,referenceCollector,run} from './harness.mjs';
import {readScreens} from './screens.mjs';

// Qualify the default LinkedErrors and JVM integrations, without supplying an
// exception payload or changing capture code between the collector and Spool.
export async function causeChainProof({runtime,app,dir,origin,cookie,identity}){
 const {mode,types,mechanisms,functions}=runtime.cause;
 const execute=async dsn=>{
  const spec=runtime.command(mode,dir,dsn);
  const result=await run(spec.command,spec.args,{cwd:spec.cwd,env:{...identity,...spec.env},unset:spec.unset});
  assert.equal(result.code,0,`${runtime.name} ${mode}: ${result.stderr}`);
 };
 const reference=await referenceCollector();
 try{await execute(reference.dsn)}finally{await reference.close()}
 const sent=reference.sent.filter(item=>item.type==='event').map(item=>objectJson(item.bytes));
 assert.equal(sent.length,1,'the SDK sends exactly one linked failure');
 const expected=sent[0].exception.values;
 assert.deepEqual(expected.map(exception=>exception.type),types,'the SDK itself emits every expected cause and wrapper');
 if(mechanisms)assert.deepEqual(expected.map(exception=>exception.mechanism.type),mechanisms,'the Java SDK distinguishes suppressed exceptions');
 for(const [index,exception] of expected.entries()){
  assert.ok(exception.stacktrace.frames.length,'each SDK exception has its own stack');
  assert.ok(exception.stacktrace.frames.some(frame=>frame.function===functions[index]),'each cause has its actual failing function');
 }
 const project=await app.json('/api/projects','POST',{id:`rt-${runtime.name}-causes`,name:`${runtime.name} cause chains`});
 await execute(project.dsn);
 const details=await issueDetails(app,project.id);
 assert.equal(details.length,1,'the complete chain creates one issue');
 const [{issue,events}]=details;
 assert.equal(issue.count,1,'the linked failure counts once');
 assert.equal(events.length,1,'one retained occurrence owns the complete chain');
 const [detail]=events,actual=detail.event.sentry.exceptions;
 // Compare every member and frame in SDK order. Exception thread_id and frame
 // native are SDK metadata outside SDK-010's enumerated retained fields.
 const retained=expected.map(({thread_id,...exception})=>({...exception,stacktrace:{...exception.stacktrace,frames:exception.stacktrace.frames.map(({native,...frame})=>frame)}}));
 assert.deepEqual(actual,retained,'all SDK-sent causes, wrappers, relations and their own full frames survive the owner read');
 assert.deepEqual([...await outcomeMap(app,project.id)].sort(),[...expectedOutcomes(reference.sent)].sort(),'all items emitted alongside the chain reconcile');
 const root=`/api/projects/${project.id}/issues/${issue.id}/events`,path=`${root}/${detail.id}?occurrence=${detail.occurrence}`;
 assert.equal((await app.request(path,'GET',undefined,{Cookie:''})).status,401,'an anonymous caller cannot read the chain');
 const grant=await app.json(`/api/projects/${project.id}/keys`,'POST',{kind:'agent'});
 assert.equal((await app.request(path,'GET',undefined,{Cookie:'',Authorization:'Bearer '+grant.key})).status,403,'agent authority does not expose owner stack evidence');
 const foreign=await app.json('/api/projects','POST',{id:`rt-${runtime.name}-foreign`,name:'Unrelated cause project'});
 assert.equal((await app.request(`/api/projects/${foreign.id}/issues/${issue.id}/events/${detail.id}?occurrence=${detail.occurrence}`)).status,404,'a foreign project cannot select the retained occurrence');
 await readScreens(origin,cookie,[{
  name:`${runtime.name}-causes`,path:`/projects/${project.id}/issues/${issue.id}`,capture:'.event-diagnostic',
  check:async page=>{
   for(const exception of expected)await page.locator('article.exception > h3').filter({hasText:`${exception.type}: ${exception.value}`}).waitFor();
   if(page.viewportSize().width!==1440)return;
   const articles=page.locator('article.exception');
   assert.equal(await articles.count(),expected.length,'Related Exceptions shows every SDK chain member');
   const marked=[];
   for(const [index,exception] of expected.entries()){
    const article=page.locator('article.exception > h3').filter({hasText:`${exception.type}: ${exception.value}`}).locator('..');
    const label=article.locator(':scope > h3 small');
    if(await label.count()){
     assert.equal(await label.innerText(),'Root cause','the innermost exception has an explicit root-cause label');
     marked.push(exception.type);
    }
    if(exception.mechanism?.type)assert.ok((await article.locator(':scope > p').innerText()).includes(exception.mechanism.type),'each relation remains distinguishable');
    const frames=article.locator(':scope > ol.exception-stack > li');
    assert.equal(await frames.count(),exception.stacktrace.frames.length,'each exception displays its own complete stack');
    for(const [frameIndex,frame] of exception.stacktrace.frames.entries()){
     const row=frames.nth(frameIndex),collapsed=row.locator(':scope > details');
     if(await collapsed.count())await collapsed.locator('summary').click();
     const code=row.locator('code').first();
     await code.waitFor({state:'visible'});
     const coordinate=`${frame.abs_path??frame.filename??'<unlocated>'}:${frame.lineno??'?'}${frame.colno==null?'':`:${frame.colno}`}`;
     assert.equal(await code.innerText(),`${coordinate} · ${frame.function??frame.raw_function??'<anonymous>'}`,`exception ${index} frame ${frameIndex} is rendered from its own SDK stack`);
    }
   }
   assert.deepEqual(marked,[types[0]],'only the innermost cause is marked Root cause; wrappers and suppressed exceptions are not');
   const trigger=page.getByRole('button',{name:'Details: Raw stack trace',exact:true});
   await trigger.focus();await page.keyboard.press('Enter');
   const dialog=page.getByRole('dialog',{name:'Raw stack trace',exact:true});
   await dialog.waitFor();
   assert.ok(await dialog.evaluate(element=>element.contains(document.activeElement)),'keyboard activation moves focus into the raw trace');
   const raw=await dialog.locator('pre').innerText();
   for(const exception of expected)assert.ok(raw.includes(`${exception.type}: ${exception.value}`),'raw trace includes every chain member');
   await page.keyboard.press('Escape');
   assert.ok(await trigger.evaluate(element=>element===document.activeElement),'Escape restores focus to the trace control');
   assert.deepEqual((await new AxeBuilder({page}).include('.event-diagnostic').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(violation=>violation.id),[],'Related Exceptions remains accessible');
  },
 }]);
 console.log(JSON.stringify({probe:'SDK-010 cause chains',runtime:runtime.name,sent:expected.length,retained:actual.length,frames:actual.map(exception=>exception.stacktrace.frames.length),root:types[0],screens:[1440,390]}));
}
