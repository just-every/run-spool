import assert from 'node:assert/strict';
import {cp,readFile,symlink,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {classifyCommandOutput} from '../command-diagnostics.mjs';
import {commandCheckout} from '../command-runner.mjs';
import {gate,testOwner} from '../auth.mjs';
import {archiveProjection} from '../archive.mjs';
// The command harness clones HEAD. Overlay current tracked inputs and the new
// agent package so this journey tests the candidate, including uncommitted edits.
export async function handoffRuntime(port=15543,{destinations:declared}={}){
 const checkout=await commandCheckout();
 try{
  const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
  for(const file of tracked)await cp(resolve(file),resolve(checkout.root,file),{force:true});
  for(const folder of ['src','packages','tests','vite','migrations'])await cp(resolve(folder),resolve(checkout.root,folder),{recursive:true,force:true});
  await symlink(resolve('node_modules'),resolve(checkout.root,'node_modules'));
  const origin='http://127.0.0.1:'+port;
  const setup=await checkout.command(['setup','--owner-email',testOwner,'--port',String(port)],null);assert.equal(setup.code,0,JSON.stringify(classifyCommandOutput(setup.output,'setup')));
  const settings=resolve(checkout.root,'.dev.vars');
  const destinations=declared??[{id:'handoff-mail',project:'a',label:'Mailbox',channel:'mail',recipient:'HANDOFF_ALERT_RECIPIENT@private.example'},{id:'handoff-webhook',project:'a',label:'Webhook',channel:'webhook',url:'https://webhook.example/HANDOFF_WEBHOOK_TARGET',key:Buffer.from('HANDOFF_SIGNING_SECRET_MATERIAL_PRIVATE').toString('base64')}];
  // Reset removes generated settings, so destinations are written again after each setup.
  const configure=async()=>writeFile(settings,(await readFile(settings,'utf8'))+`\nALERT_DESTINATION_HASH_KEY="${Buffer.alloc(32,45).toString('base64')}"\nALERT_PUBLIC_ORIGIN="https://spool.example"\nALERT_DESTINATIONS='${JSON.stringify(destinations)}'\n`,{mode:0o600});
  await configure();
  gate.key=/^RER_DEV_KEY=(\S+)$/m.exec(await readFile(resolve(checkout.root,'.rer/local/dev-key.env'),'utf8'))[1];
  let active,cookie;
  // Foreground dev with the owner dev persona; stopping it is required before CLI transfers.
  async function startDev(){gate.key=/^RER_DEV_KEY=(\S+)$/m.exec(await readFile(resolve(checkout.root,'.rer/local/dev-key.env'),'utf8'))[1];active=await checkout.ready(['dev','--port',String(port)],origin);const entered=await fetch(origin+'/auth/dev/enter?as=owner',{redirect:'manual',headers:{'x-rer-dev-key':gate.key}});assert.equal(entered.status,303);await entered.body?.cancel();cookie=entered.headers.getSetCookie().map(row=>row.split(';')[0]).join('; ');}
  async function stopDev(){if(!active)return;await checkout.command(['dev','--stop']);assert.equal((await active.closed).code,0);active=null;}
  await startDev();
  async function request(path,method='GET',value,options={}){
   const headers={Origin:origin,...options.dev===false?{}:{'x-rer-dev-key':gate.key},...options.agent?{Authorization:'Bearer '+options.agent}:{Cookie:cookie},...value===undefined?{}:{'Content-Type':typeof value==='string'?'application/x-ndjson':'application/json'},...options.headers};
   return fetch(origin+path,{method,headers,redirect:'manual',...value===undefined?{}:{body:typeof value==='string'?value:JSON.stringify(value)}});
  }
  async function json(...args){const r=await request(...args);if(!r.ok){const body=await r.json();const category=['destination_configuration','destination_unconfigured','Invalid alert rule fields','Invalid alert rule','Invalid alert event selection','Invalid alert window or revision'].includes(body.error)?body.error:'other';throw Error(`${args[1]??'GET'} ${args[0]}: HTTP ${r.status} ${category}`)}return r.json();}
  const runtime={checkout,origin,get cookie(){return cookie},get devKey(){return gate.key},request,json,startDev,stopDev,async resetRestore(text,invalidText){await stopDev();await checkout.command(['reset','--yes']);await checkout.command(['setup','--owner-email',testOwner,'--port',String(port)]);await configure();await startDev();if(invalidText){const before=await archiveProjection(await request('/api/archive'));const rejected=await request('/api/restore','POST',invalidText,{headers:{'X-Confirm-Restore':'yes'}});assert.equal(rejected.status,400,'unknown stored alert field refused by public restore');await rejected.body?.cancel();assert.deepEqual((await archiveProjection(await request('/api/archive'))).data,before.data,'unknown-field restore mutates no domain rows');}await json('/api/restore','POST',text,{headers:{'X-Confirm-Restore':'yes'}});},archive:async()=>archiveProjection(await request('/api/archive')),async close(){let failure;try{await stopDev();}catch(error){failure=error}const result=await checkout.close();assert.equal(result.children,'stopped');assert.equal(result.directory,'removed');if(failure)throw failure;return result;}};return runtime;
 }catch(error){await checkout.close();throw error;}
}
export async function writeEvidence(file,value){await writeFile(file,JSON.stringify(value,null,2)+'\n');}
