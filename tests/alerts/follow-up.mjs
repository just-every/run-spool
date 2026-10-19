import assert from 'node:assert/strict';

// ALERT-004 an interrupted send, an expired lease and a lost provider response
// each leave one durable follow-up and never a duplicate (alert portion).
export async function alertFollowUp(app,inbox,delivery){
 const path='/api/projects/web/follow-up';
 let data=await app.json(path),row=data.rows.find(r=>r.source_id===delivery.id);
 assert.ok(row&&row.state==='uncertain','lost provider response becomes owner work');
 assert.equal(data.alternate.state,'none','an installation starts with no alternate');
 const facts=async()=>(await app.db.prepare("SELECT COUNT(*) n FROM spool_audit_events WHERE action='automation.follow_up'").first()).n;
 const before=await facts();await app.schedule(Date.now()+7000);assert.equal(await facts(),before,'repeated evaluation creates no duplicate follow-up fact');
 assert.equal((await app.request(path,'GET',undefined,{Cookie:''})).status,401);
 assert.equal((await app.request(path+'/alternate','PUT',{destination:'webhook-v1',channel:'webhook'},{Origin:'https://foreign.example'})).status,403);
 assert.ok((await app.request(path+'/alternate','PUT',{destination:'other-v1',channel:'mail'})).status>=400,'alternate belongs to the exact project');
 await app.json(path+'/alternate','PUT',{destination:'webhook-v1',channel:'webhook'});
 inbox.statuses.push(503);await app.schedule(Date.now()+8000);
 data=await app.json(path);row=data.rows.find(r=>r.id===row.id);
 assert.equal(row.notices.length,1);assert.equal(row.notices[0].state,'uncertain','failed alternate is visible');
 const sent=inbox.requests.length;await app.schedule(Date.now()+9000);await app.schedule(Date.now()+10000);
 assert.equal(inbox.requests.length,sent,'uncertain alternate never retries or recursively notifies itself');
 assert.equal((await app.json(path)).rows.find(r=>r.id===row.id).notices.length,1);
 const stale=await app.request(`${path}/${row.id}/reconcile`,'POST',{revision:row.revision+1,state:'accepted',evidence:'receiver_confirmed'});
 assert.equal(stale.status,409,'a stale decision cannot claim completion');
 const accepted=await app.json(`${path}/${row.id}/reconcile`,'POST',{revision:row.revision,state:'accepted',evidence:'receiver_confirmed'});
 assert.equal(accepted.replayed,false);assert.equal((await app.json(path)).rows.find(r=>r.id===row.id).state,'completed');
 await app.json(path+'/alternate','PUT',{destination:null});
 assert.equal(await facts(),before,'owner reconciliation is separate from the one follow-up fact');
}
