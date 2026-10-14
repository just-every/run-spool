import assert from 'node:assert/strict';
import {client,event} from './reproduce.mjs';
const p='/api/projects/shop';
export const report=(app,ingest,release,clientId,flows,capture=true)=>app.request('/api/ingest/shop/exposure','POST',{version:1,release:release.name,build:release.build,environment:'production',client:clientId,flows,capture},{Authorization:'Bearer '+ingest,Cookie:''}).then(async r=>{const body=await r.json();return {status:r.status,...body};});
const proof=async(app,issue,id)=>(await app.json(`${p}/fixes?issue=${issue}`)).workflows.find(row=>row.id===id).exposure;

// Before the fix: 30 users reached checkout in the broken release; the six
// who failed are the affected cohort. That is the baseline failure rate.
// Before the deploy only one affected user has reported it; the rest arrive later.
export async function baseline(app,ingest,r1){
 const sent=await report(app,ingest,r1,client(0),['checkout']);assert.equal(sent.status,201,JSON.stringify(sent));
 const denied=await app.request('/api/ingest/shop/exposure','POST',{},{Authorization:'Bearer '+'0'.repeat(64),Cookie:''});assert.equal(denied.status,401,'exposure needs the project ingest key');await denied.body?.cancel();
}

// #18 after the deploy: each denominator moves the verdict, and too little
// exposure stays inconclusive however quiet the feed is.
export async function exposureVerdicts(app,ingest,{issue,id,r2,fixture}){
 const steps={};
 const first=await proof(app,issue,id);steps.deployedNoTraffic=first.verdict;
 assert.equal(first.verdict,'inconclusive');assert.deepEqual(first.reasons.map(r=>r.code),['no_exposure']);assert.equal(first.denominators.cohort.affectedUsers,6);
 return {
  // One affected user was the whole baseline and is the only one exposed: one quiet user proves nothing.
  async tiny(){
   await report(app,ingest,r2,client(0),['checkout']);
   const tiny=await proof(app,issue,id);steps.tinyBaseline=tiny.verdict;
   assert.deepEqual([tiny.verdict,tiny.reasons.map(r=>r.code),tiny.denominators.instrumentation.baselineExposed,tiny.denominators.instrumentation.withCapture],['inconclusive',['exposure_too_low'],1,1]);
   for(let n=1;n<30;n++)await report(app,ingest,{name:'2026.10.1',build:'b1'},client(n),['checkout']);
   return tiny;
  },
  async low(){
   for(const n of [40,41])await report(app,ingest,r2,client(n),['checkout']);
   const low=await proof(app,issue,id);steps.lowExposure=low.verdict;
   assert.equal(low.verdict,'inconclusive');assert.ok(low.reasons.some(r=>r.code==='exposure_too_low'),JSON.stringify(low.reasons));
   assert.deepEqual([low.denominators.instrumentation.withCapture,low.denominators.cohort.reachedOnFixedRelease,low.denominators.instrumentation.baselineFailed,low.denominators.instrumentation.baselineExposed],[3,1,6,30]);
   return low;
  },
  async reached(){
   for(let n=1;n<6;n++)await report(app,ingest,r2,client(n),['checkout']);
   for(let n=42;n<82;n++)await report(app,ingest,r2,client(n),['checkout']);
   for(let n=82;n<86;n++)await report(app,ingest,r2,client(n),['checkout'],false);
   for(let n=86;n<90;n++)await report(app,ingest,{name:'2026.10.1',build:'b1'},client(n),[]);
   const reached=await proof(app,issue,id);steps.reached=reached.verdict;
   assert.equal(reached.verdict,'reached',JSON.stringify(reached.reasons));
   const d=reached.denominators;
   assert.deepEqual([d.cohort.reachedOnFixedRelease,d.instrumentation.withCapture,d.instrumentation.withoutCapture,d.rollout.onFixedRelease,d.rollout.usersSinceDeploy],[6,48,4,52,80]);
   return reached;
  },
  // Reports the server refused after the deploy are a capture gap: no longer "reached".
  async gap(){
   const unregistered=await report(app,ingest,{name:'9.9.9',build:'x'},client(1),['checkout']);assert.deepEqual([unregistered.status,unregistered.outcome],[422,'rejected']);
   const invalid=await report(app,ingest,r2,'person@example.com',['checkout']);assert.equal(invalid.status,400,'a client identifier cannot be an address');
   const gap=await proof(app,issue,id);steps.captureGap=gap.verdict;
   assert.equal(gap.verdict,'inconclusive');assert.deepEqual(gap.reasons.map(r=>r.code),['capture_gap']);
   assert.deepEqual(gap.denominators.captureGap.loss.map(r=>r.reason).sort(),['exposure_invalid','exposure_unregistered']);
   return gap;
  },
  async recurred(){
   const again=await app.request('/api/ingest/shop','POST',event(fixture,'cart-after-fix',r2,{client:client(44)}),{Authorization:'Bearer '+ingest,Cookie:''});assert.equal(again.status,201);await again.body?.cancel();
   const recurred=await proof(app,issue,id);steps.recurred=recurred.verdict;
   assert.equal(recurred.verdict,'recurred');assert.deepEqual([recurred.denominators.recurrence.events,recurred.denominators.recurrence.users],[1,1]);
   return steps;
  },
 };
}
