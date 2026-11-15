import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {alertCustodyTables} from './lifecycle-journey.mjs';
// The existing hosted-mail erasure fixture replaces only the paid mail edge.
// All ownership, capture, reviewed tests, rule writes and scheduling remain native.
export async function ownerAlertCustody(app,project){
 const base=`/api/projects/${project.id}/alerting`,d=await app.json(base+'/destinations',{label:'Owner project team',target:{type:'team',id:'Default team'}},201);
 const tested=await app.json(base+'/destinations/'+d.id+'/test',{});assert.equal(tested.state,'passing');await app.json(base+'/destinations/'+d.id+'/review',{testId:tested.id});
 const save=async value=>{const preview=await app.json(base+'/rules/preview',value);assert.ok(preview.token);return app.json(base+'/rules',{...value,previewToken:preview.token},201)};
 const draft={name:'Owner custody rule',enabled:true,channel:'mail',destination:d.id,kinds:['new_issue'],windowMs:60000,threshold:2,config:{metric:'count',filters:{environment:'test'},tagKeys:[]}};
 await save(draft);
 await app.json('/api/ingest/'+project.id,{version:1,eventId:'synthetic-spool-custody',release:'r1',build:'b1',environment:'test',type:'AlertCustodyFailure',message:'Synthetic alert custody',frames:[{file:'https://app.example.test/custody.js',line:1,column:0,function:'checkout'}],breadcrumbs:[]},201,{Authorization:'Bearer '+project.ingestKey});
 const dsn=new URL(project.dsn),transaction={type:'transaction',event_id:randomUUID().replaceAll('-',''),transaction:'/v1/checkout',environment:'test',release:'r1',start_timestamp:(Date.now()-3000)/1000,timestamp:Date.now()/1000};
 const captured=await fetch(app.origin+`/api${dsn.pathname}/envelope/?sentry_key=${dsn.username}&sentry_version=7`,{method:'POST',headers:{Origin:app.origin,Connection:'close','Content-Type':'text/plain'},body:'{}\n{"type":"transaction"}\n'+JSON.stringify(transaction)});assert.equal(captured.status,200);assert.equal((await captured.json()).transactions.transaction_stored,1);
 await save({...draft,name:'Owner latency rule',kinds:['metric'],config:{metric:'aggregate',dataset:'transactions',aggregate:'p95_duration',query:{},filters:{environment:'test'},thresholdType:'above',triggers:[{label:'critical',alertThreshold:2500}],resolveThreshold:1200,tagKeys:[]}});
 await app.schedule(Math.ceil(Date.now()/60000)*60000);
 for(const table of alertCustodyTables)assert.ok((await app.DB.prepare(`SELECT COUNT(*) n FROM ${table}`).first()).n>0,'owner journey retains populated '+table);
}
