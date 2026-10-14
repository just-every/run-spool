import { archiveProjection } from './archive.mjs';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';

/** Called by sentry-http's existing real Worker/owner HTTP session; creates no processes. */
export async function otlpFlow({req,json,origin}){
  const project=await json('/api/projects','POST',{id:'otlp',name:'OTLP flow'});
  const other=await json('/api/projects','POST',{id:'otlp-other',name:'OTLP isolation'});
  for(const [name,build] of [['otlp@1','one'],['otlp@2','two']])await json('/api/projects/otlp/releases','POST',{name,build});
  const path='/api/otlp/otlp/v1/logs',headers={Authorization:`Bearer ${project.ingestKey}`};
  for(const signal of ['resourceSpans','resourceMetrics'])assert.equal((await req(path,'POST',{[signal]:[]},headers)).status,422,'non-log OTLP signals are explicitly refused');
  const attr=(key,value)=>({key,value:typeof value==='number'?{intValue:String(value)}:{stringValue:value}});
  const log=(id,message='located token=OTLP_MESSAGE_CANARY')=>({timeUnixNano:'1750000000000000000',severityNumber:17,body:{stringValue:message},attributes:[attr('spool.event_id',id),attr('code.file.path','https://app.example/app.js?token=OTLP_URL_CANARY'),attr('code.function.name','writeLog'),attr('code.line.number',5),attr('code.column.number',3),attr('private.unused','OTLP_UNUSED_CANARY')]});
  const exception=id=>({body:{stringValue:'unused'},attributes:[attr('spool.event_id',id),attr('exception.type','TypeError'),attr('exception.message','failed token=OTLP_EXCEPTION_CANARY'),attr('exception.stacktrace','TypeError: failed\n    at throwSite (https://app.example/error.js?token=OTLP_STACK_CANARY:8:4)')]});
  const group=(records,second=false)=>({resource:{attributes:[attr('service.version',second?'otlp@2':'otlp@1'),attr('spool.build',second?'two':'one'),attr('deployment.environment.name',second?'production':'test'),attr('private.resource','OTLP_RESOURCE_CANARY')]},scopeLogs:[{scope:{name:'real-http-fixture'},logRecords:records}]});
  const batch=records=>({resourceLogs:[group(records)]});
  const send=(value,extra={})=>req(path,'POST',value,{...headers,...extra});
  const rows=async()=>((await archiveProjection(await req('/api/archive'))).data.events).filter(row=>row.project==='otlp');
  assert.equal((await req(path,'POST',batch([log('cookie-only')]))).status,401,'an owner cookie cannot ingest');
  assert.equal((await send(batch([log('wrong-grant')]),{Authorization:`Bearer ${other.ingestKey}`})).status,401);
  assert.equal((await send(batch([log('wrong-origin')]),{Origin:'https://forbidden.example'})).status,403);
  const foreign='https://otlp.example';await json('/api/projects/otlp/browser-origins','POST',{origin:foreign});
  const preflight=await req(path,'OPTIONS',undefined,{Origin:foreign,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),foreign);
  assert.equal((await req(path,'OPTIONS',undefined,{Origin:'https://forbidden.example','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'})).status,403);
  const first=log('otlp-log'),second=exception('otlp-exception');
  const accepted=await send({resourceLogs:[group([first]),group([second],true)]},{Origin:foreign});
  assert.equal(accepted.status,200);assert.deepEqual(await accepted.json(),{});assert.equal(accepted.headers.get('access-control-allow-origin'),foreign);
  const stored=await rows();assert.equal(stored.length,2);
  const storedLog=stored.find(row=>row.id==='otlp-log'),storedException=stored.find(row=>row.id==='otlp-exception');
  assert.equal(storedLog.release,'otlp@1');assert.equal(storedLog.build,'one');assert.equal(storedLog.environment,'test');
  assert.equal(storedException.release,'otlp@2');assert.equal(storedException.build,'two');assert.equal(storedException.environment,'production');
  assert.equal(JSON.parse(storedLog.payload).frames[0].line,5);assert.equal(JSON.parse(storedLog.payload).frames[0].column,2);
  assert.equal(JSON.parse(storedException.payload).frames[0].line,8);assert.equal(JSON.parse(storedException.payload).frames[0].column,3);
  for(const canary of ['OTLP_MESSAGE_CANARY','OTLP_URL_CANARY','OTLP_UNUSED_CANARY','OTLP_RESOURCE_CANARY','OTLP_EXCEPTION_CANARY','OTLP_STACK_CANARY'])assert.ok(!JSON.stringify(stored).includes(canary),'raw private values never persist');
  assert.deepEqual(await (await send(batch([first]))).json(),{});assert.equal((await rows()).length,2);
  const changed=structuredClone(first);changed.attributes.find(row=>row.key==='private.unused').value.stringValue='CHANGED_PRIVATE_CANARY';
  const conflict=await send(batch([changed]));assert.equal(conflict.status,200);assert.equal((await conflict.json()).partialSuccess.rejectedLogRecords,'1');assert.equal((await rows()).length,2,'pre-scrub differences conflict despite identical normalized data');
  const resourceChanged=batch([first]);resourceChanged.resourceLogs[0].resource.attributes.at(-1).value.stringValue='CHANGED_RESOURCE_CANARY';
  assert.equal((await (await send(resourceChanged)).json()).partialSuccess.rejectedLogRecords,'1');
  const stackless={body:{stringValue:'no invented location'},attributes:[attr('spool.event_id','stackless')]};
  const duplicate=log('duplicate-attrs');duplicate.attributes.push(attr('spool.event_id','duplicate-attrs'));
  const conflicting=log('conflicting-value');conflicting.body.intValue='9';
  const sourceType=log('unsupported-source');sourceType.attributes.push(attr('spool.event_type','metric'));
  const partial=await send(batch([log('partial-valid'),stackless,duplicate,conflicting,sourceType]));
  assert.equal(partial.status,200);assert.equal((await partial.json()).partialSuccess.rejectedLogRecords,'4');assert.equal((await rows()).length,3);
  const rejectedAll=await send(batch([stackless,duplicate]));assert.equal(rejectedAll.status,200);assert.equal((await rejectedAll.json()).partialSuccess.rejectedLogRecords,'2');
  assert.deepEqual(await (await send({})).json(),{},'empty OTLP export succeeds');
  const before=(await rows()).length;
  for(const invalid of ['{"resourceLogs":',JSON.stringify({resourceLogs:[group([log('must-not-admit')]),{scopeLogs:[{logRecords:{}}]}]})])assert.equal((await send(invalid)).status,400);
  const deep={};let cursor=deep;for(let i=0;i<40;i++){cursor.next={};cursor=cursor.next}assert.equal((await send(deep)).status,413);
  assert.equal((await send(batch(Array.from({length:40},(_,i)=>log('excess-'+i))))).status,413);
  assert.equal((await send({padding:'x'.repeat(40000)})).status,413);
  assert.equal((await send(gzipSync(Buffer.from(JSON.stringify(batch([log('compressed')])))),{'Content-Encoding':'gzip'})).status,415);
  assert.equal((await send(batch([log('protobuf')]),{'Content-Type':'application/x-protobuf'})).status,415);
  assert.equal((await rows()).length,before,'malformed structure, size and wire failures admit no prefix');
  const outcomes=await json('/api/projects/otlp/outcomes');for(const reason of ['accepted','duplicate','conflict','invalid','oversized'])assert.ok(outcomes.rows.some(row=>row.reason===reason));
  // Invalid OTLP records consume the existing native project budget. Discover its
  // boundary through HTTP, without pinning a threshold or modifying the database.
  const budget=await json('/api/projects','POST',{id:'otlp-budget',name:'Shared admission budget'});
  await json('/api/projects/otlp-budget/releases','POST',{name:'otlp@1',build:'one'});
  const budgetHeaders={Authorization:`Bearer ${budget.ingestKey}`},budgetPath='/api/otlp/otlp-budget/v1/logs';
  let limited;
  for(let i=0;i<20;i++){
    await req(budgetPath,'POST',batch(Array.from({length:32},()=>stackless)),budgetHeaders);
    limited=await req(budgetPath,'POST',batch([log('budget-probe-'+i)]),budgetHeaders);
    if(limited.status===429)break;
    assert.equal(limited.status,200);
  }
  assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);
  const native={version:1,eventId:'native-shared-budget',release:'otlp@1',build:'one',environment:'test',type:'Error',message:'native shares budget',frames:[{file:'https://app.example/native.js',line:1,column:0,function:'native'}],breadcrumbs:[]};
  const nativeLimited=await req('/api/ingest/otlp-budget','POST',native,budgetHeaders);assert.equal(nativeLimited.status,429);
  await json('/api/projects/otlp/browser-origins','DELETE',{origin:foreign});assert.equal((await send(batch([log('removed-origin')]),{Origin:foreign})).status,403);
  const grant=(await json('/api/projects/otlp/keys')).find(row=>row.kind==='ingest');await json('/api/projects/otlp/keys/'+grant.hash,'DELETE');
  assert.equal((await send(batch([log('revoked')]))).status,401);assert.equal((await rows()).length,before);
  console.log('OTLP HTTP flow passed: located log/JS exception, resource association, privacy/deduplication, full/partial rejection accounting, framing/limits, project CORS/grant revocation and shared native budget.');
}
