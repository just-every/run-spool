import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {launchBrowser} from './browser-launch.mjs';
import {emailSignIn} from './auth.mjs';

const digest=key=>createHash('sha256').update(key).digest('hex');
const status=async pending=>{const response=await pending;await response.arrayBuffer();return response.status};
export async function transferCapture(owner, admin, client) {
 const ownerId=(await owner.json('/auth/session')).operator.id;
 const project=await owner.json('/api/projects','POST',{id:'synthetic-spool-transfer',name:'Cedar Checkout'}),root='/api/projects/'+project.id;
 await owner.json(root+'/releases','POST',{name:'checkout-2026.10',build:'web'});
 const deploy=await owner.json(root+'/keys','POST',{kind:'deploy'});
 const retired=await owner.json(root+'/keys','POST',{kind:'ingest'});
 await owner.json(root+'/keys/'+retired.hash,'DELETE');
 const native=(key,id)=>owner.req('/api/ingest/'+project.id,'POST',{version:1,eventId:id,release:'checkout-2026.10',build:'web',environment:'production',type:'CheckoutError',message:'Checkout timeout',frames:[{file:'https://cedar.example/checkout.js',function:'checkout',line:12,column:0}],breadcrumbs:[]},{Cookie:'',Authorization:'Bearer '+key});
 const dsn=new URL(project.dsn),sentry=id=>owner.req('/api'+dsn.pathname+'/store/?sentry_key='+dsn.username+'&sentry_version=7','POST',{event_id:id,release:'checkout-2026.10',message:'Checkout timeout'},{Cookie:''});
 const release=(key,name)=>owner.req(root+'/releases','POST',{name,build:'web'},{Cookie:'',Authorization:'Bearer '+key});
 const demoted=await admin.json(root+'/keys','POST',{kind:'deploy'});
 let target=(await owner.json('/api/organization')).members.find(row=>row.id===admin.member.id);
 await owner.json('/api/organization/members/'+target.id,'PUT',{version:target.version,role:'read-only',grants:[]});
 assert.equal(await status(release(demoted.key,'demoted-deploy')),401,'a minter below minting authority loses the old credential');
 target=(await owner.json('/api/organization')).members.find(row=>row.id===admin.member.id);
 await owner.json('/api/organization/members/'+target.id,'PUT',{version:target.version,role:'admin',grants:[]});
 const successorDeploy=await admin.json(root+'/keys','POST',{kind:'deploy'});
 assert.deepEqual(await Promise.all([status(native(project.ingestKey,'before-transfer')),status(sentry('a'.repeat(32))),status(release(deploy.key,'deploy-before-transfer')),status(release(successorDeploy.key,'successor-before-transfer'))]),[201,200,201,201]);
 const browser=await launchBrowser();
 let next;
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),split=owner.cookie.indexOf('=');
  await context.addCookies([{name:owner.cookie.slice(0,split),value:owner.cookie.slice(split+1),url:owner.origin.replace('http:','https:'),secure:true}]);
  const page=await context.newPage();await page.goto(owner.origin+'/projects/'+project.id+'/settings');
  await page.getByRole('button',{name:`Details: ${admin.member.name} access`,exact:true}).click();
  const dialog=page.getByRole('dialog',{name:admin.member.name+' access',exact:true});
  await dialog.locator('summary').filter({hasText:/^Transfer ownership$/}).click();
  const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/organization/transfer'&&r.request().method()==='POST');
  await dialog.getByRole('button',{name:'Confirm owner transfer',exact:true}).click();assert.equal((await pending).status(),200);
  assert.deepEqual(await Promise.all([status(native(project.ingestKey,'after-transfer')),status(sentry('b'.repeat(32))),status(release(deploy.key,'deploy-after-transfer')),status(release(successorDeploy.key,'successor-after-transfer'))]),[201,200,201,201],'both participants retain their live keys across ordinary transfer');
  const cookie=await emailSignIn(owner.origin,admin.member.email);next={...client(owner.origin,cookie),origin:owner.origin,cookie};
  let keys=await next.json(root+'/keys');
  assert.equal(keys.find(row=>row.hash===digest(project.ingestKey)).state,'active');
  assert.equal(keys.find(row=>row.hash===deploy.hash).state,'active');
  assert.equal(keys.find(row=>row.hash===retired.hash).state,'revoked','transfer never revives a retired key');
  assert.equal(keys.find(row=>row.hash===demoted.hash).state,'revoked','restoring and promoting a minter never revives a retired key');
  assert.equal(await status(release(demoted.key,'demoted-after-transfer')),401);
  assert.equal(await status(native(retired.key,'retired-after-transfer')),401);
  await context.clearCookies();const separator=cookie.indexOf('=');
  await context.addCookies([{name:cookie.slice(0,separator),value:cookie.slice(separator+1),url:owner.origin.replace('http:','https:'),secure:true}]);
  const folder=process.env.SPOOL_TEAM_EVIDENCE;if(folder)await mkdir(folder,{recursive:true});
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:1000});await page.goto(owner.origin+'/projects/'+project.id+'/settings');
   const row=page.locator('.key-row').filter({hasText:digest(project.ingestKey).slice(0,12)});
   await row.getByText('Capture · Active',{exact:true}).waitFor();await row.scrollIntoViewIfNeeded();
   if(folder)await page.screenshot({path:resolve(folder,`transferred-keys-${width}.png`)});
   await page.goto(owner.origin+'/projects/'+project.id+'/capture');await page.getByRole('heading',{name:'Capture is receiving events',exact:true}).waitFor();
   if(folder)await page.screenshot({path:resolve(folder,`capture-after-transfer-${width}.png`)});
  }
  const predecessor=(await next.json('/api/organization')).members.find(row=>row.operator_id===ownerId);
  await next.json('/api/organization/members/'+predecessor.id,'DELETE',{version:predecessor.version});
  assert.deepEqual(await Promise.all([status(native(project.ingestKey,'after-removal')),status(sentry('c'.repeat(32))),status(release(deploy.key,'deploy-after-removal'))]),[401,401,401],'removing the minter stops the same native, DSN and deploy credentials');
  assert.equal(await status(release(successorDeploy.key,'successor-after-removal')),201,'removal does not revoke the new owner’s key');
  keys=await next.json(root+'/keys');assert.equal(keys.find(row=>row.hash===digest(project.ingestKey)).state,'revoked');
  assert.equal(keys.find(row=>row.hash===deploy.hash).state,'revoked');
  assert.equal((await next.json(root+'/outcomes')).captureKeys.active,0);
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:1000});await page.goto(owner.origin+'/projects/'+project.id+'/settings');
   await page.locator('.key-row').filter({hasText:digest(project.ingestKey).slice(0,12)}).getByText('Capture · Revoked',{exact:true}).waitFor();
   await page.locator('.key-row').filter({hasText:digest(project.ingestKey).slice(0,12)}).scrollIntoViewIfNeeded();
   if(folder)await page.screenshot({path:resolve(folder,`removed-keys-${width}.png`)});
   await page.goto(owner.origin+'/projects/'+project.id+'/capture');await page.getByRole('heading',{name:'Capture is stopped',exact:true}).waitFor();
   assert.equal(await page.getByRole('heading',{name:'Capture is receiving events',exact:true}).count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(folder)await page.screenshot({path:resolve(folder,`capture-stopped-${width}.png`)});
  }
  await context.close();
  console.log('Owner transfer: same native/DSN/deploy keys 201/200/201 before and after; removed minter 401/401/401; demotion and revoked keys stay stopped; Settings and Capture reflect current authority at 1440/390');
 }finally{await browser.close()}
 return next;
}
