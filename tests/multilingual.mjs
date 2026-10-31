import {followErasure} from './project-erasure/follow.mjs';
import assert from 'node:assert/strict';

// Native stack intake is a phase of the public installation lifecycle.
export async function nativeLanguages({json,auth}){
 const captured={};
 // Native Python and Go stack intake remains distinct from Sentry's SDK journeys.
 for(const [language,stack,file] of [
  ['python','Traceback (most recent call last):\n  File "/home/private/cart.py", line 42, in checkout\nValueError: quantity','cart.py'],
  ['go','panic: quantity\n\ngoroutine 4 [runnable]:\nother.ready(PRIVATE_OTHER)\n\t/private/ignored.go:99 +0x1\n\ngoroutine 7 [running]:\nmain.Checkout(PRIVATE_ARGS)\n\t/build/service/cart.go:42 +0x42','cart.go']
 ]){
  const result=await json('/api/ingest/web','POST',{version:1,eventId:language,release:'checkout@1',build:'b1',environment:'production',language,stack},auth);
  const packet=await json(`/api/projects/web/issues/${result.issue}/packet`);
  assert.ok(packet.events[0].event.frames[0].file.endsWith(file));assert.equal(packet.events[0].event.frames[0].line,42);
  assert.ok(!JSON.stringify(packet).includes('/home/private/'));
  for(const canary of ['PRIVATE_OTHER','PRIVATE_ARGS'])assert.ok(!JSON.stringify(packet).includes(canary),'raw stack metadata is not retained');
  captured[language]={issue:result.issue,atAdmission:packet.events[0].atAdmission};
  const unsupported=await json('/api/projects/web/reproducers','POST',{event:language,input:[]});
  assert.equal(unsupported.support,'unsupported');assert.equal(unsupported.reason,'capture_language_unsupported');
 }
 const structured={version:1,eventId:'structured-python',release:'checkout@1',build:'b1',environment:'production',language:'python',type:'ValueError',message:'quantity',frames:[{file:'cart.py',line:42,function:'checkout'}],stack:'Traceback (most recent call last):\n  File "/forged.py", line 1, in forged\nKeyError: forged'};
 const admitted=await json('/api/ingest/web','POST',structured,auth);
 const selected=(await json(`/api/projects/web/issues/${admitted.issue}/packet`)).events[0].event;
 assert.equal(selected.type,'ValueError');assert.equal(selected.frames[0].file,'cart.py');
 const manifest={commitSha:'a'.repeat(40),repository:'https://github.example/cedar/checkout',deployedAt:new Date().toISOString(),environment:'production',pathMappings:[{from:'/build',to:'fallback'},{from:'/build/service',to:'src'}]};
 await json('/api/projects/web/releases','POST',{name:'checkout@1',build:'b1',manifest});
 const mapped=async()=>{
  const packet=await json('/api/projects/web/issues/'+captured.go.issue+'/packet');
  assert.deepEqual(packet.events[0].atAdmission,captured.go.atAdmission,'source enrichment does not rewrite admission evidence');
  const frame=packet.events[0].currentLookup[0];assert.equal(frame.status,'go_path_mapped');assert.equal(frame.original.file,'src/cart.go');assert.equal(frame.mapping.commitSha,manifest.commitSha);
 };
 await mapped();
 return async()=>{
  await mapped();
  const path='/api/projects/web/erasure',plan=await json(path);assert.ok(plan.deleted.deployment_path_mappings>0);
  const receipt=await followErasure(json,await json(path,'POST',{confirm:'web',planHash:plan.planHash}));assert.equal(receipt.phase,'complete');
  assert.ok((await json('/api/projects')).every(row=>row.id!=='web'),'restored native source custody is erased');
 };
}
