import assert from 'node:assert/strict';
export async function bulkTriageFlow({req,json,base}) {
 const rows=(await json(base+'/issue-search')).rows.slice(0,3),issues=rows.map(({id,revision})=>({id,revision}));
 const input={issues,state:'acknowledged',apply:false};
 const preview=await json(base+'/bulk-triage','POST',input);
 assert.equal(preview.issues.length,3);
 assert.deepEqual((await json(base+'/issue-search')).rows.filter(row=>issues.some(item=>item.id===row.id)).map(row=>row.state),['open','open','open'],'preview has no effects');
 for(const headers of [{Cookie:''},{Origin:'https://forbidden.example'}])assert.ok([401,403].includes((await req(base+'/bulk-triage','POST',input,headers)).status));
 const agent=await json(base+'/keys','POST',{kind:'agent'});
 assert.equal((await req(base+'/bulk-triage','POST',input,{Cookie:'',Authorization:`Bearer ${agent.key}`})).status,403);
 assert.equal((await req(base+'/bulk-triage','POST',{...input,issues:[issues[0],issues[0]]})).status,400);
 assert.equal((await req('/api/projects/wire/bulk-triage','POST',input)).status,409,'foreign selection refused');
 await json(base+'/issues/'+issues[0].id,'PATCH',{state:'resolved',revision:issues[0].revision});
 assert.equal((await req(base+'/bulk-triage','POST',{...input,apply:true,preview:preview.preview})).status,409);
 const unchanged=await Promise.all(issues.map(async item=>(await json(base+'/issues/'+item.id+'/packet')).issue));
 for(const item of issues.slice(1))assert.equal(unchanged.find(row=>row.id===item.id).state,'open','one stale row prevents every other write');
 const current=unchanged.filter(row=>issues.some(item=>item.id===row.id)).map(({id,revision})=>({id,revision}));
 const next={issues:current,state:'acknowledged',apply:false},confirmed=await json(base+'/bulk-triage','POST',next);
 assert.equal((await req(base+'/bulk-triage','POST',{...next,state:'open',apply:true,preview:confirmed.preview})).status,409,'preview bound to action');
 const applied=await json(base+'/bulk-triage','POST',{...next,apply:true,preview:confirmed.preview});assert.equal(applied.changed,3);
 const after=await Promise.all(issues.map(async item=>(await json(base+'/issues/'+item.id+'/packet')).issue));
 for(const item of current){const row=after.find(row=>row.id===item.id);assert.equal(row.state,'acknowledged');assert.equal(row.revision,item.revision+1)}
 assert.equal((await req(base+'/bulk-triage','POST',{...next,apply:true,preview:confirmed.preview})).status,409,'retry cannot repeat the action');
 await sdk009BulkResolution({req,json});
 const exported=await json(base+'/issue-export?status=acknowledged');assert.equal(exported.total,3);
 console.log('Bulk triage public flow passed: preview, atomic stale refusal, action binding, project/owner/origin scope, apply, revision and query export.');
}

// SDK-009 an explicit dist 'sentry-no-dist' stays distinct from no dist, and next/named-release resolution regresses only on a later release.
async function sdk009BulkResolution({req,json}) {
 const p=await json('/api/projects','POST',{id:'sdk009-bulk',name:'SDK-009 bulk resolution'}),base='/api/projects/sdk009-bulk',dsn=new URL(p.dsn),path=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 let serial=0;const send=async(release,type,dist)=>{const e={event_id:(++serial).toString(16).padStart(32,'0'),...(release===undefined?{}:{release}),...(dist===undefined?{}:{dist}),platform:'python',exception:{values:[{type,value:'Bulk release boundary',stacktrace:{frames:[{filename:'/app/bulk.py',function:type,lineno:8}]}}]}};const r=await req(path,'POST','{}\n{"type":"event"}\n'+JSON.stringify(e));assert.equal(r.status,200,await r.text());return e};
 const types=['BulkFirstError','BulkSecondError'],policy={version:1,order:'semver',pattern:'*'},review=await json(base+'/release-policy/preview','POST',{policy});await json(base+'/release-policy','PUT',{revision:review.revision,policy});
 const absent=await send('app@1.2.0',types[0]),explicit=await send('app@1.2.0',types[0],'sentry-no-dist');await send('app@1.2.0',types[1]);let rows=await json(base+'/issues');const packet=await json(base+'/issues/'+rows.find(r=>r.title.startsWith(types[0])).id+'/packet');assert.notEqual(packet.events.find(e=>e.id===absent.event_id).build,packet.events.find(e=>e.id===explicit.event_id).build);
 const select=async(mode,release)=>({issues:(await json(base+'/issues')).map(({id,revision})=>({id,revision})),state:'resolved',resolution:mode,...release?{release}:{},apply:false});
 const resolve=async(mode,release)=>{const input=await select(mode,release),preview=await json(base+'/bulk-triage','POST',input);assert.equal(preview.issues.length,2);await json(base+'/bulk-triage','POST',{...input,apply:true,preview:preview.preview});return preview};
 const states=async expected=>{rows=await json(base+'/issues');assert.equal(rows.length,2);assert.ok(rows.every(r=>r.state===expected),`every selected issue is ${expected}`)};
 await resolve('next');for(const type of types){await send('app@1.2.0',type);await send(undefined,type);}await states('resolved');assert.ok((await json(base+'/issues')).every(r=>r.seen_without_release===1));for(const type of types)await send('app@1.10.0',type);await states('open');
 const sha1='c'.repeat(40),sha2='d'.repeat(40);await send(sha1,types[0]);await send(sha2,types[1]);const releases=await json(base+'/releases');assert.deepEqual(releases.map(r=>r.name),['app@1.2.0','app@1.10.0',sha1,sha2]);assert.ok(releases.every(r=>r.auto_created===1));
 const next=await resolve('next');assert.ok(next.issues.every(r=>r.resolvedSequence===releases.find(r=>r.name===sha2).seq),'next uses project latest even for an issue only seen in an older release');for(const type of types)for(const release of ['app@1.2.0','app@1.10.0',sha1,sha2,undefined])await send(release,type);await states('resolved');
 const namedInput=await select('named',sha2),namedPreview=await json(base+'/bulk-triage','POST',namedInput);assert.equal((await req(base+'/bulk-triage','POST',{...namedInput,release:sha1,apply:true,preview:namedPreview.preview})).status,409,'a reviewed named target cannot change on apply');await json(base+'/bulk-triage','POST',{...namedInput,apply:true,preview:namedPreview.preview});for(const type of types){await send(sha1,type);await send(undefined,type);}await states('resolved');for(const type of types)await send(sha2,type);await states('open');
 await resolve('named','app@1.10.0');for(const type of types)await send('app@1.2.0',type);await states('resolved');for(const type of types)await send('app@1.10.0',type);await states('open');
 await resolve('named',sha1);for(const type of types)await send(sha2,type);await states('open');const input=await select('named',sha2);for(const change of [{release:undefined},{release:'unknown-release'},{resolution:'next'}])assert.equal((await req(base+'/bulk-triage','POST',{...input,...change})).status,400);
 console.log("SDK-009 an explicit dist 'sentry-no-dist' stays distinct from no dist, and next/named-release resolution regresses only on a later release (bulk; two auto semvers and two SHA releases).");
}
