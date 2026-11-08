import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {rule} from './runtime.mjs';
import {tick} from './native-journey.mjs';

// Both cases enter the emitted Worker through Sentry intake and native triage.
export async function plainResolvedRegressions(app,fixture) {
 const base='/api/projects/web',alerting=base+'/alerting';
 const grant=await app.json(base+'/keys','POST',{kind:'ingest'}),dsn=new URL(grant.dsn);
 const door=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 const second=await app.json(alerting+'/rules','POST',rule('mail',{name:'Second regression destination',kinds:['regression']}));
 await app.json(alerting+'/rules','POST',rule('mail',{name:'New issues only',kinds:['new_issue']}));
 await app.json(alerting+'/rules','POST',rule('mail',{name:'Disabled regression destination',enabled:false,kinds:['regression']}));
 const matching=[fixture.rule,second.id].sort(),release='checkout@1.0.0',build='web';
 const cases=[{type:'SameReleaseError',fn:'confirmOrder',release},{type:'NoReleaseError',fn:'sendReceipt',release:undefined}];
 let serial=62000;
 const event=(item,eventRelease)=>({event_id:(++serial).toString(16).padStart(32,'0'),...(eventRelease===undefined?{}:{release:eventRelease}),dist:build,platform:'javascript',environment:'production',exception:{values:[{type:item.type,value:'Checkout unavailable',stacktrace:{frames:[{filename:'https://app.example.com/checkout.js',function:item.fn,lineno:12,colno:3}]}}]}});
 const send=async value=>{
  const response=await app.request(door,'POST','{}\n{"type":"event"}\n'+JSON.stringify(value),{Cookie:'',Authorization:''});
  assert.equal(response.status,200,'Sentry intake accepts the capture');
  assert.equal((await response.json()).id,value.event_id);
 };
 const issues=()=>app.json(base+'/issues');
 for(const item of cases){
  await send(event(item,release));
  const issue=(await issues()).find(row=>row.title.startsWith(item.type+':'));
  assert.ok(issue,'the initial Sentry capture creates its issue');item.issue=issue.id;
  assert.equal(issue.count,1);
  await app.json(base+'/issues/'+issue.id,'PATCH',{state:'resolved',resolution:'plain',revision:issue.revision});
 }
 assert.notEqual(cases[0].issue,cases[1].issue,'two distinct issues are plain-resolved');
 for(const item of cases)assert.equal((await issues()).find(row=>row.id===item.issue).state,'resolved');
 const observed=(await app.json(base+'/releases')).find(row=>row.name===release);
 assert.ok(observed,'initial captures create the real release');
 for(const item of cases){item.recurrence=event(item,item.release);await send(item.recurrence)}
 await tick(app);
 const check=async count=>{
  const feed=await app.json(base+'/alerts'),rows=await issues();
  const deliveryRows=await app.json(alerting+'/deliveries'),ids=[];
  for(const item of cases){
   const issue=rows.find(row=>row.id===item.issue);
   assert.equal(issue.state,'open','plain resolution reopens on the next accepted event');
   assert.equal(issue.count,count,'only distinct captures increment the issue');
   const alerts=feed.filter(row=>row.issue===item.issue&&row.kind==='regression');
   assert.equal(alerts.length,1,'each plain-resolved issue has exactly one regression alert');
   const alert=alerts[0],payload=JSON.parse(alert.payload);ids.push(alert.id);
   assert.equal(payload.issueId,item.issue);
   assert.equal(payload.kind,'regression');
   assert.deepEqual(payload.release,{name:item.release??'',build,sequence:item.release?observed.seq:0},'regression carries the triggering release identity');
   const deliveries=deliveryRows.filter(row=>row.alert_id===alert.id);
   assert.deepEqual(deliveries.map(row=>row.rule_id).sort(),matching,'one delivery per reviewed matching rule, with no disabled or nonmatching rule');
   for(const delivery of deliveries){
    assert.equal(delivery.state,'accepted');assert.equal(delivery.attempts,1);
    const detail=await app.json(alerting+'/deliveries/'+delivery.id);
    assert.equal(detail.attempts.length,1);assert.equal(detail.attempts[0].state,'accepted');
   }
   const intents=(await app.db.prepare('SELECT rule_id,body FROM alert_intents WHERE alert_id=?').bind(alert.id).all()).results;
   assert.deepEqual(intents.map(row=>row.rule_id).sort(),matching,'admission persists exactly one intent per matching rule');
   for(const intent of intents)assert.deepEqual(JSON.parse(intent.body),payload,'delivery intent preserves the regression payload');
  }
  return ids;
 };
 // Native dispatch finishes in waitUntil; observe its public delivery history.
 for(let i=0;i<100;i++){
  const deliveries=(await app.json(alerting+'/deliveries')).filter(row=>cases.some(item=>item.issue===row.issue)&&row.kind==='regression');
  if(deliveries.length===4&&deliveries.every(row=>row.state==='accepted'))break;
  await delay(50);
 }
 const original=await check(2);
 await Promise.all([...cases.map(item=>send(item.recurrence)),tick(app),tick(app)]);
 assert.deepEqual(await check(2),original,'repeated capture and scheduling preserve both regression identities');
 for(const item of cases)await send(event(item,item.release));
 await tick(app);await tick(app);
 assert.deepEqual(await check(3),original,'further captures of the open issues do not create another regression or delivery');
 console.log('PROBE ALERT-001 acceptance-5: Sentry intake and plain Resolve on two distinct issues -> same-release and release-less recurrence each reopen once, retain the correct release identity and create two reviewed-rule intents; repeated capture and scheduling create no duplicate alert, intent or attempt.');
}
