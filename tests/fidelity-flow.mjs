import assert from 'node:assert/strict';

export async function fidelityFlow({req,json}) {
 const project=await json('/api/projects','POST',{id:'fidelity',name:'Cedar checkout diagnostics'}),base='/api/projects/fidelity';
 await json(base+'/releases','POST',{name:'checkout@2.0.0',build:'web'});
 const dsn=new URL(project.dsn),path=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 let sequence=0;
 const frame=(name,line)=>({filename:'/app/checkout.py',function:name,lineno:line,in_app:true,pre_context:['order = load_order()'],context_line:'charge(order)',post_context:['return receipt'],vars:{password:'PRIVATE_PASSWORD',api_key:'PRIVATE_API_KEY',order_id:'order-123',nested:{authorization:'PRIVATE_NESTED',items:3}}});
 const chain=(type='KeyError',tenant='acme')=>({event_id:(++sequence).toString(16).padStart(32,'0'),release:'checkout@2.0.0',dist:'web',platform:'python',environment:'production',exception:{values:[{type,value:'Missing checkout account',stacktrace:{frames:[frame('load_account',8)]},mechanism:{type:'chained',handled:false}},{type:'CheckoutError',value:'Unable to charge order',stacktrace:{frames:[frame('checkout',20)]},mechanism:{type:'generic',handled:false}}]},tags:{tenant},contexts:{browser:{name:'Chrome',version:'130'},os:{name:'macOS'}},request:{url:'https://cedar.example/checkout?token=PRIVATE_URL',method:'POST',headers:{Authorization:'PRIVATE_AUTH',Cookie:'PRIVATE_COOKIE','X-Request-ID':'request-123'},cookies:'PRIVATE_COOKIES',data:'PRIVATE_BODY'},extra:{payment_token:'PRIVATE_EXTRA',cart_items:3},user:{email:'PRIVATE_USER@example.com'}});
 const send=async value=>{const response=await req(path,'POST',JSON.stringify({event_id:value.event_id})+'\n{"type":"event"}\n'+JSON.stringify(value));assert.equal(response.status,200,await response.text());return value};
 const first=await send(chain()),second=await send(chain('ValueError'));
 let issues=await json(base+'/issues');assert.equal(issues.length,2,'same wrapper with distinct causes has distinct issues');
 assert.equal((await json(base+'/alerts')).filter(a=>a.kind==='new_issue').length,2,'both root causes alert');
 const found=await json(base+'/issue-search?q='+encodeURIComponent('tenant:acme browser.name:Chrome error.type:KeyError'));assert.equal(found.total,1);assert.ok(found.facets.tags.some(t=>t.key==='tenant'&&t.value==='acme'&&t.count===1));
 const issue=found.rows[0].id,eventBase=base+'/issues/'+issue+'/events';
 for(let i=0;i<29;i++)await send(chain('KeyError',i%2?'other':'acme'));
 const list=await json(eventBase);assert.equal(list.total,30);assert.equal(list.rows.length,25);assert.ok(list.next);
 const next=await json(eventBase+'?cursor='+encodeURIComponent(list.next));assert.equal(next.rows.length,5);assert.equal(new Set([...list.rows,...next.rows].map(e=>e.occurrence)).size,30);
 assert.equal(list.oldest.id,first.event_id);assert.equal(list.latest.id,sequence.toString(16).padStart(32,'0'));
 const tag=list.tags.rows.find(t=>t.key==='tenant'&&t.value==='acme');assert.equal(tag.count,16);assert.equal(tag.percent,100*16/30);
 const detail=await json(eventBase+'/'+list.oldest.id+'?occurrence='+list.oldest.occurrence);
 assert.equal(detail.event.sentry.exceptions.length,2);assert.equal(detail.event.sentry.exceptions[0].stacktrace.frames[0].vars.order_id,'order-123');assert.equal(detail.event.sentry.exceptions[0].stacktrace.frames[0].context_line,'charge(order)');assert.equal(detail.event.sentry.tags['browser.name'],'Chrome');assert.equal(detail.event.sentry.extra.cart_items,3);assert.equal(detail.event.sentry.request.method,'POST');assert.ok(detail.next);assert.equal(detail.previous,null);
 for(const canary of ['PRIVATE_PASSWORD','PRIVATE_API_KEY','PRIVATE_NESTED','PRIVATE_AUTH','PRIVATE_COOKIE','PRIVATE_BODY','PRIVATE_EXTRA','PRIVATE_USER','PRIVATE_URL'])assert.ok(!JSON.stringify(detail).includes(canary),canary+' scrubbed at owner read');
 const packet=await json(base+'/issues/'+issue+'/packet');assert.equal(packet.events[0].event.sentry.exceptions.length,2);assert.ok(!JSON.stringify(packet).includes('charge(order)'));assert.ok(!JSON.stringify(packet).includes('order-123'),'locals excluded from agent packet');
 assert.equal((await req(eventBase,'GET',undefined,{Cookie:''})).status,401);
 const grant=await json(base+'/keys','POST',{kind:'agent'});assert.equal((await req(eventBase,'GET',undefined,{Cookie:'',Authorization:'Bearer '+grant.key})).status,403,'agent cannot acquire owner local-variable scope');
 assert.equal((await req(eventBase+'/'+second.event_id+'?occurrence='+list.oldest.occurrence)).status,404,'exact issue and occurrence checked');
 const filtered=await json(eventBase+'?q=tenant:acme');assert.equal(filtered.total,16);assert.equal((await req(eventBase+'?q=tenant:acme&cursor='+encodeURIComponent(list.next))).status,400);
 const grouped=chain();grouped.exception.values=[{type:'ValueError',value:'child one',mechanism:{exception_id:1,parent_id:0},stacktrace:{frames:[frame('child_one',30)]}},{type:'TypeError',value:'child two',mechanism:{exception_id:2,parent_id:0},stacktrace:{frames:[frame('child_two',35)]}},{type:'ExceptionGroup',value:'parallel checkout',mechanism:{is_exception_group:true,exception_id:0},stacktrace:{frames:[frame('parallel',40)]}}];await send(grouped);
 const message={event_id:(++sequence).toString(16).padStart(32,'0'),release:'checkout@2.0.0',dist:'web',level:'warning',logentry:{message:'quota exceeded for %s',params:['checkout'],formatted:'quota exceeded for checkout'}};await send(message);await send({...message,event_id:(++sequence).toString(16).padStart(32,'0'),logentry:{...message.logentry,params:['billing'],formatted:'quota exceeded for billing'}});
 const messages=await json(base+'/issue-search?q='+encodeURIComponent('message:"quota exceeded"'));assert.equal(messages.total,1);assert.equal(messages.rows[0].count,2,'message template groups parameter variants');
 const recursion=chain('RecursionError');recursion.exception.values=[{type:'RecursionError',value:'recursion',stacktrace:{frames:Array.from({length:1200},(_,i)=>({filename:'/app/recursion.py',function:'recurse',lineno:i+1}))}}];await send(recursion);
 const recursiveIssue=(await json(base+'/issue-search?q=error.type:RecursionError')).rows[0].id,recursiveList=await json(base+'/issues/'+recursiveIssue+'/events');const recursiveDetail=await json(base+'/issues/'+recursiveIssue+'/events/'+recursion.event_id+'?occurrence='+recursiveList.latest.occurrence);assert.equal(recursiveDetail.event.sentry.exceptions[0].stacktrace.frames.length,1000);assert.ok(recursiveDetail.event.sentry.truncation.some(t=>t.omitted===200));
 const java=chain('IllegalStateException');java.platform='java';java.exception.values[0].stacktrace.frames=[{filename:'Checkout.java',module:'com.cedar.Checkout',function:'charge',lineno:12}];await send(java);
 console.log('Sentry fidelity public flow passed: chains/groups/message events, root-cause alerts, retained selection/pagination/tags, privacy and agent scope, 1,000-frame retention and Java chain.');
}
