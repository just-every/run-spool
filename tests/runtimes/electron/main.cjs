const {app,BrowserWindow,ipcMain,session}=require('electron');
const path=require('node:path');
const Sentry=require('@sentry/electron/main');
if(!app.isPackaged){process.stderr.write('Qualification requires the packaged app\n');app.exit(2)}
app.disableHardwareAcceleration();
app.setPath('userData',process.env.SPOOL_FIXTURE_STATE);
const mode=process.env.SPOOL_FIXTURE_MODE,seen=new Set(),waiters=[];
const observe=value=>{
 const text=JSON.stringify(value);
 for(const marker of ['synthetic-spool-renderer-log','synthetic-spool-renderer-trace','synthetic-spool-renderer-feedback','RendererHandledError','RendererUnhandledError'])if(text.includes(marker))seen.add(marker);
 if(Array.isArray(value)&&value[0]?.type)seen.add(value[0].type);
 for(const notify of waiters)notify();
};
Sentry.init({
 dsn:process.env.SPOOL_FIXTURE_DSN,release:process.env.SENTRY_RELEASE,dist:process.env.SENTRY_DIST,
 environment:'compatibility',tracesSampleRate:1,traceLifecycle:'static',sendClientReports:true,
 // Official online transport; native minidumps belong to SDK-002/011 and are explicitly disabled.
 transport:Sentry.makeElectronTransport,
 integrations:defaults=>defaults.filter(integration=>integration.name!=='SentryMinidump'),
 beforeSend:event=>event.message?.startsWith('synthetic-spool-discard-')?null:event,
 onFatalError:()=>app.exit(1),shutdownTimeout:5000,
});
Sentry.getClient().on('beforeEnvelope',envelope=>{for(const item of envelope[1])observe(item)});
Sentry.getClient().on('afterCaptureLog',observe);
const fatal=setTimeout(()=>{process.stderr.write('Electron qualification did not complete\n');app.exit(3)},30000);
class MainHandledError extends Error{constructor(){super('synthetic-spool-electron-main-handled');this.name='MainHandledError'}}
class MainUnhandledError extends Error{constructor(){super('synthetic-spool-electron-main-unhandled');this.name='MainUnhandledError'}}
function checkout(){throw new MainHandledError()}
async function drain(){await Sentry.flush(5000);await Sentry.flush(5000)}
app.whenReady().then(async()=>{
 const destination=new URL(process.env.SPOOL_FIXTURE_DSN).origin;
 for(const scopedSession of [session.defaultSession,session.fromPartition('sentry-electron')])scopedSession.webRequest.onBeforeRequest((details,reply)=>{
  const url=new URL(details.url);reply({cancel:!['file:','data:','devtools:','sentry-ipc:'].includes(url.protocol)&&url.origin!==destination});
 });
 Sentry.logger.info('synthetic-spool-main-log');
 Sentry.startSpan({name:'synthetic-spool-main-trace',op:'test'},()=>{});
 Sentry.captureMessage('synthetic-spool-discard-main');
 if(mode==='handled'){
  let eventId;try{checkout()}catch(error){eventId=Sentry.captureException(error,{attachments:[{filename:'synthetic-spool-main.txt',data:'synthetic-spool-1'}]})}
  await drain();Sentry.captureFeedback({message:'synthetic-spool-main-feedback',associatedEventId:eventId});
 }
 await drain();
 const window=new BrowserWindow({show:true,width:800,height:600,webPreferences:{nodeIntegration:true,contextIsolation:false,sandbox:false}});
 ipcMain.handle('fixture:mode',()=>mode);
 ipcMain.handle('fixture:drain',async()=>{
  await drain();
  const required=['synthetic-spool-renderer-log','synthetic-spool-renderer-trace','synthetic-spool-renderer-feedback','replay_event','replay_recording',mode==='handled'?'RendererHandledError':'RendererUnhandledError'];
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('Renderer items did not reach main: '+required.filter(name=>!seen.has(name)).join(', '))),5000);
   const notify=()=>{if(required.every(name=>seen.has(name))){clearTimeout(timer);resolve()}};waiters.push(notify);notify();
  });
  await drain();return true;
 });
 ipcMain.handle('fixture:finish',async()=>{
  await drain();clearTimeout(fatal);
  if(mode==='crash')setImmediate(()=>{throw new MainUnhandledError()});
  else{Sentry.endSession();await drain();await Sentry.close(5000);setImmediate(()=>app.quit())}
  return true;
 });
 ipcMain.on('fixture:failure',(_,message)=>{process.stderr.write(String(message)+'\n');app.exit(2)});
 await window.loadFile(path.join(__dirname,'index.html'));
}).catch(error=>{process.stderr.write(error.stack+'\n');app.exit(2)});
