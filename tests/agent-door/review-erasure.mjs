import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {checkAgentArtifacts} from '../../src/modules/agent-door/index.ts';
import {projectAgentArtifacts,operatorAgentArtifacts} from '../../src/domain/agent-door/artifact-map.mjs';
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
 await checkAgentArtifacts(app.DB,projectAgentArtifacts);await checkAgentArtifacts(app.DB,operatorAgentArtifacts);
 const peerBefore=await app.DB.prepare('SELECT * FROM agent_door_reviews WHERE id=?').bind(review.id).first();
 const disposable=done(await app.call('spool.projects.create',{name:'Ephemeral privacy probe',idempotency_key:randomUUID()}));
 const approvalPolicy=heldPolicy();approvalPolicy.rules=approvalPolicy.rules.filter(rule=>rule.class!=='standard');await app.adopt(approvalPolicy);
 const heldArgs={project:disposable.id,name:'Private approval custody',build:'private-erasure-build',idempotency_key:'private-erasure-key-'+randomUUID()};
 const held=await app.call('spool.releases.record',heldArgs);
 const pending=held._meta?.['com.runeditrun/approval']??held._meta?.['com.runeditrun/error']?.approval;assert.ok(pending?.id,JSON.stringify(held));
 const approval=(await app.json('/agents/api/approvals/'+pending.id)).approval;
 await app.json('/agents/api/approvals/'+pending.id+'/approve','POST',{revision:approval.revision,summary_sha256:approval.summary_sha256});
 const auditRows=async()=>{const rows=[];let after='0';for(;;){const page=await app.json('/agents/api/audit?after='+encodeURIComponent(after));rows.push(...page.rows);if(!page.rows.length)return rows;after=page.cursor;}};
 const beforeAudit=await auditRows(),approvedRows=beforeAudit.filter(row=>row.approval?.id===pending.id);
 assert.deepEqual(approvedRows.map(row=>row.outcome),['pending','done']);
 for(const row of approvedRows)assert.deepEqual(row.approval.by,[row.sponsor.id],'Both pending and execution history name the real approver');
 await app.adopt();
 const erasure=done(await app.call('spool.privacy.preview',{project:disposable.id}));
 const accepted=done(await app.call('spool.privacy.erase',{project:disposable.id,planHash:erasure.planHash,idempotency_key:randomUUID()}));assert.equal(accepted.phase,'deleting');
 const foreign=await app.call('spool.privacy.continue',{id:accepted.id,idempotency_key:randomUUID()},{act:{sub:'another-agent',name:'Other triage',specialist:'triage engineer'}});assert.equal(foreign._meta['com.runeditrun/error'].code,'not_found','Accepted erasure custody cannot move to another agent');
 await app.adopt(autonomousPolicy(),{paused:true});
 const paused=await app.call('spool.privacy.continue',{id:accepted.id,idempotency_key:randomUUID()});assert.equal(paused._meta['com.runeditrun/error'].code,'agents_paused');
 assert.ok((await app.json('/api/projects')).some(p=>p.id===disposable.id),'Pause leaves the accepted job unexecuted');
 const completed=await app.json('/api/erasures/'+accepted.id+'/resume','POST',{});assert.equal(completed.phase,'complete','A real person retains native erasure authority');assert.ok((await app.DB.prepare("SELECT count(*) n FROM agent_door_events WHERE uri='' AND json_extract(event,'$.tombstone.erasure_id')=?").bind(accepted.id).first()).n>=1,'Native project erasure redacts retained private resource events in place');
 assert.ok(!(await app.json('/api/projects')).some(p=>p.id===disposable.id));
 const afterAudit=await auditRows();assert.deepEqual(afterAudit.slice(0,beforeAudit.length).map(row=>[row.id,row.sequence,row.at]),beforeAudit.map(row=>[row.id,row.sequence,row.at]),'Erasure retains the entire ordered decision chronology');
 for(const row of approvedRows){const retained=afterAudit.find(item=>item.id===row.id);assert.equal(retained.approval,null,'Erased approval attribution becomes value-free chronology');assert.equal(retained.resource,null);assert.equal(retained.tombstone.erasure_id,accepted.id);assert.equal(retained.sponsor.id,'');assert.equal(retained.sponsor.name,'');}
 const erasedApproval=await app.json('/agents/api/approvals/'+pending.id);assert.equal(erasedApproval.approval.code,'subject_erased','Private approval arguments and summary are no longer available');
 const savedApproval=await app.DB.prepare('SELECT saved,approvals,result FROM agent_door_approvals WHERE id=?').bind(pending.id).first();
 assert.equal(JSON.parse(savedApproval.saved).tombstone.erasure_id,accepted.id,'Private approval custody is replaced by its native tombstone');
 const redactedCalls=(await app.DB.prepare("SELECT * FROM agent_door_calls WHERE json_extract(outcome,'$.fields.tombstone.erasure_id')=?").bind(accepted.id).all()).results;
 assert.ok(redactedCalls.length);for(const row of redactedCalls){assert.equal(row.digest,'');assert.equal(row.key,'erased:'+row.decision_id);assert.ok(row.expires_at);}
 for(const table of projectAgentArtifacts.artifacts){const rows=(await app.DB.prepare('SELECT * FROM '+table.table).all()).results;const bytes=JSON.stringify(rows);for(const sentinel of [disposable.id,'Private approval custody','private-erasure-build',heldArgs.idempotency_key])assert.ok(!bytes.includes(sentinel),table.table+' retains no erased native payload or replay key');}
 assert.deepEqual(await app.DB.prepare('SELECT * FROM agent_door_reviews WHERE id=?').bind(review.id).first(),peerBefore,'Peer review custody stays byte for byte unchanged');
 assert.equal((await app.DB.prepare('SELECT 1 FROM releases WHERE project=?').bind(disposable.id).all()).results.length,0,'Private native content is deleted');
 await app.adopt();
 const replay=await app.call('spool.releases.record',heldArgs);assert.equal(replay._meta['com.runeditrun/error'].code,'subject_erased','An in-window native replay cannot execute or return the erased value');
 const undoErased=await app.request('/agents/api/approvals/'+pending.id+'/approve','POST',{revision:approval.revision,summary_sha256:approval.summary_sha256});assert.equal(undoErased.status,409,'An old approval cannot resurrect native data');await undoErased.body?.cancel();
 console.log('Spool review/erasure: independent native reviewer Undo with no agent identity, durable erasure custody, paused continuation and current person completion passed.');
}
