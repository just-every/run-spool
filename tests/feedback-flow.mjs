import assert from 'node:assert/strict';
import { archiveProjection } from './archive.mjs';
import { startTestWorker } from './worker.mjs';
import { freePort } from './admission-runtime.mjs';
import { signIn, confirmEmailLink } from './auth.mjs';

async function restoreFeedback(before, after, expected) {
 const destination = await startTestWorker(await freePort());
 try {
  const cookie = await signIn(destination.origin);
  // One connection per request, as sentry-http's req does: archiveProjection verifies a whole archive with the event loop busy,
  // and a keep-alive connection left idle past the Worker's 5 s idle limit is closed by it; the refused POST would then be
  // written to a dead socket (fetch failed, write EPIPE) before the client had seen the close.
  const request = (path, method = 'GET', text) => fetch(destination.origin + path, { method, headers: { Connection: 'close', Origin: destination.origin, Cookie: cookie,
   ...text ? { 'Content-Type': 'application/x-ndjson', 'X-Confirm-Restore': 'yes' } : {} }, ...text ? { body: text } : {} });
  const restored = await request('/api/restore', 'POST', after.text);
  assert.equal(restored.status, 200, 'populated feedback restores on an independent installation: '+await restored.clone().text());
  const inbox = await request('/api/projects/feedback-flow/feedback');
  assert.deepEqual((await inbox.json()).items, expected);
  const snapshot = await archiveProjection(await request('/api/archive'));
  const byIdentity = rows => [...rows].sort((a,b) => JSON.stringify([a.project,a.id]).localeCompare(JSON.stringify([b.project,b.id])));
  assert.deepEqual(byIdentity(snapshot.data.feedback), byIdentity(after.data.feedback), 'feedback identities, scrubbed text and exact occurrence association survive restore');
  const refused = await request('/api/restore', 'POST', before.text);
  assert.equal(refused.status, 400);
  assert.equal((await refused.json()).error, 'erasure_epoch', 'the transferred later withdrawal journal fences an older snapshot');
 } finally { await destination.stop(); }
}

