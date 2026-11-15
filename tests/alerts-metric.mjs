import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {nativeAlertRuntime} from './alerts/native-runtime.mjs';
import {testAndReview,rule} from './alerts/runtime.mjs';
export const envelope=items=>JSON.stringify({})+'\n'+items.map(([type,value])=>JSON.stringify({type})+'\n'+JSON.stringify(value)).join('\n');
export async function sentry(app,project,items,headers={}){
 const dsn=new URL(project.dsn),path=`/api${dsn.pathname}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 return app.request(path,'POST',envelope(items),headers);
}
export async function fixture(app,id){
 const project=await app.json('/api/projects','POST',{id,name:'Checkout service '+id});
 await app.json(`/api/projects/${id}/releases`,'POST',{name:'r1',build:'b1'});
 const base=`/api/projects/${id}/alerting`,destination=await app.json(base+'/destinations','POST',{label:'Operations',recipient:'synthetic-spool-1@example.test'});
 await testAndReview(app.json,base,destination.id);
 return {project,base,destination:destination.id};
}
export const metric=(dataset,query={},extra={})=>({metric:'aggregate',dataset,aggregate:{errors:'count',transactions:'p95_duration',sessions:'crash_free_rate'}[dataset],query,filters:{environment:'production'},thresholdType:dataset==='sessions'?'below':'above',triggers:dataset==='sessions'?[{label:'critical',alertThreshold:99},{label:'warning',alertThreshold:99.5}]:[{label:'critical',alertThreshold:2500},{label:'warning',alertThreshold:1500}],resolveThreshold:dataset==='sessions'?99.8:1200,tagKeys:[],...extra});
export async function metricJourney(app){
 const f=await fixture(app,'metric-service'),other=await fixture(app,'metric-other');
 const add=async(name,config)=>app.json(f.base+'/rules','POST',rule('mail',{name,destination:f.destination,kinds:['metric'],windowMs:600000,config}));
 const txn=await add('Checkout p95',metric('transactions',{transaction:{op:'glob',value:'/v1/*'}}));
 let sequence=1;
 const transactions=async(durations,project=f.project,name='/v1/checkout',environment='production')=>{
  const items=durations.map(duration=>['transaction',{type:'transaction',event_id:(sequence++).toString(16).padStart(32,'0'),transaction:name,environment,release:'r1',start_timestamp:(Date.now()-duration)/1000,timestamp:Date.now()/1000,user:{email:'synthetic-spool-private@example.test'},request:{data:'private'},contexts:{trace:{op:'http.server'}}}]);
  const response=await sentry(app,project,items);assert.equal(response.status,200);const receipt=await response.json();assert.equal(receipt.transactions.transaction_stored,durations.length);return items;
 };
 const initial=await transactions([...Array(18).fill(1000),2000,3000]);
 await transactions([9000],other.project);await transactions([9000],f.project,'/background/task');await transactions([9000],f.project,'/v1/checkout','staging');
 const retry=await sentry(app,f.project,initial);assert.equal((await retry.json()).transactions.transaction_duplicate,20);
 const conflict=await sentry(app,f.project,[['transaction',{...initial[0][1],transaction:'/different'}]]);assert.equal((await conflict.json()).transactions.transaction_conflict,1);
 const bad=await sentry(app,f.project,[['transaction',{...initial[0][1],event_id:'f'.repeat(32),timestamp:0}]]);assert.equal((await bad.json()).transactions.transaction_invalid,1);
 let end=Math.ceil(Date.now()/60000)*60000;
 const tick=async()=>{const response=await app.tick(end);assert.equal(response.status,200);assert.equal((await response.json()).outcome,'ok');end+=60000};
 const state=async id=>(await app.json(f.base+'/rules')).find(r=>r.id===id);
 await tick();assert.equal((await state(txn.id)).metric_status,'warning');assert.ok(Math.abs((await state(txn.id)).metric_value-2000)<2);
 await transactions([3000]);await tick();assert.equal((await state(txn.id)).metric_status,'critical');
 await transactions(Array(20).fill(1000));await tick();assert.equal((await state(txn.id)).metric_status,'warning');
 await transactions(Array(20).fill(1000));await tick();assert.equal((await state(txn.id)).metric_status,'ok');
 const transactionFacts=(await app.json(`/api/projects/${f.project.id}/alerts`)).filter(a=>a.kind==='metric');
 assert.deepEqual(transactionFacts.map(a=>JSON.parse(a.payload).metric.to).sort(),['critical','ok','warning','warning'].sort());assert.ok(transactionFacts.every(a=>a.issue===null));
 const deliveries=(await app.json(f.base+'/deliveries')).filter(d=>d.rule_id===txn.id);assert.equal(deliveries.length,4);assert.ok(deliveries.every(d=>d.attempts===1&&d.state==='accepted'));
 const replay=await app.tick(end-60000);assert.equal(replay.status,200);assert.equal((await app.json(f.base+'/deliveries')).filter(d=>d.rule_id===txn.id).length,4);
 // Session health includes both individual lifecycle updates and aggregate quantities.
 const started=new Date().toISOString(),sid='a'.repeat(32),sessions=[['session',{sid,init:true,started,status:'exited',errors:0,attrs:{release:'r1',environment:'production'}}],['sessions',{attrs:{release:'r1',environment:'production'},aggregates:[{started,exited:198,crashed:1}]}]];
 assert.equal((await sentry(app,f.project,sessions)).status,200);
 const crash=await add('Crash-free checkout',metric('sessions'));
 await tick();assert.equal((await state(crash.id)).metric_status,'ok');assert.equal((await state(crash.id)).metric_value,99.5);
 assert.equal((await sentry(app,f.project,[['session',{...sessions[0][1],init:false,status:'crashed',errors:1,timestamp:new Date().toISOString()}]])).status,200);
 await tick();assert.equal((await state(crash.id)).metric_status,'warning');assert.equal((await state(crash.id)).metric_value,99);
 assert.equal((await sentry(app,f.project,[['sessions',{attrs:{release:'r1',environment:'production'},aggregates:[{started,crashed:100}]}]])).status,200);
 await tick();assert.equal((await state(crash.id)).metric_status,'critical');
 assert.equal((await sentry(app,f.project,[['sessions',{attrs:{release:'r1',environment:'production'},aggregates:[{started,exited:100000}]}]])).status,200);
 await tick();assert.equal((await state(crash.id)).metric_status,'ok');
 const count=await add('Server errors',metric('errors',{tags:{'http.status_code':{op:'glob',value:'5*'}}},{tagKeys:['http.status_code'],triggers:[{label:'critical',alertThreshold:2},{label:'warning',alertThreshold:1}],resolveThreshold:1}));
 for(let i=0;i<3;i++){
  const response=await sentry(app,f.project,[['event',{event_id:(sequence++).toString(16).padStart(32,'0'),release:'r1',dist:'b1',environment:'production',level:'error',tags:{'http.status_code':'503'},exception:{values:[{type:'CheckoutFailure'+i,value:'Service unavailable'}]}}]]);assert.equal(response.status,200);
 }
 await tick();assert.equal((await state(count.id)).metric_status,'critical');assert.equal((await state(count.id)).metric_value,3);
 end+=600000;await tick();assert.equal((await state(count.id)).metric_status,'ok');assert.equal((await state(txn.id)).metric_status,'ok','missing transaction samples do not invent a recovery');
 const retained=(await app.db.prepare('SELECT * FROM sentry_transactions WHERE project=?').bind(f.project.id).all()).results;
 assert.equal(retained.length,63);assert.ok(!JSON.stringify(retained).includes('private'));
 return f;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const app=await nativeAlertRuntime();try{await metricJourney(app);console.log('Project metric native ingestion, scheduled transitions and replay passed')}finally{await app.close()}}
