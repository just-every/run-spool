import {followErasure} from './project-erasure/follow.mjs';
import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queuedExit=await queuedEntrypoint(import.meta.url);if(queuedExit!==null)process.exit(queuedExit);
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {archiveProjection} from './archive.mjs';
import {launchBrowser} from './browser-launch.mjs';
import {executionRuntime} from './execution/runtime.mjs';
import {githubDouble} from './execution/github-double.mjs';
import {shopFixture} from './execution/fixture.mjs';
import {reproduceProof,runner} from './execution/reproduce.mjs';
import {awaitingConnection,connectedWorkflow,deployedWorkflow,expiredGrant} from './execution/fix.mjs';
import {baseline,exposureVerdicts} from './execution/exposure.mjs';
import {disconnectedGitHubSetup,executionPanel,restoredExecutionPanel} from './execution/ui.mjs';
import {executionFollowUp,attentionCaptures} from './execution/follow-up.mjs';
// [SDK-008] A captured failure reproduced in the isolated sandbox, carried through a fix
// branch under an exact expiring grant, and measured after the deploy, through
// public routes, the runner command and the issue page. GitHub is a double.
const directory=resolve('.artifacts/execution');await mkdir(directory,{recursive:true});
const state=await mkdtemp(resolve(tmpdir(),'spool-execution-')),restoredState=await mkdtemp(resolve(tmpdir(),'spool-execution-restore-'));
const p='/api/projects/shop',r1={name:'2026.10.1',build:'b1'},r2={name:'2026.10.2',build:'b2'};
let app,restored,github,browser,stage='setup';const results={};
try{
 const fixture=await shopFixture();github=await githubDouble();
 app=await executionRuntime(state,15476);
 const {ingestKey}=await app.json('/api/projects','POST',{id:'shop',name:'Harbor Shop'});
 await app.json(`${p}/releases`,'POST',r1);await app.json(`${p}/artifacts`,'POST',{release:r1.name,build:r1.build,debugId:'cart-map',map:fixture.broken});
 stage='reproduce';const reproduced=await reproduceProof(app,fixture,ingestKey);results.reproduce=reproduced.outcomes;results.loadFailures=reproduced.loadFailures;results.probe=reproduced.probe;results.checks=reproduced.checks;results.tools=reproduced.tools;
 const agent=(await app.json(`${p}/keys`,'POST',{kind:'agent'})).key;
 for(const path of [`${p}/reproducers?issue=${reproduced.issue}`,`${p}/fixes?issue=${reproduced.issue}`]){const r=await fetch(app.origin+path,{headers:{Authorization:'Bearer '+agent}});assert.equal(r.status,403,'agent keys cannot read reproducers or fix workflows');await r.body?.cancel();}
 stage='baseline';await baseline(app,ingestKey,r1);
 stage='awaiting-connection';const awaiting=await awaitingConnection(app,github,reproduced);results.awaitingConnection={status:awaiting.status,error:awaiting.error};
 stage='disconnected-setup';browser=await launchBrowser();
 const requestsBeforeSetup=github.requests.length;
 results.setupCaptures=await disconnectedGitHubSetup(app,browser,directory,reproduced.issue);
 assert.equal(github.requests.length,requestsBeforeSetup,'viewing disconnected setup never contacts GitHub');
 await browser.close();browser=null;
 // The owner configures the GitHub App connection and restarts.
 await app.stop();app=await executionRuntime(state,15476,{GITHUB_CONNECTION:github.connection});
 stage='expiry-start';const finishExpiry=await expiredGrant(app,github,reproduced);
 stage='connected';results.connected=await connectedWorkflow(app,github,reproduced,awaiting.id);
 stage='deploy';
 await app.json(`${p}/releases`,'POST',{...r2,manifest:{commitSha:results.connected.merge,repository:'https://github.com/just-every/run-spool',deployedAt:new Date().toISOString(),environment:'production'}});
 await app.json(`${p}/artifacts`,'POST',{release:r2.name,build:r2.build,debugId:'cart-map',map:fixture.fixed});
 const deployed=await deployedWorkflow(app,reproduced.issue,awaiting.id,r2.name);results.deployed=deployed.states.deployed;
 // The same reproducer against the fixed release: the fix's behaviour, checked independently.
 const fixedRun=await app.json(`${p}/reproducers/${reproduced.reproducer.id}/runs`,'POST',{release:r2.name});
 const ran=await runner(fixedRun.command);assert.equal(ran.code,0,ran.output);assert.match(ran.output,/^not_reproduced: The call returned string/m);results.fixedRelease=ran.output.trim();
 stage='exposure';const verdicts=await exposureVerdicts(app,ingestKey,{issue:reproduced.issue,id:awaiting.id,r2,fixture});
 results.tiny=(await verdicts.tiny()).reasons;results.low=(await verdicts.low()).reasons;const reached=await verdicts.reached();results.reached={reasons:reached.reasons,denominators:reached.denominators};
 stage='ui';browser=await launchBrowser();results.captures=await executionPanel(app,browser,directory,reproduced.issue,reproduced.reproducer);await browser.close();browser=null;
 stage='capture-gap';results.gap=(await verdicts.gap()).reasons;
 stage='recurrence';results.verdicts=await verdicts.recurred();
 stage='expiry';results.expiry=await finishExpiry();
 stage='follow-up';results.followUp=await executionFollowUp(app,github,reproduced);
 browser=await launchBrowser();results.attentionCaptures=await attentionCaptures(app,browser,directory);await browser.close();browser=null;
 stage='archive';
 const pending=await app.json(`${p}/reproducers/${reproduced.reproducer.id}/runs`,'POST',{});
 const archive=await (await app.request('/api/archive')).text();
 assert.ok(/"kind":"fix_advanced"/.test(archive),'owner-triggered advances leave an audit row');
 const views=async runtime=>({reproducers:(await runtime.json(`${p}/reproducers?issue=${reproduced.issue}`)).reproducers,workflows:(await runtime.json(`${p}/fixes?issue=${reproduced.issue}`)).workflows.map(({connection,...row})=>row)});
 const before=await views(app);
 restored=await executionRuntime(restoredState,15477,{GITHUB_CONNECTION:github.connection});await restored.json('/api/restore','POST',archive,{'X-Confirm-Restore':'yes'});
 const historical={reproducers:before.reproducers.map(row=>({...row,runs:row.runs.map(run=>({...run,historical:true}))})),workflows:before.workflows.map(row=>({...row,historical:true,status:'historical'}))};
 assert.deepEqual(await views(restored),historical,'all reproducer, run, workflow, receipt and exposure facts survive as inert history');
 const restoredData=(await archiveProjection(await restored.request('/api/archive'))).data;
 assert.deepEqual(restoredData,(await archiveProjection(new Response(archive))).data,'every stored product row restores unchanged');
 const sourceToken=await fetch(restored.origin+new URL(pending.url).pathname,{headers:{Authorization:'Bearer '+pending.token}});assert.equal(sourceToken.status,401,'a queued source run token cannot claim restored work');await sourceToken.body?.cancel();
 const sourceGrant=await fetch(restored.origin+`${p}/issues/${reproduced.issue}/packet`,{headers:{Authorization:'Bearer '+agent}});assert.equal(sourceGrant.status,401);await sourceGrant.body?.cancel();
 const sent=github.requests.length;
 const dispatch=async()=>Promise.all(['alert_intents','alert_mail_jobs','integration_deliveries','follow_up_attempts','reproducer_run_tokens','fix_leases'].map(async table=>(await restored.db.prepare(`SELECT COUNT(*) n FROM ${table}`).first()).n));
 assert.deepEqual(await dispatch(),[0,0,0,0,0,0],'restore creates no dispatch, token or lease');
 await restored.schedule(Date.now());assert.deepEqual(await dispatch(),[0,0,0,0,0,0],'scheduled evaluation cannot dispatch restored work');
 for(const workflow of historical.workflows)for(const step of ['advance','approve']){const response=await restored.request(`${p}/fixes/${workflow.id}/${step}`,'POST',{revision:workflow.revision});assert.equal(response.status,409);assert.match((await response.json()).error,/Restored history/);}
 const historicalRun=await restored.request(`${p}/fixes`,'POST',{reproducer:reproduced.reproducer.id,run:reproduced.run.id,repository:'just-every/run-spool',flow:'checkout'});assert.equal(historicalRun.status,409,'historical passing results cannot authorize a new fix');assert.match((await historicalRun.json()).error,/Restored history/);
 assert.deepEqual(await views(restored),historical,'refused historical authority changes no work or receipt');assert.equal(github.requests.length,sent,'no provider dispatch from restored work');
 assert.deepEqual((await archiveProjection(await restored.request('/api/archive'))).data,restoredData,'refused historical authority and scheduled evaluation change no restored product row');
 browser=await launchBrowser();results.restoredCaptures=await restoredExecutionPanel(restored,browser,directory,reproduced.issue);await browser.close();browser=null;
 const rerun=await restored.json(`${p}/reproducers/${reproduced.reproducer.id}/runs`,'POST',{});const fresh=await runner(rerun.command);assert.equal(fresh.code,0,fresh.output);
 const refreshed=(await restored.json(`${p}/reproducers?issue=${reproduced.issue}`)).reproducers.find(row=>row.id===reproduced.reproducer.id).runs.find(row=>row.id===rerun.run);
 assert.equal(refreshed.outcome,'reproduced');assert.equal(refreshed.historical,undefined,'only a fresh run establishes current proof');
 const freshProposal=await restored.json(`${p}/fixes`,'POST',{reproducer:reproduced.reproducer.id,run:rerun.run,repository:'just-every/run-spool',flow:'checkout'});assert.equal(freshProposal.status,'proposed','fresh measured proof may propose a new grant');
 const custody=(await restored.db.prepare('SELECT COUNT(*) n FROM restored_work WHERE project=?').bind('shop').first()).n;assert.ok(custody>0,'restore established destination custody');
 const restoredPlan=await restored.json(`${p}/erasure`);await followErasure(restored.json,await restored.json(`${p}/erasure`,'POST',{confirm:'shop',planHash:restoredPlan.planHash}));
 assert.equal((await restored.db.prepare('SELECT COUNT(*) n FROM restored_work WHERE project=?').bind('shop').first()).n,0,'project erasure removes destination custody with its work');
 const replay=await restored.request('/api/restore','POST',archive,{'X-Confirm-Restore':'yes'});assert.equal(replay.status,400,'an erased project cannot return through an old archive');assert.equal((await replay.json()).error,'erasure_epoch','the erasure fence rejects the old epoch before restoring rows');assert.deepEqual(await restored.json('/api/projects'),[],'refused archive replay leaves the erased destination empty');
 results.archive={reproducers:before.reproducers.length,runs:before.reproducers.reduce((n,r)=>n+r.runs.length,0),workflows:before.workflows.length,receipts:before.workflows.reduce((n,w)=>n+w.receipts.length,0)};
 // Erasure removes every new table's rows for the project, an unused run token included.
 stage='erasure';
 await app.json(`${p}/reproducers/${reproduced.reproducer.id}/runs`,'POST',{});
 const tables=['reproducers','reproducer_runs','reproducer_run_tokens','fix_workflows','fix_receipts','exposures','follow_up_attention','follow_up_fix_steps'];
 const counts=async()=>Object.fromEntries(await Promise.all(tables.map(async table=>[table,(await app.db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE project='shop'`).first()).n])));
 const planted=await counts();assert.ok(Object.values(planted).every(n=>n>0),JSON.stringify(planted));
 const preview=await app.json(`${p}/erasure`);
 const erased=await followErasure(app.json,await app.json(`${p}/erasure`,'POST',{confirm:'shop',planHash:preview.planHash}));assert.equal(erased.phase,'complete');
 assert.deepEqual(await counts(),Object.fromEntries(tables.map(table=>[table,0])),'project erasure deletes reproducers, runs, tokens, workflows, receipts and exposure');
 results.erasure={before:planted,after:await counts()};
 results.githubRequests=github.requests.map(r=>`${r.method} ${r.path} (${r.token})`);
 await writeFile(resolve(directory,'results.json'),JSON.stringify(results,null,2)+'\n');
 console.log(`ALERT-004 an interrupted send, an expired lease and a lost provider response each leave one durable follow-up and never a duplicate. Execution journey passed: outcomes ${Object.values(results.reproduce).join(',')}; workflow ${results.awaitingConnection.status} then deployed; exposure ${Object.values(results.verdicts).join(',')}; ${results.captures.length} captures.`);
}catch(error){console.error(JSON.stringify({journey:'execution',stage,message:error.message,stack:error.stack?.split('\n').filter(row=>row.includes('/tests/')).slice(0,4)}));process.exitCode=1;}
finally{
 const outcomes=await Promise.allSettled([browser?.close(),app?.stop(),restored?.stop(),github?.stop()]);
 await rm(state,{recursive:true,force:true});await rm(restoredState,{recursive:true,force:true});
 if(outcomes.some(result=>result.status==='rejected')){console.error('Execution journey cleanup failed');process.exitCode=1;}
}
