import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function peopleFlow(app){
 const project='door-triage',email='riley@spool.test',sub=randomUUID(),agentId=randomUUID();
 const invited=await app.json('/api/organization/invites','POST',{email,name:'Riley Engineer',role:'member',grants:[{project,role:'member'}]});
 const message=(await app.mail()).find(row=>row.to?.includes(email));assert.ok(message,'Native invitation reaches the controlled mail edge');
 const token=message.text.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];assert.ok(token,'Native invitation contains a confirmation');
 const accepted=await app.request('/auth/confirm','POST',{token},{Cookie:''});assert.equal(accepted.status,303,'The invited native person confirms their own email');
 const cookie=accepted.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');await accepted.body?.cancel();
 await app.syncSettings([{id:sub,email,name:'Riley Engineer',role:'member',invite:1}]);
 const claims={sub,email:'owner@spool.test',act:{sub:agentId,name:'Scoped triage',specialist:'triage engineer'}};
 const list=await app.call('spool.issues.list',{project},claims);assert.ok(!list.isError,'Durable Business subject maps to the current native teammate despite token email');
 const roster=await app.json('/api/organization'),member=roster.members.find(m=>m.id===invited.id);
 const self=await app.call('spool.access.update',{id:member.operator_id,version:member.version,role:'admin',grants:[],idempotency_key:randomUUID()},claims);
 assert.equal(self._meta['com.runeditrun/error'].code,'self_escalation');
 const emailSelf=await app.call('spool.access.update',{id:email.toUpperCase(),version:member.version,role:'admin',grants:[],idempotency_key:randomUUID()},claims);
 assert.equal(emailSelf._meta['com.runeditrun/error'].code,'self_escalation');
 const response=await app.request(`/api/projects/${project}/keys`,'POST',{kind:'agent'},{Cookie:cookie});assert.equal(response.status,201);const key=await response.json();
 const local=async target=>{
  const r=await app.request('/mcp','POST',{jsonrpc:'2.0',id:randomUUID(),method:'tools/call',params:{name:'spool.issues.list',arguments:{project:target}}},{Authorization:`Bearer ${key.key}`,'MCP-Protocol-Version':'2025-11-25'});return {status:r.status,body:await r.json()};
 };
 assert.ok(!(await local(project)).body.result.isError,'The local credential retains its original project evidence authority');
 assert.equal((await local('foreign-project')).body.result._meta['com.runeditrun/error'].code,'not_found');
 await app.json('/api/organization/members/'+member.id,'PUT',{version:member.version,role:'read-only',grants:[{project,role:'read-only'}]});
 assert.equal((await local(project)).status,401,'Narrowing permanently retires a previously minted key');
 const current=list.structuredContent[0];
 const denied=await app.call('spool.issues.update',{project,issue:current.id,revision:current.revision,state:'acknowledged',idempotency_key:randomUUID()},claims);
 assert.equal(denied._meta['com.runeditrun/error'].code,'not_found','Company autonomy preserves native read-only membership');
 await app.json('/api/organization/members/'+member.id,'PUT',{version:member.version+1,role:'member',grants:[{project,role:'member'}]});
 assert.equal((await local(project)).status,401,'Later widening cannot revive the old key');
 await app.json('/api/organization/members/'+member.id,'DELETE',{version:member.version+2});
 assert.equal((await app.mcp('tools/call',{name:'spool.issues.list',arguments:{project}},claims,'2025-11-25',401)).httpStatus,401,'Inactive native people are refused');
 console.log('Spool people: native invitation, signed teammate mapping, token-email non-authority, ID/email self-escalation, exact local project scope and permanent key retirement passed.');
}
