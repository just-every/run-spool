import {testAndReview} from './alerts/runtime.mjs';
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
 const entries=groups.find(g=>g.case.id==='distinct-entry-names');
 assert.notEqual(entries.results[0].issue,entries.results[1].issue,'ordinary entry names remain separate issues');
 const entryAlerts=(await json(`${p}/alerts`)).filter(row=>row.kind==='new_issue'&&entries.results.some(result=>result.issue===row.issue));
 assert.equal(entryAlerts.length,2,'each distinct entry creates its own new-issue alert');
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
 // TEAM-004: the original keeps its short ID, the split-out issue takes the next one, and undo returns it to the original.
 const shortIds=async()=>Object.fromEntries((await json(`${p}/issues`)).map(i=>[i.id,i.short_id])),splitIds=await shortIds();
 assert.ok(splitIds[source]&&splitIds[preview.plan.target]&&splitIds[source]!==splitIds[preview.plan.target]);assert.equal((await packet(splitIds[preview.plan.target])).issue.id,preview.plan.target);assert.equal((await packet(splitIds[source])).issue.id,source);
 await json(`${p}/corrections/${preview.id}/undo`,'POST',{confirm:true});assert.equal((await packet(source)).issue.count,current.issue.count);
 assert.equal((await packet(splitIds[source])).issue.short_id,splitIds[source],'the original ID never moves');assert.equal((await packet(splitIds[preview.plan.target])).issue.id,source,'undo: the split-out ID resolves where its occurrences returned');
 const from=falseSplit.results[1].issue,to=falseSplit.results[0].issue,a=await packet(from),b=await packet(to);
 const merge=await json(`${p}/corrections/preview`,'POST',{kind:'merge',source:from,revision:a.issue.revision,target:to,targetRevision:b.issue.revision});
 assert.deepEqual(merge.plan.issues.map(i=>[i.count,i.after]),[[a.issue.count,0],[b.issue.count,b.issue.count+a.issue.count]]);
 await json(`${p}/corrections/${merge.id}/apply`,'POST',{confirm:true});assert.equal((await packet(to)).issue.count,b.issue.count+a.issue.count);
 // TEAM-004: the absorbed short ID is an alias of the survivor in packets and search; guarded undo restores it.
 const merged=await packet(a.issue.short_id.toLowerCase());assert.deepEqual([merged.issue.id,merged.shortIdRequest.alias,merged.issue.short_id_aliases],[to,true,[a.issue.short_id]]);
 assert.deepEqual((await json(`${p}/issue-search?q=${a.issue.short_id}`)).rows.map(r=>r.id),[to]);assert.equal((await packet(from)).issue.short_id_resolves_to,b.issue.short_id);
 await json(`${p}/corrections/${merge.id}/undo`,'POST',{confirm:true});assert.equal((await packet(from)).issue.count,a.issue.count);
 const unmerged=await packet(a.issue.short_id);assert.deepEqual([unmerged.issue.id,unmerged.shortIdRequest.alias,unmerged.issue.short_id_aliases],[from,false,[]],'undo restores the pre-merge mapping');
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
 await agentProposalFlow({req,json},corpus);
 return {project:project.id,correctedIssue:guarded.plan.target,correction:guarded.id};
}

