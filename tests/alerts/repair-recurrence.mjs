import assert from 'node:assert/strict';
import {alertRuntime,event,rule,setup} from './runtime.mjs';

// The repair observation and its regression delivery must lead to the same
// accountable work, through native capture and the real scheduled handler.
export async function repairRecurrence(inbox) {
 const app=await alertRuntime(inbox);
 const project='/api/projects/web',alerting=project+'/alerting',followUp=project+'/follow-up';
 try {
  const auth=await setup(app);
  const regressionRule=await app.json(alerting+'/rules','POST',rule('mail',{kinds:['regression']}));
  const first=await app.json('/api/ingest/web','POST',event('synthetic-spool-repair-1'),auth);
  let repair=await app.json(project+'/repairs','POST',{
   issue:first.issue,link:'https://example.com/repair/1',note:'Guard the missing checkout value',
  });
  const facts=project+'/repairs/'+repair.id+'/facts';
  for(const fact of ['approved','merged'])repair=await app.json(facts,'POST',{fact,revision:repair.revision});
  await app.json(project+'/releases','POST',{name:'r2',build:'b2'});
  repair=await app.json(facts,'POST',{fact:'deployed',release:'r2',revision:repair.revision});
  repair=await app.json(facts,'POST',{fact:'exercised',note:'Exercised checkout after deployment',revision:repair.revision});
  assert.equal(repair.recordedBy,'owner');
  assert.equal(repair.facts.deployed.release,'r2');
  assert.equal(repair.facts.exercised.release,'r2');
  assert.ok(repair.facts.exercised.at>=repair.facts.deployed.at);
  const readRepair=async()=>(await app.json(project+'/repairs?issue='+first.issue)).repairs.find(row=>row.id===repair.id);
  const readIssue=async()=>(await app.json(project+'/issues')).find(row=>row.id===first.issue);
  const issue=await readIssue();
  await app.json(project+'/issues/'+issue.id,'PATCH',{state:'resolved',revision:issue.revision});
  const regressions=async()=>(await app.json(project+'/alerts')).filter(row=>row.issue===first.issue&&row.kind==='regression');

  // Older clients cannot reopen the resolved repair or invent a regression.
  await app.json('/api/ingest/web','POST',event('synthetic-spool-repair-2'),auth);
  const older=await readRepair();
  assert.equal(older.observation.evidence.recurrence.count,0);
  assert.equal(older.observation.evidence.olderReleaseEvents.count,1);
  assert.equal(older.observation.evidence.olderReleaseEvents.counted,false);
  assert.deepEqual(older.observation.evidence.olderReleaseEvents.events.map(row=>row.id),['synthetic-spool-repair-2']);
  assert.equal((await readIssue()).state,'resolved');
  assert.deepEqual(await regressions(),[]);

  await app.json(project+'/releases','POST',{name:'r3',build:'b3'});
  const release=(await app.json(project+'/releases')).find(row=>row.name==='r3');
  assert.ok(release.seq>repair.facts.deployed.sequence);
  const capture=event('synthetic-spool-repair-3',{release:'r3',build:'b3'});
  const recurred=await app.json('/api/ingest/web','POST',capture,auth);
  assert.equal(recurred.issue,first.issue);
  const observation=(await readRepair()).observation;
  assert.equal(observation.verdict,'recurred');
  assert.equal(observation.evidence.recurrence.count,1);
  assert.deepEqual(observation.evidence.recurrence.events.map(row=>[row.id,row.release,row.sequence]),[[capture.eventId,'r3',release.seq]]);
  assert.equal((await readIssue()).state,'open');
  const alerts=await regressions();assert.equal(alerts.length,1);
  const alert=alerts[0];
  assert.deepEqual(JSON.parse(alert.payload).release,{name:'r3',build:'b3',sequence:release.seq});
  await app.schedule(alert.created+1);
  const deliveries=async()=>(await app.json(alerting+'/deliveries')).filter(row=>row.alert_id===alert.id&&row.rule_id===regressionRule.id);
  const routed=await deliveries();assert.equal(routed.length,1);
  const delivery=routed[0];assert.equal(delivery.state,'accepted');
  assert.equal(delivery.channel,'mail');
  const timeline=await app.json(alerting+'/deliveries/'+delivery.id);
  assert.equal(timeline.attempts.length,1);
  assert.equal(timeline.delivery.code,'mail_development','accepted local mail is labelled as development suppression');
  assert.equal((await app.db.prepare('SELECT receipt FROM alert_mail_jobs WHERE id=?').bind(delivery.id).first()).receipt,null,'suppressed local mail has no provider receipt');

  const attention=async()=>(await app.json(followUp)).rows.filter(row=>row.source==='alert'&&row.source_id===delivery.id);
  const audit=async()=>(await app.json('/api/audit/export')).rows.filter(row=>row.action==='automation.follow_up');
  const due=delivery.created+24*60*60*1000;
  await app.json(followUp+'/alternate','PUT',{destination:'mail-v1',channel:'mail'});
  await app.schedule(due-1);
  assert.deepEqual(await attention(),[],'an accepted regression is not overdue before its unacknowledged deadline');
  const before=await audit();
  await Promise.all([app.schedule(due),app.schedule(due)]);
  const rows=await attention();assert.equal(rows.length,1);
  const row=rows[0];
  assert.equal(row.owner,'installation_owner');
  assert.equal(row.due,due);
  assert.equal(row.state,'overdue');
  assert.equal(row.reason,'unacknowledged');
  assert.equal(row.notices.length,1);
  const notice=row.notices[0];
  assert.deepEqual([notice.destination,notice.channel,notice.state,notice.code],['mail-v1','mail','completed','suppressed_locally']);
  assert.equal(notice.attempts,1);
  assert.equal(notice.log.length,1);
  assert.deepEqual([notice.log[0].state,notice.log[0].code],['completed','suppressed_locally']);
  const created=(await audit()).filter(fact=>!before.some(previous=>previous.id===fact.id));
  assert.equal(created.length,1,'the due recurrence commits exactly one creation fact');
  assert.deepEqual([created[0].source,created[0].actor_kind,created[0].subject_kind,created[0].outcome],['transaction','service','run','succeeded']);

  // Replayed intake and repeated ticks preserve the original work and notice.
  await app.json('/api/ingest/web','POST',capture,auth);
  await app.json('/api/ingest/web','POST',event('synthetic-spool-repair-4',{release:'r3',build:'b3'}),auth);
  await app.schedule(due+1000);await app.schedule(due+2000);
  assert.deepEqual(await attention(),rows);
  assert.deepEqual(await audit(),[...before,...created]);
  assert.deepEqual(await regressions(),alerts);
  const stableDeliveries=rows=>rows.map(({updated,...row})=>row);
  assert.deepEqual(stableDeliveries(await deliveries()),stableDeliveries(routed));
  assert.equal((await readRepair()).observation.evidence.recurrence.count,2,'a replay adds no occurrence while a fresh recurrence remains visible');
  assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM rer_mail_development_outbox').first()).n,0,'local mail remains suppressed');
  console.log('PROBE AI-004 acceptance 4: native repair facts and strictly newer capture -> recurred observation, one matching regression delivery, one owner follow-up at the 24-hour boundary, one suppressed alternate notice and one creation audit fact; older capture and replay controls passed.');
 } finally {await app.close();}
}
