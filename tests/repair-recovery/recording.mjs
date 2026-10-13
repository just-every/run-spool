import assert from 'node:assert/strict';
import {snapshot,unchanged,quiet,status,reasons} from './state.mjs';
// Part 1: every repair write through the public HTTP door under rer dev's owner
// persona, with refusals that change nothing and writes that alert nobody.
export async function recordingProof(app,{issue,release,link,note,credentials}){
 const {json,request}=app,root='/api/projects/a/repairs',steps=[];
 let state=await snapshot(app);
 await status(app,'/api/projects/nope/repairs',{issue,link,note},404);await status(app,root,{issue:'f'.repeat(64),link,note},404);
 state=await unchanged(app,state,'unknown project or issue');
 for(const [label,body] of [['http link',{issue,link:'http://github.example/cedar/pull/7',note}],['javascript link',{issue,link:'javascript:alert(document.cookie)',note}],['oversize note',{issue,link,note:'n'.repeat(1001)}]])await status(app,root,body,400,{},label);
 state=await unchanged(app,state,'refused input');
 // The owner cookie from another origin is refused too.
 await status(app,root,{issue,link,note},403,{headers:{Origin:'https://attacker.example'}},'cross-origin owner write');
 const denied=async(path,body,label)=>{
  for(const [name,key,code] of [['agent',credentials.agent,403],['ingest',credentials.ingest,401],['deploy',credentials.deploy,401]])await status(app,path,body,code,{agent:key},`${name} grant on ${label}`);
  state=await unchanged(app,state,'grants refused on '+label);
 };
 await denied(root,{issue,link,note},'create');
 let repair=await json(root,'POST',{issue,link,note});state=await quiet(app,state,'create');steps.push('create');
 assert.equal(repair.revision,1);assert.equal(repair.recordedBy,'owner');assert.equal(repair.link,link);assert.equal(repair.observation.verdict,'inconclusive');assert.deepEqual(reasons(repair),['not_deployed','client_loss_unknown']);
 assert.ok(repair.snapshot.events.length>0&&repair.snapshot.events.every(row=>row.state==='retained'));assert.equal(repair.snapshot.releaseSequence,1);
 const path=`${root}/${repair.id}`;
 for(const [kind,body] of [['checks',{name:'Unit tests',outcome:'passed',note:'pnpm test passed',revision:1}],['facts',{fact:'approved',revision:1}]])await denied(`${path}/${kind}`,body,kind);
 repair=await json(`${path}/checks`,'POST',{name:'Unit tests',outcome:'passed',note:'pnpm test passed',revision:1});state=await quiet(app,state,'check passed');
 repair=await json(`${path}/checks`,'POST',{name:'Prepare delivery flow',outcome:'not_run',revision:2});state=await quiet(app,state,'check not run');steps.push('checks');
 assert.deepEqual(repair.checks.map(row=>[row.name,row.outcome]),[['Unit tests','passed'],['Prepare delivery flow','not_run']]);
 await status(app,`${path}/checks`,{name:'Stale',outcome:'failed',revision:2},409,{},'stale check revision');await status(app,`${path}/facts`,{fact:'approved',revision:1},409,{},'stale fact revision');
 state=await unchanged(app,state,'stale revision');
 await status(app,`${path}/checks`,{name:'Bad',outcome:'skipped',revision:3},400,{},'unknown check outcome');
 repair=await json(`${path}/facts`,'POST',{fact:'approved',revision:3});state=await quiet(app,state,'approve');steps.push('approve');
 repair=await json(`${path}/facts`,'POST',{fact:'merged',revision:4});state=await quiet(app,state,'merge');steps.push('merge');
 assert.ok(repair.facts.approved&&repair.facts.merged&&repair.facts.deployed===null);
 await status(app,`${path}/facts`,{fact:'exercised',note:'too early',revision:5},400,{},'exercise before deploy');
 await status(app,`${path}/facts`,{fact:'deployed',release:'never-registered',revision:5},400,{},'unregistered release');
 state=await unchanged(app,state,'refused facts');
 repair=await json(`${path}/facts`,'POST',{fact:'deployed',release:release.name,revision:5});state=await quiet(app,state,'deploy');steps.push('deploy');
 assert.deepEqual(repair.facts.deployed&&[repair.facts.deployed.release,repair.facts.deployed.sequence],[release.name,release.seq]);
 const audit=state.data.audit.filter(row=>row.kind.startsWith('repair_'));assert.equal(audit.length,6,'every repair write is audited');
 assert.ok(audit.every(row=>!row.detail.includes(note)&&!row.detail.includes(link)),'audit carries identities only');
 return {repair,steps};
}
