import assert from 'node:assert/strict';
import {releaseOrderProperties,releaseOrderAgreement} from './release-order-properties.mjs';
export async function releaseOrderFlow({req,json,db}) {
 const project=await json('/api/projects','POST',{id:'release-total-order',name:'Checkout mixed release history'}),base='/api/projects/'+project.id,dsn=new URL(project.dsn),path=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 let serial=0;const send=async release=>{const r=await req(path,'POST','{}\n{"type":"event"}\n'+JSON.stringify({event_id:(++serial).toString(16).padStart(32,'0'),release,exception:{values:[{type:'CheckoutError',value:'Checkout failed',stacktrace:{frames:[{filename:'/checkout.py',function:'checkout',lineno:12}]}}]}}));assert.equal(r.status,200)};
 const original=['1.2.0','abc123','1.10.0','1.2.0-rc.1','def456'];for(const name of original)await send(name);
 const names=async()=>(await json(base+'/releases')).map(r=>r.name),issue=async()=>(await json(base+'/issues'))[0];assert.deepEqual(await names(),original,'REL-001 default is global first seen');
 const metadata=await json(base+'/releases');
 for(const order of ['sentry','first_seen','registered'])releaseOrderProperties(metadata,original,order);
 const current=await issue();await json(base+'/issues/'+current.id,'PATCH',{revision:current.revision,state:'resolved',resolution:'current'});await send('abc123');assert.equal((await issue()).state,'resolved','REL-001 delayed older first-seen capture cannot regress');
 const policy={version:1,order:'semver',pattern:'*'},preview=await json(base+'/release-policy/preview','POST',{policy});await json(base+'/release-policy','PUT',{revision:preview.revision,policy});
 const semantic=['1.2.0-rc.1','1.2.0','1.10.0','abc123','def456'];for(let i=0;i<3;i++)assert.deepEqual(await names(),semantic,'REL-001 repeat list uses one mixed transitive order');
 releaseOrderProperties(metadata,semantic,'semver');
 const latest=await json(base+'/issues/'+current.id+'/events?q='+encodeURIComponent('release:latest'));assert.ok(latest.rows.length>0);assert.ok(latest.rows.every(r=>r.release==='def456'),'REL-001 latest shares the final list element');
 await send('1.99.0');assert.equal((await issue()).state,'resolved','REL-001 a later-seen semantic release still precedes existing non-semver names');await send('next-checkout');assert.equal((await issue()).state,'open','REL-001 newer release regresses once');
 assert.equal((await json(base+'/alerts')).filter(r=>r.kind==='regression').length,1);
 await releaseOrderTies({json,db});
}

async function releaseOrderTies({json,db}) {
 const project=await json('/api/projects','POST',{id:'synthetic-spool-order-ties',name:'Release ordering ties'}),base='/api/projects/'+project.id;
 const firstSeen=['app@1.2.3+z','app@1.2.3+a','app@1.2.3+9','synthetic-spool-Z','synthetic-spool-z','synthetic-spool-é','synthetic-spool-\uE000','synthetic-spool-\u{10000}'];
 // Seed a bounded equal-time history through real registration, then fix only
 // fixture timestamps. No ordering implementation or public response is faked.
 for(const name of [...firstSeen].reverse())await json(base+'/releases','POST',{name,build:'synthetic-spool-1'});
 const instant=1800000000000;
 await db.batch(firstSeen.flatMap((name,index)=>{
  const time=index===0?instant-1:instant;
  return [db.prepare('UPDATE releases SET created=? WHERE project=? AND name=?').bind(instant+100,project.id,name),db.prepare('UPDATE release_metadata SET first_seen=? WHERE project=? AND release=?').bind(time,project.id,name)];
 }));
 // Equal semver precedence ignores build metadata; earlier first-seen wins
 // even when its name sorts later. Equal times then use UTF-8, not locale or UTF-16.
 const semantic=['app@1.2.3+z','app@1.2.3+9','app@1.2.3+a',...firstSeen.slice(3)];
 for(const order of ['sentry','first_seen','semver','registered']){
  const policy={version:1,order,pattern:'*'},preview=await json(base+'/release-policy/preview','POST',{policy});await json(base+'/release-policy','PUT',{revision:preview.revision,policy});
  const expected=order==='registered'?[...firstSeen].reverse():semantic;
  for(let repeat=0;repeat<3;repeat++){
   const rows=await json(base+'/releases');assert.deepEqual(rows.map(r=>r.name),expected,`${order}: first-seen, build metadata and byte-order ties through public SQL`);releaseOrderAgreement(rows,expected,order);
  }
 }
 // Legacy releases without metadata use their original registration time.
 await db.prepare('DELETE FROM release_metadata WHERE project=? AND release=?').bind(project.id,firstSeen[0]).run();
 const policy={version:1,order:'first_seen',pattern:'*'},preview=await json(base+'/release-policy/preview','POST',{policy});await json(base+'/release-policy','PUT',{revision:preview.revision,policy});
 const legacy=[...semantic.slice(1),firstSeen[0]],rows=await json(base+'/releases');assert.deepEqual(rows.map(r=>r.name),legacy);releaseOrderAgreement(rows,legacy,'first_seen');
}
