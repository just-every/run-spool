import {performance} from 'node:perf_hooks';

let stage='setup', serverOutput=()=>'', secrets=[];
const pages=new Map();
export function traceStage(name){stage=name;console.log('STAGE '+name);}
export function traceServer(output,privateValues){serverOutput=output;if(privateValues)secrets=privateValues.filter(value=>typeof value==='string'&&value.length>=6).sort((a,b)=>b.length-a.length);}
function safe(text){
 let result=String(text);for(const value of secrets)result=result.replaceAll(value,'[redacted]');
 return result.replace(/([?&#](?:token|key|rer-dev|code)=[^\s"'<>]*)/gi,'[redacted]').replace(/Bearer\s+\S+/gi,'Bearer [redacted]');
}
function url(value){try{const parsed=new URL(value);return parsed.origin+parsed.pathname;}catch{return 'unavailable';}}
function watchPage(page){
 if(pages.has(page))return;
 const state={console:[],pending:new Map()};pages.set(page,state);
 page.on('console',message=>{state.console.push({type:message.type(),text:safe(message.text()).slice(0,1500)});state.console=state.console.slice(-20);});
 page.on('pageerror',error=>{state.console.push({type:'pageerror',text:safe(error.message).slice(0,1500)});state.console=state.console.slice(-20);});
 page.on('request',request=>state.pending.set(request,{method:request.method(),url:url(request.url())}));
 for(const event of ['requestfinished','requestfailed'])page.on(event,request=>state.pending.delete(request));
 page.once('close',()=>pages.delete(page));
}
export function traceBrowser(value){

 const watchContext=context=>{context.on('page',watchPage);for(const page of context.pages())watchPage(page);};
 // Browser has no context-created event, so observe pages when a context is returned.
 const original=value.newContext.bind(value);
 value.newContext=async(...args)=>{const context=await original(...args);watchContext(context);return context;};
 const originalPage=value.newPage.bind(value);
 value.newPage=async(...args)=>{const page=await originalPage(...args);watchPage(page);return page;};
 for(const context of value.contexts())watchContext(context);
 return value;
}
export async function traceStep(name,action){
 const label=stage+'/'+name,start=performance.now();let timer;
 console.log('STEP '+label);
 try{
  return await Promise.race([Promise.resolve().then(action),new Promise((_,reject)=>{
   timer=setTimeout(()=>{
    console.error('STALL '+label+' '+JSON.stringify({pages:[...pages].map(([page,state])=>({url:url(page.url()),console:state.console,pending:[...state.pending.values()]})),server:safe(serverOutput()).slice(-12000)}));
    // A stuck browser or dev child must not strand cleanup until the job limit.
    setTimeout(()=>process.exit(1),10000).unref();
    reject(new Error('STALL '+label));
   },90000);
  })]);
 }finally{clearTimeout(timer);console.log('END '+label+' seconds='+((performance.now()-start)/1000).toFixed(3));}
}
