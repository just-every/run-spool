import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import prepare from './phase-fixtures.mjs';
import proof from './proof.mjs';
import {beforeStep} from './native-journey.mjs';
import {schemaErrors} from '../../src/modules/agent-door/conformance/schema.mjs';
import {catalogue} from '../../src/domain/agent-door/catalogue.mjs';

const code=answer=>answer?._meta?.['com.runeditrun/error']?.code;
const done=answer=>{assert.ok(answer&&!answer.isError,code(answer)??'Missing native result');return answer.structuredContent;};
const pointer=(value,path)=>path.split('/').slice(1).reduce((at,key)=>at?.[key.replace(/~1/g,'/').replace(/~0/g,'~')],value);

/** The declared sanity journey exercises every offered native tool, using
 * independent public setup and the emitted Worker's discovered schemas. */
export async function actionContract(app){
 await app.adopt();
 const request=(absolute,init={})=>{
  const url=new URL(absolute,app.origin);
  const headers=new Headers(init.headers);
  for(const name of ['cookie','origin','content-type'])headers.delete(name);
  return app.request(url.pathname+url.search,init.method??'GET',init.body===undefined?undefined:JSON.parse(init.body),Object.fromEntries(headers));
 };
 const fixture=await prepare({request,origin:app.origin,cookie:app.cookie,phase:'action-contract'});
 const surface=JSON.parse(await readFile(new URL('../../agent-surface.json',import.meta.url),'utf8'));
 const listed=(await app.mcp('tools/list')).tools,tools=new Map(listed.map(tool=>[tool.name,tool])),outputs=new Map(),qualified=new Set();
 const resolve=value=>{
  if(Array.isArray(value))return value.map(resolve);
  if(!value||typeof value!=='object')return value;
  if('$from' in value){assert.ok(outputs.has(value.$from),'A journey reference must come from an observed result');return pointer(outputs.get(value.$from),value.pointer);}
  if('$fixture' in value)return pointer(fixture.values[value.$fixture],value.pointer);
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,resolve(item)]));
 };
 for(const step of surface.journey){
  // Events are explicitly undeclared; they have no offered output contract.
  if(!tools.has(step.tool)){assert.equal(step.tool,'spool.events.list');continue;}
  const args=resolve(step.args),tool=tools.get(step.tool);
  if(!tool.annotations.readOnlyHint)args.idempotency_key=randomUUID();
  await beforeStep({step,args,request,origin:app.origin,cookie:app.cookie});
  const declaration=catalogue.find(entry=>entry.name===step.tool);
  const reference=declaration.proof?await proof({request,args,kind:declaration.proofKind}):undefined;
  const answer=await app.call(step.tool,args,undefined,reference);
  if(step.tool==='spool.privacy.continue'&&code(answer)==='subject_erased'){
   const marker=answer._meta['com.runeditrun/error'].tombstone;
   assert.deepEqual(Object.keys(marker).sort(),['at','erasure_id']);
   assert.equal((await app.json('/api/erasures/'+args.id)).phase,'complete');
   assert.equal((await app.json('/api/projects')).some(row=>row.id===outputs.get('erasable').id),false);
   outputs.set(step.id,{tombstone:marker});
  }else{
   const result=done(answer);
   assert.deepEqual(schemaErrors(tool.outputSchema,result),[],step.tool+' result must satisfy its offered output schema');
   outputs.set(step.id,result);
  }
  qualified.add(step.tool);
 }
 assert.deepEqual([...qualified].sort(),listed.map(tool=>tool.name).sort(),'Every offered tool has an exercised fixture result');
 assert.ok(outputs.get('issues').items.length>0,'Evidence reads contain the actual captured failure');
 assert.equal(outputs.get('packet').events.length,2,'Packet output contains both independently captured events');
 console.log('PROBE BASE-AGENT-002 2: authenticated /mcp native journey -> '+qualified.size+' offered tools exercised; successful results validate against discovered schemas; completed erasure returns its closed tombstone');
 await nativeActionParity(app,fixture.values.project,outputs.get('issues').items[0].id);
}

