import {capJourney} from './project-erasure-cap.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:net';
import {handoffRuntime} from './agent-handoff/runtime.mjs';
import {launchBrowser} from './browser-launch.mjs';
import {canary,destinations,importedProject} from './project-erasure/fixture.mjs';
import {plantCanary,plantMobile} from './project-erasure/plant.mjs';
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
 stage='plant';const planted=await plantCanary(app),mobile=await plantMobile(app);
 await json('/api/organization','POST',{id:'synthetic-spool-1',name:'synthetic-spool-1'});
 const organization=await json('/api/organization'),member=organization.members.find(row=>row.role==='owner');
 await json('/api/organization/projects/'+planted.project,'PUT',{team:canary.NAME});
 await json('/api/projects/'+planted.project+'/alerting/team-digests','PUT',{member:member.id,timezone:'America/New_York',daily:true,weekly:true,hour:9});
 await json('/api/projects/'+planted.project+'/alerting/team-snoozes','POST',{scope:'team',target:canary.NAME,until:Date.now()+3600000});
 await json('/api/projects/'+planted.project+'/follow-up/alternate-member','PUT',{member:member.id});
 const service=await json('/api/organization/services','POST',{name:'synthetic-spool-1',scopes:[{project:planted.project,kind:'agent'}]});
 await json('/api/organization/services/'+service.id+'/keys','POST',{project:planted.project,kind:'agent'});
 const retentionPath=`/api/projects/${planted.project}/retention-policy`;
 const policy=await json(retentionPath);await json(retentionPath+'/hold','PUT',{held:true,reason:canary.NAME,revision:policy.revision});
 assert.equal((await app.request(`/api/projects/${planted.project}/retention`,'POST',{cutoff:Date.now(),apply:true})).status,409,'[GOV-002] legal hold prevents expiry before erasure');
 const needles=[...Object.values(canary),importedProject,mobile.project];
 const before=scanDatabase(app.checkout.root,Object.values(canary));
 for(const kind of ['NAME','EVENT','MAP','RECIPIENT','TITLE','REPAIR','IMPORTTITLE','ORIGINAL','MOBILE','FEEDBACK','COMMIT','AUTHOR'])assert.ok(before.found.some(row=>row.needle===canary[kind]),`canary ${kind} is planted in D1`);
 const pre=await app.archive();assert.deepEqual(scanText(pre.text,[canary.NAME,canary.EVENT,canary.MAP]).length,3,'the pre-erasure archive holds the canaries');
 // The other project from the same Sentry export is unrelated and must stay exactly as it was.
 const erased=[importedProject,mobile.project];
 const unrelated=data=>Object.fromEntries(Object.entries(data).map(([table,rows])=>[table,rows.filter(row=>table==='projects'?!erased.includes(row.id):row.project!==undefined&&row.project!==null&&!erased.includes(row.project))]));
 const auditBefore=erased.map(project=>pre.data.audit.filter(row=>row.project===project).length);

 stage='preview';const preview=await json(`/api/projects/${planted.project}/erasure`);
 assert.deepEqual(scanText(JSON.stringify(preview),needles),[],'the preview carries counts without personal values or identifiers');
 for(const table of ['projects','events','issues','releases','artifacts','credentials','browser_origins','alerts','alert_rules','alert_history','alert_intents','alert_mail_jobs','alert_mail_attempts','rer_mail_development_outbox','repairs','feedback','sentry_import_targets'])assert.ok(preview.deleted[table]>0,`preview counts ${table}`);
 for(const table of ['spool_project_teams','spool_service_scopes','spool_service_credentials','spool_team_digest_settings','spool_team_snoozes','spool_follow_up_alternates'])assert.ok(preview.deleted[table]>0,'TEAM-001 erasure declares '+table);
 assert.ok(preview.deleted.retention_policies>0,'[GOV-002] held policy is included in erasure');
 assert.ok(preview.redacted.audit>0&&preview.retained.length&&preview.exceptions.length,'preview lists anonymised audit, retained tables and exceptions');

 stage='authorization';evidence.refusals=await refusals(app,{project:planted.project,keys:planted.keys,planHash:preview.planHash});

 stage='ui';browser=await launchBrowser();
 const desktop=await erasePanel(app,browser,directory,{project:planted.project,width:1440,needles:Object.values(canary)});
 const phone=await erasePanel(app,browser,directory,{project:mobile.project,width:1440,needles:Object.values(canary)});
 evidence.captures=[...desktop.captures,...phone.captures];await browser.close();browser=null;
 stage='repeat';evidence.second=await secondErase(app,{project:planted.project,planHash:preview.planHash});

 stage='scan';const after=scanDatabase(app.checkout.root,needles);assert.deepEqual(after.found,[],'no canary or erased identifier remains in any D1 table or column');
 const outbox=await scanOutbox(app,needles);assert.deepEqual(outbox.found,[],'no canary remains in the development outbox');
 const fresh=await app.archive();assert.deepEqual(scanText(fresh.text,needles),[],'no canary remains in a fresh archive');
 assert.deepEqual(unrelated(fresh.data),unrelated(pre.data),'unrelated projects keep every row');
 const audit=auditReport(app.checkout.root,{erased,expected:auditBefore});
 evidence.scan={before:{tables:before.tables,cells:before.cells,found:before.found.length},after:{tables:after.tables,cells:after.cells,found:0},outbox:outbox.messages,audit};

 stage='fences';evidence.fences=await fenceProof(app,{pre,project:planted.project,erased});
 evidence.checks=['canaries planted in event text, map content, recipient, webhook label, issue title, repair note, import originals and project name','count-only preview with retained tables and exceptions','anonymous 401, ingest/agent/deploy 403, unknown 404, wrong confirmation 400, cross-origin 403, all unchanged','preview, confirmation and receipt at 1440 with axe and no overflow','second erase changes nothing','no canary in D1, outbox or fresh archive; audits anonymised','pre-erasure archive refused on the same installation and on a fresh destination after the post-erasure archive, including a child fence; brand-new store limit'];
 await writeFile(directory+'/results.json',JSON.stringify(evidence,null,2)+'\n');
 console.log(`Project erasure public journey passed: ${evidence.checks.length} groups; ${evidence.captures.length} captures.`);
}catch(error){failure=error;console.error(JSON.stringify({journey:'project-erasure',stage,type:error.name,message:error.message,stack:error.stack?.split('\n').filter(row=>row.includes('/tests/')).slice(0,4)}));process.exitCode=1;}finally{
 const cleanup=[['browser',()=>browser?.close()],['checkout',()=>app?.close()]];
 const outcomes=await Promise.allSettled(cleanup.map(async([,stop])=>stop()));
 evidence.cleanup=outcomes.map((result,index)=>({name:cleanup[index][0],outcome:result.status==='fulfilled'?'stopped':'failed'}));
 console.log('Project erasure cleanup: '+JSON.stringify(evidence.cleanup));
 if(outcomes.some(result=>result.status==='rejected'))process.exitCode=1;
}

await capJourney();
