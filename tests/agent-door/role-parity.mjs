import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';
import {documentedInventory} from './docs-contract.mjs';

/** Native person sessions and sponsored MCP retain the same project authority.
 * Policy is chosen independently; standard triage needs no approval in either.
 */
export async function roleParityContract(app){
 const error=answer=>answer?._meta?.['com.runeditrun/error']?.code;
 const done=answer=>{assert.ok(!answer.isError,error(answer));return answer.structuredContent;};
 const documented=documentedInventory(await (await fetch(app.origin+'/docs/agents')).text());
 for(const [policyName,policy] of [['autonomous',autonomousPolicy()],['held',heldPolicy()]]){
  await app.adopt(policy);
  const project='synthetic-spool-324-'+policyName;
  const created=await app.json('/api/projects','POST',{id:project,name:project});
  await app.json(`/api/projects/${project}/releases`,'POST',{name:'synthetic-spool-324',build:'synthetic-spool-324'});
  const {issue}=await app.json('/api/ingest/'+project,'POST',{version:1,eventId:'synthetic-spool-324',release:'synthetic-spool-324',build:'synthetic-spool-324',environment:'test',type:'TypeError',message:'Synthetic role parity failure',frames:[{file:'https://synthetic.invalid/cart.js',line:1,column:0,function:'checkout'}],breadcrumbs:[]},{Authorization:'Bearer '+created.ingestKey});
  const roster=[];
  for(const [label,role,projectRole,canRead,canWrite] of [
   ['admin','admin',null,true,true],
   ['maintainer','member','maintainer',true,true],
   ['member','member','member',true,true],
   ['read-only','read-only','read-only',true,false],
   ['billing','billing',null,false,false],
  ]){
   const email=[`synthetic-spool-324-${policyName}-${label}`,'synthetic.invalid'].join('@'),sub=randomUUID();
   const invited=await app.json('/api/organization/invites','POST',{email,name:'Synthetic '+label,role,grants:projectRole?[{project,role:projectRole}]:[]});
   const mail=(await app.mail()).findLast(row=>row.to?.includes(email));
   const token=mail?.text.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];assert.ok(token,'A real native invitation reaches the controlled mail edge');
   const accepted=await app.request('/auth/confirm','POST',{token},{Cookie:''});assert.equal(accepted.status,303);
   const cookie=accepted.headers.getSetCookie().map(row=>row.split(';')[0]).join('; ');await accepted.body?.cancel();assert.ok(cookie);
   roster.push({id:sub,email,name:'Synthetic '+label,role:role==='admin'?'admin':'member',invite:1});await app.syncSettings(roster);
   const claims={sub,email,act:{sub:randomUUID(),name:'Synthetic role parity agent',specialist:'triage engineer'}};
   const native=(path,method='GET',body)=>app.request(path,method,body,{Cookie:cookie});
   const state=()=>app.json(`/api/projects/${project}/issues`);
   const before=await state();assert.ok(before.some(row=>row.id===issue),'Role checks use populated native records');
   const releases=await native(`/api/projects/${project}/releases`),agentReleases=await app.call('spool.releases.read',{project},claims);
   if(canRead){
    assert.equal(releases.status,200,`${label}: person can read the scoped project`);
    assert.deepEqual(done(agentReleases).items,await releases.json(),`${label}: MCP and person release records agree completely`);
    const tools=(await app.mcp('tools/list',{},claims)).tools.map(row=>row.name).sort();
    assert.deepEqual(tools,documented.tools,`${label}: the guide names the complete authenticated registry; native authority still governs each call`);
    assert.deepEqual((await app.mcp('resources/templates/list',{},claims)).resourceTemplates,documented.resourceTemplates,`${label}: the documented empty resource inventory remains truthful`);
   }else{
    assert.equal(releases.status,404,`${label}: person cannot read project records`);await releases.body?.cancel();
    assert.equal(error(agentReleases),'not_found',`${label}: MCP withholds the same project records`);
   }
   const current=before.find(row=>row.id===issue),input={state:current.state==='open'?'acknowledged':'open',revision:current.revision};
   const personWrite=await native(`/api/projects/${project}/issues/${issue}`,'PATCH',input);
   if(canWrite){
    assert.equal(personWrite.status,200,`${label}: native person triage succeeds`);await personWrite.body?.cancel();
    const afterPerson=(await state()).find(row=>row.id===issue);assert.equal(afterPerson.state,input.state);assert.equal(afterPerson.revision,input.revision+1);
    const next={project,issue,state:input.state==='open'?'acknowledged':'open',revision:afterPerson.revision,idempotency_key:randomUUID()};
    const answer=await app.call('spool.issues.update',next,claims);done(answer);
    assert.equal(answer._meta['com.runeditrun/decision'].disposition,policyName==='held'?'review':'autonomous','The independently adopted policy governs the supported standard write');
    const afterAgent=(await state()).find(row=>row.id===issue);assert.equal(afterAgent.state,next.state);assert.equal(afterAgent.revision,next.revision+1);
    done(await app.call('spool.issues.update',next,claims));assert.deepEqual(await state(),[afterAgent],'The same mutation key cannot repeat the effect');
   }else{
    assert.equal(personWrite.status,404,`${label}: native person triage is refused`);await personWrite.body?.cancel();
    assert.equal(error(await app.call('spool.issues.update',{project,issue,...input,idempotency_key:randomUUID()},claims)),'not_found',`${label}: company autonomy cannot widen native authority`);
    assert.deepEqual(await state(),before,`${label}: neither refused path changes populated records`);
   }
   if(label==='member'){
    const beforeRemoval=await state();
    await app.json('/api/organization/members/'+invited.id,'DELETE',{version:(await app.json('/api/organization')).members.find(row=>row.id===invited.id).version});
    const retired=await native(`/api/projects/${project}/issues`);assert.equal(retired.status,401);await retired.body?.cancel();
    assert.equal((await app.mcp('tools/call',{name:'spool.issues.list',arguments:{project}},claims,'2025-11-25',401)).httpStatus,401,'Removal retires both person and sponsored MCP authority');
    assert.deepEqual(await state(),beforeRemoval,'Retired read attempts cannot change project records');
    roster.splice(roster.findIndex(row=>row.id===sub),1);
   }
  }
  console.log(`PROBE BASE-AGENT-013 role parity (${policyName}): native invitations and authenticated person HTTP versus MCP -> admin, maintainer and member read and triage; read-only writes and billing reads and writes refused unchanged; member removal denies both doors; offered docs remain exact`);
 }
 await app.adopt(autonomousPolicy());
}
