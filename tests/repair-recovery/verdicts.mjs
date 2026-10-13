import assert from 'node:assert/strict';
import {reasons} from './state.mjs';
// Part 2: measured recovery, computed from stored data. Each state is reached
// by the real minified app on a second origin and the owner's recorded facts.
export async function verdictProof(app,{project,issue,repair,capture,old,release}){
 const {json,request}=app,read=async()=>(await json(`/api/projects/${project}/repairs?issue=${issue}`)).repairs.find(row=>row.id===repair.id);
 const fact=async(body)=>{const current=await read();return json(`/api/projects/${project}/repairs/${repair.id}/facts`,'POST',{...body,revision:current.revision});};
 const states={};
 // (a) Deployed in R, nothing captured from R yet.
 let current=await read();assert.equal(current.observation.verdict,'inconclusive');
 assert.deepEqual(reasons(current),['no_capture_from_release','flow_not_exercised','map_missing','client_loss_unknown']);
 assert.ok(current.observation.reasons.every(row=>row.reason.length>20),'every reason in plain words');assert.match(current.observation.limits,/never reached the affected flow/);states.a=reasons(current);
 // (b) Another failure arrives from R and R's map is stored; nobody recorded the exercised flow.
 const other=await capture.throw(release.name,release.build,'Track delivery');assert.notEqual(other.issue,issue);
 await json(`/api/projects/${project}/artifacts`,'POST',{release:release.name,build:release.build,debugId:'dispatch-map',map:capture.map});
 current=await read();assert.equal(current.observation.verdict,'inconclusive');assert.deepEqual(reasons(current),['flow_not_exercised','client_loss_unknown']);assert.equal(current.observation.evidence.releaseEvents,1);states.b=reasons(current);
 // (c) The owner records the exercised flow after the deploy; the window is healthy.
 current=await fact({fact:'exercised',note:'Prepared delivery for the North Market order in '+release.name});
 assert.equal(current.observation.verdict,'no_recurrence_after_exercise');assert.ok(current.facts.exercised.at>=current.facts.deployed.at);assert.deepEqual(current.observation.evidence.loss,[]);states.c=reasons(current);
 // (e) The same fingerprint from an older release is listed, not counted; no regression is invented.
 const older=await capture.throw(old.name,old.build);assert.equal(older.issue,issue,'same fingerprint');
 current=await read();assert.equal(current.observation.verdict,'no_recurrence_after_exercise');
 assert.deepEqual(current.observation.evidence.olderReleaseEvents.events.map(row=>[row.id,row.release]),[[older.eventId,old.name]]);assert.equal(current.observation.evidence.olderReleaseEvents.counted,false);
 assert.equal((await json(`/api/projects/${project}/issues/${issue}/packet`)).issue.state,'resolved','old-release recurrence does not regress');states.e={older:older.eventId};
 // (f) A rejected-event spike in the window downgrades (c).
 for(let n=0;n<3;n++){const response=await request(`/api/ingest/${project}`,'POST',{version:1,eventId:'invalid-'+n},{agent:capture.ingestKey});assert.equal(response.status,400);await response.body?.cancel();}
 current=await read();assert.equal(current.observation.verdict,'inconclusive');assert.deepEqual(reasons(current),['windowed_loss','client_loss_unknown']);
 assert.ok(current.observation.evidence.loss.some(row=>row.reason==='invalid'&&row.count>=3));states.f=reasons(current);
 // (d) The same fingerprint arrives in R: recurred, the issue regresses by the existing rule.
 const recurred=await capture.throw(release.name,release.build);assert.equal(recurred.issue,issue,'same fingerprint');
 current=await read();assert.equal(current.observation.verdict,'recurred');
 assert.deepEqual(current.observation.evidence.recurrence.events.map(row=>[row.id,row.release,row.sequence]),[[recurred.eventId,release.name,release.seq]]);
 assert.equal((await json(`/api/projects/${project}/issues/${issue}/packet`)).issue.state,'open','regressed by the existing rule');states.d={event:recurred.eventId};
 return {states,recurred,older,repair:current};
}
