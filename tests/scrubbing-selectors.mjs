// SDK-003 selector and method qualification through public Sentry/OTLP intake.
import assert from 'node:assert/strict';
import {issueDetails} from './runtimes/harness.mjs';

const privateValue=name=>'synthetic-spool-private-'+name;
const custom=(id,selector,method,replacement)=>({id:'synthetic-spool-'+id,selector,pattern:'regex',regex:'synthetic-spool-private-',method,...replacement===undefined?{}:{replacement}});
const builtin=(name,pattern,method,replacement)=>({id:'synthetic-spool-'+name,selector:'$extra.'+name,pattern,method,...replacement===undefined?{}:{replacement}});
const hash=value=>assert.match(value,/^[a-f0-9]{64}$/,'SDK-003 hash is a complete digest');
const absent=(value,needles)=>{for(const needle of needles)assert.ok(!JSON.stringify(value).includes(needle),'SDK-003 matched original is absent from owner evidence')};

export async function scrubbingSelectors({origin,cookie,request}){
 const policy={version:1,sensitiveFields:[],safeFields:[],rules:[
  custom('params','$logentry.params','remove'),custom('exception','$exception.value','mask'),
  custom('named-local','$frame.vars.direct_note','mask'),custom('locals','$frame.vars.**','hash'),
  custom('context','$frame.context','replace','synthetic-spool-replaced-line'),custom('headers','$request.headers.x-checkout','remove'),
  custom('extra','$extra.key','hash'),custom('checkout','$contexts.checkout.note','replace','synthetic-spool-replaced-note'),
  custom('tags','$tags.checkout','mask'),custom('crumb-message','$breadcrumbs.message','mask'),custom('crumb-data','$breadcrumbs.data.note','remove'),
  builtin('email','email','remove'),builtin('ipv4','ip_address','replace','synthetic-spool-replaced-ip'),
  builtin('card','credit_card','remove'),builtin('ssn','us_ssn','hash'),builtin('password_probe','password','remove'),builtin('auth_probe','auth_token','mask'),
  {id:'synthetic-spool-otlp',selector:'$message',pattern:'regex',regex:'synthetic-spool-otlp-private-',method:'mask'},
 ]};
 const setup=async id=>{
  const project=await request('/api/projects','POST',{id,name:id}),root='/api/projects/'+id;
  await request(root+'/releases','POST',{name:'synthetic-spool-selectors@1',build:'synthetic-spool-build'});
  const preview=await request(root+'/scrubbing/preview','POST',{policy});assert.equal(preview.refusal,null);assert.ok(preview.token);
  await request(root+'/scrubbing','PUT',{revision:preview.revision,policy,token:preview.token});return project;
 };
 const project=await setup('synthetic-spool-selectors'),other=await setup('synthetic-spool-selectors-other');
 // Published test-number shapes, assembled to keep complete card/SSN literals out of source.
 const examples={email:'synthetic-spool-person@example.test',ipv4:'192.0.2.44',card:'4'+'1'.repeat(15),ssn:['219','09','9999'].join('-'),password_probe:'password=synthetic-spool-private-password',auth_probe:'bearer synthetic-spool-private-auth'};
 const sentry=()=>({event_id:crypto.randomUUID().replaceAll('-',''),platform:'python',release:'synthetic-spool-selectors@1',dist:'synthetic-spool-build',environment:'compatibility',
  exception:{values:[{type:'SyntheticSpoolError',value:privateValue('exception'),stacktrace:{frames:[{
   filename:'/synthetic-spool/checkout.py',function:'syntheticSpoolCheckout',lineno:12,in_app:true,
   pre_context:['synthetic-spool-ordinary-pre',privateValue('pre-line')],context_line:privateValue('context-line'),post_context:[privateValue('post-line'),'synthetic-spool-ordinary-post'],
   vars:{direct_note:privateValue('direct-local'),order_note:privateValue('hashed-local'),nested:{note:privateValue('nested-local'),quantity:2},quantity:0},
  }]}}]},
  logentry:{message:'synthetic-spool-ordinary-template %s',formatted:'synthetic-spool-ordinary-formatted',params:['synthetic-spool-ordinary-first',privateValue('param-one'),privateValue('param-two'),'synthetic-spool-ordinary-last']},
  request:{url:'https://synthetic-spool.test/checkout',method:'POST',headers:{'x-checkout':privateValue('header'),'x-ordinary':'synthetic-spool-ordinary-header'}},
  extra:{key:privateValue('stable-hash'),ordinary:'synthetic-spool-ordinary-extra',...examples},
  contexts:{checkout:{note:privateValue('checkout'),ordinary:'synthetic-spool-ordinary-context'}},tags:{checkout:privateValue('tag'),ordinary:'synthetic-spool-ordinary-tag'},
  breadcrumbs:[{message:privateValue('breadcrumb'),data:{note:privateValue('crumb-data'),ordinary:'synthetic-spool-ordinary-data'}},{message:'synthetic-spool-ordinary-breadcrumb'}],
 });
 const send=async project=>{
  const value=sentry(),dsn=new URL(project.dsn),response=await fetch(origin+`/api${dsn.pathname}/store/?`+new URLSearchParams({sentry_key:dsn.username,sentry_version:'7'}),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
  assert.equal(response.status,200,'SDK-003 public Sentry store accepts the scoped payload');assert.equal((await response.json()).id,value.event_id);return value.event_id;
 };
 const first=await send(project),second=await send(project),otherId=await send(other);
 const details=(await issueDetails({json:request},project.id)).flatMap(issue=>issue.events),otherDetails=(await issueDetails({json:request},other.id)).flatMap(issue=>issue.events);
 const one=details.find(detail=>detail.id===first),two=details.find(detail=>detail.id===second),foreign=otherDetails.find(detail=>detail.id===otherId);
 assert.ok(one&&two&&foreign,'SDK-003 all scoped captures are readable at the owner event door');
 for(const detail of [one,two,foreign]){
  const value=detail.event.sentry,frame=value.exceptions[0].stacktrace.frames[0];
  assert.equal(detail.event.message,'[redacted]');assert.equal(value.exceptions[0].value,'[redacted]','exception and derived message aliases are scrubbed together');
  assert.deepEqual(value.logentry.params,['synthetic-spool-ordinary-first','synthetic-spool-ordinary-last'],'parameter removal preserves every nonmatching parameter in order');
  assert.equal(value.logentry.message,'synthetic-spool-ordinary-template %s');assert.equal(value.logentry.formatted,'synthetic-spool-ordinary-formatted');
  assert.equal(frame.vars.direct_note,'[redacted]');hash(frame.vars.order_note);hash(frame.vars.nested);assert.equal(frame.vars.quantity,0);
  assert.deepEqual(frame.pre_context,['synthetic-spool-ordinary-pre','synthetic-spool-replaced-line']);assert.equal(frame.context_line,'synthetic-spool-replaced-line');assert.deepEqual(frame.post_context,['synthetic-spool-replaced-line','synthetic-spool-ordinary-post']);
  assert.equal(frame.filename,'/synthetic-spool/checkout.py');assert.equal(frame.function,'syntheticSpoolCheckout');assert.equal(frame.lineno,12);
  assert.equal(Object.hasOwn(value.request.headers,'x-checkout'),false);assert.equal(value.request.headers['x-ordinary'],'synthetic-spool-ordinary-header');
  hash(value.extra.key);assert.equal(value.extra.ordinary,'synthetic-spool-ordinary-extra');
  assert.equal(value.contexts.checkout.note,'synthetic-spool-replaced-note');assert.equal(value.contexts.checkout.ordinary,'synthetic-spool-ordinary-context');
  assert.equal(value.tags.checkout,'[redacted]');assert.equal(value.tags.ordinary,'synthetic-spool-ordinary-tag');
  assert.equal(value.breadcrumbs[0].message,'[redacted]');assert.equal(Object.hasOwn(value.breadcrumbs[0].data,'note'),false);assert.equal(value.breadcrumbs[0].data.ordinary,'synthetic-spool-ordinary-data');assert.equal(value.breadcrumbs[1].message,'synthetic-spool-ordinary-breadcrumb');
  assert.equal(detail.event.breadcrumbs[0],'[redacted]','derived native breadcrumb is scrubbed with the SDK breadcrumb');
  assert.equal(Object.hasOwn(value.extra,'email'),false,'email remove rule removes the selected field');
  assert.equal(value.extra.ipv4,'synthetic-spool-replaced-ip');assert.equal(Object.hasOwn(value.extra,'card'),false,'card remove rule removes the selected field');hash(value.extra.ssn);assert.equal(Object.hasOwn(value.extra,'password_probe'),false);assert.equal(value.extra.auth_probe,'[redacted]');
  absent(detail,[...Object.values(examples),...['exception','direct-local','hashed-local','nested-local','pre-line','context-line','post-line','param-one','param-two','header','stable-hash','checkout','tag','breadcrumb','crumb-data'].map(privateValue)]);
 }
 assert.equal(one.event.sentry.extra.key,two.event.sentry.extra.key,'hashing the same value is stable within a project');
 assert.notEqual(one.event.sentry.extra.key,foreign.event.sentry.extra.key,'the same input is hashed independently in another project');
 assert.equal(one.event.sentry.exceptions[0].stacktrace.frames[0].vars.order_note,two.event.sentry.exceptions[0].stacktrace.frames[0].vars.order_note);
 const attribute=(key,value)=>({key,value:typeof value==='number'?{intValue:String(value)}:{stringValue:value}}),otlpId='synthetic-spool-otlp-'+crypto.randomUUID(),unused='synthetic-spool-unused-attribute';
 const otlp={resourceLogs:[{resource:{attributes:[attribute('service.version','synthetic-spool-selectors@1'),attribute('spool.build','synthetic-spool-build'),attribute('deployment.environment.name','compatibility'),attribute('synthetic-spool.unselected',unused)]},scopeLogs:[{scope:{name:'synthetic-spool-selectors'},logRecords:[{body:{stringValue:'synthetic-spool-otlp-private-message'},attributes:[attribute('spool.event_id',otlpId),attribute('code.file.path','https://synthetic-spool.test/checkout.js'),attribute('code.function.name','syntheticSpoolOtlp'),attribute('code.line.number',8),attribute('code.column.number',3),attribute('synthetic-spool.unselected',unused)]}]}]}]};
 const response=await fetch(origin+`/api/otlp/${project.id}/v1/logs`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+project.ingestKey},body:JSON.stringify(otlp)});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{},'the located OTLP record is accepted without partial rejection');
 const otlpDetail=(await issueDetails({json:request},project.id)).flatMap(issue=>issue.events).find(detail=>detail.id===otlpId);assert.ok(otlpDetail);
 assert.equal(otlpDetail.event.message,'[redacted]');assert.equal(otlpDetail.event.frames[0].function,'syntheticSpoolOtlp');assert.equal(otlpDetail.event.frames[0].line,8);assert.equal(otlpDetail.event.frames[0].column,2);
 assert.equal(otlpDetail.event.sentry,undefined);absent(otlpDetail,['synthetic-spool-otlp-private-message',unused]);
 return {passed:true,proof:'SDK-003 public Sentry selectors, per-parameter/per-line transformations, scoped stable hashes, builtin patterns and OTLP message policy'};
}
