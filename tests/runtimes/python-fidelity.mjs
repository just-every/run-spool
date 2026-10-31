import assert from 'node:assert/strict';
import {archiveProjection} from '../archive.mjs';
import {objectJson} from '../../src/domain/sentry/wire.ts';
import {exceptionTypes,issueDetails,referenceCollector} from './harness.mjs';
import {readScreens} from './screens.mjs';

const secrets=['synthetic-spool-f113-password','synthetic-spool-f113-api-key','synthetic-spool-f113-authorization','synthetic-spool-cookie','synthetic-spool-3'];
const ordinary='synthetic-spool-f113-ordinary';
const frames=event=>event.sentry.exceptions.flatMap(exception=>exception.stacktrace?.frames??[]);
const noSecrets=(value,door)=>{for(const secret of secrets)assert.ok(!JSON.stringify(value).includes(secret),`${door}: sensitive canary excluded`)};
function maskedLocals(event,door){
 const local=frames(event).find(frame=>frame.function==='checkout'&&frame.vars?.order_note);
 assert.ok(local,`${door}: SDK frame locals retained`);
 assert.equal(local.vars.password,'[redacted]',`${door}: password masked`);
 assert.equal(local.vars.api_key,'[redacted]',`${door}: API key masked`);
 assert.equal(local.vars.quantity,'7',`${door}: ordinary quantity retained`);
 assert.equal(local.vars.order_note,`'${ordinary}'`,`${door}: ordinary string retained`);
 noSecrets(event,door);
}
function requestEvidence(event,door){
 const request=event.sentry.request;
 assert.equal(new URL(request.url).pathname,'/checkout',`${door}: Django URL retained`);
 assert.equal(request.method,'GET',`${door}: Django method retained`);
 const query=new URLSearchParams(request.query_string);
 assert.equal(query.get('page'),'2');assert.equal(query.get('token'),'[redacted]');
 const headers=Object.fromEntries(Object.entries(request.headers??{}).map(([key,value])=>[key.toLowerCase(),value]));
 assert.equal(headers['user-agent'],'spool-runtime-qualification',`${door}: allowed header retained`);
 for(const key of ['cookie','authorization'])assert.ok(headers[key]===undefined||/\[(?:redacted|Filtered)\]/.test(headers[key]),`${door}: ${key} header excluded or masked`);
 noSecrets(event,door);
}

