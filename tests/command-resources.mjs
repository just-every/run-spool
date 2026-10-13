import {types} from 'node:util';
import {performance} from 'node:perf_hooks';
import {serverResources} from '@runeditrun/rer/server-resources';

// Base words the load refusal with the measured load and threshold, so it is matched by its exact shape.
export const loadRefusal=/^Not started: this computer is busy\. Its 1-minute load is (?:[0-9]+\.[0-9]|unknown) and a server starts only at [0-9.]+ or below\.\nTry again in a few minutes, or start it anyway with a higher threshold, for example RER_SERVERS_LOAD_THRESHOLD=[0-9]+ rer dev\.$/;
const refusals=new Map([
 ['Server startup requires 15 GiB free on checkout and temporary volumes. Recover owned space before retrying.','resource-disk'],
]);
function data(error,key){return Object.getOwnPropertyDescriptor(error,key)?.value;}
export function resourceRefusalFamily(error){
 if(types.isProxy(error)||!types.isNativeError(error))return 'unknown';
 if(data(error,'code')!=='safety_refusal'||data(error,'exitCode')!==4)return 'unknown';
 const message=data(error,'message');
 return typeof message==='string'&&loadRefusal.test(message)?'resource-load':refusals.get(message)??'unknown';
}

// Only the primary guard's exact resource refusals wait. This is before any
// persistent CLI starts; its own later resource check remains authoritative.
// Boundary injection is for external one-off evidence, never CLI configuration.
export async function waitForServerResources(root,{check=serverResources,now=()=>performance.now(),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const deadline=now()+20*60*1000;
 for(;;){
  try{await check(root);return;}catch(error){
   if(resourceRefusalFamily(error)==='unknown')throw error;
   const remaining=deadline-now();
   if(remaining<=0)throw error;
   await wait(Math.min(60_000,remaining));
  }
 }
}
