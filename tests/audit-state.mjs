import assert from 'node:assert/strict';
// Denied actions now append their safe audit observation. All business rows and
// every pre-existing audit/link row must still be byte-for-byte unchanged.
export function assertAuditAppendOnly(actual,expected,message,appendTables=['spool_audit_events','audit_actor_links','deployment_actors']) {
 for(const [table,rows] of Object.entries(expected)) {
  if(appendTables.includes(table)) {
   assert.deepEqual(actual[table].slice(0,rows.length),rows,message+' (prior '+table+')');
   if(table==='spool_audit_events')for(const row of actual[table].slice(rows.length)){assert.equal(row.source,'request');assert.ok(['denied','conflict','invalid','failed','succeeded','accepted'].includes(row.outcome));}
  } else assert.deepEqual(actual[table],rows,message+' ('+table+')');
 }
 assert.deepEqual(Object.keys(actual),Object.keys(expected));
}
