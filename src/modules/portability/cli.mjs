#!/usr/bin/env node
import { createReadStream,existsSync,realpathSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { options, cookieFile, absent, privateFile, checkpoint, promote } from './cli-options.mjs';
import { readArchive } from './format.mjs';
import { canonicalJson } from './hash.mjs';
import { transferClient, transferDiagnostic } from './http-client.mjs';
export async function main(args) {
  const opts=options([...args]),cookie=await cookieFile(opts['session-file']);
  const endpoint=opts.origin+opts.basePath;
  const client=transferClient({endpoint,origin:opts.origin,cookie}),{get}=client;
  const shell=value=>"'"+value.replaceAll("'","'\\''")+"'";
  const resumeCommand=(id)=>'node '+shell(fileURLToPath(import.meta.url))+' '+opts.command+' --origin '+shell(opts.origin)+' --session-file '+shell(opts['session-file'])+' '+(opts.command==='export'?'--out '+shell(opts.out):'--from '+shell(opts.from))+' --resume '+id;
  if(opts.command==='export') {
    await absent(opts.out);
    const id=client.jobId(opts.resume??(await get('exports','POST',{})).id,'exports');
    await checkpoint(opts.out+'.transfer.json',{version:1,kind:'export',id,origin:opts.origin});
    process.stdout.write('Job '+id+'\nResume: '+resumeCommand(id)+'\n');
    let path='exports/'+id,status=await get(path);
    while(status.phase==='building'){path='exports/'+id+'/advance';status=await get(path,'POST',{expectedPart:status.completed,maxParts:16});}
    if(status.phase!=='complete')throw client.failedJob(path,status);
    const records=await client.download(id),file=await privateFile(opts.out+'.partial',Boolean(opts.resume));
    try{for await(const record of records)await file.writeFile(canonicalJson(record)+'\n');await file.sync();}
    finally{await file.close();}
    await promote(opts.out+'.partial',opts.out);process.stdout.write('Export complete.\n');return;
  }
  if(opts.command==='import') {
    const source=Readable.toWeb(createReadStream(opts.from));let id=opts.resume,closing;
    // Verify every record even when earlier uploads are already acknowledged.
    for await(const record of readArchive(source)) {
      if(record.kind==='manifest') {
        id=client.jobId(id??(await get('imports','POST',{confirmed:true,manifest:record})).id,'imports');
        await checkpoint(opts.from+'.transfer.json',{version:1,kind:'import',id,origin:opts.origin});
        process.stdout.write('Job '+id+'\nResume: '+resumeCommand(id)+'\n');
      }else if(record.kind==='part')await get('imports/'+id+'/parts/'+record.index,'PUT',record);
      else closing=record;
    }
    const result=await get('imports/'+id+'/finalize','POST',{contentHash:closing.contentHash,archiveHash:closing.archiveHash});
    process.stdout.write('Import '+result.phase+'.\nRequired configuration: '+result.requiredConfiguration.join(', ')+'\n');return;
  }
  let collection='exports';
  let status;try{status=await get(collection+'/'+opts.resume);}catch{collection='imports';status=await get(collection+'/'+opts.resume);}
  if(opts.command==='abort')status=await get(collection+'/'+opts.resume+'/abort','POST',{});
  process.stdout.write(JSON.stringify(status)+'\n');
}
if(process.argv[1] && existsSync(process.argv[1]) && import.meta.url===pathToFileURL(realpathSync(process.argv[1])).href)main(process.argv.slice(2)).catch(error=>{
  // Errors may contain server diagnostics or filesystem paths. Do not echo them.
  process.stderr.write((transferDiagnostic(error)??'Transfer failed: check the origin, absolute paths, output, session file and job status.')+'\n');process.exitCode=1;
});
