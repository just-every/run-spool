import {parseEnvelope} from '../src/domain/sentry/wire.ts';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
// Real SDK and transport: beforeSend drops three captures; Node's public flush
// emits its own client_report to the supplied project's DSN.
export async function emitClientReport(dsn) {
 const entry = require.resolve('@sentry/node');
 const source = `const Sentry=require(${JSON.stringify(entry)});let input='';process.stdin.on('data',value=>input+=value);process.stdin.on('end',async()=>{try{const {dsn}=JSON.parse(input);Sentry.init({dsn,defaultIntegrations:false,sendClientReports:true,beforeSend:()=>null});for(let i=0;i<3;i++)Sentry.captureException(new Error('Filtered checkout validation '+i));if(!await Sentry.flush(10000)||!await Sentry.close(10000))throw new Error('SDK flush not confirmed');process.stdout.write('ok')}catch{process.stderr.write('Node SDK report emission failed');process.exitCode=1}});`;
 const result = await new Promise((resolve,reject) => {
  const child = spawn(process.execPath, ['-e', source], {env:process.env,stdio:['pipe','pipe','pipe']});
  let out='',err='';
  child.stdout.on('data',value=>out+=value);child.stderr.on('data',value=>err+=value);
  child.once('error',reject);child.once('close',code=>resolve({code,out,err}));
  child.stdin.end(JSON.stringify({dsn}));
 });
 assert.equal(result.code,0,result.err);assert.equal(result.out,'ok');
}

// [SDK-001] Headless-shell pages have separate visible windows. Minimize the
// real headless window with focus emulation off; never synthesize a DOM event.
export async function browserLifecycleReport(page,navigate) {
 // Pinned Playwright in-process API: the original session owns its visibility lock.
 // A secondary newCDPSession cannot release another session's capturer handle.
 const cdp=page._connection.toImpl(page).delegate._mainFrameSession._client;
 console.log('[SDK-001] lifecycle: original session');
 const {windowId}=await cdp.send('Browser.getWindowForTarget');
 await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});
 console.log('[SDK-001] lifecycle: focus released');
 const outgoing=page.waitForRequest(request=>{
  if(request.method()!=='POST'||!new URL(request.url()).pathname.includes('/envelope/'))return false;
  return parseEnvelope(request.postDataBuffer()).items.some(item=>item.header.type==='client_report');
 },{timeout:15000});
 let request;
 try{
  await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'minimized'}});
  console.log('[SDK-001] lifecycle: window minimized');
  [,request]=await Promise.all([page.waitForFunction(()=>document.visibilityState==='hidden',null,{polling:50,timeout:15000}),outgoing]);
  console.log('[SDK-001] lifecycle: report sent');
 }finally{
  await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});
  await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});
 }
 const report=parseEnvelope(request.postDataBuffer()).items.find(item=>item.header.type==='client_report');
 await navigate();return report;
}
