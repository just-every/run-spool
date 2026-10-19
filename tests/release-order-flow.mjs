import assert from 'node:assert/strict';
export async function releaseOrderFlow({req,json}) {
 const project=await json('/api/projects','POST',{id:'release-total-order',name:'Checkout mixed release history'}),base='/api/projects/'+project.id,dsn=new URL(project.dsn),path=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 let serial=0;const send=async release=>{const r=await req(path,'POST','{}\n{"type":"event"}\n'+JSON.stringify({event_id:(++serial).toString(16).padStart(32,'0'),release,exception:{values:[{type:'CheckoutError',value:'Checkout failed',stacktrace:{frames:[{filename:'/checkout.py',function:'checkout',lineno:12}]}}]}}));assert.equal(r.status,200)};
 const original=['1.2.0','abc123','1.10.0','1.2.0-rc.1','def456'];for(const name of original)await send(name);
 const names=async()=>(await json(base+'/releases')).map(r=>r.name),issue=async()=>(await json(base+'/issues'))[0];assert.deepEqual(await names(),original,'REL-001 default is global first seen');
 const current=await issue();await json(base+'/issues/'+current.id,'PATCH',{revision:current.revision,state:'resolved',resolution:'current'});await send('abc123');assert.equal((await issue()).state,'resolved','REL-001 delayed older first-seen capture cannot regress');
 const policy={version:1,order:'semver',pattern:'*'},preview=await json(base+'/release-policy/preview','POST',{policy});await json(base+'/release-policy','PUT',{revision:preview.revision,policy});
 const semantic=['1.2.0-rc.1','1.2.0','1.10.0','abc123','def456'];for(let i=0;i<3;i++)assert.deepEqual(await names(),semantic,'REL-001 repeat list uses one mixed transitive order');
 const latest=await json(base+'/issues/'+current.id+'/events?q='+encodeURIComponent('release:latest'));assert.ok(latest.rows.length>0);assert.ok(latest.rows.every(r=>r.release==='def456'),'REL-001 latest shares the final list element');
 await send('1.99.0');assert.equal((await issue()).state,'resolved','REL-001 a later-seen semantic release still precedes existing non-semver names');await send('next-checkout');assert.equal((await issue()).state,'open','REL-001 newer release regresses once');
 assert.equal((await json(base+'/alerts')).filter(r=>r.kind==='regression').length,1);
}
