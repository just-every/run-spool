import assert from 'node:assert/strict';
import {cp, mkdir, symlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {run, issueDetails} from './harness.mjs';
import {readScreens} from './screens.mjs';
const here=resolve(import.meta.dirname,'node');
export default {
 name:'node',sdk:'sentry.javascript.node',version:'@sentry/node 11.6.0',
 required:['event','session','span','log','attachment','feedback','client_report'],
 chain:['TypeError'],
 async prepare(dir){await cp(here,dir,{recursive:true});await symlink(resolve('node_modules'),resolve(dir,'node_modules'),'dir')},
 command(mode,dir,dsn){return {command:process.execPath,args:[resolve(dir,'app.mjs'),mode],cwd:dir,env:{SPOOL_FIXTURE_DSN:dsn}}},
 async verify({app,dir,origin,cookie}){
  const project=await app.json('/api/projects','POST',{id:'rt-node-releases',name:'Node release identities'}),root='/api/projects/rt-node-releases';
  const cwd=resolve(dir,'identity');await mkdir(cwd);
  // This exact official-SDK program infers from the same CI environment door used by real applications.
  const inheritedReleaseNames=['SENTRY_RELEASE','GITHUB_SHA','CI_MERGE_REQUEST_SOURCE_BRANCH_SHA','CI_BUILD_REF','CI_COMMIT_SHA','BITBUCKET_COMMIT','APPVEYOR_PULL_REQUEST_HEAD_COMMIT','APPVEYOR_REPO_COMMIT','CODEBUILD_RESOLVED_SOURCE_VERSION','AWS_COMMIT_ID','BUILD_SOURCEVERSION','GIT_CLONE_COMMIT_HASH','BUDDY_EXECUTION_REVISION','BUILDKITE_COMMIT','CIRCLE_SHA1','CIRRUS_CHANGE_IN_REPO','CF_REVISION','CM_COMMIT','CF_PAGES_COMMIT_SHA','DRONE_COMMIT_SHA','FC_GIT_COMMIT_SHA','HEROKU_TEST_RUN_COMMIT_VERSION','HEROKU_BUILD_COMMIT','HEROKU_SLUG_COMMIT','RAILWAY_GIT_COMMIT_SHA','RENDER_GIT_COMMIT','SEMAPHORE_GIT_SHA','TRAVIS_PULL_REQUEST_SHA','VERCEL_GIT_COMMIT_SHA','VERCEL_GITHUB_COMMIT_SHA','VERCEL_GITLAB_COMMIT_SHA','VERCEL_BITBUCKET_COMMIT_SHA','ZEIT_GITHUB_COMMIT_SHA','ZEIT_GITLAB_COMMIT_SHA','ZEIT_BITBUCKET_COMMIT_SHA','CI_COMMIT_ID','SOURCE_COMMIT','SOURCE_VERSION','GIT_COMMIT','COMMIT_REF','BUILD_VCS_NUMBER'];
  const send=async env=>{
   const result=await run(process.execPath,[resolve(dir,'app.mjs'),'identity'],{cwd,unset:inheritedReleaseNames,env:{SPOOL_FIXTURE_DSN:project.dsn,...env}});
   assert.equal(result.code,0,result.stderr);return issueDetails(app,project.id);
  };
  const [none]=await send({});
  assert.deepEqual(await app.json(root+'/releases'),[],'no release creates no invented release');
  const alerts=(await app.json(root+'/alerts')).filter(row=>row.kind==='new_issue');
  assert.deepEqual(alerts.map(row=>row.issue),[none.issue.id]);
  const identity=JSON.parse(alerts[0].payload).release;
  assert.deepEqual([identity.name,identity.sequence],['',0],'release-less alert carries no release');
  // Synthetic CI commit input, not a pinned assertion about repository history.
  const sha='0123456789abcdef'.repeat(2)+'01234567';
  const [issue]=await send({GITHUB_SHA:sha});
  assert.deepEqual(issue.events.map(e=>e.release).sort(),['',sha].sort(),'SDK-inferred SHA preserved');
  const releases=await app.json(root+'/releases');assert.deepEqual(releases.map(r=>[r.name,r.auto_created]),[[sha,1]]);
  assert.equal(issue.issue.count,2);
  assert.equal((await app.json(root+'/release-policy')).noReleaseEvents,1);
  assert.equal((await app.json(root+'/issue-search?q=!has:release')).total,1);
  await readScreens(origin,cookie,[
   {name:'node-releases',path:'/projects/rt-node-releases/releases',check:async page=>{await page.getByText('1 retained events have no release',{exact:false}).waitFor();await page.locator('tr.data-row').filter({hasText:sha}).first().waitFor()}},
   {name:'node-alerts',path:'/projects/rt-node-releases/alerts',check:async page=>{const rows=page.locator('ul.alert-records li');await rows.first().waitFor();assert.equal(await rows.count(),1);assert.ok(!(await rows.innerText()).includes(sha))}},
  ]);
 },
};
