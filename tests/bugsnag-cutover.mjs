import assert from 'node:assert/strict';
import { dsymZip, ndkLibrary, ndkWithoutBuildId, storedZip, syntheticUuid, syntheticBuildId } from './fixtures/bugsnag/native-files.mjs';

export async function bugsnagCutover({json,req,web,android}){
 const mapping='com.synthetic.MainActivity -> a.b:\n# {"id":"sourceFile","fileName":"MainActivity.kt"}\n    1:1:void <init>():10:10 -> <init>\n    1:1:void <clinit>():11:11 -> <clinit>\n    1:3:void crash():42:44 -> c\n';
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
   // Apple's dSYM pipeline is a named public-door gap, never a ProGuard success.
   const dsym=await req(uploadPath,'POST',{release:name,build,format:'dsym',mapping:'synthetic-dsym-unavailable'},headers);
   assert.equal(dsym.status,400);assert.match((await dsym.json()).error,/proguard/);
   console.log('PROBE MIG-004 GAP 2: mobile dSYM repointing -> 400; native-symbols supports ProGuard only');
   console.log("PROBE MIG-004 A3: R8 '-> <init>' -> 201; stored mapping deduplicates with 200");
   assert.equal((await req(uploadPath,'POST',{...upload,mapping:mapping.replace('42:44','52:54')},headers)).status,409,'matching native build is immutable');
   assert.equal((await req(uploadPath,'POST',{...upload,build:'43'},headers)).status,409,'symbols need exact registered build');
   const foreign=await json(`/api/projects/${web.id}/keys`,'POST',{kind:'deploy'});
   assert.equal((await req(uploadPath,'POST',upload,{Cookie:'',Authorization:`Bearer ${foreign.key}`})).status,403,'foreign project cannot upload symbols');
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

/** Bugsnag's documented dSYM and NDK uploads reach the same deploy-key door as ProGuard, and are stored by build identity. */
export async function bugsnagNativeDebugFiles({json,req,origin,project}){
 const deploy=await json(`/api/projects/${project.id}/keys`,'POST',{kind:'deploy'}),auth={Authorization:`Bearer ${deploy.key}`},path=`/api/projects/${project.id}/native-symbols`;
 const post=(fields,headers=auth,target=path)=>{const form=new FormData();for(const [name,value] of Object.entries(fields)){if(value instanceof Uint8Array)form.append(name,new Blob([value]),'upload');else form.append(name,value)}return fetch(origin+target,{method:'POST',headers:{Connection:'close',...headers},body:form})};
 const refused=async(fields,pattern,status=400)=>{const response=await post(fields),body=await response.json();assert.equal(response.status,status,JSON.stringify(body));assert.match(body.error,pattern);assert.doesNotMatch(body.error,/proguard/i,'a native refusal never reuses the ProGuard-only message');};
 const zip=await dsymZip(),so=await ndkLibrary(),dsymFields={apiKey:'synthetic-bugsnag-key',projectRoot:'/synthetic/app',appVersion:'1.0.0',appBundleVersion:'84'};
 // Malformed archives and shared objects are refused with the real reason.
 await refused({...dsymFields,dsym:zip.subarray(0,zip.length-9)},/ZIP/);
 await refused({...dsymFields,dsym:new Uint8Array(64)},/ZIP/);
 await refused({...dsymFields,dsym:storedZip({'SyntheticApp.dSYM/Contents/Info.plist':Buffer.from('<plist/>')})},/DWARF/);
 await refused({...dsymFields,dsym:storedZip({'SyntheticApp.dSYM/Contents/Resources/DWARF/SyntheticApp':Buffer.from('not a mach-o')})},/Mach-O/);
 const executable=Buffer.from((await dsymFromZip(zip)));executable.writeUInt32LE(2,12);
 await refused({...dsymFields,dsym:storedZip({'SyntheticApp.dSYM/Contents/Resources/DWARF/SyntheticApp':executable})},/dSYM/);
 await refused(dsymFields,/dsym|soSymbolFile/);
 await refused({...dsymFields,dsym:zip,soSymbolFile:so},/exactly one/);
 await refused({soSymbolFile:new Uint8Array(32),sharedObjectName:'libsynthetic.so'},/ELF/);
 await refused({soSymbolFile:await ndkWithoutBuildId(),sharedObjectName:'libnobuildid.so'},/build id/);
 await refused({soSymbolFile:so,sharedObjectName:'libsynthetic.so',arch:'x86_64'},/arch/);
 assert.equal((await post({...dsymFields,dsym:zip},{})).status,401);
 // Accepted: stored by Mach-O UUID, immutable, idempotent, listed without bytes.
 const created=await post({...dsymFields,dsym:zip}),body=await created.json();assert.equal(created.status,201,JSON.stringify(body));
 assert.equal(body.format,'dsym');assert.equal(body.files.length,1);assert.equal(body.files[0].debugId,syntheticUuid);assert.equal(body.files[0].arch,'arm64');assert.equal(body.files[0].name,'SyntheticApp');
 assert.equal(body.symbolication.status,'unsupported');assert.match(body.symbolication.reason,/Mach-O|DWARF/);
 const replay=await post({...dsymFields,dsym:zip});assert.equal(replay.status,200);assert.deepEqual(await replay.json(),body);
 const changed=Buffer.from(await dsymFromZip(zip));changed[changed.length-1]^=1;
 assert.equal((await post({...dsymFields,dsym:storedZip({'SyntheticApp.dSYM/Contents/Resources/DWARF/SyntheticApp':changed})})).status,409,'a UUID names one immutable debug file');
 const ndk=await post({soSymbolFile:so,sharedObjectName:'libsynthetic.so',arch:'arm64-v8a',appVersion:'1.0.0',appVersionCode:'42',apiKey:'synthetic-bugsnag-key',projectRoot:'/synthetic/app'}),ndkBody=await ndk.json();
 assert.equal(ndk.status,201,JSON.stringify(ndkBody));assert.equal(ndkBody.format,'ndk');assert.equal(ndkBody.files[0].debugId,syntheticBuildId);assert.equal(ndkBody.files[0].arch,'arm64-v8a');assert.equal(ndkBody.symbolication.status,'unsupported');
 assert.equal((await post({soSymbolFile:so,sharedObjectName:'libsynthetic.so'})).status,200,'identical NDK replay');
 const foreign=await json('/api/projects','POST',{id:'foreign-'+project.id,name:'Foreign symbols'}),foreignKey=await json(`/api/projects/${foreign.id}/keys`,'POST',{kind:'deploy'});
 assert.equal((await post({...dsymFields,dsym:zip},{Authorization:`Bearer ${foreignKey.key}`})).status,403,'foreign project cannot upload debug files');
 await json(`/api/projects/${foreign.id}/artifact-storage`,'PUT',{artifact_storage_cap:1000,revision:0});
 const capped=await post({...dsymFields,dsym:zip},{Authorization:`Bearer ${foreignKey.key}`},`/api/projects/${foreign.id}/native-symbols`);
 assert.equal(capped.status,429,'debug files count against the project artifact storage cap');assert.match((await capped.json()).error,/storage cap/);
 const listed=await json(`/api/projects/${project.id}/native-debug-files`);
 assert.deepEqual(listed.map(f=>[f.format,f.debugId,f.arch,f.name]).sort(),[['dsym',syntheticUuid,'arm64','SyntheticApp'],['ndk',syntheticBuildId,'arm64-v8a','libsynthetic.so']]);
 assert.ok(listed.every(f=>f.bytes>0&&/^[a-f0-9]{64}$/.test(f.digest)&&!('payload' in f)));
 assert.equal((await req(`/api/projects/${project.id}/native-debug-files`,'GET',undefined,{Cookie:''})).status,401);
 await json(`/api/projects/${project.id}/keys/${deploy.hash}`,'DELETE');await json(`/api/projects/${foreign.id}/keys/${foreignKey.hash}`,'DELETE');
 assert.equal((await post({...dsymFields,dsym:zip})).status,401,'revoked deploy grant cannot upload debug files');
 console.log('PROBE MIG-004 APPLE: bugsnag dSYM zip -> 201 keyed by Mach-O UUID, replay 200, malformed -> specific 400s; NDK .so -> 201 keyed by build id; symbolication of these files is reported unsupported');
}
async function dsymFromZip(zip){
 const {listZip}=await import('../src/domain/sentry-cli/zip.ts');
 const entry=listZip(zip,{entries:20,entryBytes:1<<20}).find(e=>e.name.endsWith('/DWARF/SyntheticApp'));return entry.read();
}
