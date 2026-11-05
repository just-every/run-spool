import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {agentRuntime} from './runtime.mjs';
import {accessToken,autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

const code=result=>result?._meta?.['com.runeditrun/error']?.code;
const done=result=>{assert.equal(result?.isError,false,code(result));return result.structuredContent;};
async function nativeSponsor(app,{project,email,name,sub=randomUUID(),agentId=randomUUID()}){
 const invited=await app.json('/api/organization/invites','POST',{email,name,role:'member',grants:[{project,role:'member'}]});
 const message=(await app.mail()).find(row=>row.to?.includes(email));assert.ok(message,'Native invitation reaches the controlled mail edge');
 const token=message.text.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];assert.ok(token,'Native invitation contains a confirmation');
 const accepted=await app.request('/auth/confirm','POST',{token},{Cookie:''});assert.equal(accepted.status,303,'The invited native person confirms their own email');
 const cookie=accepted.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');await accepted.body?.cancel();
 await app.syncSettings([{id:sub,email,name,role:'member',invite:1}]);
 const member=(await app.json('/api/organization')).members.find(m=>m.id===invited.id);
 const claims={sub,email,act:{sub:agentId,name:'Scoped triage',specialist:'triage engineer'}};
 return {invited,member,claims,cookie};
}

const appendOnly=new Set(['agent_door_audit','agent_door_relay','spool_audit_events']);

// Observe the real ledger, including all product, membership, credential,
// approval, notification and mail tables. Only safe admission facts may grow.
async function snapshot(app){
 const tables=(await app.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all()).results.map(row=>row.name);
 const results=await app.DB.batch(tables.map(table=>app.DB.prepare('SELECT * FROM "'+table.replaceAll('"','""')+'"')));
 return Object.fromEntries(tables.map((table,index)=>[table,results[index].results.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]));
}
async function unchanged(app,before,{agent,calls,token,privateText,refusals}){
 const after=await snapshot(app);
 assert.deepEqual(Object.keys(after),Object.keys(before),'Agent refusals create no native tables');
 for(const [table,rows] of Object.entries(before)){
  if(appendOnly.has(table)){
   const current=new Map(after[table].map(row=>[row.sequence,row]));
   for(const row of rows)assert.ok(JSON.stringify(current.get(row.sequence))===JSON.stringify(row),table+' preserves every existing audit fact');
   const prior=new Set(rows.map(row=>row.sequence)),added=after[table].filter(row=>!prior.has(row.sequence));
   const text=JSON.stringify(added);
   assert.ok(!text.includes(token)&&!text.includes(privateText),'Refusal audit retains neither the bearer nor captured private text');
   if(table==='agent_door_audit'){
    assert.equal(added.length,refusals,'One safe door audit per admitted refusal');
    for(const entry of added){const row=JSON.parse(entry.row);assert.equal(row.agent.id,agent);assert.equal(row.outcome,'refused');assert.equal(row.code,'not_found');assert.equal(row.approval,null);assert.equal(row.review,null);assert.equal(entry.evidence,null);}
   }
   if(table==='spool_audit_events')for(const row of added){
    assert.equal(row.source,'request','Refused agent calls create no native transaction fact');
    assert.equal(row.action,'private.action');assert.ok([200,401].includes(row.status));
    assert.ok(['succeeded','denied'].includes(row.outcome));
    assert.match(row.actor_label,/^audit:[a-f0-9]{32}$/);assert.match(row.subject_label,/^audit:[a-f0-9]{32}$/);
   }
   if(table==='agent_door_relay'){
    assert.equal(added.length,refusals,'Relay adds only the corresponding refusal references');
    for(const row of added)assert.ok(after.agent_door_audit.some(a=>a.id===row.decision_id&&JSON.parse(a.row).outcome==='refused'));
   }
  }else if(table==='agent_door_agents'){
   const strip=rows=>rows.map(({window,requests,...row})=>row);
   assert.ok(JSON.stringify(strip(after[table]))===JSON.stringify(strip(rows)),'Admission cannot change agent authority or identity');
   for(const row of after[table]){
    const prior=rows.find(p=>p.id===row.id);
    if(row.id===agent&&calls){assert.ok(row.window>=prior.window);if(row.window===prior.window)assert.equal(row.requests,prior.requests+calls,'Only the required admission count changes');else assert.ok(row.requests>=1&&row.requests<=calls,'A minute rollover counts only these admitted calls');}
    else assert.ok(JSON.stringify(row)===JSON.stringify(prior),'Unadmitted and unrelated agent counters stay unchanged');
   }
  }else assert.ok(JSON.stringify(after[table])===JSON.stringify(rows),table+' stays unchanged after refused calls');
 }
}

