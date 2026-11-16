import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { launchBrowser } from './browser-launch.mjs';
import { confirmEmailLink } from './auth.mjs';
import { snapshot, runtime, archive, restore } from './owner-erasure/helpers.mjs';
import { assertAuditAppendOnly } from './audit-state.mjs';

/** Public counts, confirmed identity removal, event deletion and restore fences. */
export async function endUserErasurePreviewFlow() {
 const app = await runtime();
 let browser;
 try {
  const cookie = app.cookie, origin = app.origin;
  const client = (session=cookie) => {
   const req = (path,method='GET',body,headers={}) => fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,Cookie:session,Connection:'close',...body!==undefined?{'Content-Type':'application/json'}:{},...headers},...body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{}});
   return {req,json:async(...args)=>{const response=await req(...args);const value=await response.json();assert.ok(response.ok,`${args[0]} HTTP ${response.status}: ${JSON.stringify(value)}`);return value}};
  };
  const owner=client(), email='synthetic-spool-27'+String.fromCharCode(64)+'example.test', other='synthetic-spool-28'+String.fromCharCode(64)+'example.test';
  await owner.json('/api/organization','POST',{id:'synthetic-spool-preview',name:'Synthetic preview'});
  const projects=[];
  for(const id of ['synthetic-spool-preview-1','synthetic-spool-preview-2','synthetic-spool-preview-3'])projects.push(await owner.json('/api/projects','POST',{id,name:id}));
  const captureCanary='synthetic-spool-'+crypto.randomUUID(),eventIds=[];
  const [project,foreign,dropped]=projects,root=p=>'/api/projects/'+p.id,door=p=>root(p)+'/end-user-erasure/preview';
  const configure=async(p,mode)=>{const current=await owner.json(root(p)+'/identity-policy'),policy=Object.fromEntries(Object.keys(current.policy).map(field=>[field,mode])),preview=await owner.json(root(p)+'/identity-policy/preview','POST',{policy});await owner.json(root(p)+'/identity-policy','PUT',{revision:current.revision,policy,token:preview.token})};
  const capture=async(p,user)=>{
   const eventId=crypto.randomUUID().replaceAll('-','');eventIds.push(eventId);
   const dsn=new URL(p.dsn),response=await owner.req(`/api${dsn.pathname}/store/?sentry_key=${dsn.username}&sentry_version=7`,'POST',{
    event_id:eventId,message:captureCanary,...user===undefined?{}:{user:{email:user,id:user===email?'synthetic-spool-person-27':'synthetic-spool-person-28',username:user===email?'synthetic-spool-name-27':'synthetic-spool-name-28',ip_address:user===email?'192.0.2.27':'192.0.2.28'}},
   },{Cookie:''});
   assert.equal(response.status,200,await response.text());
  };
  const preview=async(p,actor=owner,value=email)=>actor.json(door(p),'POST',{email:value});
  const expectCount=(value,count,total,absent)=>{
   assert.ok(value.planHash);assert.equal(value.hold,null);assert.equal(value.events.status,'available');assert.equal(value.events.count,count);
   assert.equal(value.events.retained,total);assert.equal(value.events.withoutRetainedEmail,absent);
   assert.equal(value.sessions.status,'available');assert.ok(Number.isSafeInteger(value.sessions.count));
   assert.ok(value.unavailable.every(row=>row.reason.length>0),'uncorrelatable stores explain unavailability instead of claiming zero');
  };
  for(const p of projects)assert.deepEqual((await owner.json(root(p)+'/identity-policy')).policy,{id:'keep',email:'keep',username:'keep',ip_address:'keep'},'new projects keep identity as sent');
  // This project proves the unavailable/drop branch, independent of the creation default.
  await configure(dropped,'drop');
  await configure(project,'keep');await configure(foreign,'keep');
  await capture(project,email);await capture(project,email);await capture(project,other);await capture(project);
  await capture(foreign,email);await capture(dropped,email);
  expectCount(await preview(project),2,4,1);expectCount(await preview(foreign),1,1,0);
  expectCount(await preview(project,owner,other),1,4,1);
  expectCount(await preview(project,owner,'synthetic-spool-missing'+String.fromCharCode(64)+'example.test'),0,4,1);
  const keys=(await app.DB.prepare('SELECT project,key FROM project_identity_keys ORDER BY project').all()).results;
  assert.equal(keys.length,2,'only the two retaining projects need identity keys');assert.ok(!keys.some(row=>row.project===dropped.id),'explicit drop does not mint an identity key');assert.notEqual(keys[0].key,keys[1].key,'project keys are independent');
  const identities=(await app.DB.prepare('SELECT project,payload FROM event_identities WHERE project IN (?,?)').bind(project.id,foreign.id).all()).results;
  const hashes=p=>identities.filter(row=>row.project===p.id).map(row=>JSON.parse(row.payload).email).filter(row=>row?.value===email).map(row=>row.hash);
  assert.ok(hashes(project).length&&hashes(foreign).length);assert.notEqual(hashes(project)[0],hashes(foreign)[0]);
  await configure(project,'hash');expectCount(await preview(project),2,4,1);
  await capture(project,email);expectCount(await preview(project),3,5,1);
  await capture(foreign,email);expectCount(await preview(project),3,5,1);expectCount(await preview(foreign),2,2,0);
  const unavailable=await preview(dropped);assert.equal(unavailable.events.status,'unavailable');assert.equal(unavailable.events.count,null);assert.ok(unavailable.events.explanation.length>0);assert.equal(unavailable.events.withoutRetainedEmail,1);
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
  for(const width of [1440,390]) {
   const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
   try {
    const split=maintainer.cookie.indexOf('=');await context.addCookies([{name:maintainer.cookie.slice(0,split),value:maintainer.cookie.slice(split+1),url:origin.replace('http:','https:'),secure:true}]);
    await page.goto(origin+'/projects/'+project.id+'/settings#settings-privacy');const region=page.getByRole('region',{name:'End-user erasure preview',exact:true});
    const input=region.getByLabel('Email to match');await input.fill(email);await input.press('Tab');
    await region.getByRole('button',{name:'Preview matching records'}).press('Enter');
    await region.getByRole('status').getByText('3 matching events',{exact:false}).waitFor();
    if(width===1440)assert.equal(await input.inputValue(),'');if(width===1440){assert.ok(!(await region.innerText()).includes(email));await assertScreen(page,region)};
    await region.screenshot({path:`.artifacts/erasure-preview/matching-${width}.png`});
    // Error state is a refused real request; one width asserts behavior.
    if(width===1440){await page.route('**/end-user-erasure/preview',route=>route.continue({postData:JSON.stringify({email:'invalid'})}));await input.fill(email);await region.getByRole('button',{name:'Preview matching records'}).click();await region.getByRole('alert').waitFor();assert.equal(await region.getByRole('status').count(),0);await assertScreen(page,region);await page.unroute('**/end-user-erasure/preview');}
    await page.goto(origin+'/projects/'+dropped.id+'/settings#settings-privacy');const unavailableRegion=page.getByRole('region',{name:'End-user erasure preview',exact:true});
    await unavailableRegion.getByLabel('Email to match').fill(email);await unavailableRegion.getByRole('button',{name:'Preview matching records'}).click();
    await unavailableRegion.getByRole('status').getByText('Event matching unavailable',{exact:false}).waitFor();
    if(width===1440)await assertScreen(page,unavailableRegion);
    await unavailableRegion.screenshot({path:`.artifacts/erasure-preview/unavailable-${width}.png`});
   } finally {await context.close()}
  }
  // Owner-only confirmation is a separate destructive door. The existing
  // maintainer preview remains available, but never grants erase authority.
  const eraseDoor=root(project)+'/end-user-erasure/confirm';
  const selected={field:'email',value:email,action:'remove_identity'};
  let plan=await owner.json(door(project),'POST',selected);
  const acceptedInput=()=>({...selected,planHash:plan.planHash,confirm:'ERASE USER DATA'});
  const deniedBefore=await snapshot(app);
  for(const actor of [client(''),maintainer,member,reader,foreignMember,removed,admin]){
   const response=await actor.req(eraseDoor,'POST',acceptedInput());assert.ok([401,403,404].includes(response.status));await response.arrayBuffer();
  }
  for(const credential of credentials){const response=await owner.req(eraseDoor,'POST',acceptedInput(),{Authorization:'Bearer '+credential.key});assert.ok([401,403,404].includes(response.status));await response.arrayBuffer()}
  for(const body of [{...acceptedInput(),confirm:email},{...acceptedInput(),extra:true}]){const response=await owner.req(eraseDoor,'POST',body);assert.equal(response.status,400);await response.arrayBuffer()}
  const cross=await owner.req(eraseDoor,'POST',acceptedInput(),{Origin:'https://synthetic-spool-foreign.test'});assert.equal(cross.status,403);await cross.arrayBuffer();
  assertAuditAppendOnly(await snapshot(app),deniedBefore,'confirmation refusals preserve product state');
  await capture(project,email);
  const stale=await owner.req(eraseDoor,'POST',acceptedInput());assert.equal(stale.status,409);await stale.arrayBuffer();
  const pre=await archive(app),foreignBefore=(await preview(foreign)).events.count;
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  let removalReceipt;
  try{
   const split=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin.replace('http:','https:'),secure:true}]);
   await page.goto(origin+'/projects/'+project.id+'/settings#settings-privacy');
   const region=page.getByRole('region',{name:'End-user erasure preview',exact:true});
   await region.getByLabel('Email to match').fill(email);await region.getByRole('button',{name:'Preview matching records'}).click();
   await region.getByRole('status').getByText('4 matching events',{exact:false}).waitFor();
   const button=region.getByRole('button',{name:'Confirm user erasure'});assert.equal(await button.isDisabled(),true);
   await region.getByLabel('Type ERASE USER DATA').fill('ERASE USER DATA');
   const responsePromise=page.waitForResponse(response=>response.url().endsWith('/end-user-erasure/confirm'));
   await button.click();const response=await responsePromise;assert.equal(response.status(),200);removalReceipt=await response.json();
   await region.getByRole('heading',{name:'Erasure complete',exact:true}).waitFor();await assertScreen(page,region);
   for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await region.screenshot({path:`.artifacts/erasure-preview/complete-${width}.png`})}
  }finally{await context.close()}
  assert.equal(removalReceipt.phase,'complete');assert.equal(removalReceipt.deleted.event_identities,4);
  assert.deepEqual(await owner.json('/api/erasures/'+removalReceipt.id),removalReceipt,'ordinary erasure receipt door preserves the completed counts and times');
  expectCount(await preview(project),0,6,5);assert.equal((await preview(foreign)).events.count,foreignBefore);
  const issues=await owner.json(root(project)+'/issues');
  for(const issue of issues){const visible=await owner.json(root(project)+'/issues/'+issue.id+'/affected-users');for(const row of visible.rows??[])assert.ok(!Object.keys(row.values).length||row.values.email?.value!==email);assert.ok(!JSON.stringify(visible).includes('synthetic-spool-person-27'))}
  const post=await archive(app);
  const projection=post.data.event_identities.filter(row=>row.project===project.id);
  assert.ok(!JSON.stringify(projection).includes('synthetic-spool-person-27'));assert.ok(!JSON.stringify(projection).includes(hashes(project)[0]));
  assert.equal((await restore(app,pre.text)).body.error,'erasure_epoch');
  const fresh=await runtime();try{const answer=await restore(fresh,post.text);assert.equal(answer.status,200,JSON.stringify(answer));assert.equal((await restore(fresh,pre.text)).body.error,'erasure_epoch')}finally{await fresh.close()}
  // Exact DID equality is the only honest cross-store match. A different DID
  // remains anonymous with respect to this email; it is never guessed.
  const sessionValue=other,dsn=new URL(project.dsn);
  const envelope='{}\n{"type":"session"}\n'+JSON.stringify({sid:crypto.randomUUID().replaceAll('-',''),did:sessionValue,started:new Date().toISOString(),status:'exited',attrs:{release:'synthetic-spool-27'}});
  const sessionResponse=await owner.req(`/api${dsn.pathname}/envelope/?sentry_key=${dsn.username}&sentry_version=7`,'POST',envelope,{Cookie:'','Content-Type':'text/plain'});assert.equal(sessionResponse.status,200);await sessionResponse.arrayBuffer();
  const feedbackEnvelope='{}\n{"type":"user_report"}\n'+JSON.stringify({event_id:eventIds[2],comments:'synthetic-spool-attached-feedback',email:other,name:'synthetic-spool-feedback-person'});
  const feedbackResponse=await owner.req(`/api${dsn.pathname}/envelope/?sentry_key=${dsn.username}&sentry_version=7`,'POST',feedbackEnvelope,{Cookie:'','Content-Type':'text/plain'});assert.equal(feedbackResponse.status,200);await feedbackResponse.arrayBuffer();
  const beforeFeedback=await owner.json(root(project)+'/feedback');assert.equal(beforeFeedback.total,1);assert.equal(beforeFeedback.items[0].association,'attached');assert.ok(!JSON.stringify(beforeFeedback).includes(other));
  const deleteSelection={field:'email',value:other,action:'delete_events'},deletionPlan=await owner.json(door(project),'POST',deleteSelection);
  assert.equal(deletionPlan.events.count,1);assert.equal(deletionPlan.sessions.count,1);assert.equal(deletionPlan.feedback.count,1);
  const deletion=await owner.json(eraseDoor,'POST',{...deleteSelection,planHash:deletionPlan.planHash,confirm:'ERASE USER DATA'});
  assert.equal(deletion.deleted.events,1);assert.equal(deletion.deleted.health_sessions,1);assert.equal(deletion.deleted.feedback,1);assert.equal((await owner.json(root(project)+'/feedback')).total,0);assert.equal((await preview(project,owner,other)).events.count,0);
  assert.equal((await owner.json(root(project)+'/issues')).reduce((n,row)=>n+row.count,0),5);
  const finalArchive=await archive(app);assert.ok(finalArchive.data.health_sessions.every(row=>row.project!==project.id||row.user_hash===null));
  const safeAudit=await owner.json('/api/audit/export?format=json');assert.ok(safeAudit.rows.some(row=>row.action==='erasure.complete'&&row.outcome==='succeeded'));
  const nativeAudit=(await app.DB.prepare('SELECT * FROM audit').all()).results;
  for(const value of [email,other,...hashes(project),...keys.map(row=>row.key),'synthetic-spool-person-27'])assert.ok(!JSON.stringify([removalReceipt,deletion,safeAudit,nativeAudit]).includes(value),'receipts and audits omit user identity and private match material');
  // A retained id, username or literal IP uses the same exact matcher. Drop
  // stays unavailable and a confirmation can never resurrect dropped data.
  for(const [field,value] of [['id','synthetic-spool-person-27'],['username','synthetic-spool-name-27'],['ip_address','192.0.2.27']]){
   const input={field,value,action:'remove_identity'},current=await owner.json(door(foreign),'POST',input);assert.equal(current.events.count,2);
  }
  await writeFile('.artifacts/erasure-preview/results.json',JSON.stringify({removal:removalReceipt,deletion,restore:{same:'erasure_epoch',freshPost:'restored',freshOld:'erasure_epoch'},before:{events:6,matching:4},after:{events:5,matching:0},limitations:deletion.retained},null,2)+'\n');
  console.log('PROBE SDK-027 confirmed: owner keyboard confirmation removes all fields from 4 matching events, preserves other projects, receipts and audit omit values; event deletion removes 1 event and exact DID identity; current archive restores and old archives refuse.');
  console.log('PROBE SDK-027 email-preview: public Sentry captures -> 2 matching of 4 keep events; conversion plus hash capture -> 3 of 5; foreign key and captures -> unchanged 3.');
  console.log('PROBE SDK-027 unavailable: dropped email -> unavailable, 1 unattributable; feedback, attachments, replays and search explicitly unavailable; session DID literal equality counted separately.');
  console.log('PROBE SDK-027 authority-and-privacy: repeated owner, admin and maintainer POSTs -> counts only, unchanged product rows; anonymous, member, read-only, valid or revoked grant, foreign, removed and cross-origin requests refuse; safe audits omit values and keys.');
  console.log('PROBE SDK-027 settings: keyboard preview, refusal, Axe, text size and reflow passed; matching screens recorded at 1440 and 390.');
 } finally {await browser?.close();await app.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await endUserErasurePreviewFlow();
