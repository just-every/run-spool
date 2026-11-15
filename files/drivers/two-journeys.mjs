import {pathToFileURL} from 'node:url';
const load = path => import(pathToFileURL(process.cwd()+'/'+path));
const {endUserErasurePreviewFlow} = await load('tests/end-user-erasure-preview.mjs');
const {sessionFlow} = await load('tests/session-flow.mjs');
const {startTestWorker} = await load('tests/worker.mjs');
const {signIn} = await load('tests/auth.mjs');
const {launchBrowser} = await load('tests/browser-launch.mjs');
const results=[];
try {await endUserErasurePreviewFlow();results.push({journey:'endUserErasurePreviewFlow',passed:true})}
catch(error){results.push({journey:'endUserErasurePreviewFlow',passed:false,error:error.stack})}
let worker,browser;
try {worker=await startTestWorker(15521);browser=await launchBrowser();await sessionFlow({origin:worker.origin,cookie:await signIn(worker.origin),browser});results.push({journey:'sessionFlow',passed:true})}
catch(error){results.push({journey:'sessionFlow',passed:false,error:error.stack})}
finally {await browser?.close();await worker?.stop()}
console.log(JSON.stringify(results,null,2));
process.exitCode=results.every(row=>row.passed)?0:1;
