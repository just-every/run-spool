import assert from 'node:assert/strict';
import {archiveProjection} from './archive.mjs';
import {launchBrowser} from './browser-launch.mjs';
import {browserSignIn} from './auth.mjs';

export async function fidelityFlow({req,json,origin,db}) {
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
 for(let i=0;i<29;i++){
  const event=chain('KeyError',i%2?'other':'acme');
  event.contexts.browser.name=(i+1)%3?'Chrome':'Firefox';
  event.contexts.os.name=(i+1)%5?'macOS':'Linux';
  await send(event);
 }
 const list=await json(eventBase);assert.equal(list.total,30);assert.equal(list.rows.length,25);assert.ok(list.next);
 const next=await json(eventBase+'?cursor='+encodeURIComponent(list.next));assert.equal(next.rows.length,5);assert.equal(new Set([...list.rows,...next.rows].map(e=>e.occurrence)).size,30);
 assert.equal(list.oldest.id,first.event_id);assert.equal(list.latest.id,sequence.toString(16).padStart(32,'0'));
 const tag=list.tags.rows.find(t=>t.key==='tenant'&&t.value==='acme');assert.equal(tag.count,16);assert.equal(tag.percent,100*16/30);
 assert.equal(list.tags.events,30,'tag summary spans both cursor pages');
 const expectedTags={tenant:[['acme',16],['other',14]],'browser.name':[['Chrome',21],['Firefox',9]],'os.name':[['macOS',25],['Linux',5]]};
 for(const [key,values] of Object.entries(expectedTags))assert.deepEqual(list.tags.rows.filter(row=>row.key===key),values.map(([value,count])=>({key,value,count,percent:100*count/30})));
 const combined=await json(eventBase+'?q='+encodeURIComponent('tenant:acme browser.name:Chrome'));
 assert.equal(combined.total,11,'both tag predicates match the same event');
 assert.deepEqual(combined.tags,list.tags,'filtered event lists retain whole-issue summary counts and percentages');
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
 const stored=await db.prepare('SELECT payload FROM events WHERE project=? AND id=? AND occurrence=?').bind('fidelity',first.event_id,list.oldest.occurrence).first();
 assert.ok(stored,'the admitted chain has a stored occurrence');
 const storedFrame=JSON.parse(stored.payload).sentry.exceptions[0].stacktrace.frames[0];
 assert.equal(storedFrame.vars.password,'[redacted]','masking occurs before storage, not just at the owner read');
 assert.equal(storedFrame.vars.order_id,'order-123');
 const archive=await archiveProjection(await req('/api/archive'));
 const exported=archive.data.events.find(row=>row.project==='fidelity'&&row.id===first.event_id&&row.occurrence===list.oldest.occurrence);
 assert.ok(exported,'the nonempty private export carries this exact occurrence');
 assert.equal(JSON.parse(exported.payload).sentry.exceptions[0].stacktrace.frames[0].vars.password,'[redacted]');
 assert.equal(JSON.parse(exported.payload).sentry.exceptions[0].stacktrace.frames[0].vars.order_id,'order-123');
 for(const text of [stored.payload,exported.payload])for(const secret of ['PRIVATE_PASSWORD','PRIVATE_API_KEY','PRIVATE_NESTED'])assert.ok(!text.includes(secret),'storage and private exports contain no secret local');
 const packet=await json(base+'/issues/'+issue+'/packet');assert.equal(packet.events[0].event.sentry.exceptions.length,2);assert.ok(!JSON.stringify(packet).includes('charge(order)'));assert.ok(!JSON.stringify(packet).includes('order-123'),'locals excluded from agent packet');
 assert.ok(!JSON.stringify(packet).includes('PRIVATE_PASSWORD'),'the packet never exposes a password local');
 assert.equal((await req(eventBase,'GET',undefined,{Cookie:''})).status,401);
 const grant=await json(base+'/keys','POST',{kind:'agent'});assert.equal((await req(eventBase,'GET',undefined,{Cookie:'',Authorization:'Bearer '+grant.key})).status,403,'agent cannot acquire owner local-variable scope');
 assert.equal((await req(eventBase+'/'+second.event_id+'?occurrence='+list.oldest.occurrence)).status,404,'exact issue and occurrence checked');
 const agentHeaders={Cookie:'',Authorization:'Bearer '+grant.key},packetPath=base+'/issues/'+issue+'/packet';
 const permittedPacket=await json(packetPath,'GET',undefined,agentHeaders);
 for(const local of ['PRIVATE_PASSWORD','order-123','charge(order)'])assert.ok(!JSON.stringify(permittedPacket).includes(local),'an authorized agent receives no frame-local or SDK source context');
 await json(base+'/keys/'+grant.hash,'DELETE');
 for(const door of [eventBase,packetPath])assert.equal((await req(door,'GET',undefined,agentHeaders)).status,401,'revocation closes rich detail and the sanitized packet immediately');
 assert.equal((await json(eventBase)).total,30,'credential revocation preserves the owner\'s captured events');
 const filtered=await json(eventBase+'?q=tenant:acme');assert.equal(filtered.total,16);assert.equal((await req(eventBase+'?q=tenant:acme&cursor='+encodeURIComponent(list.next))).status,400);
 const grouped=chain();grouped.exception.values=[{type:'ValueError',value:'child one',mechanism:{exception_id:1,parent_id:0},stacktrace:{frames:[frame('child_one',30)]}},{type:'TypeError',value:'child two',mechanism:{exception_id:2,parent_id:0},stacktrace:{frames:[frame('child_two',35)]}},{type:'ExceptionGroup',value:'parallel checkout',mechanism:{is_exception_group:true,exception_id:0},stacktrace:{frames:[frame('parallel',40)]}}];await send(grouped);
 const message={event_id:(++sequence).toString(16).padStart(32,'0'),release:'checkout@2.0.0',dist:'web',level:'warning',logentry:{message:'quota exceeded for %s',params:['checkout'],formatted:'quota exceeded for checkout'}};await send(message);await send({...message,event_id:(++sequence).toString(16).padStart(32,'0'),logentry:{...message.logentry,params:['billing'],formatted:'quota exceeded for billing'}});
 const messages=await json(base+'/issue-search?q='+encodeURIComponent('message:"quota exceeded"'));assert.equal(messages.total,1);assert.equal(messages.rows[0].count,2,'message template groups parameter variants');
 const anonymousBase=base+'/issues/'+messages.rows[0].id+'/events',anonymousList=await json(anonymousBase);
 const anonymous=await json(anonymousBase+'/'+anonymousList.latest.id+'?occurrence='+anonymousList.latest.occurrence);
 assert.ok(!anonymous.event.sentry.truncation.some(note=>note.path==='user'),'SDK-008 does not report identity exclusion when the SDK sent no user');
 const recursion=chain('RecursionError');recursion.exception.values=[{type:'RecursionError',value:'recursion',stacktrace:{frames:Array.from({length:1200},(_,i)=>({filename:'/app/recursion.py',function:'recurse',lineno:i+1}))}}];await send(recursion);
 const recursiveIssue=(await json(base+'/issue-search?q=error.type:RecursionError')).rows[0].id,recursiveList=await json(base+'/issues/'+recursiveIssue+'/events');const recursiveDetail=await json(base+'/issues/'+recursiveIssue+'/events/'+recursion.event_id+'?occurrence='+recursiveList.latest.occurrence);assert.equal(recursiveDetail.event.sentry.exceptions[0].stacktrace.frames.length,1000);assert.ok(recursiveDetail.event.sentry.truncation.some(t=>t.omitted===200));
 const browser=await launchBrowser();
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});await browserSignIn(page,origin);
  await page.goto(`${origin}/projects/fidelity/issues/${recursiveIssue}`);
  await page.getByText('exceptions.0.stacktrace.frames: 200 frames omitted · middle_frames',{exact:true}).waitFor();
  assert.equal(await page.locator('article.exception .exception-stack > li').count(),1000,'the owner view renders the retained frames and omission notice');
 }finally{await browser.close()}
 const java=chain('IllegalStateException');java.platform='java';java.exception.values[0].stacktrace.frames=[{filename:'Checkout.java',module:'com.cedar.Checkout',function:'charge',lineno:12}];await send(java);
 const longQuery=chain('QueryBoundError');longQuery.request.query_string='diagnostic='+encodeURIComponent('🧭'.repeat(6000))+'&token=PRIVATE_QUERY_LONG';await send(longQuery);
 const queryIssue=(await json(base+'/issue-search?q=error.type:QueryBoundError')).rows[0].id,queryRows=await json(base+'/issues/'+queryIssue+'/events');
 const queryDetail=await json(base+'/issues/'+queryIssue+'/events/'+longQuery.event_id+'?occurrence='+queryRows.latest.occurrence),boundedQuery=new URLSearchParams(queryDetail.event.sentry.request.query_string).get('diagnostic');
 assert.ok(boundedQuery.startsWith('🧭'));assert.ok(boundedQuery.endsWith('[truncated]'));assert.ok(!boundedQuery.includes('�'),'query trimming preserves UTF-8 characters');
 assert.ok(queryDetail.event.sentry.truncation.some(note=>note.path==='request.query_string'&&note.reason==='value_bytes'&&note.omitted>0),'query bound has an explicit omission note');assert.ok(!JSON.stringify(queryDetail).includes('PRIVATE_QUERY_LONG'));
 const rules=base+'/grouping-rules';await json(rules,'PUT',{revision:0,policy:{version:1,stack:'',fingerprint:'error.type:KeyError -> inner-account'}});
 const ruled=await send(chain()),ruledSearch=await json(base+'/issue-search?q='+encodeURIComponent('error.type:KeyError')),ruledIssue=ruledSearch.rows.find(row=>row.count===1),ruledRows=await json(base+'/issues/'+ruledIssue.id+'/events'),ruledDetail=await json(base+'/issues/'+ruledIssue.id+'/events/'+ruled.event_id+'?occurrence='+ruledRows.latest.occurrence);
 assert.equal(ruledDetail.event.sentry.exceptions[1].type,'CheckoutError');assert.equal(ruledDetail.grouping.projectFingerprintRule,1,'GROUP-001 rule matches inner cause beneath unchanged wrapper');assert.equal(ruledDetail.grouping.variant,'custom fingerprint');assert.ok(ruledDetail.grouping.exceptions.every(cause=>cause.frames.every(frame=>!frame.contributes)),'GROUP-001 replacement fingerprint explains excluded frames');
 console.log('SDK-010 request query strings are kept scrubbed and every exclusion is named; GROUP-001 fidelity flow passed: chains/groups/message events, root-cause alerts, retained selection/pagination/tags, privacy and agent scope, 1,000-frame retention and Java chain.');
}
