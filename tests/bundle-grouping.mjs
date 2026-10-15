import assert from 'node:assert/strict';

// A hashed rebuild and its correction, suppression and retention custody.
export async function bundleGroupingFlow({json}) {
 const project=await json('/api/projects','POST',{id:'bundles',name:'Shipping dashboard'}),p='/api/projects/bundles';
 const first={version:1,eventId:'bundle-first',release:'shipping-1',build:'build-1',environment:'production',type:'TypeError',message:"Cannot read properties of undefined (reading 'city')",frames:[{file:'https://shipping.example/assets/index-DoQws3li.js',function:'fe',line:8,column:2571}],breadcrumbs:[]};
 const next={...first,eventId:'bundle-next',release:'shipping-2',build:'build-2',frames:[{...first.frames[0],file:'https://shipping.example/assets/index-B-Fmq6y6.js'}]};
 const capture=event=>json('/api/ingest/bundles','POST',event,{Cookie:'',Authorization:`Bearer ${project.ingestKey}`});
 const packet=id=>json(`${p}/issues/${id}/packet`);
 for(const event of [first,next])await json(`${p}/releases`,'POST',{name:event.release,build:event.build});
 const original=await capture(first),before=await packet(original.issue);
 await json(`${p}/issues/${original.issue}`,'PATCH',{state:'resolved',revision:before.issue.revision});
 assert.equal((await capture(next)).issue,original.issue,'a content hash change returns to the original issue');
 const current=await packet(original.issue);
 assert.equal(current.issue.state,'open');assert.equal(current.issue.count,2);
 assert.ok((await json(`${p}/alerts`)).some(row=>row.kind==='regression'));
 assert.deepEqual(new Set(current.events.map(row=>row.event.frames[0].file)),new Set([first.frames[0].file,next.frames[0].file]),'reported filenames survive');
 assert.ok(current.events.every(row=>row.originalGrouping.issue===original.issue));
 const split=await json(`${p}/corrections/preview`,'POST',{kind:'split',source:original.issue,revision:current.issue.revision,events:[next.eventId]});
 await json(`${p}/corrections/${split.id}/apply`,'POST',{confirm:true});
 assert.equal((await packet(split.plan.target)).events[0].originalGrouping.issue,original.issue);
 assert.equal((await capture(next)).issue,split.plan.target,'duplicate follows its corrected occurrence');
 assert.equal((await capture({...next,eventId:'bundle-after-correction'})).issue,original.issue,'new capture follows native grouping');
 const policy=await json(`${p}/suppression-policies`,'POST',{field:'fingerprint',mode:'exact',value:before.issue.fingerprint,enabled:true});
 const suppressed=await capture({...next,eventId:'bundle-suppressed'});
 assert.ok((await packet(suppressed.issue)).events.find(row=>row.id==='bundle-suppressed').suppression.some(row=>row.id===policy.id));
 for(const file of ['https://shipping.example/assets/checkout-B-Fmq6y6.js','https://shipping.example/other/index-B-Fmq6y6.js'])assert.notEqual((await capture({...next,eventId:crypto.randomUUID(),frames:[{...next.frames[0],file}]})).issue,original.issue,'entry and directory remain grouping inputs');
 return async () => {
 const replacement=await json(`${p}/keys`,'POST',{kind:'ingest'});project.ingestKey=replacement.key;
 await json(`${p}/retention`,'POST',{cutoff:Date.now()+1,apply:true});
 assert.equal((await capture({...next,eventId:'bundle-after-retention'})).issue,original.issue,'routing survives event retention');
 };
}
