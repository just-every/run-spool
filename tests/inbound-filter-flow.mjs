import {createServer} from 'node:http';
import {gunzipSync,inflateSync,brotliDecompressSync} from 'node:zlib';
import {parseEnvelope,objectJson} from '../src/domain/sentry/wire.ts';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {browserSignIn} from './auth.mjs';
import {archiveProjection} from './archive.mjs';

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
 // SDK-006 category policy: error-message rules never discard feedback text.
 current=await json(root);policy=current.policy;policy.filters.messages.enabled=true;await json(root,'PUT',{revision:current.revision,policy});
 const item=async(type,value,headers={})=>{const r=await req(path,'POST','{}\n'+JSON.stringify({type})+'\n'+JSON.stringify(value),{Origin:'https://cedar.example','CF-Connecting-IP':'203.0.113.42',...headers});assert.equal(r.status,200);return r.json()};
 const feedback=(id,patch={})=>({event_id:id.toString(16).padStart(32,'0'),type:'feedback',contexts:{feedback:{message:'ignore me: customer description'}},...patch});
 assert.equal((await item('feedback',feedback(10001))).feedback[0].outcome,'accepted');
 assert.equal((await item('feedback',feedback(10002,{release:'drop-old'}))).feedback[0].outcome,'filtered');
 assert.equal((await item('feedback',feedback(10003,{environment:'noise'}))).feedback[0].outcome,'filtered');
 assert.equal((await item('feedback',feedback(10005,{contexts:{browser:{name:'Chrome',version:'80.0'},feedback:{message:'customer request'}}}))).feedback[0].outcome,'filtered','SDK-006 feedback uses available category browser context');
 assert.equal((await item('feedback',feedback(10006,{request:{url:'http://localhost/contact'}}))).feedback[0].outcome,'filtered','SDK-006 feedback uses available request location');
 const report={timestamp:Date.now()/1000,discarded_events:[{reason:'sample_rate',category:'error',quantity:7}]};
 assert.equal((await item('client_report',report)).clientReports.discarded['client_discarded:error:sample_rate'],7);
 for(const headers of [{'CF-Connecting-IP':'127.0.0.1'},{'CF-Connecting-IP':'192.0.2.40'},{'User-Agent':'Googlebot/2.1'},{'User-Agent':'Mozilla/5.0 Chrome/80.0.1' }]){
  assert.equal((await item('feedback',feedback(++sequence+20000),headers)).feedback[0].outcome,'filtered');
  const receipt=(await item('client_report',report,headers)).clientReports;assert.equal(receipt.filtered,1);assert.equal(receipt.received,0);assert.deepEqual(receipt.discarded,{});
 }
 for(const type of ['feedback','client_report'])for(const headers of [{Origin:'https://foreign.example'},{Referer:'https://foreign.example/page'}]){const r=await req(path,'POST','{}\n'+JSON.stringify({type})+'\n'+JSON.stringify(type==='feedback'?feedback(10004):report),{Origin:'https://cedar.example',...headers});assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null)}
 const stored=(await archiveProjection(await req('/api/archive'))).data;assert.equal(stored.audit.filter(row=>row.project==='filters'&&row.kind==='inbound_filters_changed').length,3,'SDK-006 each policy change audited; stale save creates none');assert.equal(stored.events.filter(row=>row.project==='filters').length,3,'SDK-006 preview and policy activation preserve earlier occurrences');
 const categoryUsage=(await json(base+'/outcomes')).rows;assert.equal(categoryUsage.find(r=>r.reason==='client_discarded:error:sample_rate').count,7);assert.equal((await json(base+'/feedback')).total,1);assert.match((await json(root)).categoryFilterCoverage.client_report,/unavailable/);
 console.log('SDK-006 inbound-filter public flow passed: every filter, full retained preview, stale/authority denial, pre-group/alert/usage exclusion, IPv4/IPv6, wildcard Origin/Referer, counters and disabling.');
}

