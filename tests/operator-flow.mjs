import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { archiveProjection } from './archive.mjs';

/** Public HTTP flows; caller owns the real Worker and authenticated owner. */
export async function operatorFlow({req,json}){
 const corpus=JSON.parse(await readFile(new URL('./fixtures/grouping-labelled.json',import.meta.url),'utf8'));
 const project=await json('/api/projects','POST',{id:corpus.project,name:'Independent grouping corpus'}),p=`/api/projects/${project.id}`;
 const packet=id=>json(`${p}/issues/${id}/packet`),admit=event=>json(`/api/ingest/${project.id}`,'POST',event,{Authorization:`Bearer ${project.ingestKey}`,Cookie:''});
 for(const r of corpus.registeredContexts)await json(`${p}/releases`,'POST',{name:r.release,build:r.build});
 const groups=[];
 for(const c of corpus.cases){const results=[];for(const row of c.events)results.push(await admit(row.event));groups.push({case:c,results});}
 assert.equal(groups[0].results[0].issue,groups[0].results[1].issue,'independent default same-incident relation');
 const falseMerge=groups.find(g=>g.case.expectedRelation==='separate-issues'),falseSplit=groups.find(g=>g.case.expectedRelation==='same-issue'&&g.results[0].issue!==g.results[1].issue);
 assert.ok(falseMerge&&falseSplit);assert.equal(falseMerge.results[0].issue,falseMerge.results[1].issue,'minified columns expose default false merge');assert.notEqual(falseSplit.results[0].issue,falseSplit.results[1].issue,'bundle location drift exposes default false split');
 const readArchive=async()=>archiveProjection(await req('/api/archive'));
 const original=await readArchive(),originalEvents=original.data.events.filter(e=>e.project===project.id);
 const receipts=async()=>{const a=await readArchive();return {outcomes:a.data.outcomes.filter(e=>e.project===project.id),alerts:a.data.alerts.filter(e=>e.project===project.id),history:a.data.alert_history.filter(e=>e.project===project.id)}};
 const before=await receipts(),source=falseMerge.results[0].issue,selected=falseMerge.case.events[1].event.eventId;
 let current=await packet(source);
 const preview=await json(`${p}/corrections/preview`,'POST',{kind:'split',source,revision:current.issue.revision,events:[selected]});
 assert.equal(preview.plan.moves.length,1);assert.equal(preview.plan.moves[0].event,selected);assert.equal(preview.plan.issues[0].after,current.issue.count-1);assert.equal((await packet(source)).issue.count,current.issue.count,'preview does not move anything');
 assert.equal((await req(`${p}/corrections/${preview.id}/apply`,'POST',{confirm:false})).status,400);
 await json(`${p}/corrections/${preview.id}/apply`,'POST',{confirm:true});
 const split=await packet(preview.plan.target);assert.equal(split.issue.count,1);assert.equal(split.events[0].originalGrouping.issue,source);assert.equal(split.events[0].currentGrouping.issue,preview.plan.target);assert.equal(split.events[0].currentGrouping.correction,preview.id);
 assert.deepEqual(await receipts(),before,'correction creates no loss counters, alert or delivery history');
 const moved=await readArchive();for(const e of originalEvents){const now=moved.data.events.find(r=>r.project===e.project&&r.id===e.id);assert.deepEqual({...now,issue:e.issue},e,'payload, digest, diagnostic, timestamps, occurrence and historical flag are immutable')}
 const retry=await admit(falseMerge.case.events[1].event);assert.equal(retry.outcome,'duplicate');assert.equal(retry.issue,preview.plan.target);
 await json(`${p}/corrections/${preview.id}/undo`,'POST',{confirm:true});assert.equal((await packet(source)).issue.count,current.issue.count);
 const from=falseSplit.results[1].issue,to=falseSplit.results[0].issue,a=await packet(from),b=await packet(to);
 const merge=await json(`${p}/corrections/preview`,'POST',{kind:'merge',source:from,revision:a.issue.revision,target:to,targetRevision:b.issue.revision});
 assert.deepEqual(merge.plan.issues.map(i=>[i.count,i.after]),[[a.issue.count,0],[b.issue.count,b.issue.count+a.issue.count]]);
 await json(`${p}/corrections/${merge.id}/apply`,'POST',{confirm:true});assert.equal((await packet(to)).issue.count,b.issue.count+a.issue.count);
 await json(`${p}/corrections/${merge.id}/undo`,'POST',{confirm:true});assert.equal((await packet(from)).issue.count,a.issue.count);
 // Stale previews and stale undo cannot overwrite newer triage or assignment.
 current=await packet(source);const stale=await json(`${p}/corrections/preview`,'POST',{kind:'split',source,revision:current.issue.revision,events:[selected]});
 await json(`${p}/issues/${source}/assignment`,'PATCH',{revision:current.issue.revision,label:'Triage operator'});
 assert.equal((await req(`${p}/corrections/${stale.id}/apply`,'POST',{confirm:true})).status,409);
 assert.equal((await req(`${p}/issues/${source}/assignment`,'PATCH',{revision:current.issue.revision,label:'Stale operator'})).status,409);
 current=await packet(source);await json(`${p}/issues/${source}/assignment`,'PATCH',{revision:current.issue.revision,label:'Release operator'});
 current=await packet(source);await json(`${p}/issues/${source}/assignment`,'PATCH',{revision:current.issue.revision,label:null});assert.equal((await json(`${p}/operator-state`)).assignments.find(a=>a.issue===source).label,null);
 current=await packet(source);const guarded=await json(`${p}/corrections/preview`,'POST',{kind:'split',source,revision:current.issue.revision,events:[selected]});await json(`${p}/corrections/${guarded.id}/apply`,'POST',{confirm:true});
 const targetPacket=await packet(guarded.plan.target);await json(`${p}/issues/${guarded.plan.target}`,'PATCH',{revision:targetPacket.issue.revision,state:'acknowledged'});assert.equal((await req(`${p}/corrections/${guarded.id}/undo`,'POST',{confirm:true})).status,409);
 // Scope and same-origin fences on each public mutation family.
 const agent=await json(`${p}/keys`,'POST',{kind:'agent'}),deploy=await json(`${p}/keys`,'POST',{kind:'deploy'});
 const mutations=[[`${p}/issues/${source}/assignment`,'PATCH',{revision:0,label:'No'}],[`${p}/suppression-policies`,'POST',{field:'message',mode:'substring',value:'failure',enabled:true}],[`${p}/corrections/preview`,'POST',{kind:'merge'}],[`${p}/corrections/${guarded.id}/undo`,'POST',{confirm:true}]];
 for(const [path,method,value] of mutations){for(const token of [project.ingestKey,agent.key,deploy.key])assert.ok([401,403].includes((await req(path,method,value,{Cookie:'',Authorization:`Bearer ${token}`})).status));assert.equal((await req(path,method,value,{Origin:'https://foreign.example'})).status,403);assert.equal((await req(path,method,value,{Cookie:''})).status,401)}
 const outside=await json('/api/projects','POST',{id:'operator-other',name:'Isolation'});assert.equal((await req(`/api/projects/${outside.id}/issues/${source}/assignment`,'PATCH',{revision:(await packet(source)).issue.revision,label:'Wrong project'})).status,409);
 // Suppression snapshots matching sanitized accepted evidence; no alert or regression, but counts survive.
 const base=structuredClone(corpus.cases[0].events[0].event),fp=(await packet(groups[0].results[0].issue)).issue.fingerprint;
 for(const [field,mode,value] of [['fingerprint','exact',fp],['release','exact',base.release],['message','substring','reading']]){
  const policy=await json(`${p}/suppression-policies`,'POST',{field,mode,value,enabled:true}),id=`suppressed-${field}`;
  let input={...base,eventId:id,frames:base.frames.map((frame,index)=>index===0?{...frame,function:field+'PolicyProbe'}:frame)};
  if(field==='fingerprint'){
   const resolved=await packet(groups[0].results[0].issue);await json(`${p}/issues/${resolved.issue.id}`,'PATCH',{revision:resolved.issue.revision,state:'resolved'});
   await json(`${p}/releases`,'POST',{name:'policy-next-release',build:'policy-next-build'});
   input={...base,eventId:id,release:'policy-next-release',build:'policy-next-build'};
  }
  const previous=await readArchive(),accepted=await admit(input),result=await packet(accepted.issue),event=result.events.find(e=>e.id===id);assert.ok(event.suppression.some(r=>r.id===policy.id&&r.field===field));
  const after=await readArchive();assert.equal(after.data.alerts.length,previous.data.alerts.length);assert.equal(after.data.alert_history.length,previous.data.alert_history.length);assert.equal(after.data.events.length,previous.data.events.length+1);
  assert.equal((await req(`${p}/suppression-policies/${policy.id}`,'PATCH',{...policy,revision:0,enabled:false})).status,409);
  await json(`${p}/suppression-policies/${policy.id}`,'PATCH',{...policy,enabled:false});assert.ok((await packet(accepted.issue)).events.find(e=>e.id===id).suppression.some(r=>r.id===policy.id),'disable preserves suppression receipt');
 }
 assert.equal((await req(`${p}/suppression-policies`,'POST',{field:'message',mode:'regex',value:'.*',enabled:true})).status,400);
 // Real release registration records deployment independently of sequence, scoped by environment.
 const manifest={commitSha:'a'.repeat(40),repository:'https://example.test/team/repo',deployedAt:'2026-10-10T12:00:00.000Z',environment:'production'};
 const deployHeaders={Cookie:'',Authorization:`Bearer ${deploy.key}`};
 await json(`${p}/releases`,'POST',{name:base.release,build:base.build,manifest},deployHeaders);
 assert.equal((await req(`${p}/releases`,'POST',{name:base.release,build:base.build,manifest},deployHeaders)).status,200);
 assert.equal((await req(`${p}/releases`,'POST',{name:base.release,build:base.build,manifest:{...manifest,commitSha:'b'.repeat(40)}},deployHeaders)).status,409);
 for(const repository of ['http://example.test/repo','https://user@example.test/repo','https://example.test/repo?token=x','https://example.test/repo#main'])assert.equal((await req(`${p}/releases`,'POST',{name:base.release,build:base.build,manifest:{...manifest,repository}})).status,400);
 assert.equal((await req(`/api/projects/${outside.id}/releases`,'POST',{name:base.release,build:base.build,manifest},deployHeaders)).status,403);
 await admit({...base,eventId:'deployment-known',environment:'production'});let observed=await packet(groups[0].results[0].issue);assert.equal(observed.deployments.last.manifest.commit_sha,manifest.commitSha);
 await admit({...base,eventId:'deployment-unknown',environment:'staging'});observed=await packet(groups[0].results[0].issue);assert.equal(observed.deployments.last.manifest,null,'production binding cannot attribute staging');
 await admit({...base,eventId:'rollback',environment:'production'});observed=await packet(groups[0].results[0].issue);assert.equal(observed.deployments.last.release,base.release);assert.equal(observed.deployments.last.manifest.commit_sha,manifest.commitSha);
 return {project:project.id,correctedIssue:guarded.plan.target,correction:guarded.id};
}
