import assert from 'node:assert/strict';

// A 202 is an accepted durable job, never a completion receipt. Advance its
// bounded public steps until the same job reports its final fenced receipt.
export async function followErasure(request, accepted, started = Date.now()) {
 let receipt = accepted;
 while (receipt.phase !== 'complete') {
  assert.ok(Date.now() - started < 300_000, 'project erasure completes within 300 seconds');
  receipt = await request(`/api/erasures/${accepted.id}/resume`, 'POST');
  assert.equal(receipt.id, accepted.id, 'continuation keeps the accepted job identity');
 }
 return receipt;
}
