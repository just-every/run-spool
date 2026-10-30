import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

export async function reviewErasureFlow(app,screens){
 const done=a=>{assert.ok(a&&!a.isError,a?._meta?.['com.runeditrun/error']?.code??'Missing result');return a.structuredContent;};
 const email='independent-reviewer@spool.test',sub=randomUUID();
 await app.json('/api/organization/invites','POST',{email,name:'Riley Reviewer',role:'admin',grants:[]});
 const invitation=(await app.mail()).findLast(message=>message.to?.includes(email));
 const token=invitation?.text.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];assert.ok(token);
 const confirmed=await app.request('/auth/confirm','POST',{token},{Cookie:''});assert.equal(confirmed.status,303);
 const cookie=confirmed.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');await confirmed.body?.cancel();
 await app.syncSettings([{id:sub,email,name:'Riley Reviewer',role:'admin',invite:1}]);
 const project='door-shop',issues=done(await app.call('spool.issues.list',{project})),issue=issues.items[0];
 const packet=done(await app.call('spool.packets.read',{project,issue:issue.id}));
 const policy=heldPolicy();policy.reviewers=['person:'+sub];await app.adopt(policy);
 const preview=done(await app.call('spool.grouping.preview',{project,kind:'split',source:issue.id,revision:issue.revision,events:[packet.events[0].id],idempotency_key:randomUUID()}));
 const applied=await app.call('spool.grouping.apply',{project,id:preview.id,idempotency_key:randomUUID()});done(applied);
 const review=applied._meta['com.runeditrun/review'];assert.ok(review?.id);
 await app.adopt(autonomousPolicy(),{paused:true});
 const undone=await app.json('/agents/api/reviews/'+review.id+'/undo','POST',{}, {Cookie:cookie});assert.equal(undone.review.state,'undone','The current person can perform native Undo while agents are paused');
 assert.equal((await app.json(`/api/projects/${project}/corrections`)).find(r=>r.id===preview.id).state,'undone');
 const activity=(await app.json(`/api/projects/${project}/operator-state`)).audit;
 assert.ok(activity.some(row=>row.kind==='grouping_applied'&&row.preparedBy?.label==='Agent door conformance for Dana Engineer'));
 assert.ok(activity.some(row=>row.kind==='grouping_undone'&&!row.preparedBy&&row.personActor?.label==='Riley Reviewer'),'Undo records only its real reviewer');
 await screens?.capture('native-reviewer-audit',`/projects/${project}/issues/${issue.id}`,'Undid a grouping correction',page=>page.getByRole('button',{name:'Details: Operator audit',exact:true}).click());
 await app.adopt();
 const disposable=done(await app.call('spool.projects.create',{name:'Ephemeral privacy probe',idempotency_key:randomUUID()}));
 const erasure=done(await app.call('spool.privacy.preview',{project:disposable.id}));
 await app.adopt(heldPolicy());
 const eraseArgs={project:disposable.id,planHash:erasure.planHash,idempotency_key:randomUUID()};
 const held=await app.call('spool.privacy.erase',eraseArgs);
 const pending=held._meta?.['com.runeditrun/approval']??held._meta?.['com.runeditrun/error']?.approval;
 assert.ok(pending?.id,JSON.stringify(held._meta));
 const approvalId=pending.id;
 const {approval}=await app.json('/agents/api/approvals/'+approvalId);
 await app.json('/agents/api/approvals/'+approvalId+'/approve','POST',{revision:approval.revision,summary_sha256:approval.summary_sha256});
 const replay=await app.call('spool.privacy.erase',eraseArgs),accepted=done(replay);
 assert.equal(accepted.phase,'deleting');
 const sponsor=(await app.json('/api/organization')).members.find(member=>member.role==='owner').operator_id;
 assert.ok(replay._meta['com.runeditrun/receipt'].approved_by.includes(sponsor));
 await app.adopt();
 const foreign=await app.call('spool.privacy.continue',{id:accepted.id,idempotency_key:randomUUID()},{act:{sub:'another-agent',name:'Other triage',specialist:'triage engineer'}});assert.equal(foreign._meta['com.runeditrun/error'].code,'not_found','Accepted erasure custody cannot move to another agent');
 await app.adopt(autonomousPolicy(),{paused:true});
 const paused=await app.call('spool.privacy.continue',{id:accepted.id,idempotency_key:randomUUID()});assert.equal(paused._meta['com.runeditrun/error'].code,'agents_paused');
 assert.ok((await app.json('/api/projects')).some(p=>p.id===disposable.id),'Pause leaves the accepted job unexecuted');
 const completed=await app.json('/api/erasures/'+accepted.id+'/resume','POST',{});assert.equal(completed.phase,'complete','A real person retains native erasure authority');assert.ok(completed.deleted.agent_door_events>=1,'Native project erasure removes its retained private resource events');
 assert.ok(!(await app.json('/api/projects')).some(p=>p.id===disposable.id));
 assert.equal((await app.request('/agents/api/approvals/'+approvalId)).status,404,'Erasure removes private approval custody');
 const rows=[];let after='';
 while(true){const audit=await app.json('/agents/api/audit'+(after?'?after='+after:''));assert.equal(audit.differs_from_policy,0);rows.push(...audit.rows);if(audit.rows.length<200)break;after=audit.cursor;}
 const history=rows.filter(row=>row.approval?.id===approvalId);
 assert.deepEqual(history.map(row=>row.outcome).sort(),['done','pending','replayed']);
 for(const row of history){assert.deepEqual(row.approval.by,[sponsor],'Erased approval history names its actual approver');assert.equal(row.resource,null);assert.ok(!JSON.stringify(row).includes(disposable.id),'Audit history retains no erased native target');}
 await app.adopt();
 console.log('Spool review/erasure: independent native reviewer Undo with no agent identity, durable erasure custody, paused continuation and current person completion passed.');
}
