import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {authBindings} from './auth.mjs';
import {finishProductRun,migrationFailure,workerOutput} from './product-diagnostics.mjs';
import {emittedWorkerOptions} from './worker-options.mjs';

export async function startTestWorker(port) {
 let temporary,native,stopping;
 const origin=`http://127.0.0.1:${port}`,output=workerOutput();
 const artifactDirectory=resolve('.artifacts'),runId=Date.now();
 // Cache the operation, including rejection: concurrent callers must not remove
 // persistence while another caller is still disposing the same native runtime.
 const stop=()=>stopping??=(async()=>{
  const result=await finishProductRun({output,artifactDirectory,runId,cleanup:[
   ['product-worker',async()=>{if(native)try{await native.dispose()}catch(error){output.add(String(error));throw error}}],
   ['temporary-files',async()=>{if(temporary)await rm(temporary,{recursive:true,force:true})}]
  ]});
  if(result.failed)throw new Error('Test Worker cleanup failed: '+JSON.stringify(result));
 })();
 try {
  temporary=await mkdtemp(resolve(tmpdir(),'spool-worker-'));
  const require=createRequire(import.meta.url);
  const miniflare=require(require.resolve('miniflare',{paths:[require.resolve('wrangler/package.json')]}));
  const {Miniflare,convertV4MiniflareOptions,Log,LogLevel}=miniflare;
  const {worker,database,triggers}=await emittedWorkerOptions(resolve('dist/server/wrangler.json'),miniflare);
  const log=new Log(LogLevel.INFO);log.log=message=>output.add(message+'\n');
  // One native listener owns the actual emitted app, disk assets and migrated D1.
  // Wrangler dev's additional proxy hop is deliberately absent; no HTTP replay.
  const options=convertV4MiniflareOptions({
   ...worker,bindings:{...worker.bindings,...authBindings(origin)},
   log,handleStructuredLogs:({message})=>output.add(message+'\n'),
   resourcePersistencePath:resolve(temporary,'state/v3'),host:'127.0.0.1',port,
   unsafeTriggerHandlers:triggers.length>0
  });
  // V4 conversion omits cron declarations. Preserve them in Miniflare's native
  // scheduled trigger schema; Wrangler's local scheduling is explicitly manual.
  if(triggers.length)options.workers[0].config.triggers=triggers;
  native=new Miniflare(options);
  await native.ready;
  try {
   const db=await native.getD1Database(database.binding);
   assert.equal((await db.prepare('PRAGMA foreign_keys').first()).foreign_keys,1,'D1 enforces foreign keys');
   const {unstable_splitSqlQuery}=require('wrangler');
   const files=(await readdir('migrations/core')).filter(file=>file.endsWith('.sql')).sort();
   assert.ok(files.length,'Actual core migrations are required');
   const sql=(await Promise.all(files.map(file=>readFile(resolve('migrations/core',file),'utf8')))).join('\n');
   // Only this standalone no-op is skipped, after proving enforcement above.
   // Wrangler's splitter retains complete triggers and quoted semicolons.
   const queries=unstable_splitSqlQuery(sql).filter(sql=>!/^PRAGMA foreign_keys\s*=\s*ON;?$/i.test(sql.trim()));
   await db.batch(queries.map(sql=>db.prepare(sql)));
  }catch(error){error.migration=migrationFailure({status:null,stderr:error?.cause?.message??error?.message});throw error}
  const health=await fetch(origin+'/health');
  try{assert.equal(health.status,200,'Emitted Worker health succeeds')}finally{await health.body?.cancel()}
  return {origin,stop,diagnostic:()=>output.summary()};
 }catch(failure){
  output.add(String(failure));
  const result=await finishProductRun({failure,output,artifactDirectory,runId,cleanup:[['test-worker',stop]]});
  throw new Error('Test Worker failed: '+JSON.stringify(result));
 }
}
