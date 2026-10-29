import assert from 'node:assert/strict';

const status=async pending=>{const response=await pending;await response.arrayBuffer();return response.status;};

// The existing team journey supplies two current members of this project.
export async function busyMemberWrites(owner,first,second,reader,project) {
 const dsn=new URL(project.dsn),door='/api'+dsn.pathname+'/envelope/?sentry_key='+dsn.username+'&sentry_version=7';
 const send=async(level='error')=>{
  const event={event_id:crypto.randomUUID().replaceAll('-',''),release:'synthetic-spool-1',level,exception:{values:[{type:'BusyMemberError',value:'Member investigation during capture'}]}};
  assert.equal(await status(first.req(door,'POST','{}\n{"type":"event"}\n'+JSON.stringify(event),{Cookie:''})),200);
 };
 await send();
 const fixture=(await first.json('/api/projects/'+project.id+'/issues')).find(row=>row.title.startsWith('BusyMemberError:'));
 assert.ok(fixture);const base='/api/projects/'+project.id+'/issues/'+fixture.id;
 const priority=await first.json(base+'/priority'),discussion=await first.json(base+'/discussion'),suppression=await first.json(base+'/suppression');
 const before=(await first.json('/api/projects/'+project.id+'/issues')).find(row=>base.endsWith(row.id));
 await send();
 const incoming=(await first.json('/api/projects/'+project.id+'/issues')).find(row=>row.id===before.id);
 assert.equal(incoming.count,before.count+1,'the accepted event reaches the issue read by the member');
 assert.ok(incoming.revision>before.revision,'event admission still advances the issue revision');
 await first.json(base+'/priority','PUT',{priority:'medium',version:priority.version});
 const afterPriority=await first.json(base+'/discussion');
 assert.ok(afterPriority.activity.some(row=>row.kind==='priority'&&row.actor_kind==='member'&&row.actor_name&&row.detail.priority==='medium'),'busy priority changes retain their member actor');
 const unchanged=await first.json(base+'/priority');
 assert.equal(await status(second.req(base+'/priority','PUT',{priority:'high',version:priority.version})),409,'a second member cannot overwrite the same priority from the same read');
 assert.deepEqual(await first.json(base+'/priority'),unchanged);
 const note=await first.json(base+'/comments','POST',{body:'Investigation continues while events arrive',revision:discussion.revision});
 let saved=await first.json(base+'/discussion');
 assert.ok(saved.comments.some(row=>row.id===note.id&&row.body==='Investigation continues while events arrive'),'a comment read before event arrival is saved');
 await send();
 await first.json(base+'/comments/'+note.id,'PATCH',{body:'Updated busy investigation',version:note.version,revision:discussion.revision});
 saved=await first.json(base+'/discussion');
 assert.equal(await status(owner.req(base+'/comments/'+note.id,'PATCH',{body:'Stale concurrent replacement',version:note.version,revision:discussion.revision})),409,'the comment version protects against a concurrent authorized editor');
 assert.deepEqual(await first.json(base+'/discussion'),saved);
 const subscription=await second.json(base+'/discussion');await send();
 await second.json(base+'/subscription','PUT',{subscribed:false,version:subscription.subscription.version,revision:subscription.revision});
 const unsubscribed=await second.json(base+'/discussion');assert.equal(unsubscribed.subscription.subscribed,false);
 assert.equal(await status(second.req(base+'/subscription','PUT',{subscribed:true,version:subscription.subscription.version})),409,'the same subscription cannot be overwritten from a stale read');
 assert.deepEqual(await second.json(base+'/discussion'),unsubscribed);
 const snapshot=await first.json(base+'/discussion');
 assert.ok([401,403,404].includes(await status(reader.req(base+'/comments','POST',{body:'Denied busy comment'}))));
 assert.equal(await status(first.req(base+'/comments','POST',{body:''})),400);
 assert.deepEqual(await first.json(base+'/discussion'),snapshot,'denied and invalid busy writes change nothing');
 const input={version:suppression.version,suppression:{mode:'snooze',durationMs:1800000,reason:'Investigate accepted events for thirty minutes'},apply:false};
 const preview=await first.json(base+'/suppression','POST',input);
 const beforeApply=await first.json(base+'/suppression');
 assert.equal(await status(first.req(base+'/suppression','POST',{...input,suppression:{...input.suppression,durationMs:60000},apply:true,preview:preview.preview})),409,'the preview is bound to the chosen archive condition');
 assert.deepEqual(await first.json(base+'/suppression'),beforeApply,'a changed condition cannot mutate archive state');
 const beforeArchivePriority=await first.json(base+'/priority');
 await send();
 await first.json(base+'/suppression','POST',{...input,apply:true,preview:preview.preview});
 const archived=await first.json(base+'/suppression'),row=(await first.json('/api/projects/'+project.id+'/issues')).find(row=>row.id===before.id);
 assert.equal(row.state,'suppressed');assert.equal(row.priority,'medium','manual priority survives subsequent event admission');
 assert.ok(archived.history.some(row=>row.state==='active'&&row.mode==='snooze'&&row.deadline>Date.now()));
 assert.equal(await status(second.req(base+'/suppression','POST',{...input,apply:true,preview:preview.preview})),409,'a concurrent archive decision refuses the stale state');
 assert.deepEqual(await first.json(base+'/suppression'),archived);
 const afterArchivePriority=await first.json(base+'/priority');
 assert.equal(await status(first.req(base+'/priority','PUT',{priority:'high',version:beforeArchivePriority.version})),409,'priority edits also protect a genuinely changed issue state');
 assert.deepEqual(await first.json(base+'/priority'),afterArchivePriority);
 await first.json(base,'PATCH',{state:'open',revision:row.revision});
 const memberProject=(await second.json('/api/projects')).find(row=>row.id===project.id);
 assert.equal(memberProject.role,'member','the priority editor has ordinary project-member authority');
 const beforeLow=await second.json(base+'/priority');
 await second.json(base+'/priority','PUT',{priority:'low',version:beforeLow.version});
 assert.equal((await first.json(base+'/priority')).priority,'low');
 const manualChoice=(await first.json(base+'/discussion')).activity.find(row=>row.kind==='priority'&&row.detail.priority==='low');
 assert.ok(manualChoice,'the member choice appears in the shared issue timeline');
 assert.equal(manualChoice.actor_kind,'member');
 assert.equal(manualChoice.actor_name,second.member.name,'the timeline names the member who made the choice');
 assert.match(manualChoice.actor_label,/^audit:[a-f0-9]{32}$/);
 const beforeFatal=(await first.json('/api/projects/'+project.id+'/issues')).find(row=>row.id===fixture.id);
 await send('fatal');
 const afterFatal=(await first.json('/api/projects/'+project.id+'/issues')).find(row=>row.id===fixture.id);
 assert.equal(afterFatal.count,beforeFatal.count+1,'the later fatal event reaches the same member-prioritized issue');
 assert.equal(afterFatal.priority,'low','the member choice survives a later fatal escalation');
 assert.equal((await first.json(base+'/priority')).priority,'low','the priority door agrees with the issue list after escalation');
 assert.deepEqual((await first.json(base+'/discussion')).activity.find(row=>row.id===manualChoice.id),manualChoice,'low and its original member actor remain visible together after escalation');
 return {issue:fixture.id,actor:second.member.name};
}

