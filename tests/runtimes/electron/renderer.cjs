const {ipcRenderer}=require('electron');
const Sentry=require('@sentry/electron/renderer');
Sentry.init({
 tracesSampleRate:1,traceLifecycle:'static',replaysSessionSampleRate:1,
 integrations:[Sentry.browserTracingIntegration({instrumentPageLoad:false,instrumentNavigation:false}),Sentry.replayIntegration({minReplayDuration:0,flushMinDelay:60000,flushMaxDelay:60000})],
});
class RendererHandledError extends Error{constructor(){super('synthetic-spool-electron-renderer-handled');this.name='RendererHandledError'}}
class RendererUnhandledError extends Error{constructor(){super('synthetic-spool-electron-renderer-unhandled');this.name='RendererUnhandledError'}}
function checkout(){throw new RendererHandledError()}
(async()=>{
 // Replay attaches its DOM recorder on load. A fast renderer can otherwise
 // finish the entire fixture and stop it before the initial snapshot exists.
 if(document.readyState!=='complete')await new Promise(resolve=>window.addEventListener('load',resolve,{once:true}));
 const replay=Sentry.getReplay();replay.start();
 if(!replay.getReplayId())throw new Error('Renderer replay did not start');
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const mode=await ipcRenderer.invoke('fixture:mode');
 document.querySelector('#status').textContent='Checkout attempted';
 Sentry.logger.info('synthetic-spool-renderer-log');
 Sentry.startSpan({name:'synthetic-spool-renderer-trace',op:'test'},()=>{});
 Sentry.captureMessage('synthetic-spool-discard-renderer');
 let eventId;
 if(mode==='handled')try{checkout()}catch(error){eventId=Sentry.captureException(error,{attachments:[{filename:'synthetic-spool-renderer.txt',data:'synthetic-spool-1'}]})}
 else{
  const captured=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('The default renderer global handler did not capture the error')),5000);
   const off=Sentry.getClient().on('beforeEnvelope',envelope=>{
    if(envelope[1].some(([header,payload])=>header.type==='event'&&payload.exception?.values?.some(value=>value.type==='RendererUnhandledError'))){clearTimeout(timer);off();resolve()}
   });
  });
  setTimeout(()=>{throw new RendererUnhandledError()},0);await captured;
 }
 await Sentry.getClient().flush(5000);
 await Sentry.getReplay().stop();
 Sentry.captureFeedback({message:'synthetic-spool-renderer-feedback',...eventId?{associatedEventId:eventId}:{}});
 await Sentry.getClient().flush(5000);
 await ipcRenderer.invoke('fixture:drain');
 await ipcRenderer.invoke('fixture:finish');
})().catch(error=>ipcRenderer.send('fixture:failure',error.stack));
