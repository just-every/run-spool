import {nativeLanguages} from './multilingual.mjs';
import {releasedArchive} from './old-archive.mjs';
import {operatorFlow} from './operator-flow.mjs';
import {bundleGroupingFlow} from './bundle-grouping.mjs';
import {operatorArchiveTamper,operatorRetentionAndErasure} from './operator-archive.mjs';
import {demoJourney} from './demo-capture.mjs';
import {deploymentJourney} from './deployment-history.mjs';
import {auditJourney} from './audit-history.mjs';
import assert from 'node:assert/strict';
import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';
import {archiveProjection} from './archive.mjs';

// Native admission to durable evidence, portable recovery and immediate revocation.
let app,cookie;
const start=async bindings=>{app=await startTestWorker(15469,bindings);cookie=await signIn(app.origin)};
const req=(path,method='GET',value,headers={})=>fetch(app.origin+path,{method,redirect:'manual',headers:{Origin:app.origin,Cookie:cookie,...value===undefined?{}:{'Content-Type':typeof value==='string'?'application/x-ndjson':'application/json'},...headers},...value===undefined?{}:{body:typeof value==='string'?value:JSON.stringify(value)}});
const json=async(...args)=>{const r=await req(...args);assert.ok(r.ok,`${args[0]}: HTTP ${r.status}`);return r.json()};
try {
 await start();
 for(const path of ['/docs','/docs/install']){const response=await fetch(app.origin+path);assert.equal(response.status,200);assert.ok(response.headers.get('content-type').includes('text/html'));await response.body?.cancel()}
 assert.equal((await fetch(app.origin+'/docs/missing')).status,404);
 assert.equal((await req('/api/projects','GET',undefined,{Cookie:''})).status,401);
 assert.equal((await req('/api/projects','POST',{id:'forged',name:'Forged'},{Origin:'https://foreign.invalid'})).status,403);
 const project=await json('/api/projects','POST',{id:'web',name:'Checkout'});
 await json('/api/projects','POST',{id:'other',name:'Other application'});
 await json('/api/projects/web/releases','POST',{name:'checkout@1',build:'b1'});
 const auth={Cookie:'',Authorization:'Bearer '+project.ingestKey};
 const event={version:1,eventId:'checkout-failed',release:'checkout@1',build:'b1',environment:'production',type:'TypeError',message:'Checkout failed token=PRIVATE_TOKEN alice@private.example',frames:[{file:'https://app.example/checkout.js?token=PRIVATE_URL',line:1,column:0,function:'checkout',debugId:'checkout-map'}],breadcrumbs:['password=PRIVATE_PASSWORD']};
 const accepted=await json('/api/ingest/web','POST',event,auth);
 assert.equal(accepted.outcome,'accepted');
 assert.equal((await json('/api/ingest/web','POST',event,auth)).outcome,'duplicate');
 assert.equal((await req('/api/ingest/web','POST',{...event,message:'Different payload'},auth)).status,409);
 const concurrent=await Promise.all(Array.from({length:6},()=>req('/api/ingest/web','POST',{...event,eventId:'retry'},auth)));
 assert.equal(concurrent.filter(r=>r.status===201).length,1);
 assert.ok(concurrent.every(r=>[200,201].includes(r.status)));
 const groups=await json('/api/projects/web/issues');assert.equal(groups.length,1);assert.equal(groups[0].count,2);
 assert.deepEqual(await json('/api/projects/other/issues'),[]);
 assert.equal((await req('/api/ingest/other','POST',event,auth)).status,401);
 const foreign='https://checkout.example';
 await json('/api/projects/web/browser-origins','POST',{origin:foreign});
 const cors=await req('/api/ingest/web','OPTIONS',undefined,{Origin:foreign,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,authorization'});
 assert.equal(cors.status,204);assert.equal(cors.headers.get('access-control-allow-origin'),foreign);
 await json('/api/projects/web/browser-origins','DELETE',{origin:foreign});
 assert.equal((await req('/api/ingest/web','POST',{...event,eventId:'denied-origin'},{...auth,Origin:foreign})).status,403);
 const nativeRecovery=await nativeLanguages({json,auth});
 const packet=await json(`/api/projects/web/issues/${accepted.issue}/packet`);
 for(const secret of ['PRIVATE_TOKEN','PRIVATE_URL','PRIVATE_PASSWORD','alice@private.example'])assert.ok(!JSON.stringify(packet).includes(secret));
 assert.ok(JSON.stringify(packet).includes('Checkout failed'));
 const grant=await json('/api/projects/web/keys','POST',{kind:'agent'});
 assert.equal((await req('/api/projects/web/issues','GET',undefined,{Cookie:'',Authorization:'Bearer '+grant.key})).status,200);
 assert.equal((await req('/api/archive','GET',undefined,{Cookie:'',Authorization:'Bearer '+grant.key})).status,403);
 // Grouping changes retain their original occurrences and survive recovery.
 await operatorFlow({req,json});
 const retainedBundle=await bundleGroupingFlow({json});
 const budget=await json('/api/projects','POST',{id:'budget',name:'Capacity observation'});
 await json('/api/projects/budget/releases','POST',{name:'checkout@1',build:'b1'});
 const burst=await Promise.all(Array.from({length:300},(_,i)=>req('/api/ingest/budget','POST',{...event,eventId:'capacity-'+i},{Cookie:'',Authorization:'Bearer '+budget.ingestKey})));
 assert.ok(burst.some(r=>r.status===429),'the public admission boundary refuses excess work');
 assert.ok(burst.every(r=>[201,429].includes(r.status)));
 const admitted=burst.filter(r=>r.status===201).length;
 assert.equal((await json('/api/projects/budget/issues')).reduce((sum,row)=>sum+row.count,0),admitted,'only accepted requests consume retained occurrences');
 const archive=await archiveProjection(await req('/api/archive'));
 assert.ok(!archive.text.includes(project.ingestKey));assert.ok(!archive.text.includes(grant.key));
 await app.restart();assert.deepEqual((await archiveProjection(await req('/api/archive'))).data,archive.data,'restart keeps the complete portable business state');
 assert.equal((await req('/api/restore','POST',archive.text,{'X-Confirm-Restore':'yes'})).status,409);
 await app.stop();await start();
 const damaged=archive.text.replace('Checkout','Tampered');
 assert.equal((await req('/api/restore','POST',damaged,{'X-Confirm-Restore':'yes'})).status,400);
 assert.deepEqual(await json('/api/projects'),[]);
 await operatorArchiveTamper({archive,req,json});
 assert.equal((await req('/api/restore','POST',archive.text,{'X-Confirm-Restore':'yes'})).status,200);
 assert.deepEqual((await archiveProjection(await req('/api/archive'))).data,archive.data,'independent restore retains every product row and no authority');
 assert.equal((await req('/api/projects/web/issues','GET',undefined,{Cookie:'',Authorization:'Bearer '+grant.key})).status,401);
 await nativeRecovery();await retainedBundle();await operatorRetentionAndErasure({req,json});
 const session=await json('/auth/session');await req('/auth/session/revoke','POST',{sessionId:session.id});
 assert.equal((await req('/api/projects')).status,401);
 await app.stop();await start();await releasedArchive({req,reset:async()=>{await app.stop();await start()}});
 console.log('Native lifecycle passed: scoped intake, atomic retries, privacy, Python/Go, CORS, restart, checked independent restore, released archive upgrade and session/grant refusal.');
} finally {await app?.stop()}

await auditJourney();

await deploymentJourney();

await demoJourney();
