import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {launchBrowser} from './browser-launch.mjs';
import {legacyMailRows} from './legacy-mail.mjs';
import {heldOwnerRequest} from './owner-erasure-inflight.mjs';

const types=['resolution','regression','assignment','comment','mention','issue_alert','deploy','weekly_report'];
const labels=['Resolutions','Regressions','Assignments','Comments','Mentions','Issue alerts','Deploys','Weekly reports'];
const choices=(...enabled)=>Object.fromEntries(types.map(type=>[type,enabled.includes(type)]));
const door=project=>'/api/projects/'+project.id+'/notifications/preferences';
const records=async owner=>{
 const response=await owner.req('/api/archive');assert.equal(response.status,200);
 return (await response.text()).trim().split('\n').flatMap(line=>JSON.parse(line).items??[]).filter(item=>item.kind==='row'&&item.table==='spool_notification_preferences').map(item=>item.row);
};
const refused=async pending=>{const response=await pending;await response.arrayBuffer();assert.ok([401,403,404].includes(response.status));};

async function preferenceBrowser(owner,actors,projects,expected) {
 const browser=await launchBrowser();
 try {
  for(const [index,actor] of actors.entries()) {
   const context=await browser.newContext({viewport:{width:1440,height:1000}}),split=actor.cookie.indexOf('=');
   await context.addCookies([{name:actor.cookie.slice(0,split),value:actor.cookie.slice(split+1),url:owner.origin.replace('http:','https:'),secure:true}]);
   const page=await context.newPage();
   for(const [projectIndex,project] of projects.entries()) {
    await page.goto(owner.origin+'/projects/'+project.id+'/settings#settings-alerts');
    const panel=page.getByRole('region',{name:'Personal notifications',exact:true});
    await expect(panel).toHaveCount(0);
    // The inert form is hidden; stored preferences keep their authenticated API and archive behavior.
    const value={...expected[index][projectIndex],deploy:!expected[index][projectIndex].deploy};
    await actor.json(door(project),'PUT',{revision:(await actor.json(door(project))).revision,email:value});
    assert.deepEqual((await actor.json(door(project))).email,value);
    expected[index][projectIndex]=value;
    await page.reload();await expect(panel).toHaveCount(0);
   }
   await context.close();
  }
 } finally {await browser.close();}
}

