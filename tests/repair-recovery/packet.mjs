import assert from 'node:assert/strict';
import {cli,clientEnvironment} from '../agent-handoff/clients.mjs';
const previousKeys=['version','project','issue','events','loss','trust','sourceContent','verification','grouping','releaseHistory','links','bounds','gaps'];
// Part 3: before any repair the packet only gains an empty list.
export function packetBeforeRepair(packet){
 assert.deepEqual(Object.keys(packet).filter(key=>key!=='repairs'),previousKeys);assert.deepEqual(packet.repairs,[]);
 assert.deepEqual(packet.verification,{state:'inconclusive',reason:'No independently measured workflow exposure or postdeploy proof'});
 assert.ok(!packet.gaps.some(row=>row.code==='repairs_omitted'));
}
// After a recurrence a fresh packet names the failed repair, and the agent CLI
// keeps owner-recorded link and note text inside its untrusted fence.
export async function packetAfterRecurrence(app,{issue,repair,recurred,agentKey,note}){
 const packet=await app.json(`/api/projects/a/issues/${issue}/packet`,'GET',undefined,{agent:agentKey});
 assert.equal(packet.verification.state,'recurred');assert.equal(packet.verification.repair,repair.id);assert.match(packet.verification.limits,/client before transport/);
 const [listed]=packet.repairs;assert.equal(listed.id,repair.id);assert.equal(listed.recordedBy,'owner');assert.match(listed.trust,/untrusted data/);
 assert.equal(listed.observation.verdict,'recurred');assert.equal(listed.observation.evidence.recurrence.events[0].id,recurred.eventId);
 assert.deepEqual(listed.checks.map(row=>row.outcome),['passed','not_run']);assert.ok(listed.facts.approved&&listed.facts.merged&&listed.facts.deployed&&listed.facts.exercised);
 const markdown=await cli(['packet',issue,'--format','markdown'],clientEnvironment(app,agentKey));assert.equal(markdown.code,0);
 assert.match(markdown.stdout,/^UNTRUSTED TELEMETRY/);const fence=/\n(`+)json\n/.exec(markdown.stdout)[1],parts=markdown.stdout.split(fence);
 assert.equal(parts.length,3,'one fence');assert.ok(fence.length>8,'fence longer than the note backticks');
 assert.ok(!parts[0].includes(repair.link)&&!parts[2].includes(note.slice(0,30)),'link and note only inside the fence');
 const fenced=JSON.parse(parts[1].replace(/^json\n/,'')),summary=rows=>rows.map(row=>[row.id,row.link,row.note,row.observation.verdict,row.observation.evidence.recurrence.events.map(event=>event.id)]);
 assert.deepEqual(summary(fenced.repairs),summary(packet.repairs));
 return {bytes:Buffer.byteLength(JSON.stringify(packet)),verification:packet.verification};
}
