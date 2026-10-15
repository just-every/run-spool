import {registerLegacyMail} from '../legacy-mail.mjs';
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {authBindings,signIn,testOwner} from '../auth.mjs';
import {emittedWorkerOptions} from '../worker-options.mjs';
import {syntheticDestination,signingKey} from './receiver.mjs';
const require=createRequire(import.meta.url);
export const relayUrl='https://relay.example.com/api/managed-mail/send';
export async function alertRuntime(receiver,{state,mail='development',egress=true,configure=true,destinationUrl=syntheticDestination,egressBridge,destinations}={}) {
 const temporary=await mkdtemp(resolve(tmpdir(),'spool-alerts-'));let runtime;
 try {
 const miniflare=require(require.resolve('miniflare',{paths:[require.resolve('wrangler/package.json')]}));
 const {Miniflare,convertV4MiniflareOptions}=miniflare;
 const {worker,database}=await emittedWorkerOptions(resolve('dist/server/wrangler.json'),miniflare);
 const wrapper=resolve(temporary,'test-entry.js');
 // Only this test host can replace the transport. The exact HTTPS identity still
 // passes unchanged through Base prepare/validation/fingerprint/signing.
 await writeFile(wrapper,`import application from ${JSON.stringify(worker.modules[0].path)};
 const networkFetch=globalThis.fetch.bind(globalThis);let mailDatabase;
 globalThis.fetch=async(input,init)=>{const url=typeof input==='string'?input:input.url??input.href;if(url==='https://api.resend.com/emails'){const request=new Request(input,init),id=request.headers.get('idempotency-key');if(await mailDatabase.prepare('SELECT 1 FROM oa_tokens WHERE id=?').bind(id).first()){const message=await request.json();await mailDatabase.prepare('INSERT INTO rer_mail_development_outbox(id,created_at,message) VALUES(?,?,?)').bind(id,Date.now(),JSON.stringify({...message,deliveryId:id})).run();return Response.json({id})}return networkFetch(${JSON.stringify(receiver.url+'/mail')},init)}if(url===${JSON.stringify(relayUrl)}){const message=JSON.parse(init.body);const response=await networkFetch(${JSON.stringify(receiver.url+'/relay')},{...init,headers:{...init.headers,'x-fixture-url':url,'x-fixture-redirect':init.redirect}});if(message.to===${JSON.stringify(testOwner)}&&response.status===202)await mailDatabase.prepare('INSERT INTO rer_mail_development_outbox(id,created_at,message) VALUES(?,?,?)').bind(crypto.randomUUID(),Date.now(),JSON.stringify(message)).run();return response;}if(new URL(url).hostname==='127.0.0.1')return networkFetch(input,init);throw new Error('Unapproved fixture network destination')};
 function edge(env){return {...env,${egressBridge?`INTEGRATION_EGRESS:{async send(wire){const reply=await (await env.EGRESS_BRIDGE.fetch('http://egress-bridge/send',{method:'POST',body:JSON.stringify(wire)})).json();if(reply.error)throw new Error(reply.error);return reply.response}},`:egress?`INTEGRATION_EGRESS:{async send(wire){if(wire.url!==${JSON.stringify(syntheticDestination)})throw new Error('Fixture destination refused');const response=await networkFetch(${JSON.stringify(receiver.url+'/hook')},{method:'POST',redirect:'manual',headers:wire.headers,body:wire.body});return {status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()}}},`:''}}}
 // Alert mail uses the fixture provider on both handlers; owner admission uses the real local CLI entry. Work passed to waitUntil finishes before the response returns.
 function alertMail(env){return {...env,MAIL_PROVIDER:${JSON.stringify(mail)},...( ${JSON.stringify(mail)}!=='development'?{MAIL_API_KEY:'synthetic-key-no-provider-call',MAIL_RELAY_URL:${JSON.stringify(relayUrl)}}:{})}}
 export default {async fetch(request,env,ctx){mailDatabase=env.DB;env=edge(env);const path=new URL(request.url).pathname;
 ${mail!=='development'?`const headers=new Headers(request.headers);if(headers.get('origin')==='http://127.0.0.1:15541')headers.set('origin','https://spool.example.com');headers.set('host','spool.example.com');request=new Request('https://spool.example.com'+path+new URL(request.url).search,{method:request.method,headers,body:request.body,redirect:'manual'});`:''}if(path==='/__fixture/schedule')return request.json().then(async value=>{if(value.disableEgress)delete env.INTEGRATION_EGRESS;await application.scheduled({scheduledTime:value.time,cron:'* * * * *'},alertMail(env),ctx);return new Response('{}',{headers:{'content-type':'application/json'}})});
  if(!path.startsWith('/auth/'))env=alertMail(env);const unconfigured=request.headers.get('x-fixture-unconfigured');if(unconfigured==='mail')delete env.MAIL_PROVIDER;if(unconfigured==='egress')delete env.INTEGRATION_EGRESS;
  const pending=[],context={waitUntil(work){pending.push(work);ctx.waitUntil(work)},passThroughOnException(){ctx.passThroughOnException()},props:ctx.props};
  const response=await application.fetch(request,env,context);await Promise.allSettled(pending);return response}};`);
 const bindings={...worker.bindings,...authBindings('http://127.0.0.1:15541'),...(mail!=='development'?{AUTH_ORIGIN:'https://spool.example.com',AUTH_LOCAL:'false',MAIL_PROVIDER:mail,MAIL_API_KEY:'synthetic-key-no-provider-call',MAIL_RELAY_URL:relayUrl}:{MAIL_PROVIDER:'development'}),ALERT_DESTINATION_HASH_KEY:Buffer.alloc(32,45).toString('base64'),ALERT_PUBLIC_ORIGIN:'https://spool.example.com',ALERT_DESTINATIONS:JSON.stringify(destinations??(configure?[
  {id:'webhook-v1',project:'web',label:'Verified receiver',channel:'webhook',url:destinationUrl,key:Buffer.from(signingKey).toString('base64')},
  {id:'mail-v1',project:'web',label:'Owner mailbox',channel:'mail',recipient:'alert-owner@example.com'},
  {id:'other-v1',project:'other',label:'Other mailbox',channel:'mail',recipient:'other-owner@example.com'},
 ]:[]))};
 // Retain the emitted graph, vars and asset router, including its user Worker
 // identity. Only the entrypoint is wrapped for the existing network edges and
 // scheduled-handler test door; all application requests use the native router.
 // A test-only Node edge for the egress double: the Worker's binding calls it over a service binding.
 const serviceBindings=egressBridge?{...worker.serviceBindings,EGRESS_BRIDGE:async request=>{const wire=await request.json();try{return Response.json({response:await egressBridge(wire)})}catch(error){return Response.json({error:error?.code??error?.message??'egress_failed'})}}}:worker.serviceBindings;
 runtime=new Miniflare(convertV4MiniflareOptions({...worker,...serviceBindings?{serviceBindings}:{},modules:[{type:'ESModule',path:wrapper},...worker.modules],modulesRoot:'/',bindings,resourcePersistencePath:state??resolve(temporary,'state'),host:'127.0.0.1',port:15541}));
  await runtime.ready;const db=await runtime.getD1Database(database.binding);registerLegacyMail('http://127.0.0.1:15541',db);
  if(!(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").first())){
   const {unstable_splitSqlQuery}=require('wrangler');const sql=(await Promise.all((await readdir('migrations/core')).filter(f=>f.endsWith('.sql')).sort().map(f=>readFile('migrations/core/'+f,'utf8')))).join('\n');
   await db.batch(unstable_splitSqlQuery(sql).filter(q=>!/^PRAGMA foreign_keys\s*=\s*ON;?$/i.test(q.trim())).map(q=>db.prepare(q)));
  }
  const origin='http://127.0.0.1:15541';let cookie=await signIn(origin,{emailLink:mail!=='development'});
  const request=(path,method='GET',body,headers={})=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,...(body?{'content-type':'application/json'}:{}),...headers},...(body?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
  const json=async(...args)=>{const r=await request(...args);assert.ok(r.ok,`Alert fixture request failed with HTTP ${r.status}`);return r.json()};
  return {origin,db,request,json,bindings,get cookie(){return cookie},set cookie(value){cookie=value},schedule:time=>json('/__fixture/schedule','POST',{time}),
   async close(){await runtime.dispose();await rm(temporary,{recursive:true,force:true})}};
 }catch(error){await runtime?.dispose();await rm(temporary,{recursive:true,force:true});throw error;}
}
export const event=(id,extra={})=>({version:1,eventId:id,release:'r1',build:'b1',environment:'fixture',type:'Error',message:'Synthetic capture token=HIDDEN_ALERT_CANARY',frames:[{file:'https://app.example.com/main.js',line:1,column:0,function:'checkout'}],...extra});
export const rule=(channel,extra={})=>({name:channel==='mail'?'Owner mail':'Webhook receiver',enabled:true,channel,destination:channel==='mail'?'mail-v1':'webhook-v1',kinds:['new_issue','regression'],windowMs:60000,threshold:2,...extra});
export async function setup(runtime) {const project=await runtime.json('/api/projects','POST',{id:'web',name:'Web app'});await runtime.json('/api/projects','POST',{id:'other',name:'Other app'});await runtime.json('/api/projects/web/releases','POST',{name:'r1',build:'b1'});return {Authorization:`Bearer ${project.ingestKey}`};}
