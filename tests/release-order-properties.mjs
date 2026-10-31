import assert from 'node:assert/strict';
import {importSource} from './source-import.mjs';

const {compareReleases}=await importSource(new URL('../src/domain/releases/order.ts',import.meta.url));
const names=rows=>rows.map(row=>row.name);

function* permutations(rows) {
 if(!rows.length){yield [];return}
 for(let i=0;i<rows.length;i++)for(const rest of permutations(rows.filter((_,at)=>at!==i)))yield [rows[i],...rest];
}

// Called by the deployment-history HTTP journey, using its retained metadata.
// Permuting a snapshot must not redefine which release was first seen.
export function releaseOrderProperties(rows,expected,order) {
 const compare=(a,b)=>compareReleases(a,b,order);
 let count=0;
 for(const input of permutations(rows)){
  const snapshot=structuredClone(input);
  for(let repeat=0;repeat<3;repeat++)assert.deepEqual(names([...input].sort(compare)),expected,`${order}: stable permutation ${count}`);
  assert.deepEqual(input,snapshot,'sorting a copy preserves release metadata');
  count++;
 }
 assert.equal(count,120,'all five-release permutations were exercised');
 for(const a of rows)for(const b of rows){
  assert.equal(Math.sign(compare(a,b))+Math.sign(compare(b,a)),0,`${order}: antisymmetric comparison`);
  assert.equal(compare(a,a),0,`${order}: reflexive comparison`);
  if(a.name!==b.name)assert.notEqual(compare(a,b),0,`${order}: distinct releases have a total order`);
  for(const c of rows)if(compare(a,b)<=0&&compare(b,c)<=0)assert.ok(compare(a,c)<=0,`${order}: transitive ${a.name}, ${b.name}, ${c.name}`);
 }
}

export function releaseOrderAgreement(rows,expected,order) {
 assert.deepEqual(names([...rows].reverse().sort((a,b)=>compareReleases(a,b,order))),expected,`${order}: production comparator agrees with the public SQL list`);
}
