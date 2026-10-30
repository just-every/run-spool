// [SDK-008] Real browser/Python SDKs; only the DSN changes between collectors.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import AxeBuilder from '@axe-core/playwright';
import {run,runOk,referenceCollector,api} from './runtimes/harness.mjs';
import {objectJson} from '../src/domain/sentry/wire.ts';
import {archiveProjection} from './archive.mjs';
import {signIn,inviteMember,emailSignIn} from './auth.mjs';
import {runtime} from './owner-erasure/helpers.mjs';
import {startTestWorker} from './worker.mjs';
import {followErasure} from './project-erasure/follow.mjs';
export async function identityFlow({browser}){
 const native=await runtime(),origin=native.origin,cookie=native.cookie;
 const browserSignIn=async(page)=>{
  const split=cookie.indexOf('=');
  await page.context().addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin.replace('http:','https:'),secure:true}]);
 };
 const app=api(origin,cookie),p=await app.json('/api/projects','POST',{id:'synthetic-spool-identity',name:'Checkout identity policy'}),root='/api/projects/'+p.id,dir=await mkdtemp(join(tmpdir(),'spool-identity-')),ref=await referenceCollector(),canary=crypto.randomUUID().replace(/[0-9]/g,d=>String.fromCharCode(97+Number(d)));
 const users=[{id:'synthetic-spool-id-'+canary},{email:['synthetic-spool-'+canary,'example.test'].join('@')},{username:'synthetic-spool-user-'+canary},{ip_address:'{{auto}}'},{ip_address:'{{auto}}'},{ip_address:'192.0.2.41'},{ip_address:'2001:db8::42'}],raw=users.flatMap(u=>Object.values(u)).filter(v=>v!=='{{auto}}');let server,restored;
 try{
  const dsn=new URL(p.dsn),transport=new URL(origin);dsn.protocol=transport.protocol;dsn.host=transport.host;p.dsn=dsn.href;
  const initial=await app.json(root+'/identity-policy');assert.deepEqual(Object.values(initial.policy),['drop','drop','drop','drop']);
  await runOk('python3',['-m','venv',join(dir,'venv')]);await runOk(join(dir,'venv/bin/pip'),['install','--quiet','--disable-pip-version-check','sentry-sdk==2.72.0']);
  const configure=async mode=>{const policy=Object.fromEntries(Object.keys(initial.policy).map(f=>[f,mode])),current=await app.json(root+'/identity-policy'),preview=await app.json(root+'/identity-policy/preview','POST',{policy});assert.ok(!raw.some(value=>JSON.stringify(preview).includes(value)));await app.json(root+'/identity-policy','PUT',{revision:current.revision,policy,token:preview.token});return preview};
  await configure('keep');
  await build({stdin:{contents:`import * as Sentry from '@sentry/browser';Sentry.init({dsn:globalThis.__DSN__,release:'synthetic-spool-identity@1',environment:'production'});Sentry.setUser(globalThis.__USER__);try{throw new Error('synthetic-spool-identity-checkout')}catch(error){window.eventId=Sentry.captureException(error)}window.done=Sentry.flush(10000);`,resolveDir:process.cwd()},outfile:join(dir,'identity.js'),bundle:true,format:'esm',platform:'browser'});
  server=createServer(async(req,res)=>{const url=new URL(req.url,'http://fixture');res.setHeader('Content-Type',url.pathname==='/identity.js'?'text/javascript':'text/html');res.end(url.pathname==='/identity.js'?await readFile(join(dir,'identity.js')):`<!doctype html><meta name="viewport" content="width=device-width"><title>Identity fixture</title><script>globalThis.__DSN__=${JSON.stringify(url.searchParams.get('dsn'))};globalThis.__USER__=${JSON.stringify(users[Number(url.searchParams.get('user'))])}</script><script type="module" src="/identity.js"></script>`)});await new Promise(r=>server.listen(0,'127.0.0.1',r));const address='http://127.0.0.1:'+server.address().port;await app.json(root+'/browser-origins','POST',{origin:address});
  const execute=async dsn=>{for(let index=0;index<users.length;index++){const context=await browser.newContext(),page=await context.newPage();try{await page.goto(address+'/?dsn='+encodeURIComponent(dsn)+'&user='+index);await page.waitForFunction(()=>window.done!==undefined);await page.evaluate(()=>window.done)}finally{await context.close()}}
   for(const user of users){const r=await run(join(dir,'venv/bin/python'),[resolve('tests/runtimes/python/identity.py')],{cwd:dir,env:{SPOOL_FIXTURE_DSN:dsn,SPOOL_IDENTITY_USER:JSON.stringify(user)}});assert.equal(r.code,0,r.stderr)} };
  await execute(ref.dsn);assert.equal(ref.sent.filter(i=>i.type==='event').length,14);const sentUsers=ref.sent.filter(i=>i.type==='event').map(i=>objectJson(i.bytes).user);assert.ok(sentUsers.some(u=>u.ip_address==='{{auto}}'));await execute(p.dsn);
  const issues=await app.json(root+'/issues');assert.equal(issues.length,2);for(const issue of issues){assert.equal(issue.count,7);const count=await app.json(root+'/issues/'+issue.id+'/affected-users');assert.equal(count.affectedUsers,5);assert.equal(count.unattributed,2);assert.ok(raw.every(value=>JSON.stringify(count).includes(value)));}
  const archive=await archiveProjection(await app.request('/api/archive'));assert.ok(raw.every(value=>archive.text.includes(value)),'keep is an explicit owner choice in the private archive');
  const grant=await app.json(root+'/keys','POST',{kind:'agent'});for(const issue of issues){const count=await app.json(root+'/issues/'+issue.id+'/affected-users','GET',undefined,{Cookie:'',Authorization:'Bearer '+grant.key});assert.equal(count.affectedUsers,5);assert.equal(count.rows,undefined);assert.ok(!raw.some(v=>JSON.stringify(count).includes(v)));const packet=await app.json(root+'/issues/'+issue.id+'/packet','GET',undefined,{Cookie:'',Authorization:'Bearer '+grant.key});assert.equal(packet.affectedUsers.affectedUsers,5);assert.ok(!raw.some(v=>JSON.stringify(packet).includes(v)))}
  await collaboratorIdentity({app,origin,browser,project:p,issues,raw,capture:objectJson(ref.sent.find(item=>item.type==='event').bytes)});
  const stalePolicy=Object.fromEntries(Object.keys(initial.policy).map(f=>[f,'hash'])),stale=await app.json(root+'/identity-policy/preview','POST',{policy:stalePolicy});await execute(ref.dsn);await execute(p.dsn);assert.equal((await app.request(root+'/identity-policy','PUT',{revision:stale.revision,policy:stalePolicy,token:stale.token})).status,409,'a count-only preview cannot approve newly retained identity records');
  await mkdir('.artifacts/c15/sdk008',{recursive:true});
  const snapshot=async(page,name,width,region)=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual((await new AxeBuilder({page}).include(`[aria-label="${region}"]`).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact)),[]);assert.deepEqual(await page.locator('button').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&!n.textContent.trim()).map(n=>n.getAttribute('aria-label'))),[]);await page.getByRole('region',{name:region,exact:true}).screenshot({path:`.artifacts/c15/sdk008/${name}-${width}.png`})};
  for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();try{await browserSignIn(page,origin);await page.goto(origin+'/projects/'+p.id+'/issues/'+issues[0].id);const section=page.getByRole('region',{name:'Affected users',exact:true});await section.getByText('5 distinct affected users',{exact:false}).waitFor();await section.getByText('Owner identity values',{exact:true}).click();await snapshot(page,'keep',width,'Affected users');await page.goto(origin+'/projects/'+p.id+'/settings');const policy=page.getByRole('region',{name:'User identity policy',exact:true});await policy.getByLabel('User id',{exact:true}).waitFor();for(const field of Object.keys(initial.policy))await policy.getByLabel('User '+field,{exact:true}).selectOption('hash');await policy.getByRole('button',{name:'Preview identity policy',exact:true}).click();await policy.getByRole('heading',{name:'Identity conversion preview',exact:true}).waitFor();await snapshot(page,'preview',width,'User identity policy');if(width===390){await policy.getByRole('button',{name:'Save identity policy',exact:true}).click();await policy.getByRole('status').filter({hasText:'Stricter conversion completed'}).waitFor()}}finally{await context.close()}}
  await execute(ref.dsn);await execute(p.dsn);
  let after=await archiveProjection(await app.request('/api/archive'));assert.ok(!raw.some(v=>after.text.includes(v)),'hash conversion leaves no raw identity in any archive row');for(const issue of issues){const data=await app.json(root+'/issues/'+issue.id+'/affected-users');assert.equal(data.affectedUsers,5);assert.ok(!raw.some(v=>JSON.stringify(data).includes(v)));const packet=await app.json(root+'/issues/'+issue.id+'/packet');assert.ok(!raw.some(v=>JSON.stringify(packet).includes(v)))}
  restored=await startTestWorker(15554);const restoredCookie=await signIn(restored.origin),result=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Cookie:restoredCookie,Origin:restored.origin,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:after.text});assert.ok(result.ok,await result.text());assert.equal((await api(restored.origin,restoredCookie).json(root+'/issues/'+issues[0].id+'/affected-users')).affectedUsers,5);
  for(const mode of ['hash','drop']){if(mode==='drop'){await configure('drop');await execute(ref.dsn);await execute(p.dsn)}for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();try{await browserSignIn(page,origin);await page.goto(origin+'/projects/'+p.id+'/issues/'+issues[0].id);const section=page.getByRole('region',{name:'Affected users',exact:true});await section.getByText(mode==='drop'?'unavailable (policy: drop)':'5 distinct affected users',{exact:false}).waitFor();await section.getByText('Owner identity values',{exact:true}).click();await snapshot(page,mode,width,'Affected users')}finally{await context.close()}}}
  assert.equal((await app.json(root+'/issues')).reduce((n,r)=>n+r.count,0),ref.sent.filter(i=>i.type==='event').length,'later keep/hash/drop intake preserves exact SDK error counts');
  after=await archiveProjection(await app.request('/api/archive'));assert.ok(!raw.some(v=>after.text.includes(v)));assert.ok(after.data.event_identities.filter(r=>r.project===p.id).every(r=>r.payload==='{}'&&r.user_key===null));assert.equal(after.data.audit.filter(r=>r.project===p.id&&r.kind==='identity_policy_changed').length,3,'one audited entry for keep, hash and drop');
  const denied=await app.request(root+'/identity-policy','PUT',{policy:initial.policy,revision:3,token:'synthetic-spool-denied'},{Cookie:'',Authorization:'Bearer '+grant.key});assert.equal(denied.status,403);
  const plan=await app.json(root+'/erasure');await followErasure(app.json,await app.json(root+'/erasure','POST',{confirm:p.id,planHash:plan.planHash}));const erased=await archiveProjection(await app.request('/api/archive'));for(const table of ['identity_policies','event_identities','project_identity_keys'])assert.ok(!erased.data[table].some(r=>r.project===p.id));
  console.log('[SDK-008] unmodified browser/Python: explicit keep, count-only preview, audited hash/drop conversion, count-only grants/packets, literal IPv4/IPv6, unresolved auto addresses, private restore and erasure; 1440/390 passed');
 }finally{await native.close();await restored?.stop();await ref.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r))}await rm(dir,{recursive:true,force:true})}
}

