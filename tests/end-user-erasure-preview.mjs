import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { launchBrowser } from './browser-launch.mjs';
import { confirmEmailLink } from './auth.mjs';
import { snapshot, runtime } from './owner-erasure/helpers.mjs';
import { assertAuditAppendOnly } from './audit-state.mjs';

/** One public journey: exact retained counts, current authority and no erasure. */
export async function endUserErasurePreviewFlow() {
 const app = await runtime();
 let browser;
 try {
  const cookie = app.cookie, origin = app.origin;
  const client = (session=cookie) => {
   const req = (path,method='GET',body,headers={}) => fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,Cookie:session,...body!==undefined?{'Content-Type':'application/json'}:{},...headers},...body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{}});
   return {req,json:async(...args)=>{const response=await req(...args);const value=await response.json();assert.ok(response.ok,`${args[0]} HTTP ${response.status}: ${JSON.stringify(value)}`);return value}};
  };
  const owner=client(), email='synthetic-spool-27'+String.fromCharCode(64)+'example.test', other='synthetic-spool-28'+String.fromCharCode(64)+'example.test';
  await owner.json('/api/organization','POST',{id:'synthetic-spool-preview',name:'Synthetic preview'});
  const projects=[];
  for(const id of ['synthetic-spool-preview-1','synthetic-spool-preview-2','synthetic-spool-preview-3'])projects.push(await owner.json('/api/projects','POST',{id,name:id}));
  const captureCanary='synthetic-spool-'+crypto.randomUUID(),eventIds=[];
  const [project,foreign,dropped]=projects,root=p=>'/api/projects/'+p.id,door=p=>root(p)+'/end-user-erasure/preview';
  const configure=async(p,mode)=>{const current=await owner.json(root(p)+'/identity-policy'),policy={...current.policy,email:mode},preview=await owner.json(root(p)+'/identity-policy/preview','POST',{policy});await owner.json(root(p)+'/identity-policy','PUT',{revision:current.revision,policy,token:preview.token})};
  const capture=async(p,user)=>{
   const eventId=crypto.randomUUID().replaceAll('-','');eventIds.push(eventId);
   const dsn=new URL(p.dsn),response=await owner.req(`/api${dsn.pathname}/store/?sentry_key=${dsn.username}&sentry_version=7`,'POST',{
    event_id:eventId,message:captureCanary,...user===undefined?{}:{user:{email:user}},
   },{Cookie:''});
   assert.equal(response.status,200,await response.text());
  };
  const preview=async(p,actor=owner,value=email)=>actor.json(door(p),'POST',{email:value});
  const expectCount=(value,count,total,absent)=>{
   assert.equal(value.operation,'preview_only');assert.equal(value.events.status,'available');assert.equal(value.events.count,count);
   assert.equal(value.events.retained,total);assert.equal(value.events.withoutRetainedEmail,absent);
   assert.deepEqual(value.unavailable.map(row=>row.store),['sessions','feedback','attachments','replays','search']);
   assert.ok(value.unavailable.every(row=>row.reason.length>0),'uncorrelatable stores explain unavailability instead of claiming zero');
  };
  await configure(project,'keep');await configure(foreign,'keep');
  await capture(project,email);await capture(project,email);await capture(project,other);await capture(project);
  await capture(foreign,email);await capture(dropped,email);
  expectCount(await preview(project),2,4,1);expectCount(await preview(foreign),1,1,0);
  expectCount(await preview(project,owner,other),1,4,1);
  expectCount(await preview(project,owner,'synthetic-spool-missing'+String.fromCharCode(64)+'example.test'),0,4,1);
  const keys=(await app.DB.prepare('SELECT project,key FROM project_identity_keys ORDER BY project').all()).results;
  assert.equal(keys.length,2);assert.notEqual(keys[0].key,keys[1].key,'project keys are independent');
  const identities=(await app.DB.prepare('SELECT project,payload FROM event_identities WHERE project IN (?,?)').bind(project.id,foreign.id).all()).results;
  const hashes=p=>identities.filter(row=>row.project===p.id).map(row=>JSON.parse(row.payload).email).filter(row=>row?.value===email).map(row=>row.hash);
  assert.ok(hashes(project).length&&hashes(foreign).length);assert.notEqual(hashes(project)[0],hashes(foreign)[0]);
  await configure(project,'hash');expectCount(await preview(project),2,4,1);
  await capture(project,email);expectCount(await preview(project),3,5,1);
  await capture(foreign,email);expectCount(await preview(project),3,5,1);expectCount(await preview(foreign),2,2,0);
  const unavailable=await preview(dropped);assert.equal(unavailable.events.status,'unavailable');assert.equal(unavailable.events.count,null);assert.match(unavailable.events.explanation,/dropped/);assert.equal(unavailable.events.withoutRetainedEmail,1);
  const invite=async(label,role,grants)=>{
   const address='synthetic-spool-preview-'+label+String.fromCharCode(64)+'example.test';
   await owner.json('/api/organization/invites','POST',{email:address,name:'Synthetic '+label,role,grants});
   const session=await confirmEmailLink(origin,address),actor=client(session),member=(await owner.json('/api/organization')).members.find(row=>row.email===address);
   return {...actor,cookie:session,member};
  };
  const grant=(p,role)=>[{project:p.id,role}];
  const maintainer=await invite('maintainer','member',[...grant(project,'maintainer'),...grant(dropped,'maintainer')]);
  const member=await invite('member','member',grant(project,'member'));
  const reader=await invite('reader','read-only',grant(project,'read-only'));
  const foreignMember=await invite('foreign','member',grant(foreign,'maintainer'));
  const removed=await invite('removed','member',grant(project,'maintainer'));
  const admin=await invite('admin','admin',[]);
  expectCount(await preview(project,maintainer),3,5,1);expectCount(await preview(project,admin),3,5,1);
  expectCount(await preview(project,removed),3,5,1);
  await owner.json('/api/organization/members/'+removed.member.id,'DELETE',{version:removed.member.version});
  const credentials=[];for(const kind of ['agent','agent','ingest','deploy'])credentials.push(await owner.json(root(project)+'/keys','POST',{kind}));
  await owner.json(root(project)+'/keys/'+credentials[1].hash,'DELETE');
  const baseline=await snapshot(app),answers=[];
  for(let index=0;index<3;index++)answers.push(await preview(project,maintainer));
  assertAuditAppendOnly(await snapshot(app),baseline,'repeated preview leaves all product rows unchanged');
  for(const row of answers)expectCount(row,3,5,1);
  const deniedBaseline=await snapshot(app);
  for(const actor of [client(''),member,reader,foreignMember,removed]) {
   const response=await actor.req(door(project),'POST',{email});
   assert.ok([401,403,404].includes(response.status),'anonymous, ordinary, read-only, foreign and removed sessions refuse');
   assert.ok(!(await response.text()).includes(email));
  }
  for(const credential of credentials){const response=await owner.req(door(project),'POST',{email},{Authorization:'Bearer '+credential.key});assert.ok([401,403,404].includes(response.status));await response.arrayBuffer()}
  const wrongOrigin=await maintainer.req(door(project),'POST',{email},{Origin:'https://synthetic-spool-foreign.test'});assert.equal(wrongOrigin.status,403);await wrongOrigin.arrayBuffer();
  const crossSite=await maintainer.req(door(project),'POST',{email},{'Sec-Fetch-Site':'cross-site'});assert.equal(crossSite.status,403);await crossSite.arrayBuffer();
  for(const input of [{email,apply:true},{email:'x'.repeat(1025)}, {email:'invalid'}, {email:[email]}, {email:email+'\n'}]) {
   const response=await owner.req(door(project),'POST',input);assert.equal(response.status,400);assert.ok(!(await response.text()).includes(email));
  }
  assertAuditAppendOnly(await snapshot(app),deniedBaseline,'refusals cannot mutate product state');
  const facts=(await owner.json('/api/audit/export?format=json')).rows.filter(row=>row.action==='identity.erasure_preview');
  assert.ok(facts.some(row=>row.actor_kind==='member'&&row.outcome==='succeeded'));
  assert.ok(facts.some(row=>row.status===403)&&facts.some(row=>row.status===404),'safe audit observes authority refusals');
  const audit=(await app.DB.prepare('SELECT * FROM audit').all()).results;
  for(const secret of [email,other,captureCanary,...eventIds,...keys.map(row=>row.key),...hashes(project),...credentials.map(row=>row.key)]) {
   assert.ok(!JSON.stringify([...answers,unavailable]).includes(secret),'preview omits values, email hashes and keys');
   assert.ok(!JSON.stringify([facts,audit]).includes(secret),'audit omits values, email hashes and keys');
  }
  browser=await launchBrowser();
  await mkdir('.artifacts/erasure-preview',{recursive:true});
  const assertScreen=async(page,region)=>{
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no horizontal overflow');
   const violations=(await new AxeBuilder({page}).include('[aria-label="End-user erasure preview"]').analyze()).violations;
   assert.deepEqual(violations.filter(row=>['serious','critical'].includes(row.impact)),[]);
   assert.deepEqual(await region.locator('button').evaluateAll(nodes=>nodes.filter(n=>!n.textContent.trim()).map(n=>n.outerHTML)),[],'all preview controls have text');
   assert.deepEqual(await region.locator('p,li,label,input,button').evaluateAll(nodes=>nodes.filter(n=>parseFloat(getComputedStyle(n).fontSize)<13).map(n=>n.tagName)),[]);
  };
  for(const width of [390,1440]) {
   const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
   try {
    const split=maintainer.cookie.indexOf('=');await context.addCookies([{name:maintainer.cookie.slice(0,split),value:maintainer.cookie.slice(split+1),url:origin.replace('http:','https:'),secure:true}]);
    await page.goto(origin+'/projects/'+project.id+'/settings');const region=page.getByRole('region',{name:'End-user erasure preview',exact:true});
    const input=region.getByLabel('Email to match');await input.fill(email);await input.press('Tab');
    await region.getByRole('button',{name:'Preview matching records'}).press('Enter');
    await region.getByRole('status').getByText('3 matching events',{exact:false}).waitFor();
    if(width===1440)assert.equal(await input.inputValue(),'');if(width===1440){assert.ok(!(await region.innerText()).includes(email));await assertScreen(page,region)};
    await region.screenshot({path:`.artifacts/erasure-preview/matching-${width}.png`});
    // Error state is a refused real request; one width asserts behavior.
    if(width===1440){await page.route('**/end-user-erasure/preview',route=>route.continue({postData:JSON.stringify({email:'invalid'})}));await input.fill(email);await region.getByRole('button',{name:'Preview matching records'}).click();await region.getByRole('alert').waitFor();assert.equal(await region.getByRole('status').count(),0);await assertScreen(page,region);await page.unroute('**/end-user-erasure/preview');}
    await page.goto(origin+'/projects/'+dropped.id+'/settings');const unavailableRegion=page.getByRole('region',{name:'End-user erasure preview',exact:true});
    await unavailableRegion.getByLabel('Email to match').fill(email);await unavailableRegion.getByRole('button',{name:'Preview matching records'}).click();
    await unavailableRegion.getByRole('status').getByText('Event matching unavailable',{exact:false}).waitFor();
    if(width===1440)await assertScreen(page,unavailableRegion);
    await unavailableRegion.screenshot({path:`.artifacts/erasure-preview/unavailable-${width}.png`});
    if(width===1440){
     await page.goto(origin+'/projects/'+project.id+'/settings');
     const currentRegion=page.getByRole('region',{name:'End-user erasure preview',exact:true});
     await currentRegion.getByLabel('Email to match').fill(email);
     await currentRegion.getByRole('button',{name:'Preview matching records'}).click();
     await currentRegion.getByRole('status').getByText('3 matching events',{exact:false}).waitFor();
     // Saving a stricter policy changes the retained population. Old preview
     // counts must disappear even when the project and component stay mounted.
     const policyRegion=page.getByRole('region',{name:'User identity policy',exact:true});
     await policyRegion.getByLabel('User email',{exact:true}).selectOption('drop');
     await policyRegion.getByRole('button',{name:'Preview identity policy',exact:true}).click();
     await policyRegion.getByRole('button',{name:'Save identity policy',exact:true}).click();
     await policyRegion.getByText('Identity policy saved.',{exact:false}).waitFor();
     assert.equal(await currentRegion.getByRole('status').count(),0,'policy conversion invalidates the old retained-email count');
     assert.equal(await currentRegion.getByLabel('Email to match').inputValue(),'');
     await currentRegion.getByLabel('Email to match').fill(email);
     await currentRegion.getByRole('button',{name:'Preview matching records'}).click();
     await currentRegion.getByRole('status').getByText('Event matching unavailable',{exact:false}).waitFor();
     assert.ok(!(await currentRegion.innerText()).includes(email),'the refreshed result still contains counts and reasons only');
    }
   } finally {await context.close()}
  }
  console.log('PROBE SDK-027 email-preview: public Sentry captures -> 2 matching of 4 keep events; conversion plus hash capture -> 3 of 5; foreign key and captures -> unchanged 3.');
  console.log('PROBE SDK-027 unavailable: dropped email -> unavailable, 1 unattributable; sessions, feedback, attachments, replays and search explicitly unavailable.');
  console.log('PROBE SDK-027 authority-and-privacy: repeated owner, admin and maintainer POSTs -> counts only, unchanged product rows; anonymous, member, read-only, valid or revoked grant, foreign, removed and cross-origin requests refuse; safe audits omit values and keys.');
  console.log('PROBE SDK-027 settings: keyboard preview, refusal, Axe, text size and reflow passed; matching screens recorded at 1440 and 390.');
  console.log('PROBE SDK-027 policy-conversion: save email drop through Settings -> prior matching count cleared; a fresh preview reports unavailable without the supplied value.');
 } finally {await browser?.close();await app.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await endUserErasurePreviewFlow();
