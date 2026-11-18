import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { sentryOrganization } from '../../scripts/fixtures/sentry-organization.mjs';
import { exportCapture } from '../../scripts/sentry-export.mjs';
import { sentryDoorClient } from '../../scripts/sentry-import.mjs';
import { archiveProjection } from '../archive.mjs';
import { ruleReceiptScreens } from './rule-receipt.mjs';

// Independent traversal of the supplied API responses: never calls the product's enumerator or mapper.
function leaves(value,path='') {
 const entries=value&&typeof value==='object'?Object.entries(value):[];
 return entries.length?entries.flatMap(([key,v])=>leaves(v,path+'/'+key.replaceAll('~','~0').replaceAll('/','~1'))):[path];
}
// Schema-specific expectations are declared independently of the product's mapper.
function disposition(kind,path) {
 if(['members','ownership'].includes(kind))return 'rejected'; // These captures lack required source timestamps.
 if(kind==='teams'&&['/id','/slug','/name'].includes(path))return 'mapped';
 if(kind==='teams'&&path==='/dateCreated'||kind==='projects'&&/^\/teams\/\d+\/(id|slug)$/.test(path))return 'transformed';
 if(kind==='keys'&&['/public','/secret','/dsn/secret','/dsn/cdn'].includes(path))return 'redacted';
 const exact={projects:['/id','/slug'],releases:['/version'],issues:['/id']};
 const converted={projects:['/name','/dateCreated'],releases:['/dateCreated'],issues:['/title','/status','/firstSeen','/lastSeen'],events:['/eventID','/groupID','/dist','/environment','/release/version','/dateCreated','/entries/0/type','/entries/0/data/values/1/type','/entries/0/data/values/1/value','/entries/1/type']};
 if(exact[kind]?.includes(path))return 'mapped';
 if(converted[kind]?.includes(path))return 'transformed';
 if(kind==='releases'&&/^\/projects\/\d+\/slug$/.test(path))return 'mapped';
 if(kind==='events'&&(/^\/entries\/0\/data\/values\/1\/rawStacktrace\/frames\/0\/(filename|absPath|lineNo|colNo|function)$/.test(path)||/^\/entries\/1\/data\/values\/0\/(type|category|message|data\/(method|status_code))$/.test(path)))return 'transformed';
 return 'unmapped';
}
export async function fieldAccounting({origin,cookie,scratch,json,req}) {
 const receipt=[];
 for(const profile of ['baseline','scaled']) {
  const capture=sentryOrganization(profile),{bundle,receipt:acquisition}=exportCapture(capture);
  const path=join(scratch,`documented-${profile}.json`);await writeFile(path,JSON.stringify(bundle),{mode:0o600});
  const client=sentryDoorClient({endpoint:origin,cookie,organization:bundle.organization.slug});
  const before=await archiveProjection(await req('/api/archive'));
  const planned=await client.plan(await readFile(path));
  assert.deepEqual((await archiveProjection(await req('/api/archive'))).data,before.data,'documented-schema review has no native effect');
  const facts=planned.sentry;
  assert.ok(facts,'owner plan exposes source accounting');
  assert.deepEqual(facts.rules,{notImported:2,message:'Rules are not carried over yet: 2 rule(s) not imported'},'review names both source rule definitions without implying native carry');
  assert.equal(new Set(acquisition.inventory.map(row=>row.family)).size,8);
  assert.deepEqual(facts.capture, bundle.capture);
  console.log(`Sentry accounting ${profile}: planned ${planned.counts.input} records, ${facts.fields.length} field dispositions.`);
  assert.equal(planned.counts.duplicates,1);
  assert.equal(planned.counts.rejected,2,'member and ownership captures without source timestamps remain rejected, never invented');
  if(profile==='scaled')assert.ok(planned.counts.input>500,'scaled graph passes the former 500-record fence');
  const seen=new Set();let unique=0;
  for(const collection of bundle.collections)for(const page of collection.pages)for(const data of page.response) {
   const id=collection.kind==='ownership'?collection.project:collection.kind==='releases'?data.version:collection.kind==='events'?data.eventID:data.id;
   const sourceId=JSON.stringify([bundle.organization.slug,collection.project,id]),key=JSON.stringify([collection.kind,sourceId]);
   if(seen.has(key))continue;seen.add(key);unique++;
   const actual=facts.fields.filter(row=>row.kind===collection.kind&&row.sourceId===sourceId);
   assert.deepEqual(actual.map(row=>row.path).sort(),leaves(data).sort(),'every independent actual scalar/empty container has exactly one disposition');
   assert.ok(actual.every(row=>row.reason&&row.location&&Number.isSafeInteger(row.bytes)));
   for(const row of actual)assert.equal(row.disposition,disposition(collection.kind,row.path),`${collection.kind} ${row.path}: independent schema disposition`);
   if(!['projects','issues','events','releases','teams','members','ownership'].includes(collection.kind))assert.ok(actual.every(row=>['unmapped','redacted'].includes(row.disposition)),'unsupported families never claim native mapping');
  }
  assert.equal(unique+1,planned.counts.unique);
  const events=facts.fields.filter(row=>row.kind==='events');
  assert.ok(events.some(row=>row.path==='/entries/0/data/values/0/type'&&row.disposition==='unmapped'),'earlier exception is explicitly lost');
  assert.ok(events.some(row=>row.path==='/entries/0/data/values/1/rawStacktrace/frames/0/lineNo'&&row.disposition==='transformed'));
  assert.ok(events.some(row=>row.path==='/entries/0/data/values/1/stacktrace/frames/0/lineNo'&&row.disposition==='unmapped'),'unused symbolicated coordinates are named');
  assert.ok(facts.arrays.some(row=>row.path==='/entries/0/data/values'&&row.omitted.includes(0)),'array loss lists the exact earlier exception index');
  assert.equal(facts.loaders.length,1);assert.equal(facts.loaders[0].replacementScriptTag,null);assert.match(facts.loaders[0].reason,/No key was minted/);
  assert.equal(facts.loaders[0].settings.rateLimit.count,37);
  const args={planId:planned.planId,reviewedFingerprint:planned.fingerprint};
  // Invoke one batch directly, then reopen status and resume through the public client.
  const first=await client.call('apply',args);
  assert.ok(['applying','completed'].includes(first.job.state));
  if(profile==='scaled')assert.equal(first.job.state,'applying','large apply really pauses at a bounded prefix');
  const resumed=sentryDoorClient({endpoint:origin,cookie,organization:bundle.organization.slug});
  assert.equal((await resumed.status(planned.planId)).job.id,first.job.id);
  const applied=await resumed.apply(planned.planId,planned.fingerprint);assert.equal(applied.job.state,'completed');
  const report=await resumed.reconcile(planned.planId);assert.equal(report.ok,true);
  assert.deepEqual(report.sentry.rules,facts.rules,'the import receipt preserves the truthful rule-loss count');
  const history=(await json('/api/imports/business')).history.find(row=>row.planId===planned.planId);
  assert.deepEqual(history.sentry.rules,facts.rules,'the owner history receipt exposes the same rule-loss words');
  assert.equal(report.sentry.sourcePayloadBytes,facts.sourcePayloadBytes);
  assert.equal(report.sentry.byteLedger.reduce((n,r)=>n+r.sourceBytes,0),report.sentry.sourcePayloadBytes);
  assert.equal(report.sentry.byteLedger.reduce((n,r)=>n+r.nativeBytes,0),report.sentry.nativeBytes);
  for(const row of report.sentry.byteLedger)assert.equal(row.difference,row.sourceBytes-row.nativeBytes);
  assert.ok(report.sentry.nativeBytes>0);assert.notEqual(report.sentry.nativeBytes,report.sentry.sourcePayloadBytes);
  const count=new Set(capture.collections.find(c=>c.kind==='issues').responses.flatMap(p=>JSON.parse(p.body)).map(row=>row.id)).size;
  const kinds={project:1,release:1,issue:count,event:count,'import-proposal':1};
  assert.deepEqual(report.counts.byKind,kinds);
  const full=await archiveProjection(await req('/api/archive'));
  const imported=full.data.projects.find(p=>p.name==='Checkout 猫 café');assert.ok(imported);
  const nativeRulesBefore=before.data.alert_rules.filter(row=>row.project===imported.id).length;
  assert.equal(nativeRulesBefore,0,'the destination project starts without native alert rules');
  const nativeRules=await json(`/api/projects/${imported.id}/alerting/rules`);
  assert.deepEqual(nativeRules,[],'retained source definitions create no executable native rules');
  if(profile==='baseline')await ruleReceiptScreens(origin,cookie,imported.id);
  assert.deepEqual(await json(`/api/projects/${imported.id}/keys`),[],'source keys never become native authority');
  const issue=(await json(`/api/projects/${imported.id}/issues`))[0];
  const packet=await json(`/api/projects/${imported.id}/issues/${issue.id}/packet`);
  assert.equal(packet.events[0].event.frames[0].line,12,'reported converted coordinates actually reach native evidence');
  // Byte-identical reviewed apply is idempotent; a catch-up of exact source adds no rows.
  assert.equal((await resumed.apply(planned.planId,planned.fingerprint)).job.id,first.job.id);
  const same=await resumed.plan(await readFile(path),{catchup:true});
  assert.equal(same.summary.created,0);assert.equal(same.summary.updated,0);
  await resumed.apply(same.planId,same.fingerprint);
  assert.deepEqual((await archiveProjection(await req('/api/archive'))).data,full.data,'exact re-import preserves native rows and provenance');
  await resumed.undo(same.planId);await resumed.undo(planned.planId);
  assert.deepEqual((await archiveProjection(await req('/api/archive'))).data,before.data,'newest-first undo exactly restores populated native state');
  if(process.env.SPOOL_IMPORT_RECEIPT)await writeFile(join(dirname(process.env.SPOOL_IMPORT_RECEIPT),`${profile}-accounting.json`),JSON.stringify(report.sentry,null,2)+'\n');
  receipt.push({profile,sourceRuleDefinitions:report.sentry.rules.notImported,nativeAlertRulesBefore:nativeRulesBefore,nativeAlertRules:nativeRules.length,ruleReceipt:report.sentry.rules.message,sourceRecords:planned.counts.input,unique:planned.counts.unique,duplicates:planned.counts.duplicates,fields:facts.fields.length,arrays:facts.arrays.length,sourceBytes:acquisition.sourceBytes,bundleBytes:acquisition.bundleBytes,sourcePayloadBytes:facts.sourcePayloadBytes,nativeBytes:report.sentry.nativeBytes,byKind:kinds,interrupted:first.job.state==='applying',reconciled:report.ok});
 }
 // Refusals report every actual field of a rejected record without reflecting its values.
 const {bundle}=exportCapture(sentryOrganization());
 bundle.collections.find(c=>c.kind==='issues').pages[0].response[0].status='unsupported';delete bundle.capture;
 const client=sentryDoorClient({endpoint:origin,cookie,organization:bundle.organization.slug});
 // Change the overlapping duplicate too, keeping this a state rejection rather than a duplicate conflict.
 const rows=bundle.collections.find(c=>c.kind==='issues').pages[0].response;rows.at(-1).status='unsupported';
 const rejected=await client.plan(Buffer.from(JSON.stringify(bundle)));
 assert.ok(rejected.counts.rejected>0);
 const fields=rejected.sentry.fields.filter(row=>row.kind==='issues'&&row.sourceId.endsWith('"synthetic-issue-0"]'));
 assert.ok(fields.length&&fields.every(row=>row.disposition==='rejected'));
 assert.equal((await client.call('undo',{planId:rejected.planId})).state,'cancelled');
 const beforeRefusals=(await archiveProjection(await req('/api/archive'))).data;
 const conflict=structuredClone(bundle);conflict.collections.find(c=>c.kind==='issues').pages[0].response.at(-1).title='Conflicting duplicate';
 await assert.rejects(client.plan(Buffer.from(JSON.stringify(conflict))),error=>error.status===422&&error.code==='source_duplicate_source_conflict');
 const overflow=structuredClone(bundle),issueCollection=overflow.collections.find(c=>c.kind==='issues');
 issueCollection.pages=[{cursor:null,nextCursor:null,response:Array.from({length:1001},(_,i)=>({...rows[0],id:`synthetic-overflow-${i}`}))}];
 await assert.rejects(client.plan(Buffer.from(JSON.stringify(overflow))),error=>error.status===413&&error.code==='source_record_limit');
 const malformed=exportCapture(sentryOrganization()).bundle;delete malformed.capture;
 const malformedEvent=malformed.collections.find(c=>c.kind==='events').pages[0].response[0];
 malformedEvent.entries[0].data.values=[null];
 const malformedPlan=await client.plan(Buffer.from(JSON.stringify(malformed)));
 const malformedFields=malformedPlan.sentry.fields.filter(row=>row.kind==='events'&&row.sourceId.endsWith('"00000000000000000000000000000000"]'));
 assert.ok(malformedFields.length&&malformedFields.every(row=>row.disposition==='rejected'),'malformed rejected events still have a complete readable ledger');
 assert.equal((await client.call('undo',{planId:malformedPlan.planId})).state,'cancelled');
 const deepStack=exportCapture(sentryOrganization()).bundle;delete deepStack.capture;
 const event=deepStack.collections.find(c=>c.kind==='events').pages[0].response[0];
 const frame=event.entries[0].data.values[1].rawStacktrace.frames[0];
 event.entries[0].data.values[1].rawStacktrace.frames=Array.from({length:1002},(_,i)=>({...frame,lineNo:i+1}));
 const trimmed=await client.plan(Buffer.from(JSON.stringify(deepStack)));
 const omissions=trimmed.sentry.arrays.find(row=>row.sourceId.endsWith('"00000000000000000000000000000000"]')&&row.path==='/entries/0/data/values/1/rawStacktrace/frames');
 assert.deepEqual(omissions.omitted,[500,501],'middle-frame loss names every omitted array element');
 assert.equal((await client.call('undo',{planId:trimmed.planId})).state,'cancelled');
 assert.deepEqual((await archiveProjection(await req('/api/archive'))).data,beforeRefusals,'duplicate, quota and stack review paths preserve native state');
 console.log('Sentry fieldAccounting: complete independent path/array oracle, eight-family inventory, loader refusal, >500-record pause/resume, reconcile, exact re-import and undo passed.');
 if(process.env.SPOOL_IMPORT_RECEIPT)await writeFile(process.env.SPOOL_IMPORT_RECEIPT,JSON.stringify({synthetic:true,test:'fieldAccounting',profiles:receipt},null,2)+'\n');
 return receipt;
}
