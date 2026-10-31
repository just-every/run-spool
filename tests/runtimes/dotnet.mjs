import assert from 'node:assert/strict';
import {cp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runOk} from './harness.mjs';
import {feedbackProof} from './feedback-proof.mjs';

const here=resolve(import.meta.dirname,'dotnet');
const env={DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_NOLOGO:'1'};
export default {
 name:'dotnet',sdk:'sentry.dotnet',version:'Sentry (.NET) 6.12.1',
 required:['event','session','transaction','log','attachment','check_in','feedback','client_report'],
 chain:['System.DivideByZeroException','System.InvalidOperationException'],
 async prepare(dir){
  await cp(here,dir,{recursive:true});
  await runOk('dotnet',['build','-c','Release','-o',resolve(dir,'out'),'--nologo','-v','q'],{cwd:dir,env});
 },
 command(mode,dir,dsn,cwd=dir){return {command:'dotnet',args:[resolve(dir,'out/App.dll'),mode],cwd,env:{...env,SPOOL_FIXTURE_DSN:dsn}}},
 async verify({app,project,details,referenceSent}){
  const feedback=await app.json(`/api/projects/${project.id}/feedback`);
  assert.ok(feedback.items.some(row=>row.message==='synthetic-spool-feedback'&&row.eventId&&row.issueId),'dotnet feedback attaches to its issue');
  return feedbackProof({app,project,details,referenceSent});
 },
};
