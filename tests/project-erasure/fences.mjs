import {commandCheckout} from '../command-runner.mjs';
import {freePort} from '../admission-runtime.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {makePart} from '../../src/modules/portability/index.mjs';
import {ContentVerifier,ArchiveVerifier} from '../../src/modules/portability/format.mjs';
import {testOwner} from '../auth.mjs';

// The pre-erasure archive keeps its source identity, journal and table set; only
// the erased project's events remain, with an epoch high enough that just the
// per-row fence can refuse it: a cascaded child row.
async function childArchive(pre,project,erased){
 // Rows of every erased project leave, except the selected project's events.
 const gone=row=>erased.includes(row.project);
 const data=Object.fromEntries(Object.entries(pre.data).map(([table,rows])=>[table,rows.filter(row=>table==='projects'?!erased.includes(row.id):table==='events'?row.project===project||!gone(row):!gone(row))]));
 data.events=data.events.filter(row=>row.project===project);assert.ok(data.events.length,'the pre-erasure archive holds the project events');
 const manifest={...pre.manifest,payloads:[],epoch:pre.manifest.epoch+1_000_000_000,tables:pre.manifest.tables.map(table=>({...table,count:data[table.name].length}))},items=[];
 for(const table of manifest.tables)for(const [index,row] of data[table.name].entries())items.push({kind:'row',table:table.name,index,row,...table.rowidAlias?{rowid:index+1}:{}});
 const parts=[];for(let n=0;n<items.length;n+=200)parts.push(await makePart(parts.length,items.slice(n,n+200)));
 manifest.partCount=parts.length;const content=new ContentVerifier(manifest),binding=new ArchiveVerifier(manifest);
 for(const part of parts){binding.add(part);for(const item of part.items)content.add(item);}
 return [manifest,...parts,{kind:'closing',partCount:parts.length,contentHash:content.digest(),archiveHash:binding.digest()}].map(row=>JSON.stringify(row)).join('\n')+'\n';
}
async function httpRestore(app,text){
 const response=await app.request('/api/restore','POST',text,{headers:{'X-Confirm-Restore':'yes'}});
 return {status:response.status,error:(await response.json()).error};
}
const reason=result=>/Archive operation refused \(([^)]+)\)/.exec(result.output)?.[1]??null;

// Older archives against the restore fence, through public HTTP and rer import.
export async function fenceProof(app,{pre,project,erased}){
 const child=await childArchive(pre,project,erased),results={};
 results.sameHttpPre=await httpRestore(app,pre.text);assert.deepEqual(results.sameHttpPre,{status:400,error:'erasure_epoch'});
 results.sameHttpChild=await httpRestore(app,child);assert.deepEqual(results.sameHttpChild,{status:400,error:'erased_row:events'});
 // The CLI consumes the post-erasure archive in an independent installation;
 // the same journal must bind both public restore transports.
 const post=await app.archive(),checkout=await commandCheckout();
 try {
  const root=checkout.root;
  await mkdir(resolve(root,'exports'),{recursive:true,mode:0o700});
  for(const [name,text] of [['pre',pre.text],['child',child],['post',post.text]])await writeFile(resolve(root,'exports',name+'.rer'),text,{mode:0o600});
  await checkout.command(['install']);
  const fresh=async()=>{await checkout.command(['reset','--yes']);await checkout.command(['setup','--owner-email',testOwner,'--port',String(await freePort())]);};
  await checkout.command(['setup','--owner-email',testOwner,'--port',String(await freePort())]);
  const imported=await checkout.command(['import','--input','exports/post.rer','--yes'],null);results.freshPost={exit:imported.code};assert.equal(imported.code,0,'post-erasure recovery through rer import');
  const exported=await checkout.command(['export','--output','exports/recovered.rer'],null);assert.equal(exported.code,0,'rer export of the recovered post-erasure installation');
  const same=await checkout.command(['import','--input','exports/pre.rer','--yes'],null);results.sameCliPre={exit:same.code,reason:reason(same)};assert.deepEqual(results.sameCliPre,{exit:4,reason:'erasure_epoch'});
  await app.resetRestore(post.text);
  results.freshHttpChild=await httpRestore(app,child);assert.deepEqual(results.freshHttpChild,{status:400,error:'erased_row:events'});
  await fresh();
  const journal=await checkout.command(['import','--input','exports/pre.rer','--journal','exports/post.rer','--yes'],null);results.newStoreWithJournal={exit:journal.code,reason:reason(journal)};assert.deepEqual(results.newStoreWithJournal,{exit:4,reason:'erased_row'});
  const limit=await checkout.command(['import','--input','exports/pre.rer','--yes'],null);results.newStoreAlone={exit:limit.code,limit:'a brand-new store has no later journal and accepts the older archive'};assert.equal(limit.code,0);
  return results;
 }finally{assert.deepEqual(await checkout.close(),{children:'stopped',directory:'removed'})}
}
