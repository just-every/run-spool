import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

export async function reviewErasureFlow(app,screens){
 const done=a=>{assert.ok(a&&!a.isError,a?._meta?.['com.runeditrun/error']?.code??'Missing result');return a.structuredContent;};
 const project='door-shop',issues=done(await app.call('spool.issues.list',{project})),issue=issues.items[0];
 const packet=done(await app.call('spool.packets.read',{project,issue:issue.id}));
 await app.adopt(heldPolicy());
 const preview=done(await app.call('spool.grouping.preview',{project,kind:'split',source:issue.id,revision:issue.revision,events:[packet.events[0].id],idempotency_key:randomUUID()}));
 const applied=await app.call('spool.grouping.apply',{project,id:preview.id,idempotency_key:randomUUID()});done(applied);
 const review=applied._meta['com.runeditrun/review'];assert.ok(review?.id);
 await app.adopt(autonomousPolicy(),{paused:true});
 const undone=await app.json('/agents/api/reviews/'+review.id+'/undo','POST',{});assert.equal(undone.review.state,'undone','The current person can perform native Undo while agents are paused');
 assert.equal((await app.json(`/api/projects/${project}/corrections`)).find(r=>r.id===preview.id).state,'undone');
 const activity=(await app.json(`/api/projects/${project}/operator-state`)).audit;
 assert.ok(activity.some(row=>row.kind==='grouping_applied'&&row.preparedBy?.label==='Agent door conformance for Dana Engineer'));
 assert.ok(activity.some(row=>row.kind==='grouping_undone'&&!row.preparedBy&&row.personActor?.label==='Dana Engineer'),'Undo records only its real reviewer');
 await screens?.capture('native-reviewer-audit',`/projects/${project}/issues/${issue.id}`,'Undid a grouping correction',page=>page.getByRole('button',{name:'Details: Operator audit',exact:true}).click());
 await app.adopt();
 const disposable=done(await app.call('spool.projects.create',{name:'Ephemeral privacy probe',idempotency_key:randomUUID()}));
 const erasure=done(await app.call('spool.privacy.preview',{project:disposable.id}));
 const accepted=done(await app.call('spool.privacy.erase',{project:disposable.id,planHash:erasure.planHash,idempotency_key:randomUUID()}));assert.equal(accepted.phase,'deleting');
 await app.adopt(autonomousPolicy(),{paused:true});
 const paused=await app.call('spool.privacy.continue',{id:accepted.id,idempotency_key:randomUUID()});assert.equal(paused._meta['com.runeditrun/error'].code,'agents_paused');
 assert.ok((await app.json('/api/projects')).some(p=>p.id===disposable.id),'Pause leaves the accepted job unexecuted');
 const completed=await app.json('/api/erasures/'+accepted.id+'/resume','POST',{});assert.equal(completed.phase,'complete','A real person retains native erasure authority');
 assert.ok(!(await app.json('/api/projects')).some(p=>p.id===disposable.id));
 await app.adopt();
 console.log('Spool review/erasure: real reviewer Undo with no agent identity, durable erasure custody, paused continuation and current person completion passed.');
}