/** Native members exercise their own preferences through HTTP and Settings. */
export async function notificationPreferencesFlow(owner,projects,invite,reader) {
 const actors=[];
 for(const n of [30,31])actors.push(await invite(owner,owner.origin,{email:['synthetic-spool-'+n,'example.test'].join('@'),name:'synthetic-spool-'+n,role:'member',grants:projects.map(project=>({project:project.id,role:'member'}))}));
 const mail=(await legacyMailRows(owner.origin)).length;
 const expected=[
  [choices('resolution','assignment','comment','issue_alert'),choices('regression','mention','deploy','weekly_report')],
  [choices('regression','mention','deploy'),choices('resolution','assignment','comment','issue_alert')],
 ];
 for(const [i,actor] of actors.entries())for(const [j,project] of projects.entries()) {
  const initial=await actor.json(door(project));assert.equal(initial.revision,0);assert.deepEqual(initial.email,choices(),'all personal email starts opt-in, including weekly reports');
  await actor.json(door(project),'PUT',{revision:initial.revision,email:expected[i][j]});
 }
 for(const [i,actor] of actors.entries())for(const [j,project] of projects.entries())assert.deepEqual((await actor.json(door(project))).email,expected[i][j],'two native people reopen independent preferences in two projects');
 await preferenceBrowser(owner,actors,projects,expected);
 assert.equal((await legacyMailRows(owner.origin)).length,mail,'HTTP and UI saves send no notification');
 const root=door(projects[0]),before=await records(owner),valid={revision:(await actors[0].json(root)).revision,email:choices('weekly_report')};
 for(const [path,input] of [[root,{...valid,member:actors[1].member.id}],[root,{...valid,operator_id:actors[1].member.operator_id}],[root+'?member='+actors[1].member.id,valid]]) {
  const response=await actors[0].req(path,'PUT',input);assert.equal(response.status,400);await response.arrayBuffer();
 }
 for(const [actor,path] of [[reader,door(projects[1])],[owner,'/api/projects/synthetic-spool-unknown/notifications/preferences']])for(const method of ['GET','PUT'])await refused(actor.req(path,method,method==='PUT'?valid:undefined));
 for(const kind of ['ingest','agent','deploy']) {
  const grant=await owner.json('/api/projects/'+projects[0].id+'/keys','POST',{kind});
  for(const method of ['GET','PUT'])await refused(owner.req(root,method,method==='PUT'?valid:undefined,{Cookie:'',Authorization:'Bearer '+grant.key}));
 }
 await refused(owner.req(root,'PUT',valid,{Origin:'https://foreign.example.test'}));
 const stale=await actors[0].req(root,'PUT',{...valid,revision:0});assert.equal(stale.status,409);await stale.arrayBuffer();
 assert.deepEqual(await records(owner),before,'targeted, inaccessible, grant, cross-origin and stale requests change no personal preferences');
 // Read-only collaborators can change their personal delivery choices without
 // gaining permission to mutate project policy or someone else's settings.
 const readOnly=await reader.json(root);await reader.json(root,'PUT',{revision:readOnly.revision,email:choices('comment')});
 const beforeRemoval=await records(owner);
 const removed=(await owner.json('/api/organization')).members.find(row=>row.id===actors[1].member.id);
 const pending=await heldOwnerRequest({origin:owner.origin,cookie:actors[1].cookie,request:path=>owner.req(path)},root,{revision:(await actors[1].json(root)).revision,email:choices('weekly_report')},{method:'PUT'});
 try {
  await owner.json('/api/organization/members/'+removed.id,'DELETE',{version:removed.version});
  assert.equal((await pending.release()).status,409,'an admitted save cannot commit after membership removal');
 } finally {pending.close();}
 const sealed=await records(owner);
 assert.deepEqual(sealed,beforeRemoval,'revocation cannot resurrect a delayed preference write');
 for(const project of projects)for(const method of ['GET','PUT'])await refused(actors[1].req(door(project),method,method==='PUT'?valid:undefined));
 assert.deepEqual(await records(owner),sealed,'removed-member reads and writes cannot mutate or revive preferences');
 for(const [j,project] of projects.entries())assert.deepEqual((await actors[0].json(door(project))).email,expected[0][j],'removing one member leaves the other member unaffected');
 const audit=(await owner.json('/api/audit/export?format=json')).rows.filter(row=>row.action==='notification.preferences');
 assert.ok(audit.some(row=>row.actor_kind==='member'&&row.outcome==='succeeded'&&row.source==='transaction'));
 assert.ok(audit.some(row=>row.outcome==='denied'));assert.ok(audit.some(row=>row.outcome==='invalid'));assert.ok(audit.some(row=>row.outcome==='conflict'));
 for(const row of audit){assert.match(row.actor_label,/^audit:[a-f0-9]{32}$/);assert.match(row.subject_label,/^audit:[a-f0-9]{32}$/);}
 for(const actor of actors)for(const value of [actor.cookie,actor.member.email,actor.member.name,actor.member.operator_id].filter(Boolean))assert.ok(!JSON.stringify(audit).includes(value),'D-1 facts expose no private account values');
 console.log('PROBE TEAM-005 preferences: two native members, two projects, HTTP and Settings saves and reopen -> independent persisted email choices, weekly opt-in; no mail');
 console.log('PROBE TEAM-005 authority: targeted, foreign-project, removed-member, project-grant, stale and cross-origin requests -> refused without preference mutation; safe audit facts');
}
