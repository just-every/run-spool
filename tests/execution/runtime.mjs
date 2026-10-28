import {chooseLocalAgentPolicy} from '../agent-door/local-policy.mjs';
import {registerLegacyMail} from '../legacy-mail.mjs';
import assert from 'node:assert/strict';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {authBindings,signIn} from '../auth.mjs';
import {emittedWorkerOptions} from '../worker-options.mjs';
const require=createRequire(import.meta.url);
// The emitted Worker on one loopback port with persisted D1, restartable with
// or without the owner's GitHub connection secret.
export async function executionRuntime(state,port,extra={}){
 const miniflare=require(require.resolve('miniflare',{paths:[require.resolve('wrangler/package.json')]}));
 const {Miniflare,convertV4MiniflareOptions}=miniflare,origin=`http://127.0.0.1:${port}`;
 const {worker,database}=await emittedWorkerOptions(resolve('dist/server/wrangler.json'),miniflare);
 await mkdir(state,{recursive:true});
 const entry=resolve(state,'execution-entry.mjs');
 await writeFile(entry,`import application from ${JSON.stringify(worker.modules[0].path)};export default {fetch(request,env,ctx){if(new URL(request.url).pathname==='/__fixture/schedule')return request.json().then(async body=>{await application.scheduled({scheduledTime:body.time,cron:'* * * * *'},env,ctx);return Response.json({})});return application.fetch(request,env,ctx)}};`);
 const runtime=new Miniflare(convertV4MiniflareOptions({...worker,modules:[{type:'ESModule',path:entry},...worker.modules],modulesRoot:'/',bindings:{...worker.bindings,...authBindings(origin),...extra},resourcePersistencePath:state,host:'127.0.0.1',port}));
 try{
  await runtime.ready;const db=await runtime.getD1Database(database.binding);registerLegacyMail(origin,db);
  if(!(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").first())){
   const {unstable_splitSqlQuery}=require('wrangler');
   const sql=(await Promise.all((await readdir('migrations/core')).filter(f=>f.endsWith('.sql')).sort().map(f=>readFile('migrations/core/'+f,'utf8')))).join('\n');
   await db.batch(unstable_splitSqlQuery(sql).filter(q=>!/^PRAGMA foreign_keys\s*=\s*ON;?$/i.test(q.trim())).map(q=>db.prepare(q)));
  }
  const cookie=await signIn(origin);await chooseLocalAgentPolicy(origin,cookie);
  const request=(path,method='GET',body,headers={})=>fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,Cookie:cookie,...(body!==undefined?{'content-type':typeof body==='string'?'application/x-ndjson':'application/json'}:{}),...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
  const json=async(path,method,body,headers,status)=>{const r=await request(path,method,body,headers);const value=await r.json();assert.ok(status?r.status===status:r.ok,`${method??'GET'} ${path}: HTTP ${r.status} ${value.error??''}`);return value;};
  return {origin,db,cookie,request,json,schedule:time=>json('/__fixture/schedule','POST',{time}),stop:()=>runtime.dispose()};
 }catch(error){await runtime.dispose();throw error;}
}
