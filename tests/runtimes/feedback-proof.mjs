import assert from 'node:assert/strict';
import {archiveProjection} from '../archive.mjs';
import {objectJson} from '../../src/domain/sentry/wire.ts';
import {exceptionTypes, outcomeMap} from './harness.mjs';

// Compare independently generated SDK identities by their error and feedback contents.
// Each event keeps its own report group, so two reports on one occurrence cannot
// stand in for one report on each of the handled and restarted occurrences.
const ordered=rows=>rows.map(row=>JSON.stringify(row)).sort();
export async function feedbackProof({app,project,details,referenceSent}){
 const sent=referenceSent.filter(item=>item.type==='feedback').map(item=>objectJson(item.bytes));
 assert.ok(sent.length,'the reference SDK sends real feedback');
 const referenceEvents=referenceSent.filter(item=>item.type==='event').map(item=>objectJson(item.bytes));
 for(const report of sent)assert.ok(referenceEvents.some(event=>event.event_id===report.contexts.feedback.associated_event_id),'the SDK report references an error it actually sent');
 const expected=referenceEvents.map(event=>[
  event.exception.values.map(value=>value.type),
  sent.filter(report=>report.contexts.feedback.associated_event_id===event.event_id).map(report=>report.contexts.feedback.message).sort(),
 ]);
 const root=`/api/projects/${project.id}`,feedback=await app.json(root+'/feedback');
 assert.equal(feedback.total,sent.length,'every SDK-produced report is retained');
 assert.equal(feedback.items.length,sent.length,'the read includes every retained report');
 assert.equal(feedback.next,null,'no report is hidden beyond this page');
 assert.equal((await outcomeMap(app,project.id)).get('feedback_accepted'),sent.length,'feedback acceptance counts equal the SDK-produced quantity');
 assert.equal(new Set(feedback.items.map(row=>row.id)).size,sent.length,'each report has a distinct retained identity');
 const events=details.flatMap(({issue,events})=>events.map(event=>({issue,event})));
 const archive=await archiveProjection(await app.request('/api/archive'));
 const retained=archive.data.feedback.filter(row=>row.project===project.id);
 assert.deepEqual(retained.map(row=>row.id).sort(),feedback.items.map(row=>row.id).sort(),'archive custody includes exactly the public feedback reports');
 for(const report of feedback.items){
  const match=events.find(({event})=>event.id===report.eventId);
  assert.ok(match,'each report references a retained SDK occurrence');
  assert.equal(report.association,'attached','each report remains attached');
  assert.equal(report.issueId,match.issue.id,'the report belongs to its retained occurrence issue');
  const stored=retained.find(row=>row.id===report.id);
  assert.deepEqual([stored.message,stored.event_id,stored.occurrence],[report.message,match.event.id,match.event.occurrence],'the persisted description and exact occurrence association agree with owner reads');
 }
 assert.deepEqual(ordered(events.map(({event})=>[
  exceptionTypes(event),feedback.items.filter(report=>report.eventId===event.id).map(report=>report.message).sort(),
 ])),ordered(expected),'every SDK error retains exactly its own feedback descriptions');
 for(const {issue} of details){
  const page=await app.json(root+`/feedback?issue=${issue.id}`),expected=feedback.items.filter(report=>report.issueId===issue.id);
  assert.equal(page.total,expected.length,'the issue feedback count equals its retained reports');
  assert.deepEqual(page.items,expected,'the issue read preserves every report and association');
 }
 console.log(JSON.stringify({probe:'SDK-025 feedback',runtime:project.id,sdkProduced:sent.length,accepted:sent.length,persisted:retained.length,associated:feedback.items.length}));
 return {
  async checkIssue(page,handled){
   const expected=feedback.items.filter(report=>report.issueId===handled.issue.id);
   assert.ok(expected.length,'the handled issue has SDK feedback');
   const panel=page.getByRole('region',{name:'Issue feedback',exact:true});
   await panel.getByText(`Showing ${expected.length} of ${expected.length} reports`,{exact:true}).waitFor();
   if(page.viewportSize().width===1440){
    const displayed=await panel.locator('li').evaluateAll(rows=>rows.map(row=>[row.querySelector('.feedback-message').textContent,row.querySelector('code').textContent]));
    assert.deepEqual(ordered(displayed),ordered(expected.map(report=>[report.message,report.eventId])),'the issue UI shows every SDK description beside its own linked event');
   }
  },
 };
}