/** Members use the same populated search selection for every bulk verb. */
export async function collaborativeBulk(owner,first,second,reader,project) {
 const root='/api/projects/'+project.id,dsn=new URL(project.dsn),door='/api'+dsn.pathname+'/envelope/?sentry_key='+dsn.username+'&sentry_version=7';
 for(const type of ['BulkMemberFirst','BulkMemberSecond','BulkMemberThird']){
  const event={event_id:crypto.randomUUID().replaceAll('-',''),release:'synthetic-spool-1',level:'warning',exception:{values:[{type,value:'Collaborative search selection'}]}};
  assert.equal(await status(first.req(door,'POST','{}\n{"type":"event"}\n'+JSON.stringify(event),{Cookie:''})),200);
 }
 const search=()=>first.json(root+'/issue-search?q=BulkMember'),read=()=>first.json(root+'/issues');
 const selected=async()=>({issues:(await search()).rows.map(({id,revision})=>({id,revision})),apply:false});
 const originals=(await search()).rows;assert.equal(originals.length,3);
 const discussed=root+'/issues/'+originals[0].id;
 await first.json(discussed+'/comments','POST',{body:'Review the searched checkout failure with @synthetic-spool-2'});
 let shared=await second.json(discussed+'/discussion');assert.ok(shared.subscription.subscribed&&shared.subscription.reasons.includes('mention'));
 await second.json(discussed+'/comments','POST',{body:'I reproduced the selected checkout failure.'});
 shared=await second.json(discussed+'/discussion');await second.json(discussed+'/subscription','PUT',{subscribed:true,version:shared.subscription.version});
 const conversation=await first.json(discussed+'/discussion');assert.ok(conversation.comments.some(row=>row.author===first.member.name&&row.body.includes('@synthetic-spool-2')));assert.ok(conversation.comments.some(row=>row.author===second.member.name&&row.body==='I reproduced the selected checkout failure.'));
 assert.equal((await second.json(discussed+'/discussion')).subscription.explicit,'subscribed');
 const snapshot=async()=>({issues:await read(),events:await Promise.all(originals.map(row=>first.json(root+'/issues/'+row.id+'/events'))),assignments:(await first.json(root+'/operator-state')).assignments});
 let input={...await selected(),action:'assign',member:'@synthetic-spool-2'},before=await snapshot();
 const plan=await first.json(root+'/bulk-triage','POST',input);assert.deepEqual(await snapshot(),before,'member assignment preview changes no issue, event or assignment');
 for(const actor of [reader])assert.ok([401,403,404].includes(await status(actor.req(root+'/bulk-triage','POST',{...input,apply:true,preview:plan.preview}))));
 assert.equal(await status(first.req(root+'/bulk-triage','POST',{...input,member:'@synthetic-spool-unknown',apply:true,preview:plan.preview})),400);
 assert.equal(await status(first.req(root+'/bulk-triage','POST',{...input,issues:[...input.issues,{id:'synthetic-spool-foreign',revision:1}],apply:true,preview:plan.preview})),409);
 assert.deepEqual(await snapshot(),before,'read-only, inaccessible assignee and foreign selection refusals preserve all selected data');
 await second.json(root+'/bulk-triage','POST',{...input,apply:true,preview:plan.preview});
 const assigned=(await first.json(root+'/operator-state')).assignments.filter(row=>originals.some(issue=>issue.id===row.issue));assert.equal(assigned.length,3);assert.ok(assigned.every(row=>/^audit:[a-f0-9]{32}$/.test(row.label)&&row.memberName===second.member.name));
 before=await snapshot();assert.equal(await status(first.req(root+'/bulk-triage','POST',{...input,apply:true,preview:plan.preview})),409);assert.deepEqual(await snapshot(),before,'a stale bulk assignment changes nothing');
 for(const issue of originals){const timeline=await first.json(root+'/issues/'+issue.id+'/discussion'),entry=timeline.activity.find(row=>row.kind==='assignment');assert.equal(entry.actor_name,second.member.name);assert.equal(entry.assignee_name,second.member.name);assert.equal(entry.detail.assignee,assigned.find(row=>row.issue===issue.id).label)}
 for(const state of ['acknowledged','resolved','suppressed','open']){
  input={...await selected(),state,...state==='resolved'?{resolution:'plain'}:{},...state==='suppressed'?{suppression:{mode:'forever',reason:'Investigating the searched checkout failures'}}:{}};
  before=await read();const preview=await first.json(root+'/bulk-triage','POST',input);assert.deepEqual(await read(),before,'bulk '+state+' preview changes no issue');
  await second.json(root+'/bulk-triage','POST',{...input,apply:true,preview:preview.preview});assert.ok((await search()).rows.every(row=>row.state===state));
 }
 // A three-issue merge must preserve every source, target and original identity.
 const target=originals[1].id;
 input={...await selected(),action:'merge',target};const preview=await first.json(root+'/bulk-triage','POST',input);before=await snapshot();
 assert.equal(preview.plan.moves.length,2);assert.deepEqual(preview.plan.issues.map(row=>row.id).toSorted(),originals.map(row=>row.id).toSorted());
 assert.deepEqual(await snapshot(),before,'merge preview moves no retained event or aggregate');
 assert.equal(await status(reader.req(root+'/bulk-triage','POST',{...input,apply:true,preview:preview.preview})),404);
 assert.equal(await status(second.req(root+'/bulk-triage','POST',{...input,target:originals[0].id,apply:true,preview:preview.preview})),409);
 assert.deepEqual(await snapshot(),before,'a refused merge changes no issue or occurrence');
 await first.json(root+'/issues/'+originals[0].id+'/comments','POST',{body:'Review the selected merge with @synthetic-spool-2'});
 const afterComment=await snapshot();assert.equal(await status(second.req(root+'/bulk-triage','POST',{...input,apply:true,preview:preview.preview})),409);assert.deepEqual(await snapshot(),afterComment,'a stale member decision cannot partially merge the selection');
 input={...await selected(),action:'merge',target};
 return {root,originals,input,target};
}
