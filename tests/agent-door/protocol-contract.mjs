import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {accessToken,autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';
import {discoverDoor,listedDoor} from '../../src/modules/agent-door/conformance/discovery.mjs';
import {scopedSurface} from '../../src/modules/agent-door/conformance/subset.mjs';

/** Qualify the native transport with the shared conformance assertions and a
 * populated-state witness for a valid mutation refused before execution. */
export async function protocolContract(app){
 const surface=scopedSurface(JSON.parse(await readFile(new URL('../../agent-surface.json',import.meta.url),'utf8')));
 const project='synthetic-spool-protocol';
 const created=await app.json('/api/projects','POST',{id:project,name:'Protocol qualification'});
 await app.json(`/api/projects/${project}/releases`,'POST',{name:'1.0.0',build:'web-1'});
 const admitted=await app.json(`/api/ingest/${project}`,'POST',{version:1,eventId:'synthetic-spool-protocol-1',release:'1.0.0',build:'web-1',environment:'production',type:'TypeError',message:'Protocol state witness',frames:[{file:'https://checkout.example/app.js',line:1,column:0,function:'total'}],breadcrumbs:[]},{Authorization:`Bearer ${created.ingestKey}`});
 // Observe every native and door table, including pending approvals, audit,
 // replay and usage custody. Refused bodies must change none of them.
 const tables=(await app.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()).results.map(row=>row.name).filter(name=>!name.startsWith('_cf_'));
 const snapshot=async()=>{
  const results=await app.DB.batch(tables.map(name=>app.DB.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"')));
  return Object.fromEntries(tables.map((name,index)=>[name,results[index].results.map(row=>JSON.stringify(row)).sort()]));
 };
 let id=0,autonomousNames;
 const request=(path,init)=>fetch(new URL(path,app.origin),init);
 try{
  for(const [policy,document] of [['autonomous',autonomousPolicy()],['held',heldPolicy()]]){
   await app.adopt(document);
   const credential=await accessToken(app.context,{client_id:`synthetic-spool-protocol-${policy}`});
   const c={...app.context,surface,origin:app.canonicalOrigin,request,
    add(point,ok,detail){assert.ok(ok,`${policy} ${point}: ${detail}`);},
    async mcp(method,params={},options={}){
     const version=options.version??'2026-07-28';
     const response=await request('/mcp',{method:'POST',headers:{Origin:app.canonicalOrigin,Authorization:`Bearer ${credential}`,Accept:'application/json, text/event-stream','Content-Type':'application/json','MCP-Protocol-Version':version,'Mcp-Method':method,...(['tools/call','resources/read','prompts/get'].includes(method)?{'Mcp-Name':method==='resources/read'?params.uri:params.name}:{}),...options.headers},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params:version==='2026-07-28'?{...params,_meta:{...params._meta,'io.modelcontextprotocol/protocolVersion':version}}:params})});
     const body=await response.json();
     if(body.error?.code===-32020)assert.equal(body.error.message,'HeaderMismatch');
     if(body.error?.code===-32022)assert.equal(body.error.message,'UnsupportedProtocolVersion');
     return {status:response.status,headers:response.headers,body,message:body,result:body.result};
    },
   };
   // This must precede every initialize in this journey. A modern client has
   // no session or negotiated state to borrow from a legacy handshake.
   const discovery=await c.mcp('server/discover');
   assert.equal(discovery.status,200);
   const info=discovery.result;
   assert.equal(info.cacheScope,'private');
   assert.ok(Number.isFinite(info.ttlMs)&&info.ttlMs>=0);
   assert.ok(info.supportedVersions.includes('2026-07-28')&&info.supportedVersions.includes('2025-11-25'));
   assert.ok(info.capabilities.tools);
   assert.ok(!['roots','sampling','logging'].some(capability=>capability in info.capabilities));
   const server=info._meta['io.modelcontextprotocol/serverInfo'];
   assert.ok(server.name&&server.version&&info.instructions.includes(surface.specialist));
   const modern=await c.mcp('tools/list');
   assert.equal(modern.status,200);
   const names=modern.result.tools.map(tool=>tool.name);
   assert.ok(names.length>0,'Compatibility proof uses a populated tool catalogue');
   assert.deepEqual(names,[...new Set(names)].sort());
   if(autonomousNames)assert.deepEqual(names,autonomousNames,'Held policy preserves the autonomous discovery catalogue');
   else autonomousNames=names;
   const initialized=await c.mcp('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'Spool protocol qualification',version:'1'}},{version:'2025-11-25'});
   assert.equal(initialized.status,200);
   assert.equal(initialized.result.protocolVersion,'2025-11-25');
   assert.deepEqual(initialized.result.serverInfo,server);
   assert.deepEqual(initialized.result.capabilities,info.capabilities);
   assert.equal(initialized.result.instructions,info.instructions);
   assert.ok(!initialized.headers.has('mcp-session-id'));
   const legacy=await c.mcp('tools/list',{}, {version:'2025-11-25'});
   assert.equal(legacy.status,200);
   assert.deepEqual(legacy.result,modern.result,'Initialized legacy and handshake-free modern lists agree, including private cache fields');
   await discoverDoor(c);
   await listedDoor(c);
   console.log(`PROBE BASE-AGENT-001 1 ${policy}: native MCP discovery -> supported versions, declared capabilities, named serverInfo and specialist instructions`);
   console.log(`PROBE BASE-AGENT-001 2 ${policy}: modern discovery before initialize and legacy initialization -> identical ${names.length}-tool catalogue`);
   console.log(`PROBE BASE-AGENT-001 3 ${policy}: unsupported MCP version -> HTTP 400 UnsupportedProtocolVersion with supported versions`);
   console.log(`PROBE BASE-AGENT-001 4 ${policy}: repeated MCP tool lists -> deterministic order, ttlMs and private cache scope`);
   console.log(`PROBE BASE-AGENT-001 5 ${policy}: foreign Origin and mismatched method header -> HTTP 403 and HeaderMismatch`);

   const issue=(await app.json(`/api/projects/${project}/issues`)).find(row=>row.id===admitted.issue);
   assert.equal(issue.state,'open');
   const args={project,issue:issue.id,state:'suppressed',revision:issue.revision,idempotency_key:randomUUID()};
   const params={name:'spool.issues.update',arguments:args,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}};
   const max=info._meta['com.runeditrun/limits'].maxBodyBytes;
   assert.ok(Number.isSafeInteger(max)&&max>0);
   const body=JSON.stringify({jsonrpc:'2.0',id:++id,method:'tools/call',params:{...params,_meta:{...params._meta,padding:'x'.repeat(max+1)}}});
   for(const streamed of [false,true]){
    const before=await snapshot();
    const response=await request('/mcp',{method:'POST',duplex:'half',headers:{Origin:app.canonicalOrigin,Authorization:`Bearer ${credential}`,Accept:'application/json, text/event-stream','Content-Type':'application/json','MCP-Protocol-Version':'2026-07-28','Mcp-Method':'tools/call','Mcp-Name':params.name},body:streamed?new ReadableStream({start(controller){const bytes=new TextEncoder().encode(body);for(let offset=0;offset<bytes.length;offset+=16384)controller.enqueue(bytes.slice(offset,offset+16384));controller.close();}}):body});
    assert.equal(response.status,413,`${policy} oversized ${streamed?'streamed':'length-bearing'} mutation`);
    await response.body?.cancel();
    assert.deepEqual(await snapshot(),before,'Oversized valid mutation changes no native records, approvals, audit, replay or usage rows');
   }
   // Remove only the padding: the same arguments reach the native mutation.
   const control=await c.mcp('tools/call',params);
   assert.equal(control.status,200);
   if(policy==='held'){
    const handle=control.result._meta['com.runeditrun/approval'];assert.ok(handle?.id);
    const {approval}=await app.json('/agents/api/approvals/'+handle.id);
    assert.equal((await app.json(`/api/projects/${project}/issues`)).find(row=>row.id===issue.id).state,'open');
    const completed=await app.json('/agents/api/approvals/'+handle.id+'/approve','POST',{revision:approval.revision,summary_sha256:approval.summary_sha256});
    assert.equal(completed.approval.state,'executed');
   }else assert.equal(control.result.isError,false);
   const changed=(await app.json(`/api/projects/${project}/issues`)).find(row=>row.id===issue.id);
   assert.equal(changed.state,'suppressed','The unpadded control completes the native state transition');
   await app.json(`/api/projects/${project}/issues/${issue.id}`,'PATCH',{state:'open',revision:changed.revision});
   console.log(`PROBE BASE-AGENT-001 6 ${policy}: oversized valid MCP issue update with length and streamed body -> 413, every table unchanged; unpadded control -> ${policy==='held'?'native approval then ':''}suppressed`);
  }
 }finally{await app.adopt();}
}
