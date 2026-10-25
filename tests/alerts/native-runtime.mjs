import {registerLegacyMail} from '../legacy-mail.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {authBindings,signIn} from '../auth.mjs';
import {emittedWorkerOptions} from '../worker-options.mjs';
const require=createRequire(import.meta.url);

// No application wrapper: HTTP and scheduled events enter the emitted Worker.
export async function nativeAlertRuntime() {
 const temporary=await mkdtemp(resolve(tmpdir(),'spool-native-alerts-'));
 let runtime;
 try {
  const miniflare=require(require.resolve('miniflare',{paths:[require.resolve('wrangler/package.json')]}));
  const {worker,database,triggers}=await emittedWorkerOptions(resolve('dist/server/wrangler.json'),miniflare);
  const origin='http://127.0.0.1:15542';
  const bindings={...worker.bindings,...authBindings(origin),ALERT_DESTINATION_HASH_KEY:Buffer.alloc(32,45).toString('base64'),ALERT_PUBLIC_ORIGIN:'https://spool.example.com',ALERT_DESTINATIONS:JSON.stringify([
   {id:'mail-v1',project:'web',label:'Owner mailbox',channel:'mail',recipient:'alert-owner@example.com'},
  ])};
  const options=miniflare.convertV4MiniflareOptions({...worker,bindings,resourcePersistencePath:resolve(temporary,'state'),host:'127.0.0.1',port:15542,unsafeTriggerHandlers:true});
  options.workers[0].config.triggers=triggers;
  runtime=new miniflare.Miniflare(options);
  await runtime.ready;
  const db=await runtime.getD1Database(database.binding);registerLegacyMail(origin,db);
  const {unstable_splitSqlQuery}=require('wrangler');
  const sql=(await Promise.all((await readdir('migrations/core')).filter(f=>f.endsWith('.sql')).sort().map(f=>readFile('migrations/core/'+f,'utf8')))).join('\n');
  await db.batch(unstable_splitSqlQuery(sql).filter(q=>!/^PRAGMA foreign_keys\s*=\s*ON;?$/i.test(q.trim())).map(q=>db.prepare(q)));
  const cookie=await signIn(origin);
  const request=(path,method='GET',body,headers={})=>fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,Cookie:cookie,...(body?{'content-type':'application/json'}:{}),...headers},...(body?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
  const json=async(...args)=>{if(['POST','PUT'].includes(args[1])&&!args[0].endsWith('/preview')&&/\/alerting\/rules(?:\/[^/]+)?$/.test(args[0])&&args[2]?.enabled&&!args[2].previewToken){const path=args[0],base=path.replace(/\/rules.*$/,'/rules'),ruleId=path===base?null:path.split('/').at(-1),preview=await request(base+'/preview','POST',{...args[2],...(ruleId?{ruleId}:{})});assert.ok(preview.ok,await preview.clone().text());args[2]={...args[2],previewToken:(await preview.json()).token};}const response=await request(...args);assert.ok(response.ok,`Native public request ${new URL(args[0],origin).pathname}: HTTP ${response.status}`);return response.json()};
  return {origin,cookie,request,json,db,
   tick:time=>fetch(origin+'/cdn-cgi/local/scheduled?'+(time?'time='+time+'&':'')+'cron=*+*+*+*+*&format=json'),
   async restart(){await runtime.dispose();runtime=new miniflare.Miniflare(options);await runtime.ready;},
   async close(){await runtime.dispose();await rm(temporary,{recursive:true,force:true})}};
 }catch(error){await runtime?.dispose();await rm(temporary,{recursive:true,force:true});throw error;}
}