/** One feedback journey through Sentry transport, owner reads and withdrawal. */
export async function feedbackFlow({ req, json, origin }) {
 const project = await json('/api/projects', 'POST', { id: 'feedback-flow', name: 'Feedback flow' });
 const other = await json('/api/projects', 'POST', { id: 'feedback-other', name: 'Other feedback project' });
 const dsn = new URL(project.dsn), root = '/api/projects/feedback-flow';
 const path = `/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 const envelope = (type, value) => '{}\n' + JSON.stringify({ type }) + '\n' + JSON.stringify(value);
 const modern = (id, message, reference) => ({ event_id: id, type: 'feedback', contexts: { feedback: { message, ...reference ? { associated_event_id: reference } : {}, contact_email: 'FEEDBACK_PRIVATE_CONTACT@example.test', name: 'FEEDBACK_PRIVATE_NAME', url: 'https://example.test/FEEDBACK_PRIVATE_URL' } }, extra: { ignored: 'FEEDBACK_PRIVATE_EXTRA' } });
 const send = (type, value, headers = {}) => req(path, 'POST', envelope(type, value), { Cookie: '', ...headers });
 const errorId = '1'.repeat(32), foreignId = '2'.repeat(32), lateId = '3'.repeat(32);
 const error = id => ({ event_id: id, release: 'feedback-r1', dist: 'build', exception: { values: [{ type: 'Error', value: 'Checkout failed', stacktrace: { frames: [{ filename: 'checkout.js', lineno: 1, colno: 1, function: 'checkout' }] } }] } });
 await json(`${root}/releases`, 'POST', { name: 'feedback-r1', build: 'build' });
 await json('/api/projects/feedback-other/releases', 'POST', { name: 'feedback-r1', build: 'build' });
 assert.equal((await send('event', error(errorId))).status, 200);
 const otherDsn = new URL(other.dsn), foreignPath = `/api/${otherDsn.pathname.slice(1)}/envelope/?sentry_key=${otherDsn.username}&sentry_version=7`;
 assert.equal((await req(foreignPath, 'POST', envelope('event', error(foreignId)), { Cookie: '' })).status, 200);
 const issue = (await json(`${root}/issues`))[0], before = await json(`${root}/outcomes`), alerts = await json(`${root}/alerts`);
 const report = modern('4'.repeat(32), 'Checkout report canary token=FEEDBACK_PRIVATE_TOKEN', errorId);
 assert.equal((await send('event', report)).status, 200, 'modern captureFeedback uses an event item with type feedback');
 assert.equal((await send('event', report)).status, 200);
 assert.equal((await send('event', { ...report, contexts: { feedback: { ...report.contexts.feedback, contact_email: 'FEEDBACK_CHANGED_PRIVATE@example.test' } } })).status, 409, 'raw identity conflicts even when discarded fields differ');
 assert.equal((await send('feedback', modern('5'.repeat(32), 'Standalone report'))).status, 200);
 const legacy = { event_id: errorId, comments: 'Legacy crash modal report', email: 'FEEDBACK_PRIVATE_LEGACY@example.test', name: 'FEEDBACK_PRIVATE_LEGACY_NAME' };
 assert.equal((await send('user_report', legacy)).status, 200);
 assert.equal((await send('feedback', modern('6'.repeat(32), 'Other project reference', foreignId))).status, 200);
 assert.equal((await send('feedback', modern('7'.repeat(32), 'Event not retained yet', lateId))).status, 200);
 assert.equal((await send('event', error(lateId))).status, 200);
 const rows = await json(`${root}/feedback`), attached = await json(`${root}/feedback?issue=${issue.id}`);
 assert.equal(rows.items.length, 5);
 assert.equal(attached.items.length, 2);
 assert.equal(rows.items.find(row => row.id === report.event_id).eventId, errorId);
 assert.equal(rows.items.find(row => row.id === report.event_id).issueId, issue.id);
 assert.equal(rows.items.find(row => row.id === '5'.repeat(32)).association, 'standalone');
 for (const id of ['6'.repeat(32), '7'.repeat(32)]) {
  assert.equal(rows.items.find(row => row.id === id).association, 'event_unavailable');
  assert.equal(rows.items.find(row => row.id === id).issueId, null, 'foreign or later events cannot acquire an association');
 }
 const firstPage = await json(`${root}/feedback?limit=2`), nextPage = await json(`${root}/feedback?limit=2&cursor=${encodeURIComponent(firstPage.next)}`);
 assert.equal(firstPage.items.length, 2); assert.equal(nextPage.items.length, 2);
 assert.ok(nextPage.items.every(row => !firstPage.items.some(previous => previous.id === row.id)));
 assert.equal((await req(`${root}/feedback?issue=${issue.id}&cursor=${encodeURIComponent(firstPage.next)}`)).status, 400);
 for (const headers of [{ Cookie: '' }, { Cookie: '', Authorization: `Bearer ${project.ingestKey}` }, { Cookie: '', Authorization: `Bearer ${(await json(`${root}/keys`, 'POST', { kind: 'agent' })).key}` }]) {
  assert.ok([401, 403].includes((await req(`${root}/feedback`, 'GET', undefined, headers)).status));
  assert.ok([401, 403].includes((await req(`${root}/feedback/${report.event_id}`, 'DELETE', undefined, headers)).status));
 }
 assert.equal((await send('feedback', modern('8'.repeat(32), 'Forbidden browser'), { Origin: 'https://forbidden.example' })).status, 403);
 assert.equal((await req(path.replace(dsn.username, 'invalid-key'), 'POST', envelope('feedback', modern('8'.repeat(32), 'Wrong key')), { Cookie: '' })).status, 401);
 const browserOrigin = 'https://feedback.example'; await json(`${root}/browser-origins`, 'POST', { origin: browserOrigin });
 const browserReport = await send('feedback', modern('8'.repeat(32), 'Browser feedback'), { Origin: browserOrigin });
 assert.equal(browserReport.status, 200); assert.equal(browserReport.headers.get('access-control-allow-origin'), browserOrigin);
 const bad = await send('feedback', modern('9'.repeat(32), ''));
 assert.equal(bad.status, 422);
 assert.equal((await send('feedback', modern('9'.repeat(32), 'x'.repeat(1001)))).status, 413);
 const after = await json(`${root}/outcomes`), count = (value, reason) => value.rows.find(row => row.reason === reason)?.count ?? 0;
 assert.equal(count(after, 'accepted') - count(before, 'accepted'), 1, 'only the late error adds an accepted-error unit');
 assert.equal((await json(`${root}/alerts`)).length, alerts.length, 'feedback never makes an error alert');
 assert.equal((await json(`${root}/issues`))[0].count, issue.count + 1, 'feedback never increments error occurrences');
 const snapshot = await archiveProjection(await req('/api/archive'));
 for (const canary of ['FEEDBACK_PRIVATE_CONTACT', 'FEEDBACK_PRIVATE_NAME', 'FEEDBACK_PRIVATE_URL', 'FEEDBACK_PRIVATE_EXTRA', 'FEEDBACK_PRIVATE_TOKEN', 'FEEDBACK_PRIVATE_LEGACY', 'FEEDBACK_CHANGED_PRIVATE']) {
  assert.ok(!JSON.stringify(rows).includes(canary)); assert.ok(!snapshot.text.includes(canary), 'discarded/scrubbed feedback fields never enter archive custody');
 }
 assert.equal((await req(`${root}/feedback/${report.event_id}`, 'DELETE', undefined, { Origin: 'https://foreign.example' })).status, 403);
 assert.equal((await req(`/api/projects/feedback-other/feedback/${report.event_id}`, 'DELETE')).status, 404);
 await json(`${root}/feedback/${report.event_id}`, 'DELETE');
 assert.ok(!(await json(`${root}/feedback?issue=${issue.id}`)).items.some(row => row.id === report.event_id));
 assert.equal((await send('event', report)).status, 409, 'a withdrawn report cannot be recreated by an SDK retry');
 const withdrawn = await archiveProjection(await req('/api/archive'));
 assert.ok(!withdrawn.text.includes('Checkout report canary'));
 assert.ok(withdrawn.manifest.epoch > snapshot.manifest.epoch); assert.ok(withdrawn.manifest.journal.length > snapshot.manifest.journal.length);
 const audit = withdrawn.data.audit.filter(row => row.kind === 'feedback_withdrawn' && row.project === project.id);
 assert.deepEqual(audit.map(row => JSON.parse(row.detail)), [{ count: 1 }], 'withdrawal audit keeps no report ID or text');
 const older = await req('/api/restore', 'POST', snapshot.text, { 'X-Confirm-Restore': 'yes' });
 assert.equal(older.status, 400); assert.equal((await older.json()).error, 'erasure_epoch', 'withdrawal refuses an older archive on the same installation');
 await restoreFeedback(snapshot, withdrawn, (await json(`${root}/feedback`)).items);
 await new Promise(resolve => setTimeout(resolve, 5));
 await json(`${root}/retention`, 'POST', { cutoff: Date.now(), apply: true });
 assert.deepEqual((await json(`${root}/feedback`)).items, [], 'retention removes both linked and standalone descriptions');
 const retained = await archiveProjection(await req('/api/archive'));
 assert.ok(!retained.data.feedback.some(row => row.project === project.id));
 assert.equal((await send('event', error(errorId))).status, 200);
 assert.deepEqual((await json(`${root}/feedback?issue=${issue.id}`)).items, [], 'reused event IDs never resurrect feedback');
 await privateFeedbackFlow();
}

// The consented inbox path supplements (and never replaces) the unmodified SDK
// description-only journey above. All writes and reads use real HTTP doors.
export async function privateFeedbackFlow() {
 const worker=await startTestWorker(await freePort(),{MAIL_PROVIDER:'development',RER_DEV_ORIGIN:''});
 try {
  const cookie=await signIn(worker.origin),origin=worker.origin;
  const req=(path,method='GET',body,headers={})=>fetch(origin+path,{method,redirect:'manual',headers:{Connection:'close',Origin:origin,Cookie:cookie,...body?{'Content-Type':'application/json'}:{},...headers},...body?{body:typeof body==='string'?body:JSON.stringify(body)}:{}});
  const json=async(...args)=>{const response=await req(...args);assert.ok(response.ok,args[0]+': '+response.status+' '+(!response.ok?await response.text():''));return response.json()};
  const project=await json('/api/projects','POST',{id:'synthetic-spool-review',name:'Synthetic Spool feedback'}),dsn=new URL(project.dsn),root='/api/projects/'+project.id;
  const id='a1'.repeat(16),event='b1'.repeat(16),contact='synthetic-spool-1@example.test',metadata='synthetic-spool-sensitive-metadata';
  const png=await screenshotFixture(metadata);
  const envelope=(type,value)=>'{}\n'+JSON.stringify({type})+'\n'+JSON.stringify(value);
  const intake=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
  const report={event_id:id,type:'feedback',contexts:{feedback:{message:'synthetic-spool-1 checkout report',associated_event_id:event,spool:{consent:true,contactEmail:contact,screenshotPng:png.toString('base64')}}}};
  const send=body=>req(intake,'POST',envelope('feedback',body),{Cookie:''});
  assert.ok((await req(intake,'POST',envelope('event',{event_id:event,exception:{values:[{type:'Error',value:'synthetic-spool-1 checkout failed'}]}}),{Cookie:''})).ok);
  assert.ok((await send(report)).ok);
  const issue=(await json(root+'/issues'))[0],privateRoot=root+'/feedback/'+id;
  for(const invalid of [false,undefined]){
   const candidate=structuredClone(report);candidate.event_id='c1'.repeat(16);candidate.contexts.feedback.spool.consent=invalid;
   assert.equal((await send(candidate)).status,422,'private details require explicit consent');
  }
  for(const bad of [Buffer.from('<svg onload="alert(1)"></svg>').toString('base64'),'https://example.test/private.png','a'.repeat(180000)]){
   const candidate=structuredClone(report);candidate.event_id='c1'.repeat(16);candidate.contexts.feedback.spool.screenshotPng=bad;
   assert.equal((await send(candidate)).status,422,'active, remote and oversized image inputs are refused');
  }
  const review=await json(privateRoot+'/private');
  assert.equal(review.private.contact,contact);assert.equal(review.private.screenshot,true);assert.equal(review.private.review,'pending');assert.equal(review.mail.enabled,false);assert.equal(review.mail.code,'mail_suppressed');
  const image=await req(privateRoot+'/screenshot');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.match(image.headers.get('cache-control'),/no-store/);assert.equal(image.headers.get('x-content-type-options'),'nosniff');
  const cleanPng=Buffer.from(await image.arrayBuffer());assert.ok(!cleanPng.includes(Buffer.from(metadata)));assert.ok(cleanPng.length<png.length,'ancillary metadata is stripped, not just hidden');
  const grant=await json(root+'/keys','POST',{kind:'agent'});
  for(const headers of [{Cookie:''},{Cookie:'',Authorization:'Bearer '+project.ingestKey},{Cookie:'',Authorization:'Bearer '+grant.key}])for(const path of ['/private','/screenshot','/replies','/review']){
   const method=path==='/replies'||path==='/review'?'POST':'GET';const response=await req(privateRoot+path,method,method==='POST'?{id:crypto.randomUUID(),message:'synthetic-spool-1 unauthorized',consent:true,reviewed:true}:undefined,headers);
   assert.ok([401,403,404].includes(response.status),'private review rejects anonymous and credential reads/writes');
  }
  assert.equal((await req(privateRoot+'/replies','POST',{id:crypto.randomUUID(),message:'synthetic-spool-1 cross origin',consent:true},{Origin:'https://foreign.example'})).status,403);
  // Native local invitations provide real member sessions without provider mail.
  const org=await json('/api/organization');if(!org.organization)await json('/api/organization','POST',{id:'synthetic-spool-review',name:'Synthetic Spool team'});
  const actors=[];
  for(const [n,role,grants] of [[2,'member',[{project:project.id,role:'member'}]],[3,'read-only',[{project:project.id,role:'read-only'}]],[4,'member',[]]]){
   const email=`synthetic-spool-${n}@example.test`;
   await json('/api/organization/invites','POST',{email,name:`Synthetic Spool ${n}`,role,grants});
   const roster=await json('/api/organization'),person=roster.members.find(row=>row.email===email),invitation=roster.invites.find(row=>row.member===person?.id&&row.localLink);assert.ok(invitation,'native pending link available only to owner');
   const confirmed=await req('/auth/confirm','POST',{token:new URL(invitation.localLink).searchParams.get('token')},{Cookie:''});assert.equal(confirmed.status,303);
   actors.push(confirmed.headers.getSetCookie().map(value=>value.split(';')[0]).join('; '));await confirmed.arrayBuffer();
  }
  const [member,reader,unrelated]=actors;
  for(const actor of [reader,unrelated])for(const suffix of ['/private','/screenshot'])assert.equal((await req(privateRoot+suffix,'GET',undefined,{Cookie:actor})).status,404,'read-only and unrelated members cannot see private data');
  assert.equal((await json(privateRoot+'/private','GET',undefined,{Cookie:member})).private.contact,contact,'assigned teammate sees consented contact');
  assert.equal((await json(privateRoot+'/review','POST',{reviewed:true},{Cookie:member})).private.review,'reviewed');
  const attempted={id:crypto.randomUUID(),message:'synthetic-spool-1 reply canary',consent:true};
  const unsent=await json(privateRoot+'/replies','POST',attempted,{Cookie:member});assert.equal(unsent.reply.state,'never_sent');assert.equal(unsent.reply.code,'mail_suppressed');
  assert.deepEqual(await json(privateRoot+'/replies','POST',attempted,{Cookie:member}),unsent,'same request reads the ledger without another attempt');
  for(const actor of [reader,unrelated])assert.equal((await req(privateRoot+'/replies','POST',{...attempted,id:crypto.randomUUID()},{Cookie:actor})).status,404,'no reply authority for unrelated/read-only members');
  const issueRead=await json(root+'/feedback?issue='+issue.id);assert.ok(!JSON.stringify(issueRead).includes(contact));assert.ok(!JSON.stringify(issueRead).includes(attempted.message));assert.ok(!('hasPrivate' in issueRead.items[0]),'issue reads never publish private details');
  const snapshot=await archiveProjection(await req('/api/archive'));
  assert.ok(snapshot.text.includes(contact)&&snapshot.text.includes(attempted.message));assert.ok(!snapshot.text.includes(metadata));
  const destination=await startTestWorker(await freePort(),{MAIL_PROVIDER:'none',RER_DEV_ORIGIN:''});
  try{
   const restoredCookie=await signIn(destination.origin),restored=await fetch(destination.origin+'/api/restore',{method:'POST',headers:{Connection:'close',Origin:destination.origin,Cookie:restoredCookie,'X-Confirm-Restore':'yes'},body:snapshot.text});
   assert.equal(restored.status,200,await restored.clone().text());await restored.arrayBuffer();
   const kept=await fetch(destination.origin+privateRoot+'/private',{headers:{Connection:'close',Cookie:restoredCookie}});assert.equal((await kept.json()).private.replies[0].state,'never_sent','restore retains history and never queues a send');
   const off=await fetch(destination.origin+privateRoot+'/replies',{method:'POST',headers:{Connection:'close',Origin:destination.origin,Cookie:restoredCookie,'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),message:'synthetic-spool-1 mail-off attempt',consent:true})});assert.equal(off.status,201);const offReply=await off.json();assert.equal(offReply.reply.state,'never_sent');assert.equal(offReply.reply.code,'mail_off');
   await feedbackScreens({origin:destination.origin,cookie:restoredCookie,project,id,contact,reply:attempted.message});
  }finally{await destination.stop()}
  const minuteBound=(await json(root+'/feedback')).bounds.perMinute;let boundedAttempt=false;
  // Cross at most one wall-clock minute while filling the public bound.
  for(let n=0;n<minuteBound*2+1;n++){
   const bounded=structuredClone(report);bounded.event_id=(100+n).toString(16).padStart(32,'0');bounded.contexts.feedback={message:'synthetic-spool-1 bounded report'};
   const response=await send(bounded);if(response.status===429){assert.equal((await response.json()).reason,'feedback_rate_limited');boundedAttempt=true;break}assert.ok(response.ok);
  }
  assert.ok(boundedAttempt,'anonymous submissions meet an explicit rate refusal');
  await json(privateRoot,'DELETE');
  for(const suffix of ['/private','/screenshot'])assert.equal((await req(privateRoot+suffix)).status,404);
  const withdrawn=await archiveProjection(await req('/api/archive'));
  for(const canary of [contact,attempted.message,'synthetic-spool-1 checkout report',cleanPng.toString('base64')])assert.ok(!withdrawn.text.includes(canary),'withdrawal removes contact, reply, description and screenshot from storage-backed exports');
  assert.equal((await send(report)).status,409,'withdrawn private report cannot be replayed');
  console.log('feedback private review: consent, safe PNG, member fences, mail-off, archive restore and withdrawal passed');
 }finally{await worker.stop()}
 await feedbackMailFlow();
}
async function screenshotFixture(metadata){
 const {launchBrowser}=await import('./browser-launch.mjs'),{crc32}=await import('node:zlib');
 const browser=await launchBrowser();let screenshot;
 try{
  const context=await browser.newContext({viewport:{width:360,height:220}}),page=await context.newPage();
  await page.setContent('<!doctype html><html lang="en"><body style="margin:0;padding:24px;background:#f5f3ee;color:#242420;font:16px Georgia"><p style="margin-top:0">Synthetic Spool checkout</p><h1 style="font-size:23px">Payment could not finish</h1><p>Your basket is saved. Please try again.</p><button style="padding:8px 16px;font:inherit">Try again</button></body></html>');
  screenshot=await page.screenshot();
 }finally{await browser.close()}
 const name=Buffer.from('tEXt'),text=Buffer.from('Comment\0'+metadata),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(text.length);crc.writeUInt32BE(crc32(Buffer.concat([name,text])));
 return Buffer.concat([screenshot.subarray(0,-12),size,name,text,crc,screenshot.subarray(-12)]);
}
async function feedbackScreens({origin,cookie,project,contact,reply}){
 const {launchBrowser}=await import('./browser-launch.mjs'),{mkdir}=await import('node:fs/promises');
 const {expect}=await import('@playwright/test'),{default:AxeBuilder}=await import('@axe-core/playwright');
 const output=process.env.SPOOL_FEEDBACK_EVIDENCE??'.artifacts/feedback-review';await mkdir(output,{recursive:true});
 const browser=await launchBrowser();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),separator=cookie.indexOf('=');
  await context.addCookies([{name:cookie.slice(0,separator),value:cookie.slice(separator+1),url:origin}]);
  const page=await context.newPage();page.setDefaultTimeout(20000);
  await page.goto(origin+'/projects/'+project.id+'/settings#settings-processing');
  const panel=page.getByRole('region',{name:'Project feedback inbox'});
  await panel.getByRole('button',{name:'Review report privately',exact:true}).click();
  await expect(panel.getByText(contact,{exact:true})).toBeVisible();
  await expect(panel.getByRole('status')).toContainText(/Email is off/);
  await expect(panel.getByRole('button',{name:'Send reply',exact:true})).toBeDisabled();
  await expect(panel.getByRole('textbox',{name:'Reply to reporter'})).toBeDisabled();
  await expect(panel.getByText(reply,{exact:true})).toBeVisible();
  await panel.getByRole('button',{name:'Review screenshot',exact:true}).click();
  const image=panel.getByRole('img',{name:'Screenshot shared by the reporter with consent'});await expect(image).toBeVisible();
  assert.equal(await image.evaluate(image=>image.complete&&image.naturalWidth===360),true,'stripped image actually decodes in built UI');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const axe=await new AxeBuilder({page}).include('.feedback-panel').analyze();assert.deepEqual(axe.violations.filter(item=>['serious','critical'].includes(item.impact)),[]);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await panel.screenshot({path:output+`/feedback-review-${width}.png`});
  }
 }finally{await browser.close()}
}
async function feedbackMailFlow(){
 const {receiver}=await import('./alerts/receiver.mjs'),{alertRuntime}=await import('./alerts/runtime.mjs');
 const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const directory=await mkdtemp(join(tmpdir(),'spool-feedback-mail-')),edge=await receiver(join(directory,'mail.sqlite'));let app,releaseMail;
 const {createServer}=await import('node:http');let holdMail=false,mailArrived;
 // Hold one response at the existing fake's network edge to observe durable
 // queued state through HTTP before the provider accepts the same attempt.
 const bridge=createServer(async(request,response)=>{
  const chunks=[];for await(const chunk of request)chunks.push(chunk);
  if(holdMail&&request.url==='/mail'){holdMail=false;mailArrived();await new Promise(resolve=>{releaseMail=resolve})}
  const result=await fetch(edge.url+request.url,{method:request.method,headers:{'Content-Type':'application/json'},body:Buffer.concat(chunks)});
  response.writeHead(result.status,Object.fromEntries(result.headers));response.end(Buffer.from(await result.arrayBuffer()));
 });
 await new Promise(resolve=>bridge.listen(0,'127.0.0.1',resolve));
 const providerEdge={url:'http://127.0.0.1:'+bridge.address().port};
 try{
  app=await alertRuntime(providerEdge,{mail:'resend',configure:false});
  const project=await app.json('/api/projects','POST',{id:'synthetic-spool-mail',name:'Synthetic Spool mail'}),dsn=new URL(project.dsn),id='e1'.repeat(16),root=`/api/projects/${project.id}/feedback/${id}`;
  const report={event_id:id,type:'feedback',contexts:{feedback:{message:'synthetic-spool-1 email report',spool:{consent:true,contactEmail:'synthetic-spool-1@example.test'}}}};
  assert.ok((await app.request(`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`,'POST','{}\n{"type":"feedback"}\n'+JSON.stringify(report),{Cookie:''})).ok);
  await app.json('/api/organization','POST',{id:'synthetic-spool-mail',name:'Synthetic Spool mail team'});
  const teammate='synthetic-spool-2@example.test';await app.json('/api/organization/invites','POST',{email:teammate,name:'Synthetic Spool teammate',role:'member',grants:[{project:project.id,role:'member'}]});
  const memberCookie=await confirmEmailLink(app.origin,teammate),memberHeaders={Cookie:memberCookie};
  const prior=edge.mailCount,attempt={id:crypto.randomUUID(),message:'synthetic-spool-1 provider reply token=synthetic-spool-private-reply',consent:true};
  const arrived=new Promise(resolve=>{mailArrived=resolve});holdMail=true;
  const sending=app.request(root+'/replies','POST',attempt,memberHeaders);await arrived;
  try{const queued=await app.json(root+'/private');assert.equal(queued.private.replies.at(-1).state,'queued','pending provider attempt has durable queued state')}finally{releaseMail()}
  const accepted=await sending;assert.equal(accepted.status,201);const sent=await accepted.json();assert.equal(sent.reply.state,'sent');assert.equal(sent.reply.code,'provider_accepted');
  assert.equal(edge.mailCount,prior+1);assert.ok(!sent.reply.message.includes('synthetic-spool-private-reply'),'reply scrubbed before storage and dispatch');
  await app.json(root+'/replies','POST',attempt,memberHeaders);assert.equal(edge.mailCount,prior+1,'retry does not dispatch a duplicate');
  edge.mailStatuses.push(403);const failed=await app.json(root+'/replies','POST',{...attempt,id:crypto.randomUUID()},memberHeaders);assert.equal(failed.reply.state,'failed');assert.equal(failed.reply.code,'provider_failed');
  edge.mailStatuses.push(503);const uncertain=await app.json(root+'/replies','POST',{...attempt,id:crypto.randomUUID()},memberHeaders);assert.equal(uncertain.reply.state,'failed');assert.equal(uncertain.reply.code,'delivery_unconfirmed');
  const before=edge.mailCount;const unconfigured=await app.json(root+'/replies','POST',{...attempt,id:crypto.randomUUID()},{...memberHeaders,'x-fixture-unconfigured':'mail'});assert.equal(unconfigured.reply.state,'never_sent');assert.equal(edge.mailCount,before);
  const kept=await app.json(root+'/private');assert.deepEqual(kept.private.replies.map(row=>row.state),['sent','failed','failed','never_sent']);
  await app.json(root,'DELETE');assert.equal((await app.request(root+'/private')).status,404);
  const archive=await archiveProjection(await app.request('/api/archive'));assert.ok(!archive.text.includes(attempt.message),'sent/failed reply ledger is removed on withdrawal');
  console.log('feedback mail: approved sender fake accepted, rejected, uncertain and unconfigured states; no duplicate sends');
 }finally{releaseMail?.();await app?.close();bridge.closeAllConnections();await new Promise(resolve=>bridge.close(resolve));await edge.close();await rm(directory,{recursive:true,force:true})}
}

if(process.argv[1]&&(await import('node:url')).pathToFileURL(process.argv[1]).href===import.meta.url){
 const worker=await startTestWorker(await freePort());
 try{
  const cookie=await signIn(worker.origin);const {chooseLocalAgentPolicy}=await import('./agent-door/local-policy.mjs');await chooseLocalAgentPolicy(worker.origin,cookie);
  const req=(path,method='GET',body,headers={})=>fetch(worker.origin+path,{method,headers:{Connection:'close',Origin:worker.origin,Cookie:cookie,...body?{'Content-Type':'application/json'}:{},...headers},...body?{body:typeof body==='string'?body:JSON.stringify(body)}:{}});
  const json=async(...args)=>{const response=await req(...args);assert.ok(response.ok,args[0]+': '+response.status);return response.json()};
  await feedbackFlow({req,json,origin:worker.origin});
  console.log('feedbackFlow passed');
 }finally{await worker.stop()}
}
