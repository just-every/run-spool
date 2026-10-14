import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {boundedCleanup,journeyDiagnostics,classifyCommandOutput} from './command-diagnostics.mjs';
import {resourceRefusalFamily,waitForServerResources} from './command-resources.mjs';
import {outboxFetch} from './auth.mjs';
import {commandCustody} from '@runeditrun/rer/internal/onboarding/command-custody.mjs';
import {createProcessBaseline,createProcessScope,processScopeEnvironment} from '@runeditrun/rer/process-scope';

// Use the installed consumer bin: its launcher installs the checkout's pin
// with the frozen lockfile before checking a fresh, dependency-free clone.
const rerPackage=new URL(import.meta.resolve('@runeditrun/rer/package.json'));
const rerBin=fileURLToPath(new URL(JSON.parse(await readFile(rerPackage,'utf8')).bin.rer,rerPackage));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const validPid=pid=>Number.isSafeInteger(pid)&&pid>1;
function signalGroup(item,signal){
 if(!validPid(item.child.pid))return true;
 try{process.kill(-item.child.pid,signal);return true;}catch(error){return error.code==='ESRCH';}
}
function groupAlive(item){
 if(!validPid(item.child.pid))return false;
 try{process.kill(-item.child.pid,0);return true;}catch(error){return error.code!=='ESRCH';}
}
async function waitStopped(items,ms){
 const deadline=Date.now()+ms;
 const stopped=()=>items.every(item=>item.settled&&(item.custody||!groupAlive(item)));
 do{if(stopped())return true;await delay(50);}while(Date.now()<deadline);
 return stopped();
}

// Retain ownership after the group leader exits: descendants can still hold
// the pipes open or run in its detached group. Always escalate and bound waits.
export async function stopChildren(items){
 const scoped=items.filter(item=>item.custody),unscoped=items.filter(item=>!item.custody);
 let scopedStopped=true;
 // The CLI starts its own detached runtime groups. Its inherited private scope
 // keeps those descendants owned even after their launcher exits/reparents.
 for(const item of scoped)try{await item.custody.stop();}catch{scopedStopped=false;}
 let signaled=true;
 for(const item of unscoped)signaled=signalGroup(item,'SIGTERM')&&signaled;
 if(await waitStopped(items,2_000))return scopedStopped?'stopped':'failed';
 for(const item of unscoped)signaled=signalGroup(item,'SIGKILL')&&signaled;
 const stopped=await waitStopped(items,5_000);
 return stopped&&scopedStopped?'stopped':signaled&&scopedStopped?'timeout':'failed';
}

export async function commandCheckout(diagnostics=journeyDiagnostics()) {
 const directory=await mkdtemp(resolve(tmpdir(),'spool-commands-')),root=resolve(directory,'checkout');
 const owned=new Set();
 async function close(){
  let children='failed',directoryOutcome='failed';
  try{children=await stopChildren([...owned]);}catch{}
  try{const result=await boundedCleanup(()=>rm(directory,{recursive:true,force:true,maxRetries:0}));
   directoryOutcome=result.outcome==='complete'?'removed':result.outcome;
  }catch{}
  return {children,directory:directoryOutcome};
 }
 try{
  // Current-command journeys need only HEAD. Fetching unrelated promised
  // history can require credentials even when HEAD is complete locally.
  const cloned=spawnSync('git',['clone','--no-local','--depth','1','--quiet',process.cwd(),root],{encoding:'utf8'});assert.equal(cloned.status,0,'isolated command checkout succeeds');
  const env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',RER_SERVERS_DIR:resolve(directory,'servers'),RER_SERVER_JOURNEY:'1'};delete env.RER_LOCAL_OPERATION;
  const baseline=await createProcessBaseline();
  function start(args,diagnostic=diagnostics.started(args[0])){
   const scope=createProcessScope(baseline);let child;
   try{child=spawn(process.execPath,[rerBin,...args,'--cwd',root,'--non-interactive','--json'],{cwd:root,env:processScopeEnvironment(scope,env),stdio:['ignore','pipe','pipe'],detached:true});}catch(error){diagnostic.spawnFailed=true;throw error;}
   diagnostic.spawned=true;
   let output='';const item={child,settled:false,spawnError:null,custody:commandCustody(child,scope)};owned.add(item);
   const capture=b=>{output=(output+b).slice(-100000);Object.assign(diagnostic,classifyCommandOutput(output,args[0]));};
   child.stdout.on('data',capture);child.stderr.on('data',capture);
   child.once('error',error=>{item.spawnError=error;diagnostic.spawnFailed=true;});
   const closed=new Promise(resolve=>child.once('close',code=>{
    item.settled=true;diagnostic.exited=true;diagnostic.exitCode=Number.isSafeInteger(code)?code:null;
    if(!item.custody&&!groupAlive(item))owned.delete(item);resolve({code,output});
   }));
   return {child,closed,output:()=>output,item,diagnostic};
  }
  async function command(args,expected=0){
   const item=start(args);let timeout;
   const expired=new Promise((_,reject)=>{timeout=setTimeout(()=>{item.diagnostic.timedOut=true;reject(new Error('Command deadline exceeded'));},15*60*1000);});
   try{
    const result=await Promise.race([item.closed,expired]);if(item.item.spawnError)throw item.item.spawnError;
    if(expected!==null)assert.equal(result.code,expected,'seed command exits with the expected status');return result;
   }finally{clearTimeout(timeout);}
  }
  async function ready(args,origin){
   const diagnostic=diagnostics.started(args[0]);
   diagnostic.resourcePreflight='checking';
   try{await waitForServerResources(root);diagnostic.resourcePreflight='passed';}catch(error){
    diagnostic.resourcePreflightRefusal=resourceRefusalFamily(error);
    diagnostic.resourcePreflight=diagnostic.resourcePreflightRefusal==='unknown'?'failed':'refused';
    throw error;
   }
   const item=start(args,diagnostic);let timeout;
   const expired=new Promise((_,reject)=>{timeout=setTimeout(()=>{item.diagnostic.timedOut=true;reject(new Error('Managed server failed readiness'));},5*60*1000);});
   async function poll(){
    for(let i=0;i<1200;i++){
     if(item.item.spawnError)throw item.item.spawnError;
     if(item.child.exitCode!==null||item.item.settled)throw new Error('Managed server exited before readiness: '+JSON.stringify({exitCode:item.child.exitCode,...classifyCommandOutput(item.output(),args[0])}));
     if(item.output().split('\n').some(line=>{try{return JSON.parse(line).event==='ready'}catch{return false}})){
      item.diagnostic.readinessObserved=true;
      assert.equal((await fetch(origin+'/health')).status,200);item.diagnostic.healthChecked=true;
      assert.equal((await outboxFetch(origin)).status,200);item.diagnostic.outboxChecked=true;return item;
     }
     await delay(250);
    }
    item.diagnostic.timedOut=true;throw new Error('Managed server failed readiness');
   }
   try{return await Promise.race([poll(),expired]);}finally{clearTimeout(timeout);}
  }
  return {root,env,command,ready,start,close};
 }catch(error){
  // Checkout acquisition also owns its temporary directory. Cleanup failure
  // must not replace the original clone/assertion failure.
  const cleanup=await close();diagnostics.checkoutCleanup(cleanup);throw error;
 }
}
