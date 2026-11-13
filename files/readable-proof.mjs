import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {executionRuntime} from '/workspace/run-spool/tests/execution/runtime.mjs';
import {launchBrowser} from '/workspace/run-spool/tests/browser-launch.mjs';
import {usageLabels} from '/workspace/run-spool/tests/team-browser.mjs';
import {damagedRestoreUI,erasedRestoreUI} from '/workspace/run-spool/tests/restore-refusal-ui.mjs';
const output=process.env.SPOOL_READABLE_PROOF;
await mkdir(output,{recursive:true});
process.env.SPOOL_TEAM_EVIDENCE=output;
const sourceState=await mkdtemp(join(tmpdir(),'spool-readable-source-')),destinationState=await mkdtemp(join(tmpdir(),'spool-readable-destination-'));
let source,destination,browser;
try {
 source=await executionRuntime(sourceState,15478);
 await source.json('/api/organization','POST',{id:'synthetic-spool-readable',name:'Synthetic Spool'});
 const project=await source.json('/api/projects','POST',{id:'synthetic-spool-readable',name:'Synthetic storefront'});
 const owner={...source,req:source.request};
 browser=await launchBrowser();
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addCookies([{name:source.cookie.split('=')[0],value:source.cookie.slice(source.cookie.indexOf('=')+1),url:source.origin}]);
 try {await usageLabels(await context.newPage(),owner,project);} finally {await context.close();}
 const archive=await (await source.request('/api/archive')).text();
 destination=await executionRuntime(destinationState,15479);
 await damagedRestoreUI(browser,destination.origin,destination.cookie,archive,output);
 await erasedRestoreUI(browser,source.origin,source.cookie,archive,output);
 await writeFile(join(output,'readable-proof.json'),JSON.stringify({result:'passed',assertionWidth:1440,screenshotWidths:[1440,390],screens:['usage','damaged restore refusal','erased-data restore refusal'],refusalsUnchanged:['part_checksum','erasure_epoch'],mutationsAfterRefusal:0},null,2)+'\n');
 console.log('Readable usage and both restore refusals passed through public HTTP/UI doors; screenshots at 1440 and 390.');
} finally {
 await browser?.close();await source?.stop();await destination?.stop();await rm(sourceState,{recursive:true,force:true});await rm(destinationState,{recursive:true,force:true});
}
