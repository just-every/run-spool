import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {agentRuntime} from './runtime.mjs';
import {accessToken,autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

/** Native query-token refusal, including application diagnostics and custody. */
export async function queryTokenContract(){
 for(const [phase,policy] of [['autonomous',autonomousPolicy],['held',heldPolicy]]){
  const diagnostics=[];
  const app=await agentRuntime(0,{},undefined,{captureDiagnostics:entry=>diagnostics.push(entry)});
  let token,queryPath;
  // Assertion errors must never dump a credential, a request URL or private rows.
  const noCredential=(value,label)=>{
   const text=typeof value==='string'?value:JSON.stringify(value);
   assert.ok(![token,queryPath,app.origin+queryPath,app.canonicalOrigin+queryPath].some(secret=>secret&&text.includes(secret)),label+' contains no query credential or credential URL');
  };
  const snapshot=async()=>{
   const tables=(await app.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all()).results;
   const state={};
   for(const {name} of tables)state[name]=(await app.DB.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"').all()).results.map(row=>JSON.stringify(row)).sort();
   return state;
  };
  try{
   assert.ok(diagnostics.some(entry=>entry.message.includes('Synthetic Worker diagnostic capture ready')),'The emitted Worker console is connected to the in-memory capture');
   const project='synthetic-spool-query';
   await app.json('/api/organization','POST',{id:'synthetic-spool-company',name:'Query-token qualification'});
   const created=await app.json('/api/projects','POST',{id:project,name:'Query-token qualification'});
   await app.json(`/api/projects/${project}/releases`,'POST',{name:'1.0.0',build:'web-1'});
   const admitted=await app.json(`/api/ingest/${project}`,'POST',{version:1,eventId:'synthetic-spool-1',release:'1.0.0',build:'web-1',environment:'production',type:'TypeError',message:'Retained query-token control',frames:[{file:'https://checkout.example/app.js',line:1,column:0,function:'total'}],breadcrumbs:[]},{Authorization:'Bearer '+created.ingestKey,Cookie:''});
   await app.adopt(policy());
   const issues=await app.json(`/api/projects/${project}/issues`);
   assert.equal(issues.length,1);assert.equal(issues[0].id,admitted.issue);
   token=await accessToken(app.context);
   queryPath='/mcp?access_token='+encodeURIComponent(token);
   let rpcId=0;
   const method=['tools','call'].join('/');
   const send=(path,name,args,authorized)=>app.request(path,'POST',{jsonrpc:'2.0',id:++rpcId,method,params:{name,arguments:args}},{Cookie:'',...authorized?{Authorization:'Bearer '+token}:{},Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':method,'Mcp-Name':name});
   const read=async()=>{
    const response=await send('/mcp','spool.issues.list',{project},true);
    const text=await response.text();noCredential(text,'Header-only response');noCredential([...response.headers],'Header-only headers');
    assert.equal(response.status,200,'The exact query canary is a valid bearer before and after refusals');
    const result=JSON.parse(text).result;
    assert.equal(result?.isError,false,'The header-only control reaches the native read');
    assert.equal(result._meta['com.runeditrun/decision'].disposition,phase==='held'?'review':'autonomous');
    assert.deepEqual(result.structuredContent.items.map(issue=>({id:issue.id,state:issue.state,revision:issue.revision,count:issue.count})),issues.map(issue=>({id:issue.id,state:issue.state,revision:issue.revision,count:issue.count})),'The allowed read sees the populated native issue');
   };
   await read();
   const before=await snapshot();
   assert.ok(before.events.length&&before.agent_door_audit.length,'Refusals start with retained captures and real agent audit facts');
   assert.equal(before.agent_door_approvals.length,0,'The proof starts without pending actions');
   noCredential(before,'Existing native custody and audit');
   const metadata=app.canonicalOrigin+'/.well-known/oauth-protected-resource/mcp';
   for(const authorized of [false,true]){
    for(const [name,args] of [
     ['spool.issues.list',{project}],
     ['spool.issues.update',{project,issue:admitted.issue,state:'suppressed',revision:issues[0].revision,idempotency_key:randomUUID()}],
    ]){
     const response=await send(queryPath,name,args,authorized);
     const text=await response.text();
     noCredential(text,'Query refusal response');noCredential([...response.headers],'Query refusal headers');
     assert.equal(response.status,401,'Query presentation refuses even alongside a valid Authorization header');
     assert.equal(response.headers.get('www-authenticate'),'Bearer resource_metadata="'+metadata+'"','The refusal challenges with this installation resource metadata');
     assert.equal(JSON.parse(text).error?.code,-32001,'The refused transport has no tool result');
     const after=await snapshot();noCredential(after,'Persisted native custody and audit after refusal');
     assert.ok(isDeepStrictEqual(after,before),'Query refusal preserves every populated native table, including audit, custody, approvals and admission counters');
    }
    console.log(`PROBE BASE-AGENT-004 acceptance-5-${phase}-${authorized?'query-and-header':'query-only'}: emitted Worker MCP read and write with a valid query token -> resource-metadata 401; retained state unchanged, no pending action or credential echo`);
   }
   await app.restart();
   const restarted=await snapshot();noCredential(restarted,'Restarted native custody and audit');
   assert.ok(isDeepStrictEqual(restarted,before),'Refused query presentations leave no durable changes after Worker restart');
   await read();
   assert.ok(isDeepStrictEqual(await app.json(`/api/projects/${project}/issues`),issues),'The positive control and refused writes preserve native issue state');
   noCredential(await snapshot(),'Final native custody and audit');
  }finally{
   await app.stop();
   // Include shutdown and deferred Worker diagnostics before releasing canaries.
   noCredential(diagnostics,'Captured application diagnostics');
   diagnostics.length=0;
  }
  console.log(`PROBE BASE-AGENT-004 acceptance-5-${phase}-nonlogging: calibrated in-memory Worker console and all retained native tables -> no raw token or query-token URL; header-only read remains usable`);
 }
}
