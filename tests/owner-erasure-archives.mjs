import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { makePart } from '../src/modules/portability/index.mjs';
import { ContentVerifier, ArchiveVerifier } from '../src/modules/portability/format.mjs';
import { commandCheckout } from './command-runner.mjs';
import { freePort } from './admission-runtime.mjs';
import { testOwner } from './auth.mjs';
import { runtime, restore } from './owner-erasure/helpers.mjs';

// Keep the old archive's identity and redaction checkpoint; remove every row
// except captured event children. This tests that a parent-free old capture
// cannot sidestep the redaction fence. Recompute genuine archive checksums.
async function capturedChildren(pre) {
 const events=pre.data.events;assert.ok(events.length);
 const manifest={...pre.manifest,tables:pre.manifest.tables.map(table=>({...table,count:table.name==='events'?events.length:0}))};
 const items=events.map((row,index)=>({kind:'row',table:'events',index,row,...manifest.tables.find(table=>table.name==='events').rowidAlias?{rowid:index+1}:{}}));
 const parts=[];for(let i=0;i<items.length;i+=200)parts.push(await makePart(parts.length,items.slice(i,i+200)));
 manifest.partCount=parts.length;
 const content=new ContentVerifier(manifest),binding=new ArchiveVerifier(manifest);
 for(const part of parts){binding.add(part);for(const item of part.items)content.add(item);}
 return [manifest,...parts,{kind:'closing',partCount:parts.length,contentHash:content.digest(),archiveHash:binding.digest()}].map(record=>JSON.stringify(record)).join('\n')+'\n';
}

export async function archiveFences(app,pre,post) {
 const child=await capturedChildren(pre),results={};let fresh,checkout;
 try {
  results.sameChild=await restore(app,child);assert.deepEqual(results.sameChild,{status:400,body:{error:'erasure_epoch'}});
  fresh=await runtime();
  results.freshPost=await restore(fresh,post.text);assert.equal(results.freshPost.status,200);
  results.freshChild=await restore(fresh,child);assert.equal(results.freshChild.status,400);assert.equal(results.freshChild.body.error,'erasure_epoch');
  await fresh.close();fresh=null;
  // Explicit later journals are a public CLI capability. HTTP has no journal
  // parameter; do not add an invented test door or call the erasure internals.
  checkout=await commandCheckout();
  await mkdir(resolve(checkout.root,'exports'),{recursive:true});
  for(const [name,text] of [['pre',pre.text],['post',post.text],['children',child]])await writeFile(resolve(checkout.root,'exports',name+'.rer'),text,{mode:0o600});
  await checkout.command(['setup','--owner-email',testOwner,'--port',String(await freePort())]);
  const reason=result=>/Archive operation refused \(([^)]+)\)/.exec(result.output)?.[1]??null;
  for(const name of ['pre','children']) {
   const refused=await checkout.command(['import','--input',`exports/${name}.rer`,'--journal','exports/post.rer','--yes'],null);
   results[name+'WithExplicitJournal']={exit:refused.code,error:reason(refused)};
   assert.deepEqual(results[name+'WithExplicitJournal'],{exit:4,error:'erasure_epoch'});
  }
  const alone=await checkout.command(['import','--input','exports/pre.rer','--yes'],null);
  results.oldArchiveAlone={exit:alone.code};assert.equal(alone.code,0,'a fresh empty store given no later journal cannot infer erasure');
  console.log('Owner erasure archive fences: '+JSON.stringify(results));return results;
 } finally {
  await fresh?.close();
  if(checkout){const cleanup=await checkout.close();assert.deepEqual(cleanup,{children:'stopped',directory:'removed'});}
 }
}
