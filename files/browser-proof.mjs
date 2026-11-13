import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {launchBrowser} from '/workspace/run-spool/tests/browser-launch.mjs';
import {expect} from '/workspace/run-spool/node_modules/@playwright/test/index.mjs';
const mode=process.argv[2]??'before';
const packet=process.env.HOME+'/rer-consolidation/work/main-spool-member-hints-1/packet';
const log=await readFile('/tmp/spool-dev-main.log','utf8');
const link=log.match(/RER_OPEN (https?:\/\/\S+)/)?.[1];assert.ok(link,'rer dev prints its private local entry');
const origin=new URL(link).origin;
const browser=await launchBrowser();
const receipt={mode,runtime:'real rer dev',widths:[1440,390],probes:[]};
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.setDefaultTimeout(25000);
 await page.goto(link);await page.waitForURL(u=>u.pathname==='/setup'||u.pathname.startsWith('/projects/'));
 const req=async(path,body,method=body===undefined?'GET':'POST')=>context.request.fetch(origin+path,{method,headers:{Origin:origin},...(body===undefined?{}:{data:body}),maxRedirects:0});
 const json=async(path,body)=>{const r=await req(path,body);assert.ok(r.ok(),path+' HTTP '+r.status());return r.json()};
 assert.equal((await json('/auth/session')).kind,'dev');
 let access=await json('/api/organization/me');
 if(!access.organization)await json('/api/organization',{id:'synthetic-spool-hints',name:'Synthetic Spool hints'});
 let projects=await json('/api/projects');
 if(!projects.length){await json('/api/projects',{id:'synthetic-spool-hints',name:'Synthetic member hints'});projects=await json('/api/projects');}
 const legacyEmail='synthetic-spool-legacy@example.test';
 let data=await json('/api/organization');
 if(!data.members.some(m=>m.email===legacyEmail))await json('/api/organization/invites',{email:legacyEmail,name:'Synthetic legacy invitee',role:'read-only',grants:[]});
 if(mode==='before'){
  // Upgrade fixture: invitation created through the normal door, with only the
  // optional retained-link row absent, as on installations predating 0105.
  execFileSync('python3',['-c',`import pathlib,sqlite3
p=next(p for p in pathlib.Path('/workspace/run-spool/.wrangler/state/v3/d1/miniflare-D1DatabaseObject').glob('*.sqlite') if p.name!='metadata.sqlite')
with sqlite3.connect(p) as db: db.execute("DELETE FROM spool_local_invite_links WHERE invite IN (SELECT i.id FROM spool_member_invites i JOIN spool_members m ON m.id=i.member WHERE m.email=?)",('synthetic-spool-legacy@example.test',))
`]);
 }
 await page.goto(origin+'/projects/'+projects[0].id+'/settings#settings-organization');
 const members=page.getByRole('region',{name:'Members',exact:true});
 await members.locator('summary').filter({hasText:/^Invitations$/}).click();
 await members.locator('summary').filter({hasText:/^Verify identity for ownership transfer$/}).click();
 const legacy=members.locator('details').filter({has:page.locator('summary').filter({hasText:/^Invitations$/})}).locator('div').filter({has:page.getByText(legacyEmail+' · invited',{exact:true})}).first();
 await expect(legacy).toBeVisible();
 assert.equal(await legacy.locator('input').count(),0);
 const verification=members.locator('details').filter({has:page.locator('summary').filter({hasText:/^Verify identity for ownership transfer$/})});
 receipt.probes.push({name:'transfer guidance',sessionKind:'dev',text:await verification.innerText()});
 receipt.probes.push({name:'legacy invitation row',text:await legacy.innerText()});
 const duplicate=await req('/api/organization/invites',{email:legacyEmail,name:'Synthetic legacy invitee',role:'read-only',grants:[]});
 assert.equal(duplicate.status(),409);receipt.probes.push({name:'reinvite pending address',status:duplicate.status(),body:await duplicate.json()});
 if(mode==='after'){
  assert.match(await verification.innerText(),/local access/i);
  assert.match(await legacy.innerText(),/remove[\s\S]*invite[\s\S]*again/i);
  const step=page.waitForResponse(r=>new URL(r.url()).pathname==='/auth/step-up'&&r.request().method()==='POST');
  await verification.getByRole('button',{name:'Verify your identity',exact:true}).click();assert.equal((await step).status(),202);
  await expect(members.getByRole('status')).toContainText(/local access/i);
 }
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  await members.screenshot({path:packet+'/'+mode+'-members-'+width+'.png',mask:[members.locator('input[readonly]')]});
 }
 if(mode==='after'){
  await members.getByRole('button',{name:'Details: Owner access',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Owner access',exact:true});
  await dialog.locator('summary').filter({hasText:/^Transfer ownership$/}).click();
  await expect(dialog).toContainText(/local access confirms/i);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   await dialog.screenshot({path:packet+'/after-transfer-dialog-'+width+'.png'});
  }
  await dialog.getByRole('button',{name:'Close details',exact:true}).click();
  receipt.probes.push({name:'dev member transfer dialog',guidance:'local access confirms the transfer',widths:[1440,390]});
 }
 if(mode==='before'){
  const email='synthetic-spool-transfer@example.test';
  await json('/api/organization/invites',{email,name:'Synthetic transfer successor',role:'admin',grants:[]});
  data=await json('/api/organization');
  const pending=data.invites.find(i=>data.members.find(m=>m.id===i.member)?.email===email);
  assert.ok(pending.localLink);
  const invitee=await browser.newContext(),other=await invitee.newPage();
  await other.goto(link);await other.waitForURL(u=>u.pathname==='/setup'||u.pathname.startsWith('/projects/'));
  await other.goto(pending.localLink);
  const confirmed=other.waitForResponse(r=>new URL(r.url()).pathname==='/auth/confirm'&&r.request().method()==='POST');
  await other.getByRole('button',{name:'Confirm',exact:true}).click();assert.equal((await confirmed).status(),303);
  data=await json('/api/organization');const member=data.members.find(m=>m.email===email);
  const transferred=await req('/api/organization/transfer',{member:member.id,version:member.version});
  assert.equal(transferred.status(),200);receipt.probes.push({name:'dev transfer without native step-up',status:transferred.status(),body:await transferred.json()});
  await invitee.close();
 }
 await context.close();
 await writeFile(packet+'/'+mode+'-browser-receipt.json',JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt,null,2));
}finally{await browser.close()}
