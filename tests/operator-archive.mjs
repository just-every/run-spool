import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';
import {canonical} from '../src/domain/privacy.ts';
import {followErasure} from './project-erasure/follow.mjs';
import assert from 'node:assert/strict';
import { makePart } from '../src/modules/portability/index.mjs';
import { ContentVerifier, ArchiveVerifier } from '../src/modules/portability/format.mjs';
import { archiveProjection } from './archive.mjs';
async function encode(original,edit){
 const data=structuredClone(original.data);edit(data);
 const manifest={...original.manifest,payloads:[],tables:original.manifest.tables.map(t=>({...t,count:data[t.name].length}))};
 const items=[];for(const t of manifest.tables)for(const [index,row] of data[t.name].entries())items.push({kind:'row',table:t.name,index,row,...t.rowidAlias?{rowid:index+1}:{}});
 const parts=[];for(let i=0;i<items.length;i+=100)parts.push(await makePart(parts.length,items.slice(i,i+100)));manifest.partCount=parts.length;
 const content=new ContentVerifier(manifest),binding=new ArchiveVerifier(manifest);for(const part of parts){binding.add(part);for(const item of part.items)content.add(item)}
 return [manifest,...parts,{kind:'closing',partCount:parts.length,contentHash:content.digest(),archiveHash:binding.digest()}].map(r=>JSON.stringify(r)).join('\n')+'\n';
}
export async function operatorArchiveTamper({archive,req,json}){
 const traceRow=data=>data.grouping_proposals.find(row=>row.project==='synthetic-spool-traces'&&row.state==='undone');
 const editTrace=(data,edit)=>{const row=traceRow(data),review=JSON.parse(row.explanation);edit(review);row.explanation=canonical(review);};
 const probes=[
  d=>editTrace(d,review=>{review.affected[0].variant.trace.comparison='different';}),
  d=>editTrace(d,review=>{review.affected[0].variant.trace.id='a'.repeat(64);}),
  d=>editTrace(d,review=>{review.affected[3].variant.trace.unavailable='synthetic-spool-untrusted-reason';}),
  d=>editTrace(d,review=>{review.affected[0].variant.trace.rawContext={note:'synthetic-spool-untrusted-context'};}),
  d=>{d.event_grouping[0].fingerprint='0'.repeat(64)},
  d=>{const r=d.grouping_corrections.find(r=>r.state==='applied'),p=JSON.parse(r.plan);p.moves[0].to=p.moves[0].from;r.plan=JSON.stringify(p)},
  d=>{d.issue_assignments[0].project='operator-other'},
  d=>{d.suppression_policies[0].mode='regex'},
  d=>{const r=d.event_suppressions[0],why=JSON.parse(r.reasons);why[0].value='not a matching value';r.reasons=JSON.stringify(why)},
  d=>{d.deployment_manifests[0].repository='https://example.test/repo?credential=hidden'},
 ];
 for(const edit of probes){const response=await req('/api/restore','POST',await encode(archive,edit));assert.equal(response.status,400,'valid archive checksums do not excuse semantic operator tampering');assert.deepEqual(await json('/api/projects'),[],'semantic refusal mutates no project rows')}
 // Exercise historical explanations through independent restore, preserving
 // their original unavailable statement rather than deriving newer evidence.
 const legacyData=structuredClone(archive.data);
 for(const row of legacyData.grouping_proposals){
  const review=JSON.parse(row.explanation);review.trace='trace identity unavailable';
  for(const value of [...review.affected,...review.counterexamples.inside,...review.counterexamples.outside]){delete value.variant.trace;if(value.differing)value.differing=value.differing.filter(key=>key!=='trace');}
  row.explanation=canonical(review);
 }
 const legacy=await encode(archive,data=>{data.grouping_proposals=legacyData.grouping_proposals;}),worker=await startTestWorker(15553);
 try{
  const cookie=await signIn(worker.origin),response=await fetch(worker.origin+'/api/restore',{method:'POST',headers:{Cookie:cookie,Origin:worker.origin,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:legacy});
  assert.equal(response.status,200,'Historical proposal explanations still restore through the public door');
  const restored=await archiveProjection(await fetch(worker.origin+'/api/archive',{headers:{Cookie:cookie}}));
  assert.deepEqual(restored.data.grouping_proposals,legacyData.grouping_proposals,'Legacy inputs and explanations round trip without invented traces or decisions');
  const row=legacyData.grouping_proposals.find(row=>row.state==='undone'),detail=await fetch(worker.origin+'/api/projects/'+row.project+'/grouping-proposals/'+row.id,{headers:{Cookie:cookie}});
  assert.equal(detail.status,200);assert.equal((await detail.json()).explanation.trace,'trace identity unavailable');
 }finally{await worker.stop();}
 console.log('PROBE CTX-001 archive: independent private restore -> historical unavailable explanations preserved; malformed trace snapshots refused without rows.');
}
export async function operatorRetentionAndErasure({req,json}){
 const p='/api/projects/operator-other',key=await json(`${p}/keys`,'POST',{kind:'ingest'});await json(`${p}/releases`,'POST',{name:'retention-r1',build:'b1'});
 const policy=await json(`${p}/suppression-policies`,'POST',{field:'message',mode:'exact',value:'erase grouping evidence',enabled:true});
 const event={version:1,eventId:'retained-reuse',release:'retention-r1',build:'b1',environment:'production',type:'Error',message:'erase grouping evidence',frames:[{file:'app.js',line:1,column:0,function:'retention'}],breadcrumbs:[]};
 const ingest=()=>json('/api/ingest/operator-other','POST',event,{Cookie:'',Authorization:`Bearer ${key.key}`}),accepted=await ingest(),packet=await json(`${p}/issues/${accepted.issue}/packet`);
 const preview=await json(`${p}/corrections/preview`,'POST',{kind:'split',source:accepted.issue,revision:packet.issue.revision,events:[event.eventId]});await json(`${p}/corrections/${preview.id}/apply`,'POST',{confirm:true});
 const oldOccurrence=(await json(`${p}/issues/${preview.plan.target}/packet`)).events[0].occurrence;
 await new Promise(resolve=>setTimeout(resolve,10));await json(`${p}/retention`,'POST',{cutoff:Date.now(),apply:true});
 const erased=await archiveProjection(await req('/api/archive'));assert.ok(!erased.data.event_grouping.some(r=>r.project==='operator-other'));assert.ok(!erased.data.event_suppressions.some(r=>r.project==='operator-other'));assert.ok(!erased.data.events.some(r=>r.project==='operator-other'));
 await json(`${p}/suppression-policies/${policy.id}`,'PATCH',{...policy,enabled:false});const reused=await ingest();assert.equal(reused.outcome,'accepted');assert.equal(reused.issue,accepted.issue);const fresh=await json(`${p}/issues/${reused.issue}/packet`);assert.notEqual(fresh.events[0].occurrence,oldOccurrence);assert.equal(fresh.events[0].currentGrouping.correction,null);assert.equal((await req(`${p}/corrections/${preview.id}/undo`,'POST',{confirm:true})).status,409,'old correction cannot resurrect or move a reused event ID');
 const project='grouping-corpus',path=`/api/projects/${project}/erasure`,plan=await json(path);
 for(const table of ['grouping_corrections','event_grouping','issue_assignments','suppression_policies','event_suppressions','deployment_manifests'])assert.ok(plan.deleted[table]>0,'erasure traverses populated operator custody');
 const receipt=await followErasure(json,await json(path,'POST',{confirm:project,planHash:plan.planHash}));assert.equal(receipt.phase,'complete');
 const proposalPath='/api/projects/agent-grouping/erasure',proposalPlan=await json(proposalPath);assert.ok(proposalPlan.deleted.grouping_proposals>0,'Erasure lists populated agent proposals');const proposalReceipt=await followErasure(json,await json(proposalPath,'POST',{confirm:'agent-grouping',planHash:proposalPlan.planHash}));assert.equal(proposalReceipt.phase,'complete');
 const tracePath='/api/projects/synthetic-spool-traces/erasure',tracePlan=await json(tracePath);
 assert.ok(tracePlan.deleted.grouping_proposals>0);assert.ok(tracePlan.deleted.events>0);
 assert.equal((await followErasure(json,await json(tracePath,'POST',{confirm:'synthetic-spool-traces',planHash:tracePlan.planHash}))).phase,'complete');
 const after=await archiveProjection(await req('/api/archive'));
 assert.ok(!JSON.stringify(after.data).includes('synthetic-spool-traces'),'Project erasure removes trace captures, comparisons and proposal snapshots');for(const rows of Object.values(after.data))for(const row of rows)assert.notEqual(row.project,project,'erased operator project leaves no project row');assert.ok(!JSON.stringify(after.data).includes(project),'audit anonymization removes erased operator identifiers');
}
