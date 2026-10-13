import { open, mkdir, link, unlink, mkdtemp, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { getPlatformProxy } from 'wrangler';
import { readArchive, PortabilityError } from '../../src/modules/portability/index.mjs';

// Binding and filesystem adapter only. The bundled product module below is the
// same policy/legacy decoder the HTTP handlers call; Base owns the archive engine.
// Archives are read back with the application's own pinned portability engine,
// never the CLI's newer copy, so the archive format matches what the app writes.
async function run(direction, path, journal) {
 const root = process.cwd(); await mkdir(join(root,'.rer/local'),{recursive:true,mode:0o700});
 const work = await mkdtemp(join(root,'.rer/local/transfer-'));
 let proxy, input, output, temporary;
 try {
  const policy = join(work,'policy.mjs');
  await build({entryPoints:[join(root,'src/domain/portability.ts')],outfile:policy,bundle:true,format:'esm',platform:'node',logLevel:'silent'});
  const { portability, archiveStream, restoreStream, laterJournalOf } = await import(pathToFileURL(policy).href);
  proxy = await getPlatformProxy({configPath:join(root,'wrangler.jsonc'),persist:{path:join(root,'.wrangler/state/v3')},remoteBindings:false});
  const service = await portability(proxy.env.DB);
  if (direction === 'import') {
   // --journal: a later archive of the same installation whose erasure journal also fences this restore.
   let later;
   if (journal) { const file = await open(journal, constants.O_RDONLY | constants.O_NOFOLLOW); try { later = await laterJournalOf(Readable.toWeb(file.createReadStream({autoClose:false}))); } finally { await file.close(); } }
   input = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
   await restoreStream(service, Readable.toWeb(input.createReadStream({autoClose:false})), later);
   return { restored:true, credentials:'excluded; run setup and create new project grants' };
  }
  await mkdir(dirname(path),{recursive:true,mode:0o700});
  temporary=path+'.'+crypto.randomUUID()+'.partial'; output=await open(temporary,'wx',0o600);
  const reader=(await archiveStream(service)).getReader();
  try { for(;;) {const {done,value}=await reader.read();if(done)break;let offset=0;while(offset<value.length)offset+=(await output.write(value,offset)).bytesWritten;} }
  finally {await reader.cancel();}
  await output.sync();await output.close();output=undefined;
  input=await open(temporary,constants.O_RDONLY|constants.O_NOFOLLOW);let manifest,closing;
  for await(const record of readArchive(Readable.toWeb(input.createReadStream({autoClose:false})))){if(record.kind==='manifest')manifest=record;if(record.kind==='closing')closing=record;}
  await input.close();input=undefined;await link(temporary,path);
  return {contentHash:closing.contentHash,tables:manifest.tables.map(({name,count})=>({name,count})),exclusions:manifest.excludedTables,requiredConfiguration:manifest.requiredConfiguration};
 } finally {await input?.close();await output?.close();if(temporary)await unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});await proxy?.dispose();await rm(work,{recursive:true,force:true});}
}
try {console.log(JSON.stringify({ok:true,...await run(process.argv[2],process.argv[3],process.argv[4])}));}
catch(error){
 // Erasure-fence and inventory refusals are safety refusals (exit 4), as in the Base CLI worker.
 // The policy bundle carries its own copy of the portability engine, so match its shape, not instanceof.
 const portable=error instanceof PortabilityError||(typeof error?.code==='string'&&/^[a-z_]+(:\S*)?$/.test(error.code)&&Number.isInteger(error.status));
 const reason=portable?error.code.split(':')[0]:'archive_operation_failed';
 const refused=portable&&(error.status===409||['wrong_product','schema_mismatch','table_inventory','configuration_inventory','erased_row','erasure_epoch','later_journal','invalid_journal'].includes(reason));
 console.log(JSON.stringify({ok:false,reason,exitCode:refused?4:1}));process.exitCode=1;}
