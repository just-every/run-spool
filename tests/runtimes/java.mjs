import assert from 'node:assert/strict';
import {cp} from 'node:fs/promises';
import {delimiter,resolve} from 'node:path';
import {exceptionTypes,issueDetails,run,runOk} from './harness.mjs';
import {readScreens} from './screens.mjs';

const here=resolve(import.meta.dirname,'java');
export default {
 name:'java',sdk:'sentry.java',version:'io.sentry:sentry 8.61.0',
 required:['event','session','transaction','log','attachment','check_in','feedback','client_report'],
 chain:['ArithmeticException','IllegalStateException'],
 async prepare(dir){
  await cp(here,dir,{recursive:true});
  await runOk('mvn',['-q','-B','dependency:copy-dependencies','-DoutputDirectory=lib'],{cwd:dir});
  await runOk('javac',['-cp',resolve(dir,'lib/*'),'-d',resolve(dir,'out'),resolve(dir,'App.java')],{cwd:dir});
 },
 command(mode,dir,dsn,cwd=dir){return {command:'java',args:['-cp',[resolve(dir,'out'),resolve(dir,'lib/*')].join(delimiter),'App',mode],cwd,env:{SPOOL_FIXTURE_DSN:dsn}}},
 async verify({app,project,dir,origin,cookie}){
  const feedback=await app.json(`/api/projects/${project.id}/feedback`);
  assert.ok(feedback.items.some(row=>row.message==='synthetic-spool-feedback'&&row.eventId&&row.issueId),'java feedback attaches to its issue');
  // SDK-010: a Caused by chain with a suppressed exception keeps all three, each with its relation.
  const created=await app.json('/api/projects','POST',{id:'rt-java-suppressed',name:'java suppressed'});
  const spec=this.command('suppressed',dir,created.dsn);
  const result=await run(spec.command,spec.args,{cwd:spec.cwd,env:spec.env});assert.equal(result.code,0,result.stderr);
  const [issue]=await issueDetails(app,'rt-java-suppressed');
  assert.deepEqual(exceptionTypes(issue.events[0]),['ArithmeticException','IOException','IllegalStateException']);
  assert.deepEqual(issue.events[0].event.sentry.exceptions.map(x=>x.mechanism.type),['chained','suppressed','chained']);
  await readScreens(origin,cookie,[{name:'java-caused-by',path:`/projects/${created.id}/issues/${issue.issue.id}`,check:async page=>{
   const root=page.locator('article.exception').filter({has:page.getByRole('heading',{name:/ArithmeticException: division by zero/})});
   await root.getByText('Root cause',{exact:true}).waitFor();
   await page.locator('article.exception > h3').filter({hasText:'IllegalStateException: checkout quantity rejected'}).waitFor();
   await page.locator('article.exception > h3').filter({hasText:'IOException: synthetic-spool-close-failed'}).waitFor();
  }}]);
 },
};
