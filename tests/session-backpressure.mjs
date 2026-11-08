import assert from 'node:assert/strict';
import {mock} from 'node:test';

// Part of sessionFlow: the installed SDK and the emitted app use their real transports.
export async function sessionBackpressureFlow({app,origin}) {
 const Sentry=await import('@sentry/node');
 const project=await app.json('/api/projects','POST',{id:'synthetic-spool-backpressure',name:'Session backpressure'});
 const root='/api/projects/'+project.id,dsn=new URL(project.dsn);
 const path=dsn.origin+'/api'+dsn.pathname+'/envelope/?sentry_version=7&sentry_key='+dsn.username;
 const ledger={};
 const add=counts=>{for(const [reason,count] of Object.entries(counts))ledger[reason]=(ledger[reason]??0)+count};
 const send=async(items,key=dsn.username)=>fetch(path.replace(dsn.username,key),{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain'},body:'{}\n'+items.map(([type,value])=>JSON.stringify({type})+'\n'+JSON.stringify(value)).join('\n')});
 const intake=async items=>{const response=await send(items);assert.equal(response.status,200);const body=await response.json();add(body.sessions??{});return {response,body}};
 const counts=async()=>Object.fromEntries((await app.json(root+'/outcomes')).rows.map(row=>[row.reason,row.count]));
 const session={sid:crypto.randomUUID().replaceAll('-',''),started:new Date().toISOString(),timestamp:new Date().toISOString(),status:'exited',errors:0,attrs:{release:'synthetic-spool-backpressure@1',environment:'production'}};
 const aggregate={attrs:session.attrs,aggregates:Array.from({length:100},()=>({started:session.started,exited:1000000}))};
 let clockPinned=false;
 try {
  // Reach the aggregate quantity bound through intake, without seeding storage internals.
  const capacity=await intake(Array.from({length:10},()=>['sessions',aggregate]));
  assert.equal(capacity.response.headers.get('X-Sentry-Rate-Limits'),null);
  const refused=await intake([['sessions',{...aggregate,aggregates:[{started:session.started,exited:1}]}],['session',{}]]);
  assert.deepEqual(refused.body.sessions,{session_capacity:1,session_invalid:1});
  assert.equal(refused.response.headers.get('X-Sentry-Rate-Limits'),null,'capacity and invalid items do not advertise temporary rate recovery');

  Sentry.init({dsn:project.dsn,release:session.attrs.release,environment:'production',defaultIntegrations:false,sendClientReports:true});
  const transport=Sentry.getClient().getTransport();
  // Pin only the SDK clock; the Worker clock and public minute bucket remain real.
  mock.timers.enable({apis:['Date'],now:Date.now()});clockPinned=true;
  let limit;
  for(let batch=0;batch<40&&!limit;batch++) {
   const filled=await intake(Array.from({length:100},()=>['session',session]));
   if(!filled.body.sessions.session_rate_limited)continue;
   // The normal SDK transport must learn the header itself, including across a minute rollover.
   const response=await transport.send([{},[[{type:'session'},session]]]);
   assert.equal(response.statusCode,200);
   limit=response.headers?.['x-sentry-rate-limits'];
   add({[limit?'session_rate_limited':'session_stored']:1});
  }
  assert.ok(limit,'public intake reaches session backpressure');
  const [seconds,categories,scope,reason]=limit.split(':');
  assert.match(seconds,/^[1-9][0-9]*$/);const retryAfter=Number(seconds);
  assert.ok(retryAfter<=60,'backoff is bounded by one receipt minute');
  assert.equal(categories,'session');assert.equal(scope,'project');assert.equal(reason,'session_rate_limited');

  const companion={event_id:crypto.randomUUID().replaceAll('-',''),release:session.attrs.release,message:'Session saturation companion error'};
  const mixed=await intake([['session',session],['session',{}],['event',companion]]);
  assert.equal(mixed.body.id,companion.event_id);assert.deepEqual(mixed.body.sessions,{session_rate_limited:1,session_invalid:1});
  assert.ok(mixed.response.headers.get('Access-Control-Expose-Headers').includes('X-Sentry-Rate-Limits'));
  assert.equal(mixed.response.headers.get('Retry-After'),null,'session backoff never sets a global retry');
  const invalid=await intake([['session',{}]]);
  assert.deepEqual(invalid.body.sessions,{session_invalid:1});assert.equal(invalid.response.headers.get('X-Sentry-Rate-Limits'),null);

  const foreign=await app.json('/api/projects','POST',{id:'synthetic-spool-backpressure-foreign',name:'Foreign session grant'});
  const revoked=await app.json(root+'/keys','POST',{kind:'ingest'});await app.json(root+'/keys/'+revoked.hash,'DELETE');
  const beforeDenied=await counts(),foreignBefore=await app.json('/api/projects/'+foreign.id+'/outcomes');
  for(const key of ['synthetic-spool-invalid',foreign.ingestKey,revoked.key]) {
   const denied=await send([['session',session],['client_report',{timestamp:Date.now()/1000,discarded_events:[{reason:'ratelimit_backoff',category:'session',quantity:99}]}]],key);
   assert.equal(denied.status,401);assert.equal(denied.headers.get('X-Sentry-Rate-Limits'),null);await denied.body.cancel();
  }
  assert.deepEqual(await counts(),beforeDenied,'invalid, foreign and revoked grants attribute no session or discard counters');
  assert.deepEqual((await app.json('/api/projects/'+foreign.id+'/outcomes')).rows,foreignBefore.rows);

  // Ordinary capture serializes a real SDK session; the transport discards it before HTTP.
  Sentry.startSession();Sentry.captureSession(true);
  const sdkError={event_id:crypto.randomUUID().replaceAll('-',''),release:session.attrs.release,message:'SDK error continues during session backoff'};
  await transport.send([{},[[{type:'session'},session],[{type:'sessions'},aggregate],[{type:'event'},sdkError]]]);
  assert.equal(await Sentry.flush(10000),true);
  const during=await counts();
  for(const [name,count] of Object.entries(ledger))assert.equal(during[name],count,'SDK backoff adds no server refusal: '+name);
  assert.equal(during.accepted,2,'mixed companion and SDK error both reach ordinary admission');
  assert.equal(during['client_discarded:session:ratelimit_backoff'],3,'individual and aggregate SDK suppressions reconcile exactly');
  assert.equal(during.session_invalid,3);assert.equal(during.session_capacity,1);

  // Wait for the real server deadline, then advance the pinned SDK clock past its own deadline.
  await new Promise(resolve=>setTimeout(resolve,(retryAfter+1)*1000));mock.timers.tick((retryAfter+1)*1000);
  Sentry.startSession();Sentry.captureSession(true);Sentry.captureException(new Error('SDK error after session backoff'));
  assert.equal(await Sentry.flush(10000),true);
  const after=await counts();
  assert.equal(after.session_stored,during.session_stored+1,'a fresh SDK capture recovers after the deadline');
  assert.equal(after.session_rate_limited,during.session_rate_limited,'recovery is admitted without another refusal');
  assert.equal(after.accepted,3);assert.equal(after['client_discarded:session:ratelimit_backoff'],3,'suppressed sessions are discarded, never replayed');
  const report=await app.json(root+'/release-health');
  assert.equal(report.denominators.individualSessions,2,'repeated intake updates deduplicate and recovery adds one new SID');
  assert.equal(report.denominators.aggregateSessions,1000000000,'capacity refusal adds no exposure');
  assert.equal(report.denominators.invalid,3);assert.equal(report.denominators.clientDiscarded,3);
  assert.equal((await app.json(root+'/issues')).reduce((sum,row)=>sum+row.count,0),3,'sessions and discard reports create no error occurrences');
  console.log('[SDK-005] session-only SDK backoff, mixed errors, deadline recovery, exact rate, capacity, invalid and discard accounting and grant fences passed');
 } finally {
  await Sentry.close(10000);if(clockPinned)mock.timers.reset();
 }
}
