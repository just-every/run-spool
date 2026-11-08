import assert from 'node:assert/strict';

export async function bugsnagCutover({json,req,web,android}){
 const mapping='com.synthetic.MainActivity -> a.b:\n# {"id":"sourceFile","fileName":"MainActivity.kt"}\n    1:3:void crash():42:44 -> c\n';
 let nativeReceipt;
 for(const project of [web,android]){
  const mobile=project===android,name=mobile?'1.0.0@production+42':'1.0.0@production+unspecified',build=mobile?'42':'unspecified';
  const deploy=await json(`/api/projects/${project.id}/keys`,'POST',{kind:'deploy'}),headers={Cookie:'',Authorization:`Bearer ${deploy.key}`};
  await json(`/api/projects/${project.id}/releases`,'POST',{name,build},headers);
  const upload=mobile?{release:name,build,format:'proguard',mapping}:{release:name,build,debugId:'synthetic-spool-map',map:{version:3,sources:['checkout.ts'],sourcesContent:['throw new Error("Checkout failed")'],names:[],mappings:'AAAA'}};
  const uploadPath=`/api/projects/${project.id}/${mobile?'native-symbols':'artifacts'}`;
  assert.equal((await req(uploadPath,'POST',upload,{Cookie:''})).status,401);
  assert.equal((await req(uploadPath,'POST',upload,headers)).status,201);
  assert.equal((await req(uploadPath,'POST',upload,headers)).status,200);
  if(mobile){
   assert.equal((await req(uploadPath,'POST',{...upload,mapping:mapping.replace('42:44','52:54')},headers)).status,409,'matching native build is immutable');
   assert.equal((await req(uploadPath,'POST',{...upload,build:'43'},headers)).status,409,'symbols need exact registered build');
   const foreign=await json(`/api/projects/${web.id}/keys`,'POST',{kind:'deploy'});
   assert.equal((await req(uploadPath,'POST',upload,{Cookie:'',Authorization:`Bearer ${foreign.key}`})).status,401,'foreign project cannot upload symbols');
  }
  const ingest=await json(`/api/projects/${project.id}/keys`,'POST',{kind:'ingest'}),dsn=new URL(ingest.dsn);
  const event={event_id:(mobile?'b':'a').repeat(32),platform:mobile?'java':'javascript',release:name,dist:build,environment:'production',
   exception:{values:[{type:'CheckoutError',value:'Fresh checkout failure',stacktrace:{frames:[mobile?{module:'a.b',function:'c',filename:'SourceFile',lineno:2,in_app:true}:{filename:'https://shop.example/checkout.js',lineno:1,colno:1,function:'submit',in_app:true}]}}]},
   ...!mobile?{debug_meta:{images:[{type:'sourcemap',code_file:'https://shop.example/checkout.js',debug_id:'synthetic-spool-map'}]}}:{}};
  const path=`/api${dsn.pathname}/envelope/?sentry_key=${dsn.username}&sentry_version=7`,envelope=JSON.stringify({event_id:event.event_id})+'\n'+JSON.stringify({type:'event'})+'\n'+JSON.stringify(event);
  const response=await req(path,'POST',envelope,{Cookie:'','Content-Type':'application/x-sentry-envelope'});assert.equal(response.status,200,await response.clone().text());const receipt=await response.json();
  assert.equal((await req(path,'POST',envelope,{Cookie:''})).status,200,'capture replay creates no extra occurrence');
  const live=(await json(`/api/projects/${project.id}/issues`)).filter(issue=>issue.algorithm!=='sentry-import-v1');assert.equal(live.length,1);
  const packet=await json(`/api/projects/${project.id}/issues/${live[0].id}/packet`);assert.equal(packet.events.length,1);assert.equal(packet.events[0].historical,false);assert.equal(packet.events[0].currentLookup[0].status,'mapped');
  assert.equal(packet.events[0].currentLookup[0].original.file,mobile?'MainActivity.kt':'checkout.ts');
  assert.equal(packet.events[0].currentLookup[0].original.line,mobile?43:1);
  if(mobile){assert.equal(packet.events[0].currentLookup[0].original.function,'com.synthetic.MainActivity.crash');assert.equal(packet.events[0].currentLookup[0].original.column,null);nativeReceipt={...receipt,issue:live[0].id};}
  await json(`/api/projects/${project.id}/keys/${deploy.hash}`,'DELETE');assert.equal((await req(uploadPath,'POST',upload,headers)).status,401,'revoked deploy grant cannot reuse a symbol upload');
  await json(`/api/projects/${project.id}/keys/${ingest.hash}`,'DELETE');assert.equal((await req(path,'POST',envelope,{Cookie:''})).status,401,'revoked capture grant cannot replay');
 }
 return nativeReceipt;
}