// The same retained SDK events qualify both native authority and presentation.
async function collaboratorIdentity({app,origin,browser,project,issues,raw,capture}) {
 const organization='/api/organization',root='/api/projects/'+project.id;
 await app.json(organization,'POST',{id:'synthetic-spool-identity',name:'Identity collaborators'});
 const foreign=await app.json('/api/projects','POST',{id:'synthetic-spool-identity-foreign',name:'Private unrelated project'});
 const foreignDsn=new URL(foreign.dsn),foreignRoot='/api/projects/'+foreign.id;
 const captured=await app.request('/api'+foreignDsn.pathname+'/store/?sentry_key='+foreignDsn.username+'&sentry_version=7','POST',capture,{Cookie:''});
 assert.equal(captured.status,200);await captured.body?.cancel();
 const foreignIssues=await app.json(foreignRoot+'/issues');assert.equal(foreignIssues.length,1);assert.equal(foreignIssues[0].count,1);
 const foreignIssue=foreignRoot+'/issues/'+foreignIssues[0].id;
 assert.equal((await app.json(foreignIssue+'/packet')).events.length,1,'foreign-project refusal addresses a real retained SDK capture');
 // Both organization-wide and project-only read-only authority use the same retained evidence.
 for(const role of ['read-only','member']) {
 const identity={email:['synthetic-spool-reader-'+role,'example.test'].join('@'),name:'Identity reader',role,grants:[{project:project.id,role:'read-only'}]};
 const invited=await inviteMember(app,origin,identity);
 // Sign in again normally so authority does not depend on the invitation cookie.
 const cookie=await emailSignIn(origin,identity.email),reader=api(origin,cookie);
 assert.deepEqual((await reader.json('/api/projects')).map(row=>[row.id,row.role]),[[project.id,'read-only']]);
 const privateFree=(text,door)=>{for(const value of raw)assert.ok(!text.includes(value),door+' omits retained raw identity')};
 const paths=[];
 for(const issue of issues) {
  const path=root+'/issues/'+issue.id;
  const owner=await app.json(path+'/affected-users');
  assert.equal(owner.affectedUsers,5);assert.equal(owner.unattributed,2);assert.equal(owner.events,7);
  assert.ok(raw.every(value=>JSON.stringify(owner.rows).includes(value)),'the permitted owner is a populated positive control');
  const count=await reader.json(path+'/affected-users');
  assert.equal(count.affectedUsers,5);assert.equal(count.unattributed,2);assert.equal(count.events,7);
  assert.equal(count.rows,undefined,'native read-only membership receives no identity rows');
  privateFree(JSON.stringify(count),'Affected users HTTP');
  const packet=await reader.json(path+'/packet');
  assert.equal(packet.affectedUsers.affectedUsers,5);assert.equal(packet.affectedUsers.unattributed,2);
  assert.equal(packet.affectedUsers.rows,undefined);assert.equal(packet.issue.id,issue.id);
  assert.equal(packet.events.length,7,'the private projection is checked on populated evidence');
  privateFree(JSON.stringify(packet),'Packet HTTP');
  const events=await reader.json(path+'/events');assert.equal(events.total,7);
  privateFree(JSON.stringify(events),'Event list HTTP');
  for(const event of events.rows)privateFree(JSON.stringify(await reader.json(path+'/events/'+event.id+'?occurrence='+event.occurrence)),'Event detail HTTP');
  paths.push(path+'/affected-users',path+'/packet',path+'/events');
 }
 for(const format of ['json','csv']) {
  const response=await reader.request(root+'/issue-export?format='+format);assert.equal(response.status,200);
  const text=await response.text();privateFree(text,'Issue '+format+' export');
  if(format==='json'){const exported=JSON.parse(text);assert.equal(exported.total,2);assert.deepEqual(exported.rows.map(row=>[row.id,row.count]).sort(),issues.map(row=>[row.id,7]).sort())}
  else for(const issue of issues)assert.ok(text.includes(issue.id),'the CSV contains each populated issue');
  paths.push(root+'/issue-export?format='+format);
 }
 for(const path of paths) {
  const suffix=path.slice(root.length).replace(/^\/issues\/[^/]+/,'/issues/'+foreignIssues[0].id);
  const response=await reader.request(foreignRoot+suffix);
  assert.equal(response.status,404,'a current collaborator cannot read a foreign project');
  privateFree(await response.text(),'Foreign-project refusal');
 }
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 const split=cookie.indexOf('=');
 await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin.replace('http:','https:'),secure:true}]);
 const responses=[];
 page.on('response',response=>{
  if(new URL(response.url()).pathname.startsWith(root+'/'))responses.push(response.text().then(text=>({path:new URL(response.url()).pathname,text})).catch(()=>null));
 });
 try {
  await mkdir('.artifacts/identity',{recursive:true});
  for(const [index,issue] of issues.entries()) {
   await page.setViewportSize({width:1440,height:1000});
   await page.goto(origin+'/projects/'+project.id+'/issues/'+issue.id);
   const section=page.getByRole('region',{name:'Affected users',exact:true});
   await section.getByText('5 distinct affected users',{exact:false}).waitFor();
   assert.match(await section.innerText(),/2 of 7 occurrences have no retained user key/);
   assert.equal(await section.getByText('Owner identity values',{exact:true}).count(),0);
   privateFree(await page.content(),'Rendered issue detail');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'the populated collaborator issue fits the desktop viewport');
   assert.deepEqual((await new AxeBuilder({page}).include('[aria-label="Affected users"]').analyze()).violations.filter(v=>['serious','critical'].includes(v.impact)),[]);
   for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    await page.getByRole('main').screenshot({path:`.artifacts/identity/reader-${role}-${index}-${width}.png`});
   }
  }
  const received=(await Promise.all(responses)).filter(Boolean);
  for(const issue of issues){const path=root+'/issues/'+issue.id;for(const suffix of ['/packet','/affected-users'])assert.ok(received.some(row=>row.path===path+suffix),'the rendered issue actually loaded its private HTTP evidence')}
  for(const response of received)privateFree(response.text,'Rendered issue HTTP');
  await app.json(organization+'/members/'+invited.member.id,'DELETE',{version:invited.member.version});
  for(const path of ['/auth/session',...paths]) {
   const response=await reader.request(path);
   assert.equal(response.status,401,'the removed collaborator loses the very next private read');
   privateFree(await response.text(),'Removed collaborator refusal');
  }
  await page.reload();await page.waitForURL(url=>url.pathname==='/sign-in');
  privateFree(await page.content(),'Removed collaborator screen');
  for(const issue of issues){const owner=await app.json(root+'/issues/'+issue.id+'/affected-users');assert.equal(owner.events,7);assert.equal(owner.affectedUsers,5);assert.equal(owner.unattributed,2);assert.ok(raw.every(value=>JSON.stringify(owner.rows).includes(value)),'refusals leave the owner evidence unchanged')}
  console.log('[SDK-026] native '+role+' with read-only project authority: each SDK issue has 5 users and 2 unattributed of 7; no identity rows or raw values in HTTP, rendered detail, packets or JSON and CSV exports; owner positive control, foreign-project and next-read removal refusals; 1440 and 390 screens passed');
 } finally {await context.close()}
 }
}
