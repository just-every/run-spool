import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {executionRuntime} from '../execution/runtime.mjs';
import {mappingArchive} from './archive.mjs';
// An archive exported before the Android symbol cutover stores the old Java verdict
// `missing_debug_id` for a frame that carries a filename, line and the optional
// column. It must keep restoring, with the event's frame and diagnostic intact.
export async function priorJavaArchive(port){
 const state=await mkdtemp(join(tmpdir(),'spool-java-archive-')),target=await mkdtemp(join(tmpdir(),'spool-java-archive-restore-'));
 let app,restored;
 try{
  app=await executionRuntime(state,port);
  await app.json('/api/projects','POST',{id:'java-compat',name:'Cedar Android compatibility'});
  await app.json('/api/projects/java-compat/releases','POST',{name:'java-compat',build:'42'});
  const key=await app.json('/api/projects/java-compat/keys','POST',{kind:'ingest'}),dsn=new URL(key.dsn);
  const event={event_id:'c'.repeat(32),platform:'java',release:'java-compat',dist:'42',environment:'production',exception:{values:[{type:'IllegalStateException',value:'Compatibility sample',stacktrace:{frames:[{filename:'MainActivity.java',function:'com.synthetic.MainActivity.crash',lineno:43,colno:1}]}}]}};
  const envelope=JSON.stringify({event_id:event.event_id})+'\n'+JSON.stringify({type:'event'})+'\n'+JSON.stringify(event);
  const sent=await app.request('/api'+dsn.pathname+'/envelope/?sentry_key='+dsn.username+'&sentry_version=7','POST',envelope,{Cookie:'','content-type':'application/x-sentry-envelope'});
  assert.equal(sent.status,200);
  const frames=[{file:'MainActivity.java',line:43,column:0,function:'com.synthetic.MainActivity.crash'}];
  const current=async db=>{const row=await db.prepare('SELECT payload,diagnostic FROM events WHERE id=?').bind(event.event_id).first();return {frames:JSON.parse(row.payload).frames,diagnostic:JSON.parse(row.diagnostic)}};
  const fresh=await current(app.db);
  assert.deepEqual(fresh.frames,frames);assert.equal(fresh.diagnostic[0].status,'missing_native_symbols','new Java events keep their native statuses');
  // What the exporter before the cutover stored for this event.
  const prior=await mappingArchive(await (await app.request('/api/archive')).text(),rows=>{for(const row of rows.events)row.diagnostic=JSON.stringify([{generated:frames[0],status:'missing_debug_id'}])},true);
  await app.stop();app=null;
  restored=await executionRuntime(target,port);
  await restored.json('/api/restore','POST',prior,{'X-Confirm-Restore':'yes'});
  assert.deepEqual(await current(restored.db),{frames,diagnostic:[{generated:frames[0],status:'missing_debug_id'}]},'frame fields and the stored diagnostic survive the restore');
 }finally{await app?.stop();await restored?.stop();await rm(state,{recursive:true,force:true});await rm(target,{recursive:true,force:true});}
}
