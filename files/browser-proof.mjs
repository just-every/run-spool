import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {launchBrowser}=await import(pathToFileURL(resolve('tests/browser-launch.mjs')));
const {expect}=await import(pathToFileURL(resolve('node_modules/@playwright/test/index.mjs')));
const folder=process.env.PACKET,origin='http://127.0.0.1:8787';
const key=/^RER_DEV_KEY=(\S+)$/m.exec(await readFile('.rer/local/dev-key.env','utf8'))[1];
const browser=await launchBrowser();
try{
 const owner=await browser.newContext({viewport:{width:1440,height:1000}});
 await owner.request.post(origin+'/__dev/key',{data:{key}});
 assert.equal((await owner.request.get(origin+'/auth/dev/enter?as=owner',{maxRedirects:0})).status(),303);
 const json=async(path,data)=>{const r=await owner.request.post(origin+path,{headers:{Origin:origin},data});assert.ok(r.ok(),path+' '+r.status());return r.json()};
 const projects=await(await owner.request.get(origin+'/api/projects')).json();
 const project=projects.find(row=>row.id==='synthetic-spool-local');assert.ok(project);
 await json('/api/organization/invites',{email:'synthetic-spool-proof@example.test',name:'Synthetic scoped invitee',role:'read-only',grants:[{project:project.id,role:'read-only'}]});
 const page=await owner.newPage();page.setDefaultTimeout(20000);await page.goto(origin+'/projects/'+project.id+'/settings');
 const members=page.getByRole('region',{name:'Members',exact:true});
 await members.locator('summary').filter({hasText:/^Invitations$/}).click();
 const input=members.getByLabel('Invitation link for synthetic-spool-proof@example.test',{exact:true});await input.waitFor();
 const link=await input.inputValue();assert.ok(new URL(link).searchParams.get('token'));
 const captures=[];
 async function screen(page,name,mask=[],target=page){
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
   await target.screenshot({path:resolve(folder,name+'-'+width+'.png'),mask});captures.push(name+'-'+width+'.png');
  }
  await page.setViewportSize({width:1440,height:1000});
 }
 await screen(page,'local-invitations',[members.locator('input[readonly]')],members);
 const member=await browser.newContext({viewport:{width:1440,height:1000}}),invitee=await member.newPage();invitee.setDefaultTimeout(20000);
 await invitee.goto(link);await expect(invitee.getByRole('button',{name:'Confirm',exact:true})).toBeVisible();
 await screen(invitee,'invitation-confirmation');
 await invitee.getByRole('button',{name:'Confirm',exact:true}).click();await invitee.waitForURL(url=>!url.pathname.startsWith('/auth/'));
 assert.ok(!(await member.cookies()).some(row=>row.name.startsWith('rer_dev_gate')));
 const access=await(await member.request.get(origin+'/api/organization/me')).json();assert.equal(access.role,'read-only');assert.deepEqual(access.projects.map(row=>row.id),[project.id]);
 const session=await(await member.request.get(origin+'/auth/session')).json();assert.equal(session.kind,'dev');assert.equal(session.operator.role,'member');
 const person=(await(await owner.request.get(origin+'/api/organization')).json()).members.find(row=>row.name==='Synthetic scoped invitee');
 const removal=await owner.request.delete(origin+'/api/organization/members/'+person.id,{headers:{Origin:origin},data:{version:person.version}});assert.ok(removal.ok());
 assert.equal((await member.request.get(origin+'/api/projects/'+project.id+'/issues')).status(),401);
 await invitee.goto(origin+'/projects/'+project.id+'/issues');await expect(invitee).toHaveURL(url=>url.pathname==='/sign-in');
 await expect(invitee.locator('a[href*="/auth/dev/enter"],a[href*="/auth/one-click"]')).toHaveCount(0);
 await screen(invitee,'removed-member-sign-in');
 // Only a deliberate owner gate handoff to this browser enables the shortcut.
 await invitee.goto(origin+'/__dev/key#'+new URLSearchParams({'rer-dev':key,next:'/sign-in?returnTo='+encodeURIComponent('/projects/'+project.id+'/issues')}));
 await expect(invitee.getByRole('link',{name:'Continue as owner',exact:true})).toBeVisible();
 await screen(invitee,'owner-gate-sign-in');
 await invitee.getByRole('link',{name:'Continue as owner',exact:true}).click();await invitee.waitForURL(url=>url.pathname!=='/sign-in');
 assert.equal((await(await member.request.get(origin+'/auth/session')).json()).operator.role,'owner');
 const receipt={assertionWidth:1440,proofWidths:[1440,390],memberReceivedOwnerGate:false,memberRole:access.role,scopedProjects:access.projects.map(row=>row.id),removalReadStatus:401,removedMemberOwnerOffers:0,explicitOwnerGateRestoresShortcut:true,captures};
 await writeFile(resolve(folder,'browser-receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}finally{await browser.close()}
