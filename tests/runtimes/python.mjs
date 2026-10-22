import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {run,runOk,exceptionTypes,issueDetails} from './harness.mjs';

const here=resolve(import.meta.dirname,'python');
// Every environment variable sentry-sdk reads to infer a release; cleared to prove "no release".
const releaseSources=['SENTRY_RELEASE','HEROKU_SLUG_COMMIT','HEROKU_BUILD_COMMIT','SOURCE_VERSION','CODEBUILD_RESOLVED_SOURCE_VERSION','CIRCLE_SHA1','GAE_DEPLOYMENT_ID','GITHUB_SHA','COMMIT_REF','BUILD_VCS_NUMBER','BITBUCKET_COMMIT','CF_PAGES_COMMIT_SHA','VERCEL_GIT_COMMIT_SHA','RENDER_GIT_COMMIT','RAILWAY_GIT_COMMIT_SHA'];
const python=dir=>resolve(dir,'venv/bin/python');
const command=(dir,script,mode,dsn,cwd=dir)=>({command:python(dir),args:[resolve(here,script),...mode?[mode]:[]],cwd,env:{SPOOL_FIXTURE_DSN:dsn},unset:releaseSources});

export default {
 name:'python',sdk:'sentry.python',version:'sentry-sdk 2.72.0',
 required:['event','transaction','log','attachment','check_in','client_report'],
 chain:['ZeroDivisionError','ValueError'],
 async prepare(dir){
  await runOk('python3',['-m','venv',resolve(dir,'venv')]);
  await runOk(resolve(dir,'venv/bin/pip'),['install','--quiet','--disable-pip-version-check','sentry-sdk==2.72.0','django==5.2.8']);
 },
 command(mode,dir,dsn,cwd=dir){return {...command(dir,'app.py',mode,dsn,cwd),unset:[]}},
 async verify({app,project,details,dir}){
  const events=details.flatMap(d=>d.events.map(e=>e.event.sentry));
  // SDK-010: local variables, SDK context and default integrations, as the unmodified SDK sent them.
  const failing=events.find(sentry=>sentry.exceptions.some(x=>x.stacktrace?.frames.some(f=>f.vars?.order_note)));
  const frame=failing.exceptions.flatMap(x=>x.stacktrace.frames).find(f=>f.function==='charge'&&f.vars);
  assert.equal(frame.vars.quantity,'0','an ordinary local survives');assert.equal(frame.vars.password,'[redacted]');assert.equal(frame.vars.api_key,'[redacted]');
  assert.equal(failing.contexts.runtime.name,'CPython');for(const integration of ['excepthook','logging','stdlib','threading'])assert.ok(failing.sdk.integrations.includes(integration),`default ${integration} integration`);
  const execute=async(id,script,{cwd=dir,mode,setup}={})=>{
   const created=await app.json('/api/projects','POST',{id,name:id});
   const spec=command(dir,script,mode,created.dsn,cwd);const result=await run(spec.command,spec.args,{cwd:spec.cwd,env:spec.env,unset:spec.unset});
   assert.equal(result.code,0,`${script}: ${result.stderr.slice(-500)}`);return {created,issues:await issueDetails(app,id)};
  };
  // SDK-009: no release (no environment variable, not a git checkout) is accepted and counted as release-less.
  const empty=resolve(dir,'no-release');await mkdir(empty,{recursive:true});
  const none=await execute('rt-python-no-release','app.py',{cwd:empty,mode:'handled'});
  assert.equal(none.issues.length,1);assert.deepEqual((await app.json('/api/projects/rt-python-no-release/releases')),[],'release-less capture creates no pretend release');
  assert.equal((await app.json('/api/projects/rt-python-no-release/issue-search?q=!has:release')).total,1);
  assert.deepEqual([none.issues[0].issue.attention.payload.release.name,none.issues[0].issue.attention.payload.release.sequence],['',0],'release-less alert names no release');
  // SDK-009: the SDK infers a release from the git checkout it runs in.
  const checkout=resolve(dir,'inferred');await mkdir(checkout,{recursive:true});
  const git=(...args)=>runOk('git',['-c','user.email=synthetic-spool@example.test','-c','user.name=synthetic-spool',...args],{cwd:checkout});
  await git('init','-q');await git('commit','-q','--allow-empty','-m','synthetic-spool-1');
  const sha=(await runOk('git',['rev-parse','HEAD'],{cwd:checkout})).stdout.trim();
  const inferred=await execute('rt-python-inferred','app.py',{cwd:checkout,mode:'handled'});
  assert.ok(inferred.issues.every(d=>d.events.every(e=>e.release===sha)),'SDK-inferred git SHA is the release');
  const releases=await app.json('/api/projects/rt-python-inferred/releases');assert.ok(releases.some(r=>r.name===sha),'inferred release is created automatically');
  // SDK-010: exception groups with every member, and Django request data from a real WSGI request.
  const group=await execute('rt-python-group','group.py');
  const [grouped]=group.issues;assert.deepEqual(exceptionTypes(grouped.events[0]),['TypeError','ValueError','ExceptionGroup']);
  assert.equal(grouped.events[0].event.sentry.exceptions.at(-1).mechanism.is_exception_group,true);
  const django=await execute('rt-python-django','django_app.py');
  const request=django.issues[0].events[0].event.sentry.request;
  assert.ok(request.url.endsWith('/checkout'));assert.equal(request.method,'GET');assert.ok(request.query_string.includes('page=2'));assert.ok(!JSON.stringify(request).includes('synthetic-spool-3'),'secret query value masked');assert.ok(!JSON.stringify(request).includes('synthetic-spool-cookie'),'cookie value removed');
  const headers=Object.fromEntries(Object.entries(request.headers??{}).map(([name,value])=>[name.toLowerCase(),value]));
  assert.equal(headers['user-agent'],'spool-runtime-qualification','Django request headers are kept');
  assert.ok(django.issues[0].events[0].event.sentry.sdk.integrations.includes('django'),'Django integration is a default');
 },
};
