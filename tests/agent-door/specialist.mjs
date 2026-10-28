import assert from 'node:assert/strict';
export default async function specialist({tool}) {
 const response=await tool('spool.outcomes.read',{project:'door-fixture'});
 assert.ok(!response.result?.isError,'Native capture-loss context is available');
 assert.match(response.result.structuredContent.coverage,/unknown/i);
 // Deliberately retained upstream assertion: a claim is not independent proof.
 const recipes=await tool('spool.reproducers.read',{project:'door-fixture',issue:'missing-native-issue'});
 assert.ok(recipes.result?.isError,'A missing issue cannot manufacture a sandbox result');
}
