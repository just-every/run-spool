import assert from 'node:assert/strict';
import {catalogue} from '../../src/domain/agent-door/catalogue.mjs';
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

// Independent native behavior fixtures: do not derive expectations from discovery.
// A POST preview can be read-only; recording a deployment does no provider work.
const behaviors=[
 {readOnlyHint:true,destructiveHint:false,openWorldHint:false,names:[
  'projects.list','issues.list','issues.read','packets.read','outcomes.read',
  'issues.search','issues.export','occurrences.list','feedback.read','health.read',
  'affected.read','notifications.read','proposals.list','proposals.read',
  'grouping.read','reproducers.read','repairs.read','fixes.read','releases.read',
  'deployments.read','alerts.read','alerts.destinations','followups.read',
  'access.read','credentials.list','credentials.read','retention.read',
  'retention.preview','privacy.preview','witness.read',
 ]},
 {readOnlyHint:false,destructiveHint:false,openWorldHint:false,names:[
  'projects.create','proposals.create','issues.update','grouping.preview',
  'grouping.apply','grouping.undo','reproducers.create','reproducers.run',
  'reproducers.claim','repairs.record','repairs.check','repairs.record_fact',
  'fixes.create','releases.record','deployments.record','alerts.preview',
  'alerts.update','followups.update','access.update','credentials.update',
 ]},
 {readOnlyHint:false,destructiveHint:true,openWorldHint:false,names:[
  'retention.update','privacy.erase','privacy.continue',
 ]},
 {readOnlyHint:false,destructiveHint:false,openWorldHint:true,names:[
  'fixes.advance','alerts.test',
 ]},
];
const expected=new Map(behaviors.flatMap(({names,...annotations})=>names.map(name=>['spool.'+name,annotations])));
const invokeOnly=['alert_mail','alert_webhook','followup','retention'].map(name=>'spool.workers.'+name);

/** Qualify annotations through the emitted Worker's authenticated MCP door. */
export async function annotationContract(app){
 const names=[...expected.keys()].sort();
 assert.deepEqual(catalogue.map(tool=>tool.name).sort(),names,'Native declarations retain every independently enumerated client tool');
 for(const tool of catalogue){
  const annotations=expected.get(tool.name);
  assert.equal(tool.readOnly,annotations.readOnlyHint,tool.name+' native read or write behavior');
  assert.equal(tool.classes.includes('destructive'),annotations.destructiveHint,tool.name+' native destructive possibility');
  assert.equal(tool.classes.includes('external'),annotations.openWorldHint,tool.name+' native external possibility');
 }
 try{
  for(const [policy,document] of [['autonomous',autonomousPolicy()],['held',heldPolicy()]]){
   await app.adopt(document);
   const listed=(await app.mcp('tools/list')).tools;
   assert.deepEqual(listed.map(tool=>tool.name),names,policy+' offers every native client tool exactly once');
   for(const tool of listed){
    for(const [hint,value] of Object.entries(expected.get(tool.name))){
     assert.ok(Object.hasOwn(tool.annotations??{},hint),policy+' '+tool.name+' explicitly declares '+hint);
     assert.equal(typeof tool.annotations[hint],'boolean',policy+' '+tool.name+' '+hint+' is boolean');
     assert.equal(tool.annotations[hint],value,policy+' '+tool.name+' '+hint+' matches native behavior');
    }
   }
   assert.ok(!listed.some(tool=>tool.name.startsWith('spool.workers.')),'Native workers stay invoke-only under '+policy);
   assert.ok(!listed.some(tool=>tool.name==='spool.events.list'),'Undeclared events stay absent under '+policy);
   for(const name of invokeOnly){
    const refusal=await app.mcp('tools/call',{name,arguments:{}},{},'2025-11-25',400);
    assert.equal(refusal.error?.data?.code,'tool_not_found',policy+' client cannot invoke '+name);
   }
   console.log(`PROBE BASE-AGENT-002 3 ${policy}: authenticated /mcp tools/list -> ${listed.length} native tools with explicit truthful boolean annotations; four worker tools refused`);
  }
 }finally{await app.adopt(autonomousPolicy());}
}