// SDK-006: the installed SDK, its default integrations and normal transport.
// Only the explicit trusted-edge fixture headers vary; no SDK module is patched.
export async function sdkInboundFilterFlow({request,origin,browser,temporary,require,applicationOrigin,dsns}) {
 const entry=resolve(temporary,'filter-client.mjs');
 await writeFile(entry,`import * as Sentry from ${JSON.stringify(require.resolve('@sentry/node'))};
 import {channel} from 'node:diagnostics_channel';
 const input=JSON.parse(process.env.FILTER_CASE),endpoint=new URL(input.dsn),responses=[];
 channel('http.client.request.start').subscribe(({request})=>{if(request.getHeader('host')===endpoint.host&&request.path.startsWith('/api'+endpoint.pathname+'/envelope'))request.once('response',response=>responses.push(response.statusCode));});
 Sentry.init({dsn:input.dsn,transportOptions:{headers:input.headers}});
 Sentry.captureEvent(input.event);if(!await Sentry.flush(10000))process.exitCode=1;await Sentry.close(10000);process.stdout.write(JSON.stringify({responses}));`);
 // Record only item metadata at a loopback network edge, then forward the
 // unchanged SDK bytes. Automatic sessions can carry an SDK-inferred release
 // on CI; reconcile those real items instead of assuming one item per capture.
 const send=async(dsn,event,headers={})=>{
  const original=new URL(dsn),items=[];
  const edge=createServer(async(req,res)=>{try{
   const chunks=[];for await(const chunk of req)chunks.push(chunk);const bytes=Buffer.concat(chunks),encoding=req.headers['content-encoding'];
   const decoded=encoding==='gzip'?gunzipSync(bytes):encoding==='deflate'?inflateSync(bytes):encoding==='br'?brotliDecompressSync(bytes):bytes;
   for(const item of parseEnvelope(decoded).items){const value=objectJson(item.bytes);items.push({type:item.header.type,release:value.attrs?.release})}
   const forwarded=new Headers();for(const [key,value] of Object.entries(req.headers))if(value!==undefined&&!['host','content-length','transfer-encoding','connection'].includes(key))forwarded.set(key,Array.isArray(value)?value.join(','):value);
   const response=await fetch(new URL(req.url,original.protocol+'//'+original.host),{method:req.method,headers:forwarded,body:bytes,redirect:'manual'});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){res.writeHead(502);res.end('Synthetic transport edge failed')}});
  await new Promise(resolve=>edge.listen(0,'127.0.0.1',resolve));const endpoint=new URL(dsn);endpoint.hostname='127.0.0.1';endpoint.port=String(edge.address().port);
  try{return await new Promise((done,reject)=>{
   const child=spawn(process.execPath,[entry],{env:{...process.env,SENTRY_RELEASE:'synthetic-spool-21',FILTER_CASE:JSON.stringify({dsn:endpoint.href,event,headers:{'CF-Connecting-IP':'203.0.113.42','Origin':'https://cedar.example',...headers}})},stdio:['ignore','pipe','ignore']});
   let output='';child.stdout.on('data',chunk=>output+=chunk);
   child.once('error',reject);child.once('exit',code=>{if(code!==0)return reject(new Error('SDK-006 Node SDK flush failed'));try{const result=JSON.parse(output);assert.ok(result.responses.length,'SDK-006 observes actual normal-transport responses');done(Object.assign(result.responses,{items}))}catch(error){reject(error)}});
  })}finally{await new Promise(resolve=>edge.close(resolve))}
 };
 for(const width of [1440,390]) {
  const id=`sdk-filters-${width}`,base=`/api/projects/${id}`,root=base+'/inbound-filters';
  const project=await request('/api/projects','POST',{id,name:'Cedar checkout inbound filters'});
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  try {
   await browserSignIn(page,origin);await page.goto(`${origin}/projects/${id}/settings`);
   const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'Inbound filters and usage',exact:true})});
   await panel.getByText('Browser extensions',{exact:true}).waitFor();
   const snap=async(state)=>{if(process.env.SPOOL_SCREEN_DIR){await mkdir(process.env.SPOOL_SCREEN_DIR,{recursive:true});await panel.screenshot({path:resolve(process.env.SPOOL_SCREEN_DIR,`SDK-006-${width}-${state}.png`)});}};
   await snap('empty');
   const policy=(await request(root)).policy;
   const values={ip_addresses:'192.0.2.0/24',messages:'*ignore me*',releases:'drop-*',environments:'noise',allowed_domains:'cedar.example\n*.cedar.example'};
   for(const filter of (await request(root)).filters){
    await panel.getByRole('checkbox',{name:'Enable '+filter.label.toLowerCase(),exact:true}).check();
    if(values[filter.id])await panel.getByLabel(filter.label+' · one per line',{exact:true}).fill(values[filter.id]);
   }
   await panel.getByPlaceholder('chrome<=100').fill('chrome<=100');
   await panel.getByRole('button',{name:'Preview retained events',exact:true}).click();
   await panel.getByText(/Preview complete · 0 retained events/).waitFor();await snap('preview');
   await panel.getByRole('button',{name:'Save inbound filters',exact:true}).click();await panel.getByText('Inbound filters saved. Later intake uses this policy.',{exact:true}).waitFor();
   await panel.getByText('Filters by accepted category and unavailable fields',{exact:true}).click();await snap('saved');
   let n=0;
   const event=(patch={})=>({release:'web-1',dist:'web',environment:'production',exception:{values:[{type:'CheckoutError',value:'ordinary checkout failure '+(++n),stacktrace:{frames:[{filename:'https://cedar.example/app.js',lineno:8,colno:1,function:'checkout'}]}}]},...patch});
   await send(project.dsn,event());const before=(await request(base+'/issues')).reduce((sum,row)=>sum+row.count,0),alerts=(await request(base+'/alerts')).length;
   const exception=(type,value,file)=>({exception:{values:[{type,value,stacktrace:{frames:[{filename:file,lineno:8,colno:1}]}}]}});
   const cases=[
    ['browser_extensions',exception('ExtensionError','extension failure','chrome-extension://cedar-extension/app.js')],
    ['legacy_browsers',{contexts:{browser:{name:'Chrome',version:'80.0.1'}}}],
    ['localhost',exception('CheckoutError','local failure','http://localhost/app.js')],
    ['crawlers',{}, {'User-Agent':'Googlebot/2.1'}],
    ['react_hydration',exception('Error','Hydration failed because the initial UI does not match','app.js')],
    ['chunk_load',exception('ChunkLoadError','Loading chunk failed','app.js')],
    ['ip_addresses',{}, {'CF-Connecting-IP':'192.0.2.42'}],
    ['messages',exception('CheckoutError','ignore me','app.js')],
    ['releases',{release:'drop-old'}],['environments',{environment:'noise'}],
   ];
   let filteredItems=0;
   for(const [filter,patch,headers] of cases){const prior=(await request(root)).filters.find(f=>f.id===filter).recentMatches,responses=await send(project.dsn,event(patch),headers);const expected=responses.items.filter(item=>item.type==='event'||['crawlers','ip_addresses'].includes(filter)&&(item.type==='client_report'||item.type==='feedback'||['session','sessions'].includes(item.type)&&!!item.release)).length;assert.ok(expected>0);filteredItems+=expected;assert.equal((await request(root)).filters.find(f=>f.id===filter).recentMatches,prior+expected,`SDK-006 real SDK ${filter}: every observed applicable item`)}
   assert.equal((await request(base+'/outcomes')).rows.find(r=>r.reason==='filtered').count,filteredItems,'SDK-006 filtered items reconcile exactly with SDK wire categories');
   let refusedRequests=0;
   for(const headers of [{Origin:'https://foreign.example'},{Referer:'https://foreign.example/cart'}]){const responses=await send(project.dsn,event(),headers);assert.ok(responses.length);assert.ok(responses.every(status=>status===403),'SDK-006 every real SDK request from a refused domain is denied, including automatic client reports');refusedRequests+=responses.length;}
   const expectedFiltered=filteredItems+refusedRequests;assert.equal((await request(root)).filters.find(f=>f.id==='allowed_domains').recentMatches,refusedRequests,'SDK-006 exact domain counter reconciles with observed SDK transport, including client reports');
   assert.equal((await request(base+'/issues')).reduce((sum,row)=>sum+row.count,0),before,'SDK-006 filtered real SDK events create no occurrence');assert.equal((await request(base+'/alerts')).length,alerts,'SDK-006 filtered real SDK events create no alert');
   let usage=(await request(base+'/outcomes')).rows;assert.equal(usage.find(r=>r.reason==='accepted').count,1);assert.equal(usage.find(r=>r.reason==='filtered').count,expectedFiltered,'SDK-006 filtered units exactly reconcile with observed SDK requests');
   await panel.getByRole('button',{name:'Refresh filters and usage',exact:true}).click();await panel.getByText('Filter policy and usage refreshed',{exact:true}).waitFor();
   await panel.getByRole('checkbox',{name:'Enable error message patterns',exact:true}).uncheck();await panel.getByRole('button',{name:'Preview retained events',exact:true}).click();await panel.getByText(/Preview complete · 1 retained events/).waitFor();
   await panel.getByRole('button',{name:'Save inbound filters',exact:true}).click();await panel.getByText('Inbound filters saved. Later intake uses this policy.',{exact:true}).waitFor();
   await send(project.dsn,event(exception('CheckoutError','ignore me','app.js')));assert.equal((await request(base+'/outcomes')).rows.find(r=>r.reason==='accepted').count,2,'SDK-006 disabled rule accepts later SDK error');
   await panel.getByRole('button',{name:'Refresh filters and usage',exact:true}).click();await panel.getByText('Filter policy and usage refreshed',{exact:true}).waitFor();await snap('receipts');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'SDK-006 responsive settings');
   await request(base+'/browser-origins','POST',{origin:applicationOrigin});dsns.filter=project.dsn;
   await panel.getByRole('checkbox',{name:'Enable error message patterns',exact:true}).check();await panel.getByRole('button',{name:'Preview retained events',exact:true}).click();await panel.getByText(/Preview complete · 2 retained events/).waitFor();await panel.getByRole('button',{name:'Save inbound filters',exact:true}).click();await panel.getByText('Inbound filters saved. Later intake uses this policy.',{exact:true}).waitFor();
   const sessionFilteredBeforeBrowser=(await request(base+'/outcomes')).rows.find(r=>r.reason==='session_filtered')?.count??0;
   const application=await context.newPage();await application.goto(applicationOrigin+'/?target=filter');await application.waitForFunction(()=>window.__SDK_READY__);
   // Browser transport is a real local browser; localhost is deliberately enabled.
   await application.evaluate(()=>window.sendFilterError('ignore me: browser checkout failure'));
   await application.waitForFunction(()=>window.__SPOOL_SENT__.filter(type=>type==='session').length===2);await application.evaluate(()=>window.flushSDK());
   usage=(await request(base+'/outcomes')).rows;assert.equal(usage.find(r=>r.reason==='accepted').count,2,'SDK-006 browser SDK matching event filtered');assert.equal(usage.find(r=>r.reason==='session_filtered').count-sessionFilteredBeforeBrowser,2,'SDK-005 two default browser session items inherit localhost filtering');assert.equal(usage.find(r=>r.reason==='filtered').count,expectedFiltered+3);
   await application.close();
   await panel.getByRole('button',{name:'Preview retained events',exact:true}).click();await panel.getByText(/Preview complete/).waitFor();const stale=await request(root);await request(root,'PUT',{revision:stale.revision,policy:stale.policy});await panel.getByRole('button',{name:'Save inbound filters',exact:true}).click();await page.getByRole('alert').filter({hasText:'inbound_policy_revision_conflict'}).waitFor();await snap('conflict');
   await page.route('**'+root,route=>route.abort());await page.reload();await page.getByRole('alert').filter({hasText:'Filters could not be loaded'}).waitFor();await snap('failure');await page.unroute('**'+root);await page.getByRole('button',{name:'Retry filters',exact:true}).click();await panel.getByRole('button',{name:'Refresh filters and usage',exact:true}).waitFor();
   const denied=await browser.newContext({viewport:{width,height:1000}});try{const signedOut=await denied.newPage();await signedOut.goto(`${origin}/projects/${id}/settings`);await signedOut.getByRole('heading',{name:'Sign in to your installation',exact:true}).waitFor();if(process.env.SPOOL_SCREEN_DIR)await signedOut.screenshot({path:resolve(process.env.SPOOL_SCREEN_DIR,`SDK-006-${width}-denied.png`)});}finally{await denied.close()}


  } finally {await context.close()}
 }
 console.log('SDK-006 real unmodified Node SDK: every filter enabled through app at 1440/390, nonmatches, exact counters, no issues/alerts/accepted units, disable and later acceptance.');
}
