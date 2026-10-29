import assert from 'node:assert/strict';

// Compare captured state through the private archive door. Refusals may add
// outcome counters and audit facts, but cannot change any captured domain row.
export function capturedRows(data){
 return Object.fromEntries(Object.entries(data).filter(([table])=>!['outcomes','audit'].includes(table)).map(([table,rows])=>[table,rows.map(row=>JSON.stringify(row)).sort()]));
}
export function outcomeTotals(rows){
 const totals={};for(const row of rows){const key=row.project+':'+row.reason;totals[key]=(totals[key]??0)+row.count;}return totals;
}
export async function nativeRefusal({snapshot,send,project,status,outcome,reason,counter,retry=false}){
 const before=await snapshot(),response=await send();
 assert.equal(response.status,status,'native refusal status');
 const body=await response.json();assert.equal(body.outcome,outcome,'native refusal outcome');
 if(reason!==undefined)assert.equal(body.reason,reason,'native refusal reason');
 if(retry){assert.match(response.headers.get('Retry-After')??'',/^[1-9][0-9]*$/,'bounded intake refusal tells the caller when to retry');assert.equal(body.retryAfter,Number(response.headers.get('Retry-After')));assert.ok(body.retryAfter<=60);}
 const after=await snapshot();assert.deepEqual(capturedRows(after.data),capturedRows(before.data),'refused intake changes no captured row');
 const expected=outcomeTotals(before.data.outcomes);if(counter){const key=project+':'+counter;expected[key]=(expected[key]??0)+1;}
 assert.deepEqual(outcomeTotals(after.data.outcomes),expected,'only the authorized refusal receives exactly one named outcome');
 return body;
}
