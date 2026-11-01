import assert from 'node:assert/strict';
import {checkTarget} from '../../src/modules/agent-door/conformance/target.mjs';
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

/** Assertions formerly pending on Base, exercised against the real Worker. */
export async function continuationFlow(app,{project,issue,proposal,created}){
 const code=result=>result?._meta?.['com.runeditrun/error']?.code;
 const before=await app.json('/api/projects/'+project+'/grouping-proposals');
 await app.adopt(autonomousPolicy(),{paused:true});
 const paused=await app.call('spool.proposals.create',proposal);
 assert.equal(code(paused),'agents_paused','Replay rechecks Pause before returning a cached result');
 const stopping=(await app.json('/agents/api/audit')).rows.findLast(row=>row.code==='agents_paused'&&row.tool==='spool.proposals.create');
 assert.deepEqual(stopping.resource,{kind:'issue',id:issue});
 assert.deepEqual(stopping.classes.map(item=>item.class),['standard']);
 await app.adopt({schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'blocked',class:'*',do:'blocked'}],spend:{none:true}});
 assert.equal(code(await app.call('spool.proposals.create',proposal)),'policy_blocked','A previous outcome does not authorize replay under a new blocked policy');
 await app.adopt(heldPolicy());
 assert.equal(code(await app.call('spool.proposals.create',proposal)),'review_required','A new review requirement cannot reuse an autonomous outcome');
 await app.adopt({schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'held',class:'*',do:'approval',approver:['sponsor'],wait:'PT1H'}],spend:{none:true}});
 assert.equal(code(await app.call('spool.proposals.create',proposal)),'approval_required','A new approval requirement cannot reuse an autonomous outcome');
 await app.adopt();
 assert.deepEqual((await app.call('spool.proposals.create',proposal)).structuredContent,created);
 assert.deepEqual(await app.json('/api/projects/'+project+'/grouping-proposals'),before,'No replay admission variant repeats the effect');
 // Published 0.2.89 re-runs an aggregate read after its exact approval. The
 // retained approval cannot expose rows from before a native person edit.
 await app.adopt({schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'read-approval',class:'*',do:'approval',approver:['sponsor'],wait:'PT1H'}],spend:{none:true}});
 const readArgs={project},pendingRead=await app.mcp('tools/call',{name:'spool.issues.list',arguments:readArgs},{},'2026-07-28');
 const handle=pendingRead._meta?.['com.runeditrun/approval'];assert.ok(handle?.id);
 const {approval}=await app.json('/agents/api/approvals/'+handle.id);
 await app.json('/agents/api/approvals/'+handle.id+'/approve','POST',{revision:approval.revision,summary_sha256:approval.summary_sha256});
 const read=()=>app.mcp('tools/call',{name:'spool.issues.list',arguments:readArgs,requestState:pendingRead.requestState},{},'2026-07-28');
 const firstRead=await read();assert.ok(!firstRead.isError);assert.ok(firstRead._meta?.['com.runeditrun/receipt']);
 const original=firstRead.structuredContent.items.find(row=>row.id===issue);assert.ok(original);
 const nextState=original.state==='acknowledged'?'open':'acknowledged';
 await app.json(`/api/projects/${project}/issues/${issue}`,'PATCH',{state:nextState,revision:original.revision});
 const currentRead=await read();assert.ok(!currentRead.isError);assert.ok(currentRead._meta?.['com.runeditrun/receipt']);
 const current=currentRead.structuredContent.items.find(row=>row.id===issue);
 assert.equal(current.state,nextState,'An approved aggregate replay returns the current native projection');
 assert.equal(current.revision,original.revision+1);
 assert.equal((await app.json('/agents/api/approvals/'+handle.id)).approval.state,'executed');
 await app.json(`/api/projects/${project}/issues/${issue}`,'PATCH',{state:original.state,revision:current.revision});
 await app.adopt();
 const missing=await app.mcp('resources/read',{uri:'spool://projects/'+project+'/issues/no-such-issue'});
 assert.equal(missing.error?.data?.code,'capability_not_declared','Undeclared resources have a machine code in JSON-RPC error.data');
 assert.equal(missing.error?.data?.capability,'resources');
 // Exercise the installed target check after more than one native audit page.
 for(let i=0;i<201;i++)assert.ok(!(await app.call('spool.issues.list',{project})).isError);
 const latest=await app.call('spool.proposals.read',{project,id:created.id});assert.ok(!latest.isError);
 const page=await app.json('/agents/api/audit?agent='+app.context.agentId);assert.ok(page.cursor,'Real audit has a second page');
 await checkTarget({agentId:app.context.agentId,personJson:app.json,resolve:value=>value,add:(id,ok,detail)=>assert.ok(ok,id+': '+detail)},
  {id:'beyond-first-page',tool:'spool.proposals.read',target:{kind:'grouping_proposal',id:created.id}},new Map(),{decision:latest._meta['com.runeditrun/decision'],result:latest},'native');
 console.log('Closed Base assertions: native audit targets, resource refusal code and current replay admission.');
}