/** Same unexpired Business bearer across native role and inactive changes. */
export async function sponsorRoleContract(){
 for(const mode of ['autonomous','held']){
  const app=await agentRuntime();
  try{
   await app.json('/api/organization','POST',{id:'synthetic-spool-company',name:'Sponsor authority qualification'});
   const project='synthetic-spool-sponsor-'+mode,privateText='synthetic-spool-private-'+mode;
   const created=await app.json('/api/projects','POST',{id:project,name:'Sponsor authority '+mode});
   await app.json('/api/projects/'+project+'/releases','POST',{name:'1.0.0',build:'web-1'});
   const captured=await app.json('/api/ingest/'+project,'POST',{version:1,eventId:'synthetic-spool-'+mode,release:'1.0.0',build:'web-1',environment:'production',type:'TypeError',message:privateText,frames:[{file:'https://checkout.example/app.js',line:1,column:0,function:'total'}],breadcrumbs:[]},{Authorization:'Bearer '+created.ingestKey});
   const email=['synthetic-spool-'+mode,'spool.test'].join('@');
   const {member,claims,cookie}=await nativeSponsor(app,{project,email,name:'Sponsor '+mode});
   // A real member-minted credential makes key retirement part of the ledger
   // witness, rather than a vacuous check against an empty credential table.
   const grant=await app.json('/api/projects/'+project+'/keys','POST',{kind:'agent'},{Cookie:cookie});
   await app.adopt(autonomousPolicy());
   const token=await accessToken(app.context,claims),expires=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).exp;
   // Keep this exact bearer across the native person changes. The existing
   // app.call helper mints a fresh token per call, so use the same public MCP
   // request directly without changing the shared runtime or people journey.
   const call=async(name,args,status=200)=>{
    const version='2026-07-28';
    const response=await app.request('/mcp','POST',{jsonrpc:'2.0',id:randomUUID(),method:'tools/call',params:{name,arguments:args,_meta:{'io.modelcontextprotocol/protocolVersion':version}}},{Authorization:'Bearer '+token,Cookie:'',Accept:'application/json, text/event-stream','MCP-Protocol-Version':version,'Mcp-Method':'tools/call','Mcp-Name':name});
    const body=await response.json();assert.equal(response.status,status,'Retained-bearer MCP status');
    return body.result??{httpStatus:response.status,error:body.error};
   };
   const read=()=>call('spool.issues.read',{project,issue:captured.issue});
   const initial=done(await read());assert.equal(initial.id,captured.issue);
   const write={project,issue:initial.id,revision:initial.revision,state:'acknowledged',idempotency_key:randomUUID()};
   done(await call('spool.issues.update',write));
   const authorized=done(await read());assert.equal(authorized.state,'acknowledged');assert.equal(authorized.revision,initial.revision+1,'The positive control persists one native triage write');
   assert.equal((await app.DB.prepare('SELECT revoked FROM credentials WHERE hash=?').bind(grant.hash).first()).revoked,null);
   if(mode==='held'){
    await app.adopt(heldPolicy());
    const held=await call('spool.issues.update',{...write,revision:authorized.revision,state:'suppressed',idempotency_key:randomUUID()});
    assert.equal(held.resultType,'input_required');
    const pending=held._meta['com.runeditrun/error']?.approval??held._meta['com.runeditrun/approval'];assert.ok(pending?.id,'The held fixture actually reaches company approval with an authorized member');
    assert.equal(done(await read()).state,'acknowledged','Holding the mutation leaves the completed triage state intact');
   }
   assert.ok(Date.now()/1000<expires,'The retained bearer is unexpired before the native downgrade');
   await app.json('/api/organization/members/'+member.id,'PUT',{version:member.version,role:'read-only',grants:[{project,role:'read-only'}]});
   const downgraded=await snapshot(app);
   assert.ok(downgraded.credentials.find(row=>row.hash===grant.hash).revoked,'The authorized downgrade retires the member key before refusal probes');
   const fresh={...write,revision:authorized.revision,state:mode==='held'?'suppressed':'open',idempotency_key:randomUUID()};
   assert.equal(code(await call('spool.issues.update',fresh)),'not_found','Next fresh mutation uses the current native read-only role');
   assert.equal(code(await call('spool.issues.update',write)),'not_found','Cached mutation replay rechecks the current native role');
   await unchanged(app,downgraded,{agent:claims.act.sub,calls:2,token,privateText,refusals:2});
   const permitted=done(await read());assert.equal(permitted.id,captured.issue);assert.equal(permitted.state,'acknowledged');assert.equal(permitted.revision,authorized.revision,'Read-only access remains available with the same bearer');
   console.log('PROBE BASE-AGENT-005 downgrade-'+mode+': same Business bearer, native member PUT to read-only -> fresh mutation and cached replay not_found, native ledger unchanged, populated read succeeds');
   await app.json('/api/organization/members/'+member.id,'DELETE',{version:member.version+1});
   const inactive=await snapshot(app);
   assert.equal(inactive.oa_operators.find(row=>row.id===member.operator_id).status,'inactive');
   assert.ok(Date.now()/1000<expires,'The original bearer is still unexpired after native deactivation');
   assert.equal((await call('spool.issues.read',{project,issue:captured.issue},401)).httpStatus,401,'Next call with the same bearer rejects the inactive sponsor');
   await unchanged(app,inactive,{agent:claims.act.sub,calls:0,token,privateText,refusals:0});
   console.log('PROBE BASE-AGENT-005 inactive-'+mode+': same unexpired Business bearer after native member DELETE -> next MCP read HTTP 401 and unchanged native ledger');
  }finally{await app.stop();}
 }
}
