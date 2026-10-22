import assert from 'node:assert/strict';
import {cp} from 'node:fs/promises';
import {delimiter,resolve} from 'node:path';
import {runOk} from './harness.mjs';

const here=resolve(import.meta.dirname,'java');
export default {
 name:'java',sdk:'sentry.java',version:'io.sentry:sentry 8.61.0',
 required:['event','transaction','log','attachment','check_in','feedback','client_report'],
 chain:['ArithmeticException','IllegalStateException'],
 async prepare(dir){
  await cp(here,dir,{recursive:true});
  await runOk('mvn',['-q','-B','dependency:copy-dependencies','-DoutputDirectory=lib'],{cwd:dir});
  await runOk('javac',['-cp',resolve(dir,'lib/*'),'-d',resolve(dir,'out'),resolve(dir,'App.java')],{cwd:dir});
 },
 command(mode,dir,dsn,cwd=dir){return {command:'java',args:['-cp',[resolve(dir,'out'),resolve(dir,'lib/*')].join(delimiter),'App',mode],cwd,env:{SPOOL_FIXTURE_DSN:dsn,SENTRY_RELEASE:'synthetic-spool-java@1.0.0'}}},
 async verify({app,project}){
  const feedback=await app.json(`/api/projects/${project.id}/feedback`);
  assert.ok(feedback.items.some(row=>row.message==='synthetic-spool-feedback'&&row.eventId&&row.issueId),'java feedback attaches to its issue');
 },
};
