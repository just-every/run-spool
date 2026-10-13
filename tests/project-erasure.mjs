import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queuedExit=await queuedEntrypoint(import.meta.url);if(queuedExit!==null)process.exit(queuedExit);
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:net';
import {handoffRuntime} from './agent-handoff/runtime.mjs';
import {launchBrowser} from './browser-launch.mjs';
import {canary,destinations,importedProject} from './project-erasure/fixture.mjs';
import {plantCap,plantCanary,plantMobile} from './project-erasure/plant.mjs';
import {refusals,secondErase} from './project-erasure/doors.mjs';
import {scanDatabase,scanOutbox,scanText,auditReport} from './project-erasure/scan.mjs';
import {erasePanel} from './project-erasure/ui.mjs';
import {fenceProof} from './project-erasure/fences.mjs';
// BASE-DATA-003 project erasure through public rer setup/dev, HTTP, export and
// import: canaries planted everywhere a project reaches, owner-only erase with a
// count-only preview, typed confirmation and receipt, then scans and fences.
const directory=resolve('.artifacts/project-erasure');await mkdir(directory,{recursive:true});
const port=await new Promise((accept,reject)=>{const server=createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const {port}=server.address();server.close(()=>accept(port));});});
let app,browser,failure,stage='setup';const evidence={checks:[],captures:[]};
try{
 app=await handoffRuntime(port,{destinations});const {json}=app;
 stage='plant';const cap=await plantCap(app),planted=await plantCanary(app),mobile=await plantMobile(app);
 const needles=[...Object.values(canary),importedProject,cap.project,mobile.project];
 const before=scanDatabase(app.checkout.root,Object.values(canary));
 for(const kind of ['NAME','EVENT','MAP','RECIPIENT','TITLE','REPAIR','IMPORTTITLE','ORIGINAL','CAP','MOBILE'])assert.ok(before.found.some(row=>row.needle===canary[kind]),`canary ${kind} is planted in D1`);
 const pre=await app.archive();assert.deepEqual(scanText(pre.text,[canary.NAME,canary.EVENT,canary.MAP]).length,3,'the pre-erasure archive holds the canaries');
 // The other project from the same Sentry export is unrelated and must stay exactly as it was.
 const unrelated=data=>Object.fromEntries(Object.entries(data).map(([table,rows])=>[table,rows.filter(row=>table==='projects'?![importedProject,cap.project,mobile.project].includes(row.id):row.project!==undefined&&row.project!==null&&![importedProject,cap.project,mobile.project].includes(row.project))]));
 const auditBefore=[importedProject,cap.project,mobile.project].map(project=>pre.data.audit.filter(row=>row.project===project).length);

 stage='preview';const preview=await json(`/api/projects/${planted.project}/erasure`);
 assert.deepEqual(scanText(JSON.stringify(preview),needles),[],'the preview carries counts without personal values or identifiers');
 for(const table of ['projects','events','issues','releases','artifacts','credentials','browser_origins','alerts','alert_rules','alert_history','alert_intents','alert_mail_jobs','alert_mail_attempts','rer_mail_development_outbox','repairs','sentry_import_targets'])assert.ok(preview.deleted[table]>0,`preview counts ${table}`);
 assert.ok(preview.redacted.audit>0&&preview.retained.length&&preview.exceptions.length,'preview lists anonymised audit, retained tables and exceptions');

 stage='authorization';evidence.refusals=await refusals(app,{project:planted.project,keys:planted.keys,planHash:preview.planHash});

 stage='cap';const capPreview=await json(`/api/projects/${cap.project}/erasure`);assert.equal(capPreview.deleted.events,10000);
 const started=Date.now(),capReceipt=await json(`/api/projects/${cap.project}/erasure`,'POST',{confirm:cap.project,planHash:capPreview.planHash}),capMs=Date.now()-started;
 console.log('cap erasure',JSON.stringify({ms:capMs,phase:capReceipt.phase,seconds:capReceipt.seconds,deleted:capReceipt.deleted}));
 assert.equal(capReceipt.phase,'complete');assert.equal(capReceipt.deleted.events,10000);assert.ok(capMs<300_000&&capReceipt.seconds<300,'erasure at the retained-event cap completes within 300 seconds');
 assert.deepEqual(scanText(JSON.stringify(capReceipt),needles),[],'the receipt carries counts and times only');
 evidence.cap={events:10000,requestMs:capMs,receiptSeconds:capReceipt.seconds,deleted:capReceipt.deleted};

 stage='ui';browser=await launchBrowser();
 const desktop=await erasePanel(app,browser,directory,{project:planted.project,width:1440,needles:Object.values(canary)});
 const phone=await erasePanel(app,browser,directory,{project:mobile.project,width:390,needles:Object.values(canary)});
 evidence.captures=[...desktop.captures,...phone.captures];await browser.close();browser=null;
 stage='repeat';evidence.second=await secondErase(app,{project:planted.project,planHash:preview.planHash});

 stage='scan';const after=scanDatabase(app.checkout.root,needles);assert.deepEqual(after.found,[],'no canary or erased identifier remains in any D1 table or column');
 const outbox=await scanOutbox(app,needles);assert.deepEqual(outbox.found,[],'no canary remains in the development outbox');
 const fresh=await app.archive();assert.deepEqual(scanText(fresh.text,needles),[],'no canary remains in a fresh archive');
 assert.deepEqual(unrelated(fresh.data),unrelated(pre.data),'unrelated projects keep every row');
 const audit=auditReport(app.checkout.root,{erased:[importedProject,cap.project,mobile.project],expected:auditBefore});
 evidence.scan={before:{tables:before.tables,cells:before.cells,found:before.found.length},after:{tables:after.tables,cells:after.cells,found:0},outbox:outbox.messages,audit};

 stage='fences';evidence.fences=await fenceProof(app,{pre,project:planted.project,erased:[importedProject,cap.project,mobile.project]});
 evidence.checks=['canaries planted in event text, map content, recipient, webhook label, issue title, repair note, import originals and project name','count-only preview with retained tables and exceptions','anonymous 401, ingest/agent/deploy 403, unknown 404, wrong confirmation 400, cross-origin 403, all unchanged','retained-event cap erased within 300 seconds','preview, confirmation and receipt at 1440 and 390 with axe and no overflow','second erase changes nothing','no canary in D1, outbox or fresh archive; audits anonymised','pre-erasure archive refused on the same installation and on a fresh destination after the post-erasure archive, including a child fence; brand-new store limit'];
 await writeFile(directory+'/results.json',JSON.stringify(evidence,null,2)+'\n');
 console.log(`Project erasure public journey passed: ${evidence.checks.length} groups; cap ${capMs} ms; ${evidence.captures.length} captures.`);
}catch(error){failure=error;console.error(JSON.stringify({journey:'project-erasure',stage,type:error.name,message:error.message,stack:error.stack?.split('\n').filter(row=>row.includes('/tests/')).slice(0,4)}));process.exitCode=1;}finally{
 const cleanup=[['browser',()=>browser?.close()],['checkout',()=>app?.close()]];
 const outcomes=await Promise.allSettled(cleanup.map(async([,stop])=>stop()));
 evidence.cleanup=outcomes.map((result,index)=>({name:cleanup[index][0],outcome:result.status==='fulfilled'?'stopped':'failed'}));
 console.log('Project erasure cleanup: '+JSON.stringify(evidence.cleanup));
 if(outcomes.some(result=>result.status==='rejected'))process.exitCode=1;
}
