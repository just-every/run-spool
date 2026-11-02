import {mock} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {alertRuntime,event,rule,setup} from './runtime.mjs';
import {readArchive,makePart,canonicalJson,sha256} from '../../src/modules/portability/index.mjs';
import {ArchiveVerifier,ContentVerifier} from '../../src/modules/portability/format.mjs';

const base='/api/projects/web/alerting';
const now=Date.UTC(2026,9,31,12),start=now-120000;
async function snapshot(app){
 const tables=['events','issues','alert_rules','alert_rule_filters','alert_cursors','alerts','alert_intents','alert_history','alert_mail_jobs'];
 return Promise.all(tables.map(async table=>(await app.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results));
}
async function recordsOf(archive){const rows=[];for await(const row of readArchive(new Response(archive).body))rows.push(row);return rows;}
// Repack a valid synthetic prior-schema archive to exercise the additive door.
async function withoutFilters(archive){
 const records=await recordsOf(archive),manifest=records[0];
 manifest.tables=manifest.tables.filter(t=>t.name!=='alert_rule_filters');
 if(manifest.schemaObjects)manifest.schemaObjects=manifest.schemaObjects.filter(t=>t.table!=='alert_rule_filters');
 if(manifest.migrations)manifest.migrations=manifest.migrations.filter(n=>n!=='0090_alert_rule_filters.sql');
 manifest.schema=await sha256(canonicalJson(manifest.tables.map(({name,sql})=>({name,sql}))));
 const parts=[];for(const record of records.filter(r=>r.kind==='part')){const items=record.items.filter(i=>i.table!=='alert_rule_filters');if(items.length)parts.push(await makePart(parts.length,items));}
 manifest.partCount=parts.length;
 const binding=new ArchiveVerifier(manifest),content=new ContentVerifier(manifest);
 for(const part of parts){binding.add(part);for(const item of part.items)content.add(item);}
 return [manifest,...parts,{...records.at(-1),partCount:parts.length,archiveHash:binding.digest(),contentHash:content.digest()}].map(r=>JSON.stringify(r)).join('\n')+'\n';
}
export async function environmentFilterFlow(inbox){
 const temp=await mkdtemp(resolve(tmpdir(),'spool-count-filter-')),state=resolve(temp,'state');let app;
 try{
  mock.timers.enable({apis:['Date'],now});
  app=await alertRuntime(inbox,{state,now});const auth=await setup(app);
  const filtered=rule('webhook',{name:'Production counts',kinds:['spike'],environment:'production'});
  const excluded=rule('webhook',{name:'Excluded count control',kinds:['spike'],environment:'absent'});
  const filteredId=await app.json(base+'/rules','POST',filtered),excludedId=await app.json(base+'/rules','POST',excluded);
  const legacy=await app.json(base+'/rules','POST',rule('webhook',{name:'All retained counts',kinds:['spike']}));
  const captures=[];
  for(const [id,environment] of [['synthetic-spool-101','production'],['synthetic-spool-102','staging'],['synthetic-spool-103','Production']]){
   const accepted=await app.json('/api/ingest/web','POST',event(id,{environment}),auth);captures.push(accepted);assert.equal(accepted.issue,captures[0].issue);
  }
  // Only the fixture's clock placement changes; captures, grouping and all alert effects use public doors.
  await app.db.prepare("UPDATE events SET received=? WHERE project='web'").bind(start+1000).run();
  const preview=body=>app.json(base+'/rules/preview','POST',{rule:body,windowStart:start});
  const before=await snapshot(app),first=await preview(filtered);
  assert.deepEqual(await snapshot(app),before,'preview never mutates product evidence or scheduling');
  assert.deepEqual([first.matchingCount,first.qualifyingIssues,first.issues],[1,0,[{id:captures[0].issue,count:1}]]);
  assert.deepEqual(first.window,{start,end:start+60000,durationMs:60000,complete:true});
  assert.equal(first.threshold,2);assert.equal(first.environment,'production');assert.equal(first.owner.role,'Installation owner');assert.match(first.owner.auditAlias,/^audit:/);
  assert.deepEqual(first.destination,{id:'webhook-v1',label:'Verified receiver',channel:'webhook',configured:true,reviewed:true});
  assert.ok(first.limitations.includes('Expired evidence')&&first.limitations.includes('missing capture')&&first.limitations.includes('not anomaly detection'));
  assert.ok((await app.db.prepare("SELECT COUNT(*) n FROM spool_audit_events WHERE action='alert.rule.preview' AND outcome='succeeded'").first()).n>0);
  assert.equal((await preview({...filtered,environment:null})).matchingCount,3);
  for(const [body,headers] of [
   [{rule:filtered,windowStart:start},{Cookie:''}],
   [{rule:filtered,windowStart:start},auth],
   [{rule:filtered,windowStart:start},{Origin:'https://foreign.invalid'}],
   [{rule:{...filtered,destination:'other-v1'},windowStart:start},{}],
   [{rule:{...filtered,environment:'production*'},windowStart:start},{}],
   [{rule:{...filtered,kinds:['new_issue']},windowStart:start},{}],
  ]){const before=await snapshot(app);assert.ok((await app.request(base+'/rules/preview','POST',body,headers)).status>=400);assert.deepEqual(await snapshot(app),before);}
  await app.json('/api/ingest/web','POST',event('synthetic-spool-104',{environment:'production'}),auth);
  await app.db.prepare("UPDATE events SET received=? WHERE project='web'").bind(start+1000).run();
  const ready=await preview(filtered);assert.equal(ready.matchingCount,2);assert.equal(ready.qualifyingIssues,1);
  await app.db.prepare('UPDATE alert_cursors SET next_start=?').bind(start).run();
  await Promise.all([app.schedule(now),app.schedule(now)]);await app.schedule(now);
  const alerts=await app.json('/api/projects/web/alerts'),forRule=id=>alerts.filter(a=>a.kind==='spike'&&JSON.parse(a.payload).rule.id===id);
  assert.equal(forRule(filteredId.id).length,1);assert.equal(JSON.parse(forRule(filteredId.id)[0].payload).window.count,2);
  assert.equal(forRule(excludedId.id).length,0,'excluded environments cannot reach threshold');
  assert.equal(forRule(legacy.id).length,1);assert.equal(JSON.parse(forRule(legacy.id)[0].payload).window.count,4,'legacy rules still count every environment');
  const deliveryId=forRule(filteredId.id)[0].id;
  assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM alert_intents WHERE rule_id=?').bind(filteredId.id).first()).n,1);
  assert.equal(inbox.requests.filter(r=>JSON.parse(r.body).alertId===deliveryId).length,1);
  await app.close();app=await alertRuntime(inbox,{state,now});
  await app.schedule(now);assert.equal(inbox.requests.filter(r=>JSON.parse(r.body).alertId===deliveryId).length,1,'restart never replays delivery');
  await app.json('/api/ingest/web','POST',event('synthetic-spool-104',{environment:'production'}),auth);await app.schedule(now);
  assert.equal((await preview(filtered)).matchingCount,2,'capture replay adds no matching occurrence');
  const revised=await app.json(base+'/rules/'+filteredId.id,'PUT',{...filtered,environment:'staging',enabled:false,revision:1});assert.equal(revised.revision,2);
  const stable=await snapshot(app);
  for(const [path,body,headers] of [
   [base+'/rules/'+filteredId.id,{...filtered,revision:1},{}],
   [base+'/rules/'+filteredId.id,{...filtered,revision:2},auth],
   ['/api/projects/other/alerting/rules/'+filteredId.id,{...filtered,revision:2},{}],
   [base+'/rules/'+filteredId.id,{...filtered,revision:2},{Origin:'https://foreign.invalid'}],
  ]){assert.ok((await app.request(path,'PUT',body,headers)).status>=400);assert.deepEqual(await snapshot(app),stable);}
  const archive=await (await app.request('/api/archive')).text();const records=await recordsOf(archive);
  const rows=records.filter(r=>r.kind==='part').flatMap(p=>p.items).filter(i=>i.kind==='row');
  assert.ok(rows.filter(r=>r.table==='alert_rules').every(r=>r.row.enabled===0));
  assert.equal(rows.find(r=>r.table==='alert_rule_filters'&&r.row.rule_id===filteredId.id).row.environment,'staging');
  await app.close();app=await alertRuntime(inbox,{now});
  assert.equal((await app.request('/api/restore','POST',archive,{'X-Confirm-Restore':'yes'})).status,200);
  const restored=(await app.json(base+'/rules')).find(r=>r.id===filteredId.id);assert.deepEqual([restored.environment,restored.enabled,restored.revision],['staging',0,2]);
  const sends=inbox.requests.length;await app.schedule(now+120000);assert.equal(inbox.requests.length,sends);
  const erasure=await app.json('/api/projects/web/erasure');assert.ok(erasure.deleted.alert_rule_filters===2);
  let erased=await app.json('/api/projects/web/erasure','POST',{confirm:'web',planHash:erasure.planHash});for(let n=0;erased.phase!=='complete'&&n<20;n++)erased=await app.json('/api/erasures/'+erased.id+'/resume','POST',{});assert.equal(erased.phase,'complete');
  assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM alert_rule_filters').first()).n,0);
  const refusedRestore=await app.request('/api/restore','POST',archive,{'X-Confirm-Restore':'yes'});assert.ok(refusedRestore.status>=400);assert.equal((await refusedRestore.json()).error,'erasure_epoch','erasure fence refuses resurrection');
  assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM alert_rule_filters').first()).n,0);
  await app.close();app=await alertRuntime(inbox,{now});
  const previous=await withoutFilters(archive);
  const previousRestore=await app.request('/api/restore','POST',previous,{'X-Confirm-Restore':'yes'});const previousResult=await previousRestore.json();assert.equal(previousRestore.status,200,'prior schema restores without predicates: '+JSON.stringify(previousResult));
  assert.ok((await app.json(base+'/rules')).every(r=>r.environment===null&&r.enabled===0));
  const ended=app.cookie;await app.request('/auth/signout','POST',{});const fenced=await snapshot(app);assert.equal((await app.request(base+'/rules/preview','POST',{rule:filtered,windowStart:start},{Cookie:ended})).status,401);assert.deepEqual(await snapshot(app),fenced);
  console.log('PROBE ALERT-001 filter and preview: public intake across exact-case environments -> preview 1 then 2 matching retained occurrences, excluded rule 0, legacy count 4; one matching alert, intent and local receiver request across concurrency, repetition and restart; stale and foreign writes refuse; disabled archives and erasure fences pass.');
 }finally{await app?.close();mock.timers.reset();await rm(temp,{recursive:true,force:true});}
}
