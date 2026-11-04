import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {accessToken,autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

// Qualify the signed Business boundary through the emitted production Worker.
// Native records and approvals remain real; this adds no identity-provider claim.
export async function identityContract(app){
 let id=0;
 const challenge=`Bearer resource_metadata="${app.canonicalOrigin}/.well-known/oauth-protected-resource/mcp"`;
 const raw=async(method,params,token,{version='2026-07-28',mismatch=false,query=''}={})=>{
  const response=await fetch(app.origin+'/mcp'+query,{method:'POST',headers:{
   Origin:app.origin,Connection:'close','Content-Type':'application/json',Accept:'application/json, text/event-stream',
   ...(token?{Authorization:'Bearer '+token}:{}),
   ...(version?{'MCP-Protocol-Version':version}:{}),
   'Mcp-Method':mismatch?'synthetic-spool-mismatch':method,
   ...(params.name?{'Mcp-Name':params.name}:{}),
  },body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params:{...params,_meta:{'io.modelcontextprotocol/protocolVersion':version??'2025-11-25'}}})});
  return {status:response.status,headers:response.headers,body:await response.json()};
 };
 const issueState=rows=>rows.map(({id,project,state,revision,count})=>({id,project,state,revision,count}));
 const done=answer=>{
  assert.equal(answer.status,200);
  assert.equal(answer.body.result?.isError,false,JSON.stringify(answer.body));
  return answer.body.result.structuredContent;
 };
 for(const [phase,policy] of [['autonomous',autonomousPolicy],['held',heldPolicy]]){
  await app.adopt(policy());
  const project='synthetic-spool-identity-'+phase;
  const created=await app.json('/api/projects','POST',{id:project,name:project});
  await app.json(`/api/projects/${project}/releases`,'POST',{name:'synthetic-spool-1',build:'synthetic-spool-1'});
  const admitted=await app.json('/api/ingest/'+project,'POST',{
   version:1,eventId:'synthetic-spool-identity-'+phase,release:'synthetic-spool-1',build:'synthetic-spool-1',environment:'production',
   type:'TypeError',message:'synthetic-spool-identity',frames:[{file:'https://checkout.example/app.js',line:1,column:0,function:'total'}],breadcrumbs:[],
  },{Authorization:'Bearer '+created.ingestKey});
  const issue=admitted.issue;
  const snapshot=async()=>({
   issues:await app.json(`/api/projects/${project}/issues`),
   occurrences:await app.json(`/api/projects/${project}/issues/${issue}/occurrences`),
   approvals:await app.json('/agents/api/approvals'),
  });
  const before=await snapshot();
  assert.equal(before.issues.length,1,'Refusal proof has one captured issue');
  assert.equal(before.issues[0].id,issue);
  assert.equal(before.issues[0].state,'open');
  assert.equal(before.occurrences.total,1);
  assert.equal(before.occurrences.rows[0].id,'synthetic-spool-identity-'+phase);
  const args={project,issue,state:'suppressed',revision:before.issues[0].revision,idempotency_key:randomUUID()};

  for(const method of ['initialize','server/discover','tools/list','tools/call']){
   for(const token of [null,'synthetic-spool-invalid']){
    for(const version of [null,'2025-11-25','2026-07-28','2099-01-01']){
     const answer=await raw(method,method==='tools/call'?{name:'spool.issues.update',arguments:args}:{},token,{version,mismatch:true});
     assert.equal(answer.status,401,`${phase} ${method}: authentication precedes transport negotiation`);
     assert.equal(answer.headers.get('www-authenticate'),challenge);
     assert.equal(answer.body.error?.code,-32001);
     assert.equal(answer.body.result,undefined,'Unauthenticated requests return no result');
    }
   }
  }
  assert.deepEqual(await snapshot(),before,'Missing and invalid credentials change neither product records nor approvals');
  console.log(`PROBE BASE-AGENT-004 1 ${phase}: unauthenticated MCP methods with absent, supported and unsupported versions and mismatched method header -> 401 resource_metadata before negotiation; native state unchanged`);

  const metadataResponse=await fetch(app.origin+'/.well-known/oauth-protected-resource/mcp');
  assert.equal(metadataResponse.status,200,'Resource metadata is available without a token');
  const metadata=await metadataResponse.json();
  assert.equal(metadata.resource,app.canonicalOrigin+'/mcp');
  assert.deepEqual(metadata.authorization_servers,[app.context.signer.issuer]);
  assert.deepEqual(metadata.bearer_methods_supported,['header']);
  const readToken=await accessToken(app.context,{scope:'spool:evidence'});
  const listed=await raw('tools/list',{},readToken);
  assert.equal(listed.status,200);
  const tools=listed.body.result.tools;
  assert.ok(tools.some(tool=>tool.name==='spool.issues.list'&&tool.annotations.readOnlyHint));
  const write=tools.find(tool=>tool.name==='spool.issues.update');
  assert.ok(write&&!write.annotations.readOnlyHint,'The challenged write is an offered native action');
  const required=write._meta['com.runeditrun/scope'];
  assert.equal(required,'spool:issues');
  assert.deepEqual(metadata.scopes_supported,[...new Set(tools.map(tool=>tool._meta['com.runeditrun/scope']))].sort(),'Metadata identifies every served scope');
  const read=done(await raw('tools/call',{name:'spool.issues.list',arguments:{project}},readToken));
  assert.deepEqual(issueState(read.items),issueState(before.issues),'A valid read-only Business token reads the actual captured issue');
  console.log(`PROBE BASE-AGENT-004 1 metadata ${phase}: anonymous resource metadata -> canonical MCP audience, paired trusted issuer and exact served scopes; scoped read -> known native issue`);

  const iat=Math.floor(Date.now()/1000)-30;
  for(const [kind,claims] of [['expired',{iat:iat-600,exp:iat-60}],['overlong',{iat,exp:iat+901}]]){
   const answer=await raw('tools/call',{name:write.name,arguments:args},await accessToken(app.context,claims));
   assert.equal(answer.status,401,`${phase} ${kind} signed token is refused`);
   assert.equal(answer.headers.get('www-authenticate'),challenge);
   assert.equal(answer.body.error?.code,-32001);
   assert.equal(answer.body.result,undefined);
   assert.deepEqual(await snapshot(),before,`${kind} token changes no product record or approval`);
  }
  for(const aud of ['https://synthetic-spool-sibling.invalid/mcp',app.canonicalOrigin+'/other']){
   const answer=await raw('tools/call',{name:write.name,arguments:args},await accessToken(app.context,{aud}));
   assert.equal(answer.status,401,'A signed token for a different canonical audience is refused');
   assert.equal(answer.headers.get('www-authenticate'),challenge);
   assert.deepEqual(await snapshot(),before,'Foreign audience changes no native record or approval');
  }
  console.log(`PROBE BASE-AGENT-004 2 ${phase}: signed foreign-audience tokens attempt native write -> 401 and unchanged product; current-audience read -> captured issue. Real sibling-seed delivery remains unqualified`);
  const queryToken=await accessToken(app.context);
  await app.json('/__fixture/log-probe');
  assert.ok(app.logs.some(line=>line.includes('synthetic-spool-log-probe')),'The observer receives actual Worker console output');
  for(const token of [null,readToken]){
   const answer=await raw('tools/call',{name:write.name,arguments:args},token,{query:'?access_token='+encodeURIComponent(queryToken)});
   assert.equal(answer.status,401,'A query token refuses even with a valid header');
   assert.equal(answer.headers.get('www-authenticate'),challenge);
   assert.equal(JSON.stringify(answer.body).includes(queryToken),false,'The challenge never reflects the query token');
   assert.deepEqual(await snapshot(),before,'Query credentials change no native record or approval');
  }
  const logged=JSON.stringify({worker:app.logs,door:await app.json('/agents/api/audit'),native:await app.json('/api/audit')});
  assert.equal(logged.includes(queryToken),false,'Worker console and native audit retain no query token');
  console.log(`PROBE BASE-AGENT-004 5 ${phase}: query credentials alone and alongside a valid header -> 401, unchanged records and approvals, token absent from captured Worker console, native audit and response`);
  const bounded=await accessToken(app.context,{iat,exp:iat+900,scope:'spool:evidence'});
  assert.deepEqual(done(await raw('tools/call',{name:'spool.issues.list',arguments:{project}},bounded)).items,read.items,'A still-valid token with a 900-second lifetime works');
  console.log(`PROBE BASE-AGENT-004 3 ${phase}: signed expired and 901-second tokens attempt native issue update -> 401 and unchanged records and approvals; valid 900-second scoped token -> captured issue`);

  const denied=await raw('tools/call',{name:write.name,arguments:args},readToken);
  assert.equal(denied.status,403);
  assert.equal(denied.body.error?.data?.code,'insufficient_scope');
  assert.equal(denied.body.result,undefined);
  assert.equal(denied.headers.get('www-authenticate'),`Bearer error="insufficient_scope", scope="${required}", resource_metadata="${app.canonicalOrigin}/.well-known/oauth-protected-resource/mcp"`,'One challenge names every scope required by this write');
  assert.deepEqual(await snapshot(),before,'Read-only scope cannot mutate the issue or queue an approval');

  const scoped=await accessToken(app.context,{scope:required});
  const allowed=await raw('tools/call',{name:write.name,arguments:args},scoped);
  assert.equal(allowed.status,200);
  if(phase==='held'){
   assert.equal(allowed.body.result.resultType,'input_required');
   const reference=allowed.body.result._meta['com.runeditrun/approval'];
   assert.ok(reference?.id,'A correctly scoped write reaches company approval');
   assert.deepEqual(await app.json(`/api/projects/${project}/issues`),before.issues,'Company approval still holds a correctly scoped write without mutation');
   const approval=(await app.json('/agents/api/approvals/'+reference.id)).approval;
   const decided=await app.json('/agents/api/approvals/'+reference.id+'/approve','POST',{revision:approval.revision,summary_sha256:approval.summary_sha256});
   assert.equal(decided.approval.state,'executed');
  }else done(allowed);
  const after=await app.json(`/api/projects/${project}/issues`);
  assert.equal(after[0].id,issue);
  assert.equal(after[0].state,'suppressed','The same native write succeeds with its required scope and company authority');
  assert.equal(after[0].revision,before.issues[0].revision+1,'The valid control updates exactly once');
  assert.deepEqual(issueState(done(await raw('tools/call',{name:'spool.issues.list',arguments:{project}},readToken)).items),issueState(after),'A read-only token can read the resulting native state');
  console.log(`PROBE BASE-AGENT-004 4 ${phase}: read-only token calls native issue update -> 403 insufficient_scope naming ${required}, unchanged product and approval state; exact-scope retry -> ${phase==='held'?'pending, native approval, ':''}suppressed exactly once`);
  for(const boundary of ['seed','business']){
   const consent='synthetic-spool-consent-'+phase+'-'+boundary;
   const identity={consent,act:{sub:'synthetic-spool-agent-'+phase+'-'+boundary,name:'Synthetic Spool agent',specialist:app.context.surface.specialist}};
   const token=await accessToken(app.context,identity);
   assert.equal(done(await raw('tools/call',{name:'spool.issues.list',arguments:{project}},token)).items[0].id,issue,'Consent is live before retirement');
   const current=(await app.json(`/api/projects/${project}/issues`))[0];
   const attempted={project,issue,state:'open',revision:current.revision,idempotency_key:randomUUID()};
   const accepted=await raw('tools/call',{name:write.name,arguments:attempted},token);
   let pending;
   if(phase==='held'){
    assert.equal(accepted.body.result.resultType,'input_required');
    const ref=accepted.body.result._meta['com.runeditrun/approval'];
    pending=(await app.json('/agents/api/approvals/'+ref.id)).approval;
   }else assert.equal(done(accepted).state,'open');
   const retiredState=await snapshot();
   const started=Date.now();
   if(boundary==='seed'){
    const path='/agents/api/consents/'+encodeURIComponent(consent)+'/revoke';
    for(const [headers,status] of [[{Cookie:''},401],[{Authorization:'Bearer '+token},403],[{Origin:'https://foreign.invalid'},403]]){
     const refused=await app.request(path,'POST',{},headers);assert.equal(refused.status,status);await refused.body?.cancel();
    }
    assert.equal(done(await raw('tools/call',{name:'spool.issues.list',arguments:{project}},token)).items[0].id,issue,'Unauthorized retirement does not revoke consent');
    assert.deepEqual(await app.json(path,'POST',{}),{revoked:true});
    assert.deepEqual(await app.json(path,'POST',{}),{revoked:true},'Retirement is idempotent');
   }else await app.adopt(policy(),{revoked:{agents:[],consents:[consent]}});
   for(const method of ['initialize','server/discover','tools/list','tools/call']){
    const answer=await raw(method,method==='tools/call'?{name:write.name,arguments:attempted}:{},token);
    assert.equal(answer.status,401,'Retired consent refuses the next MCP method');
    assert.equal(answer.headers.get('www-authenticate'),challenge);
   }
   assert.ok(Date.now()-started<60000,'The receiving boundary refuses within sixty seconds');
   assert.deepEqual((await snapshot()).issues,retiredState.issues,'Retired consent and replay change no native issue');
   assert.deepEqual((await snapshot()).occurrences,retiredState.occurrences);
   if(pending){
    const response=await app.request('/agents/api/approvals/'+pending.id+'/approve','POST',{revision:pending.revision,summary_sha256:pending.summary_sha256});
    const result=await response.json();
    if(boundary==='business'){
     assert.equal(response.status,409);assert.equal(result.code,'approval_expired','Signed Business retirement expires its pending approval');
    }else{
     assert.equal(response.status,200);assert.equal(result.approval.state,'refused');assert.equal(result.approval.code,'sponsor_unavailable','Native retirement refuses held execution');
    }
    assert.deepEqual(await app.json(`/api/projects/${project}/issues`),retiredState.issues);
   }
   const other=await accessToken(app.context,{...identity,consent:'synthetic-spool-independent-'+phase+'-'+boundary});
   assert.equal(done(await raw('tools/call',{name:'spool.issues.list',arguments:{project}},other)).items[0].id,issue,'Independent consent for the same agent remains readable');
   await app.restart();
   assert.equal((await raw('tools/list',{},await accessToken(app.context,identity))).status,401,'Fresh tokens with retired consent remain refused after restart');
   const replacement={...identity,act:{...identity.act,sub:randomUUID()}};
   assert.equal((await raw('tools/list',{},await accessToken(app.context,replacement))).status,401,'Changing the agent cannot revive the retired consent');
   if(boundary==='seed'){
    await app.adopt(policy());
    assert.equal((await raw('tools/list',{},await accessToken(app.context,identity))).status,401,'A policy renewal cannot revive a locally retired consent');
   }
   console.log(`PROBE BASE-AGENT-004 6 ${phase} ${boundary}: ${boundary==='seed'?'owner-only native retirement':'signed Business revocation delivery'} -> next MCP methods and replay refused, held execution has no effect, independent consent works, retirement survives restart`);
  }
 }
 await app.adopt(autonomousPolicy());
}
