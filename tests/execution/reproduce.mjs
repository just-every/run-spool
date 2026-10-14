import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
// Runs the public runner command exactly as the UI prints it.
export function runner(command){
 const [, token, url]=/^SPOOL_RUN_TOKEN=([a-f0-9]{64}) pnpm reproduce (\S+)$/.exec(command)??[];
 assert.ok(token&&url,'the queued run prints one runner command');
 return new Promise((accept,reject)=>{const child=spawn(process.execPath,['scripts/reproduce/runner.mjs',url],{env:{PATH:process.env.PATH,SPOOL_RUN_TOKEN:token},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);child.once('error',reject);child.once('close',code=>accept({code,output,token,url}));});
}
const client=n=>'client-'+String(n).padStart(4,'0')+'-abcdefgh';
export const event=(fixture,id,release,extra={})=>({version:1,eventId:id,release:release.name,build:release.build,environment:'production',type:fixture.type,message:fixture.message,frames:fixture.frames,breadcrumbs:[],...extra});
export {client};

// #16: declared defect classes, exact records, isolated runs, distinct outcomes
// and an independent behaviour check through public routes and the runner.
export async function reproduceProof(app,fixture,ingest){
 const p='/api/projects/shop',r1={name:'2026.10.1',build:'b1'};
 const post=(value,expected=201)=>app.request('/api/ingest/shop','POST',value,{Authorization:'Bearer '+ingest,Cookie:''}).then(async r=>{const body=await r.json();assert.equal(r.status,expected,JSON.stringify(body));return body;});
 // Six affected users hit the failure in the broken release.
 let issue;for(let n=0;n<6;n++)issue=(await post(event(fixture,'cart-'+n,r1,{client:client(n)}))).issue;
 const unmapped=await post({...event(fixture,'cart-unmapped',r1),frames:fixture.frames.map(({debugId,...frame})=>({...frame,line:frame.line+1000}))});
 const packet=await app.json(`${p}/issues/${issue}/packet`);
 assert.equal(packet.events[0].currentLookup[0].status,'mapped','the captured frame maps through the stored map');
 const unsupported=await app.json(`${p}/reproducers`,'POST',{event:'cart-unmapped',input:[{}]});
 assert.deepEqual([unsupported.support,unsupported.reason,unmapped.issue!==issue],['unsupported','frame_not_mapped',true]);
 const refused=await app.request(`${p}/reproducers/${unsupported.id}/runs`,'POST',{});assert.equal(refused.status,409,'nothing runs for an unsupported class');await refused.body?.cancel();
 const reproducer=await app.json(`${p}/reproducers`,'POST',{event:'cart-0',input:[{}]});
 assert.equal(reproducer.support,'supported');
 assert.deepEqual(reproducer.spec.call,{module:'src/cart.js',export:'lineCount',input:[{}]},'exact module, export and input recorded');
 assert.deepEqual([reproducer.spec.environment.network,reproducer.spec.environment.bindings,reproducer.spec.environment.processEnvironment,reproducer.spec.environment.filesystem],['none','none','empty','none']);
 assert.deepEqual(reproducer.spec.source.modules.map(m=>m.name).sort(),['src/cart.js','src/format.js'],'every module source the map carries, by digest');
 const sensitive=await app.request(`${p}/reproducers`,'POST',{event:'cart-0',input:[{email:'person@example.com'}]});assert.equal(sensitive.status,400,'input the scrubber would change is refused, never altered');await sensitive.body?.cancel();
 // A run: single-use token, claimed once, observation-only report.
 const queued=await app.json(`${p}/reproducers/${reproducer.id}/runs`,'POST',{});
 const runOnce=await runner(queued.command);assert.equal(runOnce.code,0,runOnce.output);assert.match(runOnce.output,/^reproduced: /m);
 const again=await fetch(queued.url,{headers:{Authorization:'Bearer '+queued.token}});assert.equal(again.status,401,'a reported run token is spent');await again.body?.cancel();
 // A forged claim never decides the outcome.
 const forged=await app.json(`${p}/reproducers/${reproducer.id}/runs`,'POST',{});
 const unclaimed=await fetch(forged.url+'/observation',{method:'POST',headers:{Authorization:'Bearer '+forged.token,'Content-Type':'application/json'},body:'{}'});assert.equal(unclaimed.status,409,'report before the job is fetched');await unclaimed.body?.cancel();
 const job=await (await fetch(forged.url,{headers:{Authorization:'Bearer '+forged.token}})).json();
 assert.equal(job.modules.find(m=>m.name==='src/cart.js').source.includes('lineCount'),true,'the job carries the recorded module sources');
 const second=await fetch(forged.url,{headers:{Authorization:'Bearer '+forged.token}});assert.equal(second.status,409,'a job is claimed once');await second.body?.cancel();
 const wrong=await fetch(forged.url+'/observation',{method:'POST',headers:{Authorization:'Bearer '+'0'.repeat(64),'Content-Type':'application/json'},body:'{}'});assert.equal(wrong.status,401);await wrong.body?.cancel();
 const tools={workerd:'workerd test',node:process.version,runner:'forged'};
 const claim=await fetch(forged.url+'/observation',{method:'POST',headers:{Authorization:'Bearer '+forged.token,'Content-Type':'application/json'},body:JSON.stringify({protocol:1,tools,observation:{phase:'returned',type:'string',preview:'ok'},outcome:'reproduced'})});
 assert.equal(claim.status,400,'a report that claims an outcome is refused');await claim.body?.cancel();
 const lie=await fetch(forged.url+'/observation',{method:'POST',headers:{Authorization:'Bearer '+forged.token,'Content-Type':'application/json'},body:JSON.stringify({protocol:1,tools,observation:{phase:'threw',name:fixture.type,message:'something else',stack:'TypeError: something else\n    at lineCount (src/format.js:9:1)'}})}).then(r=>r.json());
 assert.equal(lie.outcome,'not_reproduced','the behaviour check, not the report, decides');
 // Distinct outcomes: failed (missing export, killed loop) and a returned call that shows the isolation.
 const outcomes={};
 for(const [name,body] of [['missing',{event:'cart-0',export:'missingExport',input:[]}],['spin',{event:'cart-0',export:'spin',input:[]}],['probe',{event:'cart-0',export:'probe',input:[]}]]){
  const record=await app.json(`${p}/reproducers`,'POST',body),run=await app.json(`${p}/reproducers/${record.id}/runs`,'POST',{});
  const result=await runner(run.command);assert.equal(result.code,0,result.output);
  outcomes[name]=(await app.json(`${p}/reproducers?issue=${issue}`)).reproducers.find(row=>row.id===record.id).runs[0];
 }
 assert.deepEqual([outcomes.missing.outcome,outcomes.missing.observation.phase],['failed','entry_missing']);
 assert.deepEqual([outcomes.spin.outcome,outcomes.spin.observation.phase],['failed','timed_out'],'a call that never returns is killed');
 assert.equal(outcomes.probe.outcome,'not_reproduced');
 assert.match(outcomes.probe.observation.preview,/^"(no process object|empty environment); network blocked: /,'no environment and no network inside the sandbox: '+outcomes.probe.observation.preview);
 const view=(await app.json(`${p}/reproducers?issue=${issue}`)).reproducers.find(row=>row.id===reproducer.id);
 const reproduced=view.runs.find(run=>run.outcome==='reproduced');
 assert.deepEqual(reproduced.checks.filter(c=>c.required).map(c=>[c.check,c.passed]),[['exception_type',true],['message',true],['frame_source',true],['frame_line',true]]);
 assert.match(reproduced.tools.workerd,/^workerd /);assert.equal(reproduced.state,'finished');
 return {issue,r1,reproducer:view,run:reproduced,outcomes:{reproduced:reproduced.outcome,forged:lie.outcome,missing:outcomes.missing.outcome,spin:outcomes.spin.outcome,probe:outcomes.probe.outcome,unsupported:unsupported.support},probe:outcomes.probe.observation.preview,checks:reproduced.checks,tools:reproduced.tools};
}
