import assert from 'node:assert/strict';

export async function inboundFilterFlow({req,json}) {
 const project=await json('/api/projects','POST',{id:'filters',name:'Cedar intake policy'}),base='/api/projects/filters',root=base+'/inbound-filters';
 assert.ok(project.defaultOnFilters.includes('browser_extensions'));assert.ok(project.defaultOnFilters.includes('crawlers'));
 await json(base+'/browser-origins','POST',{origin:'https://cedar.example'});
 await json(base+'/releases','POST',{name:'web-1',build:'web'});await json(base+'/releases','POST',{name:'drop-old',build:'web'});
 let sequence=0;
 const native=(patch={})=>({version:1,eventId:'filter-'+(++sequence),release:'web-1',build:'web',environment:'production',type:'CheckoutError',message:'ignore me',frames:[{file:'https://cedar.example/app.js',line:8,column:0,function:'checkout'}],breadcrumbs:[],...patch});
 // Model the public network edge explicitly; the local Worker otherwise supplies loopback metadata.
 const ingest=(event,headers={})=>req('/api/ingest/filters','POST',event,{Cookie:'',Authorization:'Bearer '+project.ingestKey,Origin:'https://cedar.example','CF-Connecting-IP':'203.0.113.42',...headers});
 assert.equal((await ingest(native())).status,201);
 let current=await json(root),policy=structuredClone(current.policy);
 for(const f of Object.values(policy.filters))f.enabled=true;
 policy.filters.legacy_browsers.browsers=[{name:'chrome',maxVersion:'100'}];
 policy.filters.ip_addresses.values=['192.0.2.0/24','2001:db8::/32'];policy.filters.messages.values=['*ignore me*'];policy.filters.releases.values=['drop-*'];policy.filters.environments.values=['noise'];policy.filters.allowed_domains.values=['cedar.example','*.cedar.example'];
 const preview=await json(root+'/preview','POST',{policy});assert.equal(preview.scanned,1);assert.equal(preview.counts.messages.matches,1);assert.equal(preview.counts.ip_addresses.unavailable,1);
 const saved=await json(root,'PUT',{revision:current.revision,policy});assert.equal(saved.revision,1);assert.equal((await req(root,'PUT',{revision:0,policy})).status,409);
 const before=(await json(base+'/issues')).reduce((n,i)=>n+i.count,0),alerts=(await json(base+'/alerts')).length;
 const dsn=new URL(project.dsn),path=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 const sentry=async(patch,headers={})=>{const event={event_id:(++sequence).toString(16).padStart(32,'0'),release:'web-1',dist:'web',environment:'production',exception:{values:[{type:'CheckoutError',value:'ordinary checkout failure',stacktrace:{frames:[{filename:'https://cedar.example/app.js',lineno:8,colno:1,function:'checkout'}]}}]},...patch};const r=await req(path,'POST',JSON.stringify({event_id:event.event_id})+'\n{"type":"event"}\n'+JSON.stringify(event),{Origin:'https://cedar.example','CF-Connecting-IP':'203.0.113.42',...headers});assert.equal(r.status,200);};
 await sentry({exception:{values:[{type:'ExtensionError',value:'extension failure',stacktrace:{frames:[{filename:'chrome-extension://cedar-ext/app.js',lineno:2,colno:1}]}}]}});
 await sentry({contexts:{browser:{name:'Chrome',version:'80.0.1'}}});
 await sentry({request:{headers:{'User-Agent':'Googlebot/2.1'}}});
 for(const [id,event,headers] of [
  ['localhost',native({message:'local',frames:[{file:'http://localhost/app.js',line:8,column:0,function:'checkout'}]}),{}],
  ['crawlers',native({message:'crawler'}),{'User-Agent':'Googlebot/2.1'}],
  ['react_hydration',native({message:'Hydration failed because the initial UI does not match'}),{}],
  ['chunk_load',native({type:'ChunkLoadError',message:'Loading chunk failed'}),{}],
  ['ip_addresses',native({message:'address filtered'}),{'CF-Connecting-IP':'192.0.2.42'}],
  ['ip_addresses',native({message:'IPv6 filtered'}),{'CF-Connecting-IP':'2001:db8::2'}],
  ['messages',native(),{}],['releases',native({release:'drop-old',message:'old release'}),{}],['environments',native({environment:'noise',message:'noisy environment'}),{}],
 ]){const r=await ingest(event,headers);assert.equal(r.status,202,id);assert.ok((await r.json()).filters.includes(id));}
 for(let i=0;i<125;i++)assert.equal((await ingest(native())).status,202,'filtered events do not consume accepted admission budget');
 assert.equal((await json(base+'/issues')).reduce((n,i)=>n+i.count,0),before);assert.equal((await json(base+'/alerts')).length,alerts,'filters run before issue and alert creation');
 const allowed=await ingest(native({message:'permitted origin'}),{Origin:'https://shop.cedar.example',Referer:'https://shop.cedar.example/cart'});assert.equal(allowed.status,201);assert.equal(allowed.headers.get('access-control-allow-origin'),'https://shop.cedar.example');
 for(const headers of [{Origin:'https://not-cedar.example'},{Origin:'https://cedar.example',Referer:'https://not-cedar.example/cart'}]){const r=await ingest(native({message:'bad domain'}),headers);assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null);}
 current=await json(root);for(const id of ['browser_extensions','legacy_browsers','localhost','crawlers','react_hydration','chunk_load','ip_addresses','messages','releases','environments','allowed_domains'])assert.ok(current.filters.find(f=>f.id===id).recentMatches>0,id+' recent counter');
 policy.filters.messages.enabled=false;await json(root,'PUT',{revision:current.revision,policy});assert.equal((await ingest(native())).status,201,'disabled filter applies to later intake');
 const outcomes=(await json(base+'/outcomes')).rows;assert.equal(outcomes.find(r=>r.reason==='accepted').count,3);assert.equal(outcomes.find(r=>r.reason==='filtered').count,139);
 assert.equal((await req(root,'GET',undefined,{Cookie:''})).status,401);const grant=await json(base+'/keys','POST',{kind:'agent'});assert.equal((await req(root,'PUT',{revision:2,policy},{Cookie:'',Authorization:'Bearer '+grant.key})).status,403);
 console.log('Inbound-filter public flow passed: every filter, full retained preview, stale/authority denial, pre-group/alert/usage exclusion, IPv4/IPv6, wildcard Origin/Referer, counters and disabling.');
}
