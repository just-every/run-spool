import assert from 'node:assert/strict';
import {archiveProjection} from './archive.mjs';
import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';
import {followErasure} from './project-erasure/follow.mjs';
import {readScreens} from './runtimes/screens.mjs';

export async function fidelityFlow({req,json,origin,cookie}) {
 const project=await json('/api/projects','POST',{id:'fidelity',name:'Cedar checkout diagnostics'}),base='/api/projects/fidelity';
 await json(base+'/releases','POST',{name:'checkout@2.0.0',build:'web'});
 const dsn=new URL(project.dsn),path=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 let sequence=0;
 const queryString='page=2&%61pi_key=PRIVATE_QUERY_KEY&authorization=PRIVATE_QUERY_AUTH&filter=checkout+failed&note=password%3DPRIVATE_QUERY_NESTED&email=PRIVATE_QUERY_EMAIL%40example.com&redirect=https%3A%2F%2Fcedar.example%2Fcart%3Ftoken%3DPRIVATE_QUERY_URL&tag=checkout&tag=retry';
 const frame=(name,line)=>({filename:'/app/checkout.py',function:name,lineno:line,in_app:true,pre_context:['order = load_order()'],context_line:'charge(order)',post_context:['return receipt'],vars:{password:'PRIVATE_PASSWORD',api_key:'PRIVATE_API_KEY',order_id:'order-123',nested:{authorization:'PRIVATE_NESTED',items:3}}});
 const chain=(type='KeyError',tenant='acme')=>({event_id:(++sequence).toString(16).padStart(32,'0'),release:'checkout@2.0.0',dist:'web',platform:'python',environment:'production',exception:{values:[{type,value:'Missing checkout account',stacktrace:{frames:[frame('load_account',8),{...frame('library_wrapper',4),in_app:false}]},mechanism:{type:'chained',handled:false}},{type:'CheckoutError',value:'Unable to charge order',stacktrace:{frames:[frame('checkout',20)]},mechanism:{type:'generic',handled:false}}]},tags:{tenant},contexts:{browser:{name:'Chrome',version:'130'},os:{name:'macOS'}},request:{url:'https://cedar.example/checkout?token=PRIVATE_URL',method:'POST',headers:{Authorization:'PRIVATE_AUTH',Cookie:'PRIVATE_COOKIE','X-Request-ID':'request-123'},cookies:'PRIVATE_COOKIES',data:'PRIVATE_BODY'},extra:{payment_token:'PRIVATE_EXTRA',cart_items:3},user:{email:'PRIVATE_USER@example.com'}});
 const send=async value=>{const response=await req(path,'POST',JSON.stringify({event_id:value.event_id})+'\n{"type":"event"}\n'+JSON.stringify(value));assert.equal(response.status,200,await response.text());return value};
 const initial=chain();initial.request.query_string=queryString;initial.request.env={SERVER_NAME:'PRIVATE_ENV_SERVER',HTTP_HOST:'PRIVATE_ENV_HOST',APP_SECRET:'PRIVATE_ENV_SECRET'};
 const first=await send(initial),second=await send(chain('ValueError'));
 let issues=await json(base+'/issues');assert.equal(issues.length,2,'same wrapper with distinct causes has distinct issues');
 assert.equal((await json(base+'/alerts')).filter(a=>a.kind==='new_issue').length,2,'both root causes alert');
 // GROUP-001: distinct roots and per-frame in_app are observable at public owner detail.
 const found=await json(base+'/issue-search?q='+encodeURIComponent('tenant:acme browser.name:Chrome error.type:KeyError'));assert.equal(found.total,1);assert.ok(found.facets.tags.some(t=>t.key==='tenant'&&t.value==='acme'&&t.count===1));
 const issue=found.rows[0].id,eventBase=base+'/issues/'+issue+'/events';
 for(let i=0;i<29;i++)await send(chain('KeyError',i%2?'other':'acme'));
 const list=await json(eventBase);assert.equal(list.total,30);assert.equal(list.rows.length,25);assert.ok(list.next);
 const next=await json(eventBase+'?cursor='+encodeURIComponent(list.next));assert.equal(next.rows.length,5);assert.equal(new Set([...list.rows,...next.rows].map(e=>e.occurrence)).size,30);
 assert.equal(list.oldest.id,first.event_id);assert.equal(list.latest.id,sequence.toString(16).padStart(32,'0'));
 const tag=list.tags.rows.find(t=>t.key==='tenant'&&t.value==='acme');assert.equal(tag.count,16);assert.equal(tag.percent,100*16/30);
 const detail=await json(eventBase+'/'+list.oldest.id+'?occurrence='+list.oldest.occurrence);
 assert.equal(detail.grouping.variant,'exception chain','GROUP-001 shows the whole-chain variant');assert.equal(detail.grouping.exceptions[0].frames[0].contributes,true);assert.equal(detail.grouping.exceptions[0].frames[1].contributes,false,'GROUP-001 SDK not-in-app frame is excluded');assert.equal(detail.grouping.exceptions[0].frames[1].reason,'not in-app');
 // SDK-008: report excluded Sentry identity without retaining its value.
 assert.ok(detail.event.sentry.truncation.some(note=>note.path==='user'&&note.reason==='identity_policy_drop'),'SDK-008 names the default-drop identity policy at the owner detail door');
 // SDK-010 request query strings are kept scrubbed and every exclusion is named.
 const query=new URLSearchParams(detail.event.sentry.request.query_string);
 assert.equal(query.get('page'),'2');assert.equal(query.get('filter'),'checkout failed');assert.deepEqual(query.getAll('tag'),['checkout','retry']);
 assert.equal(query.get('api_key'),'[redacted]','encoded secret names are decoded before masking');assert.equal(query.get('authorization'),'[redacted]');
 assert.equal(query.get('note'),'password=[redacted]');assert.equal(query.get('email'),'[email]');assert.equal(query.get('redirect'),'https://cedar.example/cart','ERR-003 scrubs URLs inside decoded query values');
 for(const key of ['cookies','data','env']){
  assert.equal(detail.event.sentry.request[key],undefined);
  assert.ok(detail.event.sentry.truncation.some(note=>note.path==='request.'+key&&note.reason==='request_policy_excluded'),'excluded request '+key+' is named');
 }
 assert.equal(detail.event.sentry.user,undefined);
 assert.ok(!detail.event.sentry.truncation.some(note=>note.path==='request.query_string'&&note.reason==='request_policy_excluded'));
 assert.equal(detail.event.sentry.exceptions.length,2);assert.equal(detail.event.sentry.exceptions[0].stacktrace.frames[0].vars.order_id,'order-123');assert.equal(detail.event.sentry.exceptions[0].stacktrace.frames[0].context_line,'charge(order)');assert.equal(detail.event.sentry.tags['browser.name'],'Chrome');assert.equal(detail.event.sentry.extra.cart_items,3);assert.equal(detail.event.sentry.request.method,'POST');assert.ok(detail.next);assert.equal(detail.previous,null);
 for(const canary of ['PRIVATE_PASSWORD','PRIVATE_API_KEY','PRIVATE_NESTED','PRIVATE_AUTH','PRIVATE_COOKIE','PRIVATE_BODY','PRIVATE_EXTRA','PRIVATE_USER','PRIVATE_URL','PRIVATE_QUERY','PRIVATE_ENV'])assert.ok(!JSON.stringify(detail).includes(canary),canary+' scrubbed at owner read');
 const packet=await json(base+'/issues/'+issue+'/packet');assert.equal(packet.events[0].event.sentry.exceptions.length,2);assert.ok(!JSON.stringify(packet).includes('charge(order)'));assert.ok(!JSON.stringify(packet).includes('order-123'),'locals excluded from agent packet');
 assert.equal((await req(eventBase,'GET',undefined,{Cookie:''})).status,401);
 const grant=await json(base+'/keys','POST',{kind:'agent'});assert.equal((await req(eventBase,'GET',undefined,{Cookie:'',Authorization:'Bearer '+grant.key})).status,403,'agent cannot acquire owner local-variable scope');
 assert.equal((await req(eventBase+'/'+second.event_id+'?occurrence='+list.oldest.occurrence)).status,404,'exact issue and occurrence checked');
 const filtered=await json(eventBase+'?q=tenant:acme');assert.equal(filtered.total,16);assert.equal((await req(eventBase+'?q=tenant:acme&cursor='+encodeURIComponent(list.next))).status,400);
 const grouped=chain();grouped.exception.values=[{type:'ValueError',value:'child one',mechanism:{exception_id:1,parent_id:0},stacktrace:{frames:[frame('child_one',30)]}},{type:'TypeError',value:'child two',mechanism:{exception_id:2,parent_id:0},stacktrace:{frames:[frame('child_two',35)]}},{type:'ExceptionGroup',value:'parallel checkout',mechanism:{is_exception_group:true,exception_id:0},stacktrace:{frames:[frame('parallel',40)]}}];await send(grouped);
 const message={event_id:(++sequence).toString(16).padStart(32,'0'),release:'checkout@2.0.0',dist:'web',level:'warning',logentry:{message:'quota exceeded for %s',params:['checkout'],formatted:'quota exceeded for checkout'}};await send(message);await send({...message,event_id:(++sequence).toString(16).padStart(32,'0'),logentry:{...message.logentry,params:['billing'],formatted:'quota exceeded for billing'}});
 const messages=await json(base+'/issue-search?q='+encodeURIComponent('message:"quota exceeded"'));assert.equal(messages.total,1);assert.equal(messages.rows[0].count,2,'message template groups parameter variants');
 const anonymousBase=base+'/issues/'+messages.rows[0].id+'/events',anonymousList=await json(anonymousBase);
 const anonymous=await json(anonymousBase+'/'+anonymousList.latest.id+'?occurrence='+anonymousList.latest.occurrence);
 assert.ok(!anonymous.event.sentry.truncation.some(note=>note.path==='user'),'SDK-008 does not report identity exclusion when the SDK sent no user');
 const recursion=chain('RecursionError');recursion.exception.values=[{type:'RecursionError',value:'recursion',stacktrace:{frames:Array.from({length:1200},(_,i)=>({filename:'/app/recursion.py',function:'recurse',lineno:i+1}))}}];await send(recursion);
 const recursiveIssue=(await json(base+'/issue-search?q=error.type:RecursionError')).rows[0].id,recursiveList=await json(base+'/issues/'+recursiveIssue+'/events');const recursiveDetail=await json(base+'/issues/'+recursiveIssue+'/events/'+recursion.event_id+'?occurrence='+recursiveList.latest.occurrence);assert.equal(recursiveDetail.event.sentry.exceptions[0].stacktrace.frames.length,1000);assert.ok(recursiveDetail.event.sentry.truncation.some(t=>t.omitted===200));
 const java=chain('IllegalStateException');java.platform='java';java.exception.values[0].stacktrace.frames=[{filename:'Checkout.java',module:'com.cedar.Checkout',function:'charge',lineno:12}];await send(java);
 const longQuery=chain('QueryBoundError');longQuery.request.query_string='diagnostic='+encodeURIComponent('🧭'.repeat(6000))+'&token=PRIVATE_QUERY_LONG';await send(longQuery);
 const queryIssue=(await json(base+'/issue-search?q=error.type:QueryBoundError')).rows[0].id,queryRows=await json(base+'/issues/'+queryIssue+'/events');
 const queryDetail=await json(base+'/issues/'+queryIssue+'/events/'+longQuery.event_id+'?occurrence='+queryRows.latest.occurrence),boundedQuery=new URLSearchParams(queryDetail.event.sentry.request.query_string).get('diagnostic');
 assert.ok(boundedQuery.startsWith('🧭'));assert.ok(boundedQuery.endsWith('[truncated]'));assert.ok(!boundedQuery.includes('�'),'query trimming preserves UTF-8 characters');
 assert.ok(queryDetail.event.sentry.truncation.some(note=>note.path==='request.query_string'&&note.reason==='value_bytes'&&note.omitted>0),'query bound has an explicit omission note');assert.ok(!JSON.stringify(queryDetail).includes('PRIVATE_QUERY_LONG'));
 const rules=base+'/grouping-rules';await json(rules,'PUT',{revision:0,policy:{version:1,stack:'',fingerprint:'error.type:KeyError -> inner-account'}});
 const ruled=await send(chain()),ruledSearch=await json(base+'/issue-search?q='+encodeURIComponent('error.type:KeyError')),ruledIssue=ruledSearch.rows.find(row=>row.count===1),ruledRows=await json(base+'/issues/'+ruledIssue.id+'/events'),ruledDetail=await json(base+'/issues/'+ruledIssue.id+'/events/'+ruled.event_id+'?occurrence='+ruledRows.latest.occurrence);
 assert.equal(ruledDetail.event.sentry.exceptions[1].type,'CheckoutError');assert.equal(ruledDetail.grouping.projectFingerprintRule,1,'GROUP-001 rule matches inner cause beneath unchanged wrapper');assert.equal(ruledDetail.grouping.variant,'custom fingerprint');assert.ok(ruledDetail.grouping.exceptions.every(cause=>cause.frames.every(frame=>!frame.contributes)),'GROUP-001 replacement fingerprint explains excluded frames');
 await impactJourney({req,json,origin,cookie});
 console.log('SDK-010 request query strings are kept scrubbed and every exclusion is named; GROUP-001 fidelity flow passed: chains/groups/message events, root-cause alerts, retained selection/pagination/tags, privacy and agent scope, 1,000-frame retention and Java chain.');
}

