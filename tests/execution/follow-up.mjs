import assert from 'node:assert/strict';
import {openGate} from '../auth.mjs';
const root='/api/projects/shop',path=root+'/follow-up';
const current=async(app,issue,id)=>(await app.json(root+'/fixes?issue='+issue)).workflows.find(row=>row.id===id);

// ALERT-004 an interrupted send, an expired lease and a lost provider response
// each leave one durable follow-up and never a duplicate (execution portion).
export async function executionFollowUp(app,github,reproduced){
 const workflow=await app.json(root+'/fixes','POST',{reproducer:reproduced.reproducer.id,run:reproduced.run.id,repository:'just-every/run-spool',base:'main',flow:'checkout',durationMinutes:120});
 const beforePulls=github.state.pulls.length;
 github.state.losePullResponse=true;
 const lost=await app.request(`${root}/fixes/${workflow.id}/approve`,'POST',{revision:workflow.revision});
 assert.equal(lost.status,502);await lost.body?.cancel();
 assert.equal(github.state.pulls.length,beforePulls+1,'provider accepted exactly one PR before its response was lost');
 const afterLoss=github.requests.length,latest=await current(app,reproduced.issue,workflow.id);
 const blocked=await app.request(`${root}/fixes/${workflow.id}/advance`,'POST',{revision:latest.revision});
 assert.equal(blocked.status,409);await blocked.body?.cancel();assert.equal(github.requests.length,afterLoss,'uncertain provider mutation cannot repeat on Advance');
 await app.schedule(Date.now());
 let row=(await app.json(path)).rows.find(item=>item.source_id===workflow.id);
 assert.ok(row&&row.state==='uncertain');
 const facts=async()=>(await app.db.prepare("SELECT COUNT(*) n FROM spool_audit_events WHERE action='automation.follow_up'").first()).n;
 const priorFacts=await facts();await app.schedule(Date.now()+1000);assert.equal(await facts(),priorFacts,'one fact despite repeated evaluation');
 const pull=github.state.pulls.at(-1),head=github.state.refs.get('heads/'+pull.head);
 await app.json(`${path}/${row.id}/reconcile`,'POST',{revision:row.revision,state:'accepted',evidence:'github_pull_verified',result:{number:pull.number,url:`https://github.com/just-every/run-spool/pull/${pull.number}`,head}});
 const resumed=await app.json(`${root}/fixes/${workflow.id}/advance`,'POST',{revision:(await current(app,reproduced.issue,workflow.id)).revision});
 assert.equal(resumed.states.pullRequest.number,pull.number);assert.equal(github.state.pulls.length,beforePulls+1,'verified provider result resumes the existing PR');
 // Crash before any receipt: an expired durable step lease remains an unknown
 // effect even if the next owner request beats the scheduled scanner.
 await app.db.prepare('INSERT INTO fix_leases VALUES(?,?,?)').bind(workflow.id,'shop',Date.now()-1).run();
 const sent=github.requests.length;
 const expired=await app.request(`${root}/fixes/${workflow.id}/advance`,'POST',{revision:resumed.revision});
 assert.equal(expired.status,409);await expired.body?.cancel();assert.equal(github.requests.length,sent);
 await app.schedule(Date.now()+2000);
 row=(await app.json(path)).rows.find(item=>item.source_id===workflow.id);
 assert.equal(row.state,'uncertain');assert.equal(await facts(),priorFacts,'same workflow reuses its accountable follow-up');
 return {workflow:workflow.id,attention:row.id,providerPull:pull.number};
}

export async function attentionCaptures(app,browser,directory){
 const captures=[];
 for(const width of [1440]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   await openGate(context,app.origin);
   await context.addCookies([{name:app.cookie.slice(0,app.cookie.indexOf('=')),value:app.cookie.slice(app.cookie.indexOf('=')+1),url:app.origin}]);
   const page=await context.newPage();await page.goto(app.origin+'/projects/shop/alerts');
   await page.getByRole('button',{name:'Needs attention',exact:true}).click();
   await page.getByRole('heading',{name:'Needs attention',exact:true}).waitFor();
   await page.getByText('No alternate',{exact:false}).first().waitFor();
   const section=page.locator('section[aria-labelledby="attention-title"]');
   await section.getByRole('button',{name:'Reconcile accepted',exact:true}).first().waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`attention fits at ${width}`);
   const file=`${directory}/needs-attention-${width}.png`;await section.screenshot({path:file});captures.push(file);
  }finally{await context.close();}
 }
 return captures;
}
