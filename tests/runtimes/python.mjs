import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {run,runOk,exceptionTypes,issueDetails} from './harness.mjs';
import {readScreens} from './screens.mjs';

const here=resolve(import.meta.dirname,'python');
// Every environment variable sentry-sdk reads to infer a release; cleared to prove "no release".
const releaseSources=['SENTRY_RELEASE','HEROKU_SLUG_COMMIT','HEROKU_BUILD_COMMIT','SOURCE_VERSION','CODEBUILD_RESOLVED_SOURCE_VERSION','CIRCLE_SHA1','GAE_DEPLOYMENT_ID','GITHUB_SHA','COMMIT_REF','BUILD_VCS_NUMBER','BITBUCKET_COMMIT','CF_PAGES_COMMIT_SHA','VERCEL_GIT_COMMIT_SHA','RENDER_GIT_COMMIT','RAILWAY_GIT_COMMIT_SHA'];
const python=dir=>resolve(dir,'venv/bin/python');
const command=(dir,script,mode,dsn,cwd=dir)=>({command:python(dir),args:[resolve(here,script),...mode?[mode]:[]],cwd,env:{SPOOL_FIXTURE_DSN:dsn},unset:releaseSources});

export default {
 name:'python',sdk:'sentry.python',version:'sentry-sdk 2.72.0',
 required:['event','session','transaction','log','attachment','check_in','client_report'],
 chain:['ZeroDivisionError','ValueError'],
 async prepare(dir){
  await runOk('python3',['-m','venv',resolve(dir,'venv')]);
  await runOk(resolve(dir,'venv/bin/pip'),['install','--quiet','--disable-pip-version-check','sentry-sdk==2.72.0','django==5.2.8','brotli==1.2.0']);
 },
 command(mode,dir,dsn,cwd=dir){return {...command(dir,'app.py',mode,dsn,cwd),unset:[]}},
 async checkIssue({page,app,project,handled}){
  const root=`/api/projects/${project.id}/issues/${handled.issue.id}/events`,listed=await app.json(root+'?q=tenant:acme');
  assert.equal(listed.total,handled.issue.count);const tenant=listed.tags.rows.find(row=>row.key==='tenant'&&row.value==='acme');assert.equal(tenant.count,listed.total);assert.equal(tenant.percent,100*tenant.count/listed.tags.events);
  await page.getByRole('searchbox',{name:'Search events',exact:true}).fill('tenant:acme');
  const selected=page.locator('.metadata[data-event-id]');
  const choose=async(name,event)=>{const button=page.getByRole('button',{name,exact:true});await button.click();await page.waitForFunction(id=>document.querySelector('.metadata[data-event-id]')?.getAttribute('data-event-id')===id,event.id);assert.equal(new URL(page.url()).searchParams.get('event'),event.id)};
  await page.getByRole('button',{name:'Oldest',exact:true}).waitFor();await choose('Oldest',listed.oldest);
  await page.getByRole('button',{name:'Next event',exact:true}).waitFor({state:'visible'});await choose('Next event',listed.latest);await choose('Previous event',listed.oldest);await choose('Latest',listed.latest);
  assert.equal(await selected.getAttribute('data-event-id'),listed.latest.id);
  const sdk=handled.events.find(e=>e.id===listed.latest.id).event.sentry;
  assert.equal(await page.locator('article.exception').count(),sdk.exceptions.length);
  const sdkFrame=sdk.exceptions.flatMap(e=>e.stacktrace.frames).find(frame=>frame.function==='charge'&&frame.vars);
  assert.ok((await page.locator('.sdk-context').first().innerText()).includes('sent by SDK'));
  const localSummary=page.locator('article.exception summary').filter({hasText:'Local variables · sent by SDK'}).first();await localSummary.click();const locals=localSummary.locator('..');
  assert.ok((await locals.innerText()).includes('quantity'));assert.ok(JSON.stringify(sdkFrame.vars).includes('[redacted]'));
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await page.getByRole('button',{name:'Details: Raw stack trace',exact:true}).click();const raw=page.getByRole('dialog',{name:'Raw stack trace',exact:true});
  const expected=await raw.locator('pre').innerText();await raw.getByRole('button',{name:'Copy raw stack trace',exact:true}).click();await page.getByRole('button',{name:'Stack trace copied',exact:true}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expected);for(const exception of sdk.exceptions)assert.ok(expected.includes(exception.type));
  await page.keyboard.press('Escape');
 },
 async verify({app,details,dir,origin,cookie}){
  const events=details.flatMap(d=>d.events.map(e=>e.event.sentry));
  // SDK-010: local variables, SDK context and default integrations, as the unmodified SDK sent them.
  const failing=events.find(sentry=>sentry.exceptions.some(x=>x.stacktrace?.frames.some(f=>f.vars?.order_note)));
  const frame=failing.exceptions.flatMap(x=>x.stacktrace.frames).find(f=>f.function==='charge'&&f.vars);
  assert.equal(frame.vars.quantity,'0','an ordinary local survives');assert.equal(frame.vars.password,'[redacted]');assert.equal(frame.vars.api_key,'[redacted]');
  assert.equal(failing.contexts.runtime.name,'CPython');for(const integration of ['excepthook','logging','stdlib','threading'])assert.ok(failing.sdk.integrations.includes(integration),`default ${integration} integration`);
  const create=id=>app.json('/api/projects','POST',{id,name:id});
  const send=async(created,script,{cwd=dir,mode}={})=>{
   const spec=command(dir,script,mode,created.dsn,cwd);const result=await run(spec.command,spec.args,{cwd:spec.cwd,env:spec.env,unset:spec.unset});
   assert.equal(result.code,0,`${script}: ${result.stderr.slice(-500)}`);return issueDetails(app,created.id);
  };
  // SDK-009: no release (no environment variable, not a git checkout) is accepted, alerted and counted as release-less.
  const releasesProject=await create('rt-python-releases'),root='/api/projects/rt-python-releases';
  const empty=resolve(dir,'no-release');await mkdir(empty,{recursive:true});
  const none=await send(releasesProject,'app.py',{cwd:empty,mode:'handled'});
  assert.equal(none.length,1);assert.deepEqual(await app.json(root+'/releases'),[],'release-less capture creates no pretend release');
  const alerts=(await app.json(root+'/alerts')).filter(row=>row.kind==='new_issue');
  assert.deepEqual(alerts.map(row=>row.issue),[none[0].issue.id],'the release-less event raises one new-issue alert');
  const alertRelease=JSON.parse(alerts[0].payload).release;
  assert.deepEqual([alertRelease.name,alertRelease.sequence],['',0],'release-less alert names no release');
  // SDK-009: the SDK infers a release from the git checkout it runs in, and is created automatically.
  const checkout=resolve(dir,'inferred');await mkdir(checkout,{recursive:true});
  const git=(...args)=>runOk('env',['GIT_AUTHOR_NAME=Run Edit Run fleet',`GIT_AUTHOR_EMAIL=${['fleet','runeditrun.com'].join('@')}`,'GIT_COMMITTER_NAME=Run Edit Run fleet',`GIT_COMMITTER_EMAIL=${['fleet','runeditrun.com'].join('@')}`,'git',...args],{cwd:checkout});
  await git('init','-q');await git('commit','-q','--allow-empty','-m','synthetic-spool-1');
  const sha=(await runOk('git',['rev-parse','HEAD'],{cwd:checkout})).stdout.trim();
  const [issue]=await send(releasesProject,'app.py',{cwd:checkout,mode:'handled'});
  assert.deepEqual(issue.events.map(e=>e.release).sort(),['',sha].sort(),'SDK-inferred git SHA is the release');
  const releases=await app.json(root+'/releases');assert.deepEqual(releases.map(r=>[r.name,r.auto_created]),[[sha,1]],'inferred release is created automatically');
  // Release-scoped figures leave the release-less event out and count it apart; issue totals keep it.
  assert.equal(issue.issue.count,2,'the release-less event counts in the issue total');
  assert.equal((await app.json(root+'/release-policy')).noReleaseEvents,1,'release-scoped no-release count');
  assert.equal((await app.json(root+'/issue-search?q=!has:release')).total,1);assert.equal((await app.json(root+`/issue-search?q=release:${sha}`)).total,1);
  await readScreens(origin,cookie,[
   {name:'python-releases',path:'/projects/rt-python-releases/releases',check:async page=>{await page.getByRole('button',{name:'Details: Events without a release',exact:true}).click();await page.getByRole('dialog',{name:'Events without a release',exact:true}).getByText('1 events have no release.',{exact:false}).waitFor();await page.keyboard.press('Escape');await page.locator('tr.data-row').filter({hasText:sha}).first().waitFor()}},
   {name:'python-alerts',path:'/projects/rt-python-releases/alerts',check:async page=>{const record=page.locator('ul.alert-records li');await record.first().waitFor();assert.equal(await record.count(),1,'one alert in the feed');const text=await record.innerText();assert.ok(text.includes(issue.issue.title)&&!text.includes(sha),'the feed shows the release-less alert with no release name')}},
  ]);
  // SDK-010: exception groups with every member, and Django request data from a real WSGI request.
  const [grouped]=await send(await create('rt-python-group'),'group.py');assert.deepEqual(exceptionTypes(grouped.events[0]),['TypeError','ValueError','ExceptionGroup']);
  assert.equal(grouped.events[0].event.sentry.exceptions.at(-1).mechanism.is_exception_group,true);
  const [django]=await send(await create('rt-python-django'),'django_app.py');
  const request=django.events[0].event.sentry.request;
  assert.ok(request.url.endsWith('/checkout'));assert.equal(request.method,'GET');assert.ok(request.query_string.includes('page=2'));assert.ok(!JSON.stringify(request).includes('synthetic-spool-3'),'secret query value masked');assert.ok(!JSON.stringify(request).includes('synthetic-spool-cookie'),'cookie value removed');
  const headers=Object.fromEntries(Object.entries(request.headers??{}).map(([name,value])=>[name.toLowerCase(),value]));
  assert.equal(headers['user-agent'],'spool-runtime-qualification','Django request headers are kept');
  assert.ok(django.events[0].event.sentry.sdk.integrations.includes('django'),'Django integration is a default');
 },
};
