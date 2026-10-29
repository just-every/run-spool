import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';
import {api,counts,expectedOutcomes,exceptionTypes,issueDetails,outcomeMap,referenceCollector,run,sentIdentities} from './runtimes/harness.mjs';
import {readScreens} from './runtimes/screens.mjs';

// [SDK-005] [SDK-001] [SDK-012] [SDK-013] Real, unmodified Sentry SDK programs for each qualified runtime: once against a plain
// reference collector, once against Spool with only the DSN changed. Spool's public API
// must then account for every envelope item the SDK itself produced.
const available={electron:'./runtimes/electron.mjs',node:'./runtimes/node.mjs',python:'./runtimes/python.mjs',go:'./runtimes/go.mjs',java:'./runtimes/java.mjs',ruby:'./runtimes/ruby.mjs',php:'./runtimes/php.mjs',dotnet:'./runtimes/dotnet.mjs',rust:'./runtimes/rust.mjs',elixir:'./runtimes/elixir.mjs'};
const names=process.argv.slice(2).length?process.argv.slice(2):Object.keys(available);
for(const name of names)assert.ok(available[name],`unknown runtime ${name}`);
const sequence=['handled','crash','handled'];
const temporary=await mkdtemp(join(tmpdir(),'spool-runtimes-'));
let worker;
try{
 worker=await startTestWorker(15540);
 const {origin}=worker,cookie=await signIn(origin),app=api(origin,cookie);
 for(const name of names){
  const runtime=(await import(available[name])).default,dir=join(temporary,name);
  await runtime.prepare(dir);
  // Each SDK reads its release (and, where it supports one, its dist) from the standard variables.
  const identity={SENTRY_RELEASE:`synthetic-spool-${name}@1.0.0`,SENTRY_DIST:'synthetic-spool-1'};
  const execute=async(dsn,modes=sequence)=>{const results=[];for(const mode of modes){const c=runtime.command(mode,dir,dsn);results.push({mode,...await run(c.command,c.args,{cwd:c.cwd,env:{...identity,...c.env},unset:c.unset})})}return results};
  const reference=await referenceCollector();
  const referenceRuns=await execute(reference.dsn);await reference.close();
  for(const result of referenceRuns)assert.equal(result.mode==='crash'?result.code!==0:result.code===0,true,`${name} reference ${result.mode} exit ${result.code}: ${result.stderr.slice(-600)}`);
  const types=counts(reference.sent.map(item=>item.type));
  for(const type of runtime.required)assert.ok(types.get(type),`${name} SDK sent no ${type} item with its default/wizard options (sent ${[...types].join(',')})`);
  const project=await app.json('/api/projects','POST',{id:`rt-${name}`,name:`${name} runtime`});
  const spoolRuns=await execute(project.dsn);
  for(const result of spoolRuns)assert.equal(result.mode==='crash'?result.code!==0:result.code===0,true,`${name} Spool ${result.mode} exit ${result.code}: ${result.stderr.slice(-600)}`);
  // Reconcile accepted, unsupported and client-discarded outcomes with what the SDK sent.
  const outcomes=await outcomeMap(app,project.id),expected=expectedOutcomes(reference.sent);
  assert.deepEqual([...outcomes].sort(),[...expected].sort(),`${name}: Spool outcomes reconcile with SDK-sent items`);
  const details=await issueDetails(app,project.id);
  assert.equal(details.reduce((n,d)=>n+d.issue.count,0),types.get('event'),`${name}: every SDK error event is a persisted occurrence`);
  // Every SDK marks crashes its own way: an explicit unhandled mechanism, or (sentry-go) level fatal.
  const unhandled=runtime.unhandled??(sentry=>sentry.exceptions.some(x=>x.mechanism?.handled===false));
  const handled=details.find(d=>JSON.stringify(exceptionTypes(d.events[0]))===JSON.stringify(runtime.chain)&&d.events.every(e=>!unhandled(e.event.sentry)));
  assert.ok(handled,`${name}: handled exception chain ${runtime.chain} persisted; stored ${JSON.stringify(details.map(d=>[exceptionTypes(d.events[0]),d.events.map(e=>e.event.sentry.level)]))}`);
  assert.equal(handled.issue.count,2,`${name}: the restarted process groups into the same issue`);
  const crashed=details.find(d=>d.events.some(e=>unhandled(e.event.sentry)));
  assert.ok(crashed,`${name}: unhandled failure persisted as unhandled`);
  for(const {events} of details)for(const {event} of events){assert.equal(event.environment,'compatibility');assert.ok(event.sentry.sdk.name.startsWith(runtime.sdk),`${name}: SDK identity ${event.sentry.sdk?.name}`);assert.ok(event.sentry.sdk.version,`${name}: SDK version kept`)}
  // Release and dist as the SDK sent them; a sent release is created automatically (SDK-009).
  const sent=sentIdentities(reference.sent),stored=new Set(details.flatMap(d=>d.events.map(e=>JSON.stringify([e.release,e.event.build]))));
  assert.deepEqual([...stored].sort(),[...sent].sort(),`${name}: release and dist equal what the SDK sent`);
  const releases=await app.json(`/api/projects/${project.id}/releases`);
  for(const [release] of [...sent].map(value=>JSON.parse(value)))if(release)assert.ok(releases.some(r=>r.name===release&&r.auto_created===1&&JSON.parse(r.creating_sdk).name.startsWith(runtime.sdk)),`${name}: release ${release} is created automatically`);
  // The handled occurrence reads the same through the UI, at desktop and phone width.
  const outer=runtime.chain.at(-1);
  await readScreens(origin,cookie,[{name:`${name}-issue`,path:`/projects/${project.id}/issues/${handled.issue.id}`,check:async page=>{await page.locator('article.exception h3').filter({hasText:outer}).first().waitFor();if(runtime.checkIssue)await runtime.checkIssue({page,app,project,handled})}}]);
  // Failure handling: a wrong key or an unreachable intake never breaks the application.
  const before=await app.json(`/api/projects/${project.id}/issues`);
  const url=new URL(project.dsn);
  const forged=`${url.protocol}//${(url.username[0]==='0'?'1':'0')+url.username.slice(1)}@${url.host}${url.pathname}`;
  for(const dsn of [forged,`http://${url.username}@127.0.0.1:1/1`]){const [handledRun]=await execute(dsn,['handled']);assert.equal(handledRun.code,0,`${name}: SDK failure to deliver must not fail the app: ${handledRun.stderr.slice(-400)}`)}
  const after=await app.json(`/api/projects/${project.id}/issues`);
  assert.deepEqual(after.map(i=>[i.id,i.count]),before.map(i=>[i.id,i.count]),`${name}: refused or undeliverable events create nothing`);
  if(runtime.verify)await runtime.verify({app,project,details,dir,origin,cookie});
  console.log(JSON.stringify({runtime:name,sdk:runtime.version,sent:Object.fromEntries(types),outcomes:Object.fromEntries(outcomes),identity:[...sent]}));
 }
}finally{await worker?.stop();await rm(temporary,{recursive:true,force:true})}
