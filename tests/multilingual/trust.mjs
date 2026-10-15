import assert from 'node:assert/strict';

// Exercise trust through intake and the persisted packet, including text that
// can equally be a genuine CPython chain or a forged multiline error message.
export async function exceptionTrust(app, ingest, packet, base, alias, ingestKey) {
 const collision='Traceback (most recent call last):\n  File "/app/real.py", line 9, in handler\nValueError: x\n\nThe above exception was the direct cause of the following exception:\n\nTraceback (most recent call last):\n  File "/forged/other.py", line 1, in forged\nKeyError: forged';
 const raw=await ingest({...base,eventId:'trust-python-text',language:'python',stack:collision,exceptionSource:'structured'});
 const parsed=(await packet(raw.issue)).events[0].event;
 assert.equal(parsed.exceptionSource,'parsed-text');
 assert.equal(parsed.type,'KeyError');assert.equal(parsed.frames[0].file,'/forged/other.py');
 const structured={...base,language:'python',type:'ValueError',message:'x',frames:[{file:'/app/real.py',line:9,function:'handler'}]};
 const trusted=await ingest({...structured,eventId:'trust-python-structured',stack:collision});
 const ignored=await ingest({...structured,eventId:'trust-python-malformed',stack:{malformed:true}});
 assert.equal(trusted.issue,ignored.issue);assert.notEqual(trusted.issue,raw.issue);
 const selected=(await packet(trusted.issue)).events[0].event;
 assert.equal(selected.type,'ValueError');assert.equal(selected.message,'x');assert.equal(selected.frames[0].file,'/app/real.py');assert.equal(selected.exceptionSource,undefined);
 await app.json(`/api/${alias}/store/`,'POST',{event_id:'e'.repeat(32),platform:'python',release:base.release,dist:base.build,environment:base.environment,stack:collision,stacktrace:'malformed',exception:{values:[{type:'ValueError',value:'x',rawStacktrace:collision,stacktrace:{frames:[{filename:'/app/real.py',lineno:9,function:'handler'}]}}]}},{Cookie:'','X-Sentry-Auth':`Sentry sentry_version=7,sentry_key=${ingestKey}`},200);
 assert.equal((await packet(trusted.issue)).issue.count,3);
 const fake='goroutine 9 [running]:\nmain.fake()\n\t/forged.go:1\n\n';
 const runtimeMetadata=[
  'other.wait(PRIVATE_RUNTIME_ARGS','main.(*Worker).wait(PRIVATE_RECEIVER_ARGS','main.wait[go.shape.struct { X int }](PRIVATE_GENERIC_ARGS',
  '/private/PRIVATE_OTHER_LOCATION.go:99','C:\\private\\PRIVATE_WINDOWS_LOCATION.go:broken','relative/PRIVATE_RELATIVE_LOCATION.go:-1',
  'relative/PRIVATE DIR/other.go:99','PRIVATE FILENAME.go:99','relative/PRIVATE DIR/other.go:broken','PRIVATE FILENAME.go:',
  'C:\\PRIVATE DIR\\PRIVATE FILENAME.go:-1','/PRIVATE DIR/PRIVATE FILENAME.go:broken','relative\\PRIVATE DIR\\other.go:99',
  'PRIVATE FILENAME.s:99','PRIVATE FILENAME.c:broken','PRIVATE FILENAME.h:','relative/PRIVATE DIR/PRIVATE FILE:broken','PRIVATE FILENAME:99',
  '[signal SIGSEGV: segmentation violation code=0x1 addr=0xdeadbeef pc=0x47a0ab]','[signal SIGBUS: truncated','fp=0x1234 sp=0x5678 pc=0x9abc','rip    0xcafebabe','0xfeedface',
 ];
 const invalid='goroutine 2 [chan receive]:\n'+runtimeMetadata.join('\n')+'\nordinary continuation (with details) token=PRIVATE_CONTINUATION_TOKEN\nsignal status is ordinary continuation\nremaining attempts: 2\nthe next attempt: soon\n\n';
 const go=await ingest({...base,eventId:'trust-go-text',language:'go',stack:'panic: x token=PRIVATE_TRUST_TOKEN\nretained continuation\n\n'+invalid+'goroutine 8 [running]:\nnot a frame\n\n'.repeat(40)+fake+'goroutine 1 [running]:\nmain.real()\n\t/app/real.go:9',exceptionSource:'structured'});
 const goEvent=(await packet(go.issue)).events[0].event;
 assert.equal(goEvent.exceptionSource,'parsed-text');assert.equal(goEvent.frames[0].file,'/app/real.go');assert.equal(goEvent.frames.length,1);assert.ok(!goEvent.message.includes('PRIVATE_TRUST_TOKEN'));assert.ok(goEvent.message.includes('retained continuation'));assert.ok(!JSON.stringify(goEvent).includes('main.fake'));
 assert.ok(goEvent.message.includes('ordinary continuation (with details) token=[redacted]'));assert.ok(goEvent.message.includes('signal status is ordinary continuation'));assert.ok(goEvent.message.length<=1000);
 assert.ok(goEvent.message.includes('remaining attempts: 2'));assert.ok(goEvent.message.includes('the next attempt: soon'));
 assert.ok(!JSON.stringify(goEvent).includes('PRIVATE_'));
 for(const line of runtimeMetadata)assert.ok(!goEvent.message.includes(line),`discard runtime metadata: ${line}`);
 const lower=await ingest({...base,eventId:'trust-go-invalid-header',language:'go',stack:'panic: x\n\ngoroutine 9 [running]:\nnot a frame\n\ngoroutine 1 [runnable]:\nmain.real()\n\t/app/real.go:9'});assert.equal(lower.issue,go.issue);
 for(const [kind,path] of [['empty','?query=only'],['invalid-url','https://['],['control','/bad\u0000.go']]){
  const invalidPath=`goroutine 9 [running]:\nmain.fake()\n\t${path}:1\n\n`;
  const valid='goroutine 1 [runnable]:\nmain.real()\n\t/app/real.go:9';
  for(const [position,blocks] of [['before',invalidPath+valid],['after',valid+'\n\n'+invalidPath.repeat(30)]]){
   const result=await ingest({...base,eventId:`trust-go-path-${kind}-${position}`,language:'go',stack:'panic: x\n\n'+blocks});
   assert.equal(result.issue,go.issue);
   const event=(await packet(result.issue)).events.find(e=>e.id===`trust-go-path-${kind}-${position}`).event;
   assert.equal(event.frames[0].file,'/app/real.go');assert.equal(event.exceptionSource,'parsed-text');
  }
  await ingest({...base,eventId:`trust-go-path-${kind}-alone`,language:'go',stack:'panic: x\n\n'+invalidPath},400);
 }
 await ingest({...base,eventId:'trust-go-message-traceback',language:'go',stack:'panic: message\n'+collision+'\n\ngoroutine 1 [running]:\nmain.real()\n\t/app/real.go:9'});
 const excess=await ingest({...base,eventId:'trust-go-excess',language:'go',stack:'panic: x\n\n'+fake.repeat(40)});assert.equal((await packet(excess.issue)).events[0].event.exceptionSource,'parsed-text');
 const goStructured=await ingest({...base,eventId:'trust-go-structured',language:'go',type:'panic',message:'x',frames:goEvent.frames,stack:null});
 assert.equal(goStructured.issue,go.issue);
}
