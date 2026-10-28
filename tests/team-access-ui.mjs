import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

/** Existing grants must remain wire drafts, including after a refused save. */
export async function memberAccessChanges(page, owner, projects, member) {
 const path='/api/organization/members/'+member.id;
 const stored=async()=>{const data=await owner.json('/api/organization');return {member:data.members.find(row=>row.id===member.id),grants:data.grants.filter(row=>row.member===member.id).map(({project,role})=>({project,role}))}};
 const response=()=>page.waitForResponse(r=>new URL(r.url()).pathname===path&&r.request().method()==='PUT');
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:1000});
  await page.goto(owner.origin+'/projects/'+projects[0].id+'/settings');
  await page.getByRole('button',{name:`Details: ${member.name} access`,exact:true}).click();
  const dialog=page.getByRole('dialog',{name:member.name+' access',exact:true});
  const role=dialog.getByLabel(/^Organization role/),grant=dialog.getByLabel(new RegExp('^'+projects[1].name));
  let pending=response();await role.selectOption('member');let saved=await pending;
  assert.equal(saved.status(),200,'organization role saves with an existing project grant');
  assert.deepEqual(saved.request().postDataJSON().grants,[{project:projects[0].id,role:'read-only'}]);
  await role.waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('dialog[open] select')?.disabled);
  pending=response();await grant.selectOption('read-only');saved=await pending;
  assert.equal(saved.status(),200,'a second project grant saves');
  const current=await stored();
  assert.deepEqual(saved.request().postDataJSON().grants,current.grants);
  assert.ok(saved.request().postDataJSON().grants.every(row=>Object.keys(row).sort().join(',')==='project,role'));
  assert.equal(current.member.role,'member');assert.equal(current.grants.length,2);
  await page.waitForFunction(()=>!document.querySelector('dialog[open] select')?.disabled);
  const folder=process.env.SPOOL_TEAM_EVIDENCE;
  if(folder){await mkdir(folder,{recursive:true});await page.screenshot({path:resolve(folder,`member-access-saved-${width}.png`)});}
  // A real concurrent administrator advances the stored revision. The stale
  // browser receives the server's conflict; no transport response is mocked.
  await owner.json(path,'PUT',{version:current.member.version,role:'member',grants:current.grants});
  pending=response();await role.selectOption('read-only');assert.equal((await pending).status(),409);
  await page.waitForFunction(()=>!document.querySelector('dialog[open] select')?.disabled);
  assert.equal(await role.inputValue(),'member','failed organization role restores the stored selection');
  pending=response();await grant.selectOption('');assert.equal((await pending).status(),409);
  await page.waitForFunction(()=>!document.querySelector('dialog[open] select')?.disabled);
  assert.equal(await grant.inputValue(),'read-only','failed project grant restores the stored selection');
  if(folder)await page.screenshot({path:resolve(folder,`member-access-refused-${width}.png`)});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log(`Members ${width}: role PUT 200, second-project PUT 200, grants contain only project/role; stale role/grant PUT 409 and stored selections restored`);
  const row=await stored();
  await owner.json(path,'PUT',{version:row.member.version,role:'read-only',grants:[{project:projects[0].id,role:'read-only'}]});
 }
 await page.goto(owner.origin+'/projects/'+projects[0].id+'/settings');
}
