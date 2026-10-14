import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queuedExit=await queuedEntrypoint(import.meta.url);if(queuedExit!==null)process.exit(queuedExit);
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {launchBrowser} from './browser-launch.mjs';
import {executionRuntime} from './execution/runtime.mjs';
import {githubDouble} from './execution/github-double.mjs';
import {shopFixture} from './execution/fixture.mjs';
import {reproduceProof,runner} from './execution/reproduce.mjs';
import {awaitingConnection,connectedWorkflow,deployedWorkflow,expiredGrant} from './execution/fix.mjs';
import {baseline,exposureVerdicts} from './execution/exposure.mjs';
import {executionPanel} from './execution/ui.mjs';
// A captured failure reproduced in the isolated sandbox, carried through a fix
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
 stage='reproduce';const reproduced=await reproduceProof(app,fixture,ingestKey);results.reproduce=reproduced.outcomes;results.probe=reproduced.probe;results.checks=reproduced.checks;results.tools=reproduced.tools;
 const agent=(await app.json(`${p}/keys`,'POST',{kind:'agent'})).key;
 for(const path of [`${p}/reproducers?issue=${reproduced.issue}`,`${p}/fixes?issue=${reproduced.issue}`]){const r=await fetch(app.origin+path,{headers:{Authorization:'Bearer '+agent}});assert.equal(r.status,403,'agent keys cannot read reproducers or fix workflows');await r.body?.cancel();}
 stage='baseline';await baseline(app,ingestKey,r1);
 stage='awaiting-connection';const awaiting=await awaitingConnection(app,github,reproduced);results.awaitingConnection={status:awaiting.status,error:awaiting.error};
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
 results.low=(await verdicts.low()).reasons;const reached=await verdicts.reached();results.reached={reasons:reached.reasons,denominators:reached.denominators};
 stage='ui';browser=await launchBrowser();results.captures=await executionPanel(app,browser,directory,reproduced.issue,reproduced.reproducer);await browser.close();browser=null;
 stage='capture-gap';results.gap=(await verdicts.gap()).reasons;
 stage='recurrence';results.verdicts=await verdicts.recurred();
 stage='expiry';results.expiry=await finishExpiry();
 stage='archive';
 const archive=await (await app.request('/api/archive')).text();
 const views=async runtime=>({reproducers:(await runtime.json(`${p}/reproducers?issue=${reproduced.issue}`)).reproducers,workflows:(await runtime.json(`${p}/fixes?issue=${reproduced.issue}`)).workflows.map(({connection,...row})=>row)});
 const before=await views(app);
 restored=await executionRuntime(restoredState,15477);await restored.json('/api/restore','POST',archive,{'X-Confirm-Restore':'yes'});
 assert.deepEqual(await views(restored),before,'reproducers, runs, workflows, receipts and exposure verdicts restore unchanged');
 results.archive={reproducers:before.reproducers.length,runs:before.reproducers.reduce((n,r)=>n+r.runs.length,0),workflows:before.workflows.length,receipts:before.workflows.reduce((n,w)=>n+w.receipts.length,0)};
 results.githubRequests=github.requests.map(r=>`${r.method} ${r.path} (${r.token})`);
 await writeFile(resolve(directory,'results.json'),JSON.stringify(results,null,2)+'\n');
 console.log(`Execution journey passed: outcomes ${Object.values(results.reproduce).join(',')}; workflow ${results.awaitingConnection.status} then deployed; exposure ${Object.values(results.verdicts).join(',')}; ${results.captures.length} captures.`);
}catch(error){console.error(JSON.stringify({journey:'execution',stage,message:error.message,stack:error.stack?.split('\n').filter(row=>row.includes('/tests/')).slice(0,4)}));process.exitCode=1;}
finally{
 const outcomes=await Promise.allSettled([browser?.close(),app?.stop(),restored?.stop(),github?.stop()]);
 await rm(state,{recursive:true,force:true});await rm(restoredState,{recursive:true,force:true});
 if(outcomes.some(result=>result.status==='rejected')){console.error('Execution journey cleanup failed');process.exitCode=1;}
}
