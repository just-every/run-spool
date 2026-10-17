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
 const exported=await json(base+'/issue-export?status=acknowledged');assert.equal(exported.total,3);
 console.log('Bulk triage public flow passed: preview, atomic stale refusal, action binding, project/owner/origin scope, apply, revision and query export.');
}
