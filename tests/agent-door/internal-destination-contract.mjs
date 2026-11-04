import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

/** Compare internal and outside recipients through the same native TEST door. */
export async function internalDestinationContract(app,{baseline,policy,project,path,state}){
 const external={class:'external',facts:{measure:1,counterparty:'known',provider:'email',step:'destination test'}};
 const standard={class:'standard',facts:{measure:1}};
 const blocked=(internal=false)=>{
  const document=policy();
  document.rules.push({id:'outside',class:'external',do:'blocked'});
  if(internal)document.rules.push({id:'inside',class:'standard',do:'blocked'});
  return document;
 };
 const create=async(recipient,label='Internal recipient; zero cost')=>app.json(path+'/destinations','POST',{label,recipient});
 const refused=async(destination,classification,rule,extra={})=>{
  const before=await state(),key=randomUUID();
  const result=await app.call('spool.alerts.test',{project,id:destination.id,...extra,idempotency_key:key});
  const decision=result._meta?.['com.runeditrun/decision'];
  assert.deepEqual(result._meta?.['com.runeditrun/error'],{code:'policy_blocked',class:classification.class,rule,revision:app.context.revision});
  assert.equal(decision.disposition,'blocked');
  assert.deepEqual(decision.classes,[{...classification,rule,do:'blocked'}]);
  const audit=(await app.json('/agents/api/audit?agent='+app.context.agentId)).rows.find(row=>row.id===decision.id);
  assert.ok(audit);assert.deepEqual(audit.classes,[classification]);
  assert.deepEqual(audit.rules,[{class:classification.class,rule,do:'blocked'}]);
  assert.equal(audit.revision,app.context.revision);assert.equal(audit.code,'policy_blocked');
  assert.equal(audit.outcome,'refused');assert.deepEqual(audit.resource,{kind:'alert_destination',id:destination.id});
  assert.deepEqual(audit.ignored_arguments,Object.keys(extra).sort());
  assert.deepEqual(await state(),before,'A refused classification leaves native tests, deliveries, approvals and provider sends unchanged');
 };
 const claims={internal:true,confirmExternal:true,cost:0,amount:0,currency:'USD'};
 const owner=await create(app.context.person.email);
 await app.adopt(blocked(true));
 await refused(owner,standard,'inside');
 await refused(owner,standard,'inside',claims);
 await app.json(path+'/destinations/'+owner.id,'PUT',{label:'Outside recipient; public; paid',recipient:app.context.person.email});
 await refused(owner,standard,'inside');
 // An address that merely shares the owner's domain has no Business binding.
 const sameDomain=await create(['synthetic-spool-2',app.context.person.email.split('@')[1]].join('@'));
 await refused(sameDomain,external,'outside',claims);
 await app.adopt(blocked());
 const admitted=await app.call('spool.alerts.test',{project,id:owner.id,...claims,idempotency_key:randomUUID()});
 assert.ok(!admitted.isError,'A current internal recipient is admitted while outside effects stay blocked');
 assert.equal(admitted._meta['com.runeditrun/decision'].disposition,baseline==='held'?'review':'autonomous');
 assert.deepEqual(admitted._meta['com.runeditrun/decision'].classes,[{...standard,rule:baseline==='held'?'standard':'all',do:baseline==='held'?'review':'autonomous'}]);
 const ownerSends=(await app.mail()).filter(row=>row.deliveryId===admitted.structuredContent.id);
 assert.equal(ownerSends.length,1);assert.deepEqual(ownerSends[0].to,[app.context.person.email]);

 const email=['synthetic-spool-3','synthetic.invalid'].join('@'),sub=randomUUID();
 const invited=await app.json('/api/organization/invites','POST',{email,name:'Synthetic teammate',role:'member',grants:[{project,role:'member'}]});
 const teammate=await create(email);
 // A signed roster row alone cannot convert an unconfirmed invite into an
 // internal identity, and a native member alone cannot claim Business scope.
 const roster=[{id:sub,email,name:'Synthetic teammate',role:'member',invite:1}];
 await app.syncSettings(roster);
 await refused(teammate,external,'outside',claims);
 const invitation=(await app.mail()).find(row=>row.to?.includes(email));
 const token=invitation?.text.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];
 assert.ok(token,'The seeded native invitation reaches the controlled mail edge');
 const confirmed=await app.request('/auth/confirm','POST',{token},{Cookie:''});
 assert.equal(confirmed.status,303);await confirmed.body?.cancel();
 await app.syncSettings([]);
 await refused(teammate,external,'outside');
 await app.syncSettings(roster);
 await app.adopt(blocked(true));
 await refused(teammate,standard,'inside');
 await refused(teammate,standard,'inside',claims);
 await app.json(path+'/destinations/'+teammate.id,'PUT',{label:'Public recipient; expensive',recipient:email});
 await refused(teammate,standard,'inside');
 await app.adopt(blocked());
 const memberTest=await app.call('spool.alerts.test',{project,id:teammate.id,idempotency_key:randomUUID()});
 assert.ok(!memberTest.isError,'A confirmed native teammate on the signed roster is internal');
 assert.deepEqual(memberTest._meta['com.runeditrun/decision'].classes,[{...standard,rule:baseline==='held'?'standard':'all',do:baseline==='held'?'review':'autonomous'}]);
 const memberSends=(await app.mail()).filter(row=>row.deliveryId===memberTest.structuredContent.id);
 assert.equal(memberSends.length,1);assert.deepEqual(memberSends[0].to,[email]);
 await app.syncSettings([]);
 await refused(teammate,external,'outside',claims);
 await app.syncSettings(roster);
 // Hold a fresh destination before any TEST exists, so a send-window refusal
 // cannot hide stale classification after its recipient leaves the Business.
 const waiting=await create(email,'Internal recipient awaiting company approval');
 const held=blocked();held.rules.push({id:'inside-approval',class:'standard',do:'approval',approver:['sponsor'],wait:'PT1H'});
 await app.adopt(held);
 const beforePending=await state(),key=randomUUID();
 const pending=await app.call('spool.alerts.test',{project,id:waiting.id,idempotency_key:key});
 const reference=pending._meta?.['com.runeditrun/approval']??pending._meta?.['com.runeditrun/error']?.approval;
 assert.ok(reference?.id,'A company can hold the internal TEST for exact approval');
 assert.deepEqual(pending._meta['com.runeditrun/decision'].classes,[{...standard,rule:'inside-approval',do:'approval'}]);
 assert.deepEqual({...await state(),approvals:beforePending.approvals},beforePending,'A held internal TEST creates no native test or provider send');
 const approval=(await app.json('/agents/api/approvals/'+reference.id)).approval;
 assert.deepEqual(approval.summary.recipients,[email]);
 await app.syncSettings([]);
 const beforeApproval=await state();
 await app.json('/agents/api/approvals/'+reference.id+'/approve','POST',{revision:approval.revision,summary_sha256:approval.summary_sha256});
 const changed=(await app.json('/agents/api/approvals/'+reference.id)).approval;
 assert.equal(changed.state,'refused');assert.equal(changed.code,'approval_evidence_changed');
 assert.deepEqual(await state(),beforeApproval,'Removing the signed recipient binding fences an already held internal TEST without a send');
 await refused(waiting,external,'outside',claims);
 await app.syncSettings(roster);
 const member=(await app.json('/api/organization')).members.find(row=>row.id===invited.id);
 await app.json('/api/organization/members/'+member.id,'DELETE',{version:member.version});
 await refused(teammate,external,'outside',claims);
 console.log(`PROBE SURFACE-002 acceptance-2 ${baseline}: MCP spool.alerts.test -> exact active owner and confirmed signed teammate are standard; same-domain, invited, unmapped, roster-removed and native-removed recipients stay external; blocked calls leave native effects unchanged; allowed internal controls each send once to the actual recipient`);
 console.log(`PROBE SURFACE-002 acceptance-7-internal ${baseline}: fresh-key internal and zero-cost arguments plus saved-label claims -> identical standard facts for current Business identities and identical external facts for outside identities`);
 console.log(`PROBE SURFACE-002 acceptance-2-held-change ${baseline}: approve a held internal TEST after signed roster removal -> approval_evidence_changed; a fresh call is externally blocked; no native test or provider send`);
}
