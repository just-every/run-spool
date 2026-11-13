import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const fromRoot=path=>import(pathToFileURL(resolve(path)));
const {executionRuntime}=await fromRoot('tests/execution/runtime.mjs');
const {archiveProjection}=await fromRoot('tests/archive.mjs');
const {followErasure}=await fromRoot('tests/project-erasure/follow.mjs');
const {makePart}=await fromRoot('src/modules/portability/index.mjs');
const {ContentVerifier,ArchiveVerifier}=await fromRoot('src/modules/portability/format.mjs');
const label=process.argv[2]??'before',packet=resolve(process.argv[3]);
const roots=await Promise.all([1,2].map(()=>mkdtemp(resolve(tmpdir(),'spool-restore-validation-'))));
let source,target;
const result={label,synthetic:true,originalArchiveAvailable:false,checks:[]};
const sorted=data=>Object.fromEntries(Object.entries(data).map(([table,rows])=>[table,rows.map(row=>JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))))).sort()]));
async function probe(app,text){const r=await app.request('/api/restore','POST',text,{'X-Confirm-Restore':'yes'});return {status:r.status,body:await r.json()};}
async function altered(archive,edit){
 const data=structuredClone(archive.data);edit(data);
 const manifest={...archive.manifest,payloads:[],tables:archive.manifest.tables.map(t=>({...t,count:data[t.name].length}))};
 const items=[];for(const t of manifest.tables)for(const [index,row] of data[t.name].entries())items.push({kind:'row',table:t.name,index,row,...t.rowidAlias?{rowid:index+1}:{}});
 const parts=[];for(let n=0;n<items.length;n+=100)parts.push(await makePart(parts.length,items.slice(n,n+100)));manifest.partCount=parts.length;
 const content=new ContentVerifier(manifest),binding=new ArchiveVerifier(manifest);for(const part of parts){binding.add(part);for(const item of part.items)content.add(item);}
 return [manifest,...parts,{kind:'closing',partCount:parts.length,contentHash:content.digest(),archiveHash:binding.digest()}].map(r=>JSON.stringify(r)).join('\n')+'\n';
}
try{
 source=await executionRuntime(roots[0],15676);
 for(const id of ['erase-execution','retain-execution']){
  const project=await source.json('/api/projects','POST',{id,name:id}),p='/api/projects/'+id;
  await source.json(p+'/releases','POST',{name:'r1',build:'b1'});
  const event={version:1,eventId:'event-1',release:'r1',build:'b1',environment:'production',type:'Error',message:'Synthetic archive restore case',frames:[{file:'app.js',line:1,column:0,function:'archiveCase'}],breadcrumbs:[]};
  const captured=await source.json('/api/ingest/'+id,'POST',event,{Authorization:'Bearer '+project.ingestKey,Cookie:''});
  await source.json(p+'/reproducers','POST',{event:event.eventId,input:[{}]});
  await source.json(p+'/repairs','POST',{issue:captured.issue,link:'https://github.example/synthetic/pull/1',note:'Synthetic retained repair'});
 }
 const pre=await archiveProjection(await source.request('/api/archive'));
 result.before={projects:pre.data.projects.length,reproducers:pre.data.reproducers.length,repairs:pre.data.repairs.length};
 const path='/api/projects/erase-execution/erasure',plan=await source.json(path);
 const erasure=await followErasure(source.json,await source.json(path,'POST',{confirm:'erase-execution',planHash:plan.planHash}));
 assert.equal(erasure.phase,'complete');
 const post=await archiveProjection(await source.request('/api/archive'));
 const erasedExecution=post.data.audit.filter(r=>r.project===null&&r.kind==='reproducer_recorded');
 assert.equal(erasedExecution.length,1);assert.equal(post.data.reproducers.length,1);assert.equal(post.data.repairs.length,1);
 result.afterErasure={projects:post.data.projects.length,reproducers:post.data.reproducers.length,repairs:post.data.repairs.length,receipts:post.data.rer_erasure_operations.length,anonymizedExecutionAudit:erasedExecution.length};
 result.sameSourcePre=await probe(source,pre.text);assert.equal(result.sameSourcePre.body.error,'erasure_epoch');
 target=await executionRuntime(roots[1],15677);
 result.semanticExecution=await probe(target,await altered(post,d=>{d.reproducers[0].support='invalid';}));
 result.invalidReceipt=await probe(target,await altered(post,d=>{d.rer_erasure_operations[0].phase='deleting';}));
 const records=post.text.trimEnd().split('\n').map(JSON.parse);records.find(r=>r.kind==='part').sha256='0'.repeat(64);
 result.checksumTamper=await probe(target,records.map(JSON.stringify).join('\n')+'\n');assert.equal(result.checksumTamper.status,400);
 assert.deepEqual(await target.json('/api/projects'),[],'all refusals preserve empty destination');
 result.restore=await probe(target,post.text);
 if(label==='before'){
  assert.equal(result.restore.status,400,'reproduce ordinary post-erasure archive refusal on main');
  result.reproduced=true;
 }else{
  assert.equal(result.restore.status,200,'same ordinary post-erasure archive restores after fix');
  const restored=await archiveProjection(await target.request('/api/archive'));
  assert.deepEqual(sorted(restored.data),sorted(post.data),'retained rows, receipt and anonymous audit are unchanged');
  for(const table of ['credentials','sessions','reproducer_run_tokens','fix_leases','alert_destinations','alert_intents','alert_mail_jobs','alert_mail_attempts'])assert.ok(!(table in restored.data),'excluded authority or dispatch table '+table);
  result.freshPre=await probe(target,pre.text);assert.equal(result.freshPre.body.error,'erasure_epoch');
  result.nonempty=await probe(target,post.text);assert.equal(result.nonempty.status,409);assert.equal(result.nonempty.body.error,'target_not_empty:alerts');
  assert.equal(result.semanticExecution.status,400);assert.equal(result.semanticExecution.body.error,'Invalid execution archive');
  assert.equal(result.invalidReceipt.status,400);assert.equal(result.invalidReceipt.body.error,'Archive erasure in progress');
  result.checks=['identical post-erasure source now restores','all retained domain rows compare equal','completed erasure receipt and anonymized execution/repair audit travel unchanged','authority and dispatch tables remain excluded','same-source and fresh post-import erasure fences refuse old archive','nonempty target refuses unchanged archive','rebound semantic execution and in-progress erasure tampering refuse before rows','checksum tampering refuses before rows'];
 }
}catch(error){result.failure={name:error.name,message:error.message};process.exitCode=1;}
finally{
 const stopped=await Promise.allSettled([source?.stop(),target?.stop()]);result.cleanup=stopped.map(r=>r.status);await Promise.all(roots.map(root=>rm(root,{recursive:true,force:true})));
 await writeFile(resolve(packet,label+'-receipt.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}
