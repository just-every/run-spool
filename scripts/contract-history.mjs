import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

// Contract prose and claim checks authenticate their immutable source documents.
// Keep the established Verify workflow shallow: retrieve only the recorded
// source commits when absent, without changing HEAD or any branch.
const references=new Set();
const coverage='docs/contract/COVERAGE.json';
if(existsSync(coverage))references.add(JSON.parse(readFileSync(coverage,'utf8')).old?.commit);
const text=readFileSync('CONTRACT.md','utf8'),marker='<!-- contract-claim-source';
if(text.includes(marker))references.add(JSON.parse(text.split(marker)[1].split('-->')[0].trim()).old);
references.delete(undefined);
for(const reference of references){
 if(!/^[0-9a-f]{40}$/.test(reference))throw Error('Contract history must name a full immutable commit');
 if(spawnSync('git',['cat-file','-e',reference+'^{commit}'],{stdio:'ignore'}).status===0)continue;
 const fetched=spawnSync('git',['fetch','--no-tags','--depth=1','origin',reference],{stdio:'inherit'});
 if(fetched.status!==0)throw Error('Unable to fetch recorded contract source '+reference);
 if(spawnSync('git',['cat-file','-e',reference+'^{commit}'],{stdio:'ignore'}).status!==0)throw Error('Recorded contract source is still unavailable');
}
console.log('Immutable contract history ready: '+references.size+' source commit(s)');