// One privacy journey, through real SDK intake, owner detail, archive and agent doors.
export async function pythonFidelity({app,origin,cookie,db,send}){
 const captured=[];
 for(const [id,script] of [['rt-python-privacy','privacy_chain.py'],['rt-python-request','django_app.py']]){
  const collector=await referenceCollector();
  try{
   const result=await send(collector.dsn,script);assert.equal(result.code,0,result.stderr);
  }finally{await collector.close()}
  const reference=collector.sent.filter(item=>item.type==='event').map(item=>objectJson(item.bytes));
  assert.equal(reference.length,1,`${script}: reference receives one real SDK error`);
  const project=await app.json('/api/projects','POST',{id,name:id});
  const result=await send(project.dsn,script);assert.equal(result.code,0,result.stderr);
  const [detail,...extra]=await issueDetails(app,id);assert.ok(detail);assert.equal(extra.length,0);assert.equal(detail.events.length,1);
  const [event]=detail.events;
  // Read D1 bytes directly: owner and archive normalizers cannot hide a storage leak.
  const stored=await db.prepare('SELECT payload FROM events WHERE project=? AND id=? AND occurrence=?').bind(id,event.id,event.occurrence).first();
  assert.ok(stored);const payload=JSON.parse(stored.payload);
  assert.deepEqual(payload.sentry.exceptions.map(e=>e.type),reference[0].exception.values.map(e=>e.type),'all SDK chain members persist in order');
  captured.push({project,detail,event,payload,reference:reference[0]});
 }
 const [chain,django]=captured;
 assert.deepEqual(exceptionTypes(chain.event),['KeyError','ValueError']);
 const sentFrames=chain.reference.exception.values.flatMap(exception=>exception.stacktrace.frames);
 const sentLocal=sentFrames.find(frame=>frame.function==='checkout'&&frame.vars?.order_note);
 assert.ok(sentLocal,'the unmodified Python SDK actually captured locals');
 assert.ok(JSON.stringify(sentLocal.vars.password).includes(secrets[0]),'reference sees the password canary before Spool');
 assert.ok(JSON.stringify(sentLocal.vars.api_key).includes(secrets[1]),'reference sees the API-key canary before Spool');
 maskedLocals(chain.payload,'persisted event');maskedLocals(chain.event.event,'owner detail');
 const sentRequest=django.reference.request;
 assert.equal(sentRequest.method,'GET');assert.equal(new URL(sentRequest.url).pathname,'/checkout');
 const sentHeaders=Object.fromEntries(Object.entries(sentRequest.headers).map(([key,value])=>[key.toLowerCase(),value]));
 assert.equal(sentHeaders['authorization'],'Bearer '+secrets[2],'the real Django request sent the Authorization canary');
 assert.ok(sentHeaders.cookie.includes('synthetic-spool-cookie'),'the real Django request sent the cookie control');
 requestEvidence(django.payload,'persisted event');requestEvidence(django.event.event,'owner detail');
 const archiveResponse=await app.request('/api/archive');assert.equal(archiveResponse.status,200);
 const archive=await archiveProjection(archiveResponse);noSecrets(archive.text,'private archive bytes');
 for(const capture of captured){
  const row=archive.data.events.find(row=>row.project===capture.project.id&&row.id===capture.event.id&&row.occurrence===capture.event.occurrence);
  assert.ok(row,'actual archive contains the captured occurrence');
  const event=JSON.parse(row.payload); // No product normalization at this boundary.
  if(capture===chain)maskedLocals(event,'private archive payload');else requestEvidence(event,'private archive payload');
  const root=`/api/projects/${capture.project.id}`,eventPath=`${root}/issues/${capture.detail.issue.id}/events/${capture.event.id}?occurrence=${capture.event.occurrence}`;
  const grant=await app.json(root+'/keys','POST',{kind:'agent'}),agent={Cookie:'',Authorization:'Bearer '+grant.key};
  for(const headers of [{},agent]){
   const packet=await app.json(`${root}/issues/${capture.detail.issue.id}/packet`,'GET',undefined,headers);
   noSecrets(packet,'packet');
   for(const event of packet.events){
    for(const frame of frames(event.event))for(const key of ['vars','pre_context','context_line','post_context'])assert.equal(frame[key],undefined,'packets do not acquire local or source scope');
    assert.equal(event.event.sentry.request,undefined,'packets do not acquire request scope');
   }
   assert.ok(!JSON.stringify(packet).includes(ordinary),'ordinary local stays inside permitted owner evidence');
  }
  assert.equal((await app.request(eventPath,'GET',undefined,agent)).status,403,'agent cannot read rich owner detail');
  assert.equal((await app.request('/api/archive','GET',undefined,agent)).status,403,'agent cannot export private evidence');
  assert.equal((await app.request(eventPath,'GET',undefined,{Cookie:''})).status,401,'anonymous detail refused');
  await app.json(root+'/keys/'+grant.hash,'DELETE');
  const revoked=await app.request(`${root}/issues/${capture.detail.issue.id}/packet`,'GET',undefined,agent);
  assert.equal(revoked.status,401,'revoked grant cannot expose the previously permitted packet');
 }
 const pages=[{
  name:'python-private-chain',path:`/projects/${chain.project.id}/issues/${chain.detail.issue.id}`,
  check:async page=>{
   await page.getByRole('heading',{name:'Related Exceptions',exact:true}).waitFor();
   for(const type of ['KeyError','ValueError'])await page.locator('article.exception h3').filter({hasText:type}).waitFor();
   const locals=page.locator('article.exception details').filter({has:page.locator(':scope > summary').filter({hasText:'Local variables · sent by SDK'})});
   await locals.first().locator(':scope > summary').click();
   await page.getByRole('button',{name:'Details: Raw stack trace',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'Raw stack trace',exact:true});await dialog.waitFor();
   if(page.viewportSize().width===1440){
    const text=await dialog.locator('pre').innerText();noSecrets(text,'displayed raw chain');
    const traces=text.split('\n\nThe above exception was the cause/context of the following exception:\n\n');
    assert.equal(traces.length,2,'both complete Python tracebacks shown');
    for(const [index,exception] of chain.event.event.sentry.exceptions.entries()){
     assert.ok(traces[index].startsWith('Traceback (most recent call last):\n'));
     const expected=exception.stacktrace.frames.map(frame=>`  File "${frame.filename??frame.abs_path}", line ${frame.lineno}, in ${frame.function}`);
     assert.deepEqual(traces[index].split('\n').slice(1,-1),expected,'every sanitized frame copied in SDK order');
     assert.equal(traces[index].split('\n').at(-1),`${exception.type}: ${exception.value}`);
    }
    await page.context().grantPermissions(['clipboard-read','clipboard-write']);
    await dialog.getByRole('button',{name:'Copy raw stack trace',exact:true}).click();await dialog.getByRole('button',{name:'Stack trace copied',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),text,'clipboard contains the entire sanitized Python chain');
    noSecrets(await page.evaluate(()=>navigator.clipboard.readText()),'clipboard');
    const body=await page.locator('body').innerText();noSecrets(body,'issue view');
    assert.ok(body.includes('quantity')&&body.includes('password')&&body.includes('[redacted]'),'owner view presents ordinary and masked locals');
   }
  },
 },{
  name:'python-django-request',path:`/projects/${django.project.id}/issues/${django.detail.issue.id}`,
  check:async page=>{
   const request=page.locator('.event-sections > details').filter({has:page.locator(':scope > summary').filter({hasText:'Request'})});
   await request.locator('summary').click();await request.locator('pre').waitFor();
   if(page.viewportSize().width===1440){
    const shown=JSON.parse(await request.locator('pre').innerText());requestEvidence({sentry:{request:shown}},'Django issue view');
   }
  },
 }];
 await readScreens(origin,cookie,pages);
 console.log('PROBE SDK-010 acceptance 2: pinned Python SDK intake -> raw persisted and private archive payloads mask both canaries; owner ordinary locals survive; packets omit locals and refused grants reveal none');
 console.log('PROBE SDK-010 acceptance 6: real Django WSGI request -> URL, GET and User-Agent retained; cookie and Authorization canaries absent from storage, owner view, archive and packet');
 console.log('PROBE SDK-010 acceptance 8 copied chain: issue raw-stack dialog -> clipboard equals both complete sanitized KeyError and ValueError tracebacks; screens recorded at 1440 and 390');
}