/** Native HTTP is the person's server action, including current revisions.
 * Compare both the persisted user state and the permanent transaction facts. */
async function nativeActionParity(app,project,issue){
 const path='/api/projects/'+project,issuePath=path+'/issues/'+issue;
 const issueState=async()=>(await app.json(path+'/issues')).find(row=>row.id===issue);
 const facts=async()=>(await app.json('/api/audit/export?format=json')).rows;
 const actionFacts=rows=>rows.filter(row=>row.source==='transaction'&&row.action==='issue.triage');
 const initial=await issueState(),start=await facts();
 await app.json(issuePath,'PATCH',{state:'acknowledged',revision:initial.revision});
 const person=await issueState(),personFacts=actionFacts((await facts()).filter(row=>!start.some(prior=>prior.id===row.id)));
 assert.equal(person.state,'acknowledged');assert.equal(person.revision,initial.revision+1);
 assert.equal(personFacts.length,1,'The native person action commits its transaction audit');
 await app.json(issuePath,'PATCH',{state:initial.state,revision:person.revision});
 const restored=await issueState(),before=await facts();
 done(await app.call('spool.issues.update',{project,issue,state:'acknowledged',revision:restored.revision,idempotency_key:randomUUID()}));
 const agent=await issueState(),agentFacts=actionFacts((await facts()).filter(row=>!before.some(prior=>prior.id===row.id)));
 assert.deepEqual({...agent,revision:person.revision},person,'The person and tool action produce the same complete issue record apart from the expected revision increment');
 assert.equal(agent.revision,restored.revision+1);
 assert.equal(agentFacts.length,1,'The tool action commits exactly one matching native transaction audit');
 const factState=row=>[row.action,row.outcome,row.subject_kind,row.subject_label,row.project_label];
 assert.deepEqual(agentFacts.map(factState),personFacts.map(factState));
 assert.equal(agentFacts[0].actor_kind,'agent');assert.equal(personFacts[0].actor_kind,'owner');
 console.log('PROBE BASE-AGENT-002 5: native HTTP and spool.issues.update on the same captured issue -> equal complete record state, one matching issue.triage transaction fact, and truthful distinct actors');

 for(const [label,nativePath,method,input,tool,args,status] of [
  ['stale issue',issuePath,'PATCH',{state:'resolved',revision:initial.revision},'spool.issues.update',{project,issue,state:'resolved',revision:initial.revision},409],
  ['stale repair',path+'/repairs/'+(await app.json(path+'/repairs?issue='+issue)).repairs[0].id+'/checks','POST',{revision:1,name:'Refused stale check',outcome:'passed'},'spool.repairs.check',null,409],
  ['missing grouping preview',path+'/corrections/not-a-preview/apply','POST',{confirm:true},'spool.grouping.apply',{project,id:'not-a-preview'},404],
 ]){
  const snapshot=await issueState(),rows=await app.json(path+'/repairs?issue='+issue);
  const response=await app.request(nativePath,method,input),native=await response.json();assert.equal(response.status,status,label);
  const arguments_=args??{project,id:rows.repairs[0].id,...input};
  const refused=await app.call(tool,{...arguments_,idempotency_key:randomUUID()});
  assert.equal(refused.isError,true);assert.equal(code(refused),native.code,label+' returns the person action stable code');
  assert.ok(native.code,'The native refusal exposes a stable code');
  assert.deepEqual(await issueState(),snapshot,label+' changes no issue record');
  assert.deepEqual(await app.json(path+'/repairs?issue='+issue),rows,label+' changes no repair or check');
 }
 console.log('PROBE BASE-AGENT-002 4: stale issue, stale repair and absent grouping preview through native HTTP and /mcp -> identical stable refusal codes and unchanged retained issue and repair state');
}
