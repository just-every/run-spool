import {startTestWorker} from '/home/agent/rer-consolidation/work/sd-spool-import-rules-1/run-spool/tests/worker.mjs';
import {signIn} from '/home/agent/rer-consolidation/work/sd-spool-import-rules-1/run-spool/tests/auth.mjs';
import {sentryDoorClient} from '/home/agent/rer-consolidation/work/sd-spool-import-rules-1/run-spool/scripts/sentry-import.mjs';
import {writeFile} from 'node:fs/promises';
const app=await startTestWorker(15529);try{
 const cookie=await signIn(app.origin),organization='synthetic-spool-import-rules',slug='synthetic-spool-3',time=new Date().toISOString();
 const collection=(kind,project,response)=>({kind,project,pages:[{cursor:null,nextCursor:null,response}]});
 const bundle={format:'spool-sentry-org-export',version:1,organization:{id:organization,slug:organization,region:'us'},window:{start:time,end:time},collections:[collection('projects',null,[{id:slug,slug,name:'Synthetic spool 3',dateCreated:time}]),collection('releases',null,[]),collection('rules',slug,[{id:'synthetic-spool-rule-1',name:'Synthetic affected users',conditions:[{id:'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition',value:2,interval:'1m'}],actions:[]},{id:'synthetic-spool-rule-2',name:'Synthetic crash-free sessions',dataset:'sessions',aggregate:'percentage(sessions_crashed, sessions)'}])],omissions:['Synthetic shape probe only; no account or provider.']};
 const client=sentryDoorClient({endpoint:app.origin,cookie,organization}),plan=await client.plan(Buffer.from(JSON.stringify(bundle))),apply=await client.apply(plan.planId,plan.fingerprint),report=await client.reconcile(plan.planId);
 const response=await fetch(app.origin+`/api/projects/${report.projectIds[0]}/alerting/rules`,{headers:{Cookie:cookie}}),rules=await response.json();
 const receipt={schema:1,kind:'current-main import capability probe',sourceKinds:bundle.collections.map(r=>r.kind),sourceRules:2,job:apply.job.state,reconciled:report.ok,nativeTargets:report.counts.byKind,nativeRules:rules.length,ruleFieldDisposition:plan.sentry.fields.filter(r=>r.kind==='rules').map(r=>({path:r.path,disposition:r.disposition,reason:r.reason}))};
 await writeFile('/home/agent/rer-consolidation/work/sd-spool-import-rules-1/packet/import-capability.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({sourceRules:2,nativeRules:rules.length,job:apply.job.state,nativeTargets:report.counts.byKind}));
}finally{await app.stop()}