async function impactJourney({req,json,origin,cookie}){
 const project=await json('/api/projects','POST',{id:'synthetic-spool-impact',name:'Synthetic issue impact'}),root='/api/projects/'+project.id;
 const policy={id:'hash',email:'drop',username:'drop',ip_address:'drop'},preview=await json(root+'/identity-policy/preview','POST',{policy});await json(root+'/identity-policy','PUT',{revision:0,policy,token:preview.token});
 const dsn=new URL(project.dsn),path=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 const send=async(type,value)=>{const response=await req(path,'POST','{}\n'+JSON.stringify({type})+'\n'+JSON.stringify(value));assert.equal(response.status,200);return response.json()};
 const sent=[],sids=Array.from({length:5},()=>crypto.randomUUID().replaceAll('-',''));
 for(const [i,release,user] of [[1,'synthetic-spool-1','synthetic-spool-user-1'],[2,'synthetic-spool-2','synthetic-spool-user-1'],[3,'synthetic-spool-2','synthetic-spool-user-2'],[4,'',null],[5,'synthetic-spool-2','synthetic-spool-user-1']]){
  const event_id=i.toString(16).padStart(32,'0');sent.push(event_id);
  await send('event',{event_id,...release?{release}:{},platform:'python',environment:'test',...user?{user:{id:user}}:{},tags:{tenant:'acme',...i===3?{diagnostic:'synthetic-spool-3'}:{}},contexts:{session:{sid:i===5?sids[1].replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5').toUpperCase():sids[i-1]},...i===3?{checkout:{stage:'payment'}}:{}},exception:{values:[{type:'ImpactError',value:'synthetic-spool-'+i,stacktrace:{frames:[{filename:'/app/impact.py',function:'checkout',lineno:8,in_app:true}]}}]}});
 }
 const [issue]=await json(root+'/issues'),events=root+'/issues/'+issue.id+'/events';assert.equal(issue.count,5);
 const started=new Date(Date.now()-60000).toISOString();
 for(const [n,release,status,user] of [[0,'synthetic-spool-1','exited','synthetic-spool-user-1'],[1,'synthetic-spool-2','crashed','synthetic-spool-user-1'],[2,'synthetic-spool-2','exited','synthetic-spool-user-2'],[3,'synthetic-spool-2','exited','synthetic-spool-user-3'],[4,'synthetic-spool-2','exited','synthetic-spool-user-4']])assert.equal((await send('session',{sid:sids[n],started,timestamp:started,status,errors:Number(status==='crashed'),did:user,attrs:{release,environment:'test'}})).sessions.session_stored,1);
 assert.equal((await send('session',{sid:crypto.randomUUID().replaceAll('-',''),started,timestamp:started,status:'exited',attrs:{environment:'test'}})).sessions.session_missing_release,1);
 const list=await json(events),impact=await json(root+'/issues/'+issue.id+'/impact');
 assert.deepEqual(list.rows.map(e=>e.id).sort(),sent.sort());assert.deepEqual([impact.events,impact.users.events,impact.users.affectedUsers,impact.users.unattributed],[5,5,2,1]);
 assert.equal(impact.firstSeen,list.oldest.received);assert.equal(impact.lastSeen,list.latest.received);assert.equal(impact.rate.events,5);assert.equal(impact.rate.perHour,5/24);
 assert.equal(impact.releases.noReleaseEvents,1);assert.deepEqual(impact.releases.rows.map(r=>[r.release,r.events]),[['synthetic-spool-1',1],['synthetic-spool-2',3]]);
 assert.equal(impact.releases.rows.reduce((n,r)=>n+r.events,0)+impact.releases.noReleaseEvents,impact.events,'release history exclusions reconcile with every retained issue event');
 const first=impact.releases.rows[0].projectHealth[0],second=impact.releases.rows[1].projectHealth[0];assert.deepEqual([first.sessions,first.crashFreeSessionRate,first.adoptionShare],[1,1,1/5]);assert.deepEqual([second.sessions,second.crashFreeSessionRate,second.adoptionShare],[4,.75,4/5]);
 assert.deepEqual([impact.projectHealth.denominators.sessionsSeen,impact.projectHealth.denominators.releaseLess],[5,1]);assert.equal(impact.affectedSessions,4);assert.deepEqual(impact.sessions,{events:5,linkedEvents:5,unlinkedEvents:0,knownAffected:4});assert.deepEqual(impact.releases.rows.map(row=>[row.knownAffectedSessions,row.unlinkedSessionEvents]),[[1,0],[2,0]],'the no-release event and its session do not enter issue release-scoped counts');assert.ok(impact.sessionCoverage.includes('not affected sessions'));
 const privateDetail=await json(events+'/'+list.oldest.id+'?occurrence='+list.oldest.occurrence);assert.equal(privateDetail.event.sdkSession,sids[0]);assert.equal(privateDetail.event.sentry.contexts.session,'[redacted]','generic session evidence remains scrubbed');
 const packet=JSON.stringify(await json(root+'/issues/'+issue.id+'/packet'));for(const sid of sids)assert.ok(!packet.includes(sid),'private session references never expand agent packet scope');
 assert.ok(!JSON.stringify(impact).includes('synthetic-spool-user'),'issue impact never exposes a user identity or session DID');
 assert.equal(list.recommended.id,'3'.padStart(32,'0'),'the most complete recent capture is recommended over a newer lean capture');assert.equal(list.latest.id,'5'.padStart(32,'0'));
 const filtered=await json(events+'?q='+encodeURIComponent('tenant:acme release:synthetic-spool-1'));assert.equal(filtered.recommended.id,'1'.padStart(32,'0'),'recommendation obeys the entire event query');
 for(const headers of [{Cookie:''},{Cookie:'',Authorization:'Bearer '+project.ingestKey}]){const response=await req(root+'/issues/'+issue.id+'/impact','GET',undefined,headers);assert.ok([401,403].includes(response.status));await response.body?.cancel()}
 const foreign=await req(root+'/issues/does-not-exist/impact');assert.equal(foreign.status,404);await foreign.body?.cancel();
 const other=await json('/api/projects','POST',{id:'synthetic-spool-impact-other',name:'Synthetic foreign project'}),otherRoot='/api/projects/'+other.id;
 const cross=await req(otherRoot+'/issues/'+issue.id+'/impact');assert.equal(cross.status,404);await cross.body?.cancel();
 const agent=await json(root+'/keys','POST',{kind:'agent'});const agentRead=await req(root+'/issues/'+issue.id+'/impact','GET',undefined,{Cookie:'',Authorization:'Bearer '+agent.key});assert.equal(agentRead.status,403);await agentRead.body?.cancel();
 await readScreens(origin,cookie,[{name:'issue-impact',path:`/projects/${project.id}/issues/${issue.id}`,check:async page=>{
  const selected=page.locator('.metadata[data-event-id]');await page.waitForFunction(id=>document.querySelector('.metadata[data-event-id]')?.getAttribute('data-event-id')===id,list.recommended.id);
  await page.getByRole('button',{name:'Latest',exact:true}).click();await page.waitForFunction(id=>document.querySelector('.metadata[data-event-id]')?.getAttribute('data-event-id')===id,list.latest.id);
  await page.getByRole('button',{name:'Recommended',exact:true}).click();await page.waitForFunction(id=>document.querySelector('.metadata[data-event-id]')?.getAttribute('data-event-id')===id,list.recommended.id);assert.ok((await selected.innerText()).includes('ImpactError: synthetic-spool-3'));assert.equal(new URL(page.url()).searchParams.get('occurrence'),list.recommended.occurrence);
  const view=page.getByRole('region',{name:'Issue impact',exact:true});await view.getByText('Retained events',{exact:true}).waitFor();const facts=Object.fromEntries(await view.locator('dl > div').evaluateAll(rows=>rows.map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent])));assert.equal(facts['Retained events'],'5');assert.equal(facts['Affected users'],'2');assert.equal(facts['Affected sessions'],'4');assert.equal(facts['Without a session link'],'0');assert.equal(facts['Without a user key'],'1');assert.equal(facts['Events per hour · last 24 hours'],'0.21');
  await view.locator('.issue-release-history > summary').click();assert.ok((await view.innerText()).includes('1 events without a release'));assert.equal(await view.locator('h3').count(),2);assert.ok((await view.innerText()).includes('75.0% crash-free sessions'));assert.ok((await view.innerText()).includes('1 session items without a release'));
  await view.getByText('Impact coverage and sessions',{exact:true}).click();await view.getByText(impact.sessionCoverage,{exact:true}).waitFor();
 }}]);
 // A private archive restores the exact references with their event custody.
 const snapshot=await archiveProjection(await req('/api/archive'));const archived=snapshot.data.events.filter(row=>row.project===project.id);assert.equal(archived.length,5);assert.ok(archived.every(row=>JSON.parse(row.payload).sdkSession));
 const restored=await startTestWorker(15542);
 try{const restoredCookie=await signIn(restored.origin),restore=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Origin:restored.origin,Cookie:restoredCookie,'Content-Type':'application/x-ndjson','x-confirm-restore':'yes'},body:snapshot.text});assert.equal(restore.status,200,await restore.text());const reply=await fetch(restored.origin+root+'/issues/'+issue.id+'/impact',{headers:{Cookie:restoredCookie}});assert.equal(reply.status,200);const read=await reply.json();assert.deepEqual([read.events,read.affectedSessions,read.users.affectedUsers],[5,4,2]);assert.deepEqual(read.sessions,impact.sessions);assert.deepEqual(read.releases,impact.releases)}finally{await restored.stop()}
 // A valid-looking session in another project, and wrong release or environment,
 // cannot establish an association. Missing links never become an invented zero.
 const foreignSid=crypto.randomUUID().replaceAll('-',''),foreignDsn=new URL(other.dsn);
 const foreignSession=await req(`/api/${foreignDsn.pathname.slice(1)}/envelope/?sentry_key=${foreignDsn.username}&sentry_version=7`,'POST','{}\n{"type":"session"}\n'+JSON.stringify({sid:foreignSid,started,timestamp:started,status:'exited',attrs:{release:'synthetic-spool-2',environment:'test'}}));assert.equal(foreignSession.status,200);await foreignSession.body?.cancel();
 for(const [n,context,release,environment] of [[6,undefined,'synthetic-spool-2','test'],[7,{sid:foreignSid},'synthetic-spool-2','test'],[8,{sid:sids[0]},'synthetic-spool-2','test'],[9,{sid:sids[1]},'synthetic-spool-2','other'],[10,{sid:'-'+sids[0]},'synthetic-spool-1','test']])await send('event',{event_id:n.toString(16).padStart(32,'0'),release,environment,contexts:context?{session:context}:{},platform:'python',tags:{tenant:'other'},exception:{values:[{type:'ImpactError',value:'synthetic-spool-'+n,stacktrace:{frames:[{filename:'/app/impact.py',function:'checkout',lineno:8,in_app:true}]}}]}});
 const incomplete=await json(root+'/issues/'+issue.id+'/impact');assert.equal(incomplete.events,10);assert.equal(incomplete.affectedSessions,null);assert.deepEqual(incomplete.sessions,{events:10,linkedEvents:5,unlinkedEvents:5,knownAffected:4});assert.equal(incomplete.users.affectedUsers,2,'session identities never populate event user identity');assert.equal(incomplete.users.unattributed,6);
 // Dropping identity immediately changes the read; no cached user inference survives.
 const dropped={id:'drop',email:'drop',username:'drop',ip_address:'drop'},current=await json(root+'/identity-policy'),dropPreview=await json(root+'/identity-policy/preview','POST',{policy:dropped});await json(root+'/identity-policy','PUT',{revision:current.revision,policy:dropped,token:dropPreview.token});
 const after=await json(root+'/issues/'+issue.id+'/impact');assert.equal(after.users.affectedUsers,null);assert.equal(after.users.unattributed,10);assert.equal(after.events,10);
 const cutoff=Date.now();assert.equal((await json(root+'/retention','POST',{cutoff,apply:false})).events,10);assert.equal((await json(root+'/retention','POST',{cutoff,apply:true})).events,10);
 const expired=await json(root+'/issues/'+issue.id+'/impact');assert.deepEqual([expired.events,expired.firstSeen,expired.lastSeen,expired.users.affectedUsers,expired.users.unattributed,expired.rate.events],[0,null,null,null,0,0]);assert.equal(expired.affectedSessions,0);assert.deepEqual(expired.releases,{noReleaseEvents:0,rows:[]});assert.deepEqual(expired.retention,{appliedCutoff:cutoff,removedProjectEvents:10});
 await readScreens(origin,cookie,[{name:'issue-impact-expired',path:`/projects/${project.id}/issues/${issue.id}`,check:async page=>{const view=page.getByRole('region',{name:'Issue impact',exact:true});await view.getByText('Retained events',{exact:true}).waitFor();assert.equal(await view.getByText('No retained occurrence',{exact:true}).count(),2);await view.getByText('Impact coverage and sessions',{exact:true}).click();assert.ok((await view.innerText()).includes('Project retention has removed 10 events'))}}]);
 const plan=await json(root+'/erasure');await followErasure(json,await json(root+'/erasure','POST',{confirm:project.id,planHash:plan.planHash}));
 const erased=await req(root+'/issues/'+issue.id+'/impact');assert.equal(erased.status,404);await erased.body?.cancel();
 const replay=await req(path,'POST','{}\n{"type":"event"}\n'+JSON.stringify({event_id:sent[0],platform:'python',message:'synthetic-spool-replay'}));assert.equal(replay.status,401,'erased project credentials cannot resurrect impact');await replay.body?.cancel();
 console.log('FIND-002 issue impact: all retained events, shared SDK-008 users, release exclusions, rate, project session denominators and query-scoped recommendation passed at 1440 and 390; explicit session association and truthful missing or foreign link coverage passed.');
}