async function agentProposalFlow({req,json},corpus){
 const name='AI-005 agent grouping proposals show counterexamples and rate, alert and repair effects, and stay reversible';
 const project=await json('/api/projects','POST',{id:'agent-grouping',name:'Release grouping investigation'}),root='/api/projects/'+project.id,endpoint=root+'/grouping-proposals';
 const grant=await json(root+'/keys','POST',{kind:'agent'}),deploy=await json(root+'/keys','POST',{kind:'deploy'}),agent={Cookie:'',Authorization:'Bearer '+grant.key};
 const ingest=event=>json('/api/ingest/'+project.id,'POST',event,{Cookie:'',Authorization:'Bearer '+project.ingestKey});
 const event={...structuredClone(corpus.cases.find(c=>c.id==='minified-false-merge').events[0].event),release:'grouping-r1',build:'grouping-b1',eventId:'proposal-first'};
 await json(root+'/releases','POST',{name:event.release,build:event.build});
 const first=await ingest(event),packet=()=>json(`${root}/issues/${first.issue}/packet`);
 const repair=await json(root+'/repairs','POST',{issue:first.issue,link:'https://example.test/repairs/grouping',note:'Preserve recurrence through a rebuilt release'});
 await json(root+'/releases','POST',{name:'grouping-r2',build:'grouping-b2'});
 await json(root+'/repairs/'+repair.id+'/facts','POST',{revision:repair.revision,fact:'deployed',release:'grouping-r2'});
 const recurrence={...event,eventId:'proposal-recurred',release:'grouping-r2',build:'grouping-b2'};await ingest(recurrence);
 const deceptive={...recurrence,eventId:'proposal-deceptive',frames:event.frames.map((frame,index)=>index?frame:{...frame,column:frame.column+30})};await ingest(deceptive);
 const rebuilt={...recurrence,eventId:'proposal-rebuilt',frames:event.frames.map(frame=>({...frame,file:'https://assets.example.test/rebuilt.js',line:frame.line+100}))},other=await ingest(rebuilt);
 assert.notEqual(first.issue,other.issue,'A rebuilt stack can split the same failure');
 let original=await packet();await json(root+'/issues/'+first.issue+'/assignment','PATCH',{revision:original.issue.revision,label:'Runtime engineer'});
 let destination=await json(root+'/issues/'+other.issue+'/packet');await json(root+'/issues/'+other.issue+'/assignment','PATCH',{revision:destination.issue.revision,label:'Release engineer'});
 const destinationId=(await json(root+'/alerting/destinations','POST',{label:'Grouping investigation',recipient:'grouping-alerts@example.test'})).id;
 await testAndReview(json,root+'/alerting',destinationId);
 const rule=await json(root+'/alerting/rules','POST',{name:'Two matching failures',enabled:true,channel:'mail',destination:destinationId,kinds:['spike','new_issue'],windowMs:60000,threshold:2});
 const input=async(kind='split')=>{const p=await packet(),target=await json(root+'/issues/'+other.issue+'/packet');return {kind,source:first.issue,revision:p.issue.revision,...kind==='split'?{events:['proposal-recurred','proposal-deceptive']}:{target:other.issue,targetRevision:target.issue.revision},variants:['grouping-r1','grouping-r2'].map(release=>({stack:JSON.stringify(p.events.find(e=>e.id==='proposal-first').event.frames),release,route:'/checkout'})),rationale:'These similar checkout failures may be one incident; compare the rebuilt release. token=private-canary alice@example.test',window:{start:Date.now()-60000,end:Date.now()+1}}};
 const projectRows=async()=>{const a=await archiveProjection(await req('/api/archive'));return Object.fromEntries(Object.entries(a.data).filter(([table])=>table!=='grouping_proposals').map(([table,rows])=>[table,rows]));};
 const before=await projectRows(),historical=await input('merge');historical.window={start:Date.now()-120000,end:Date.now()-60000};const rejected=await json(endpoint,'POST',historical,agent);
 assert.match(rejected.label,/^proposed by agent audit:[a-f0-9]{32}$/);assert.ok(!Object.hasOwn(rejected,'explanation'),'Agent grant gains no explanation read beyond packets');assert.ok(!JSON.stringify(rejected).includes('private-canary'));assert.ok(!JSON.stringify(rejected).includes('alice@example.test'));
 assert.deepEqual(await projectRows(),before,'A proposed record changes no archive grouping, alert, assignment, suppression, accepted counter or repair projection');
 let detail=await json(endpoint+'/'+rejected.id);assert.ok(detail.explanation.counterexamples.inside.length);assert.ok(detail.explanation.counterexamples.outside.some(e=>e.event==='proposal-rebuilt'));assert.ok(detail.explanation.repair.observations.find(r=>r.id===repair.id).observation.evidence.window.end>=detail.explanation.repair.observations.find(r=>r.id===repair.id).observation.evidence.release.registered,'A historical rate window cannot backdate the current repair observation');assert.equal(detail.explanation.ownership.length,2);assert.deepEqual(new Set(detail.explanation.ownership.map(r=>r.label)),new Set(['Runtime engineer','Release engineer']));
 await json(endpoint+'/'+rejected.id+'/reject','POST',{});assert.equal((await json(endpoint+'/'+rejected.id)).state,'rejected');assert.deepEqual(await projectRows(),before,'Reject changes no application projection');
 const proposed=await json(endpoint,'POST',await input(),agent);detail=await json(endpoint+'/'+proposed.id);
 assert.equal(detail.explanation.affected.length,2);assert.deepEqual(new Set(detail.explanation.affected.map(e=>e.event)),new Set(['proposal-recurred','proposal-deceptive']));assert.equal(detail.explanation.rates.find(r=>r.issue===first.issue).delta,-2);assert.equal(detail.explanation.trace,'trace identity unavailable');
 const condition=detail.explanation.alerts.rules.find(r=>r.id===rule.id).issues.find(i=>i.issue===first.issue);assert.equal(condition.before,3);assert.equal(condition.after,1);assert.equal(condition.conditionBefore,true);assert.equal(condition.conditionAfter,false);assert.ok(detail.explanation.alerts.open.length);
 const observation=detail.explanation.repair.observations.find(r=>r.id===repair.id);assert.equal(observation.observation.verdict,'recurred');
 for(const token of [project.ingestKey,deploy.key])for(const [path,body] of [[endpoint,await input()],[endpoint+'/'+proposed.id+'/approve',{}],[endpoint+'/'+proposed.id+'/reject',{}]])assert.ok([401,403].includes((await req(path,'POST',body,{Cookie:'',Authorization:'Bearer '+token})).status));
 const approved=await json(endpoint+'/'+proposed.id+'/approve','POST',{});assert.equal(approved.state,'approved');assert.deepEqual(approved.preview.plan.moves.map(m=>m.event),detail.explanation.affected.map(m=>m.event));assert.deepEqual(await projectRows(),{...before,grouping_corrections:(await archiveProjection(await req('/api/archive'))).data.grouping_corrections},'Approval creates only the existing explicit correction preview');
 assert.equal((await req(root+'/corrections/'+approved.correction+'/apply','POST',{confirm:false})).status,400);
 original=await packet();await json(root+'/corrections/'+approved.correction+'/apply','POST',{confirm:true});assert.equal((await json(endpoint+'/'+proposed.id)).state,'applied');
 const after=await json(root+'/repairs?issue='+first.issue);assert.equal(after.repairs[0].observation.verdict,'recurred');assert.ok(after.repairs[0].observation.reasons.some(r=>r.code==='grouping_changed'));
 await json(root+'/corrections/'+approved.correction+'/undo','POST',{confirm:true});assert.equal((await json(endpoint+'/'+proposed.id)).state,'undone');
 const undone=await packet();assert.equal(undone.issue.count,original.issue.count);for(const old of original.events){const now=undone.events.find(e=>e.id===old.id);assert.deepEqual(now.event,old.event);assert.equal(now.originalGrouping.issue,first.issue);}
 const repairAfterUndo=(await json(root+'/repairs?issue='+first.issue)).repairs[0];assert.equal(repairAfterUndo.observation.verdict,'recurred');assert.ok(repairAfterUndo.observation.reasons.some(r=>r.code==='grouping_changed'));
 const stale=await json(endpoint,'POST',await input(),agent),current=await packet();await json(root+'/issues/'+first.issue+'/assignment','PATCH',{revision:current.issue.revision,label:'Later owner decision'});assert.equal((await req(endpoint+'/'+stale.id+'/approve','POST',{})).status,409);assert.equal((await json(endpoint+'/'+stale.id)).state,'stale');
 const untouched=await json(endpoint,'POST',await input('merge'),agent);assert.equal((await json(endpoint+'/'+untouched.id)).state,'proposed');
 const safe=(await json('/api/audit?limit=100')).rows;assert.ok(safe.some(r=>r.action==='grouping.propose'&&r.actor_kind==='service'&&r.actor_label===proposed.actor));assert.ok(!JSON.stringify(safe).includes('private-canary'));
 console.log(name+' passed.');
}
