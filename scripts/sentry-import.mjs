#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
export async function sentryImportCli(args) {
  const [action,...rest]=args,options={};
  if(!['dry-run','apply','resume','undo','read','originals'].includes(action))throw new Error('Expected dry-run, apply, resume, read, originals or undo');
  const names=new Map([['--endpoint','endpoint'],['--session-env','sessionEnv'],['--file','file'],['--organization','organization'],['--fingerprint','fingerprint'],['--operation','operation'],['--job','job'],['--output','output']]);
  for(let index=0;index<rest.length;index++){const name=names.get(rest[index]);if(!name||options[name]||!rest[index+1]||rest[index+1].startsWith('--'))throw new Error('Invalid or duplicate option');options[name]=rest[++index]}
  const endpoint=new URL(options.endpoint);
  if(endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=='/'||!['http:','https:'].includes(endpoint.protocol))throw new Error('Endpoint must be an HTTP(S) origin without credentials');
  if(endpoint.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname))throw new Error('Owner session requires HTTPS outside loopback');
  if(!/^[A-Z_][A-Z0-9_]*$/i.test(options.sessionEnv??'')||!process.env[options.sessionEnv])throw new Error('session-env must name a populated owner session environment variable');
  const session=process.env[options.sessionEnv];
  let path='/api/imports/sentry',body,method='POST';
  if(action==='dry-run'||action==='apply'){
    if(!options.file)throw new Error('file is required');
    const bytes=await readFile(options.file);if(bytes.length>2*1024*1024)throw new Error('Export bundle exceeds 2 MiB');
    path+=action==='dry-run'?'/plan':'/apply';
    body={source:bytes.toString('base64'),...options.operation?{operationKey:options.operation}:{}};
    if(action==='apply'){if(!options.fingerprint||!options.operation)throw new Error('Reviewed fingerprint and stable operation key required');body.reviewedFingerprint=options.fingerprint;body.operationKey=options.operation}
  }else{
    if(!options.job||!options.organization)throw new Error('Job and organization required');
    path+=`/${encodeURIComponent(options.organization)}/${encodeURIComponent(options.job)}`;
    if(['read','originals'].includes(action)){method='GET';if(action==='originals')path+='/originals'}else path+=`/${action}`;
  }
  if(action==='originals'&&!options.output)throw new Error('Originals require --output FILE');
  let response;try{response=await fetch(endpoint.origin+path,{method,redirect:'error',headers:{Origin:endpoint.origin,Cookie:session,...body?{'Content-Type':'application/json'}:{}},...body?{body:JSON.stringify(body)}:{}})}catch{throw new Error('Spool import transport failed')}
  if(!response.ok)throw new Error(`Spool import refused (HTTP ${response.status}); inspect the authenticated workbench for the safe reason`);
  const result=await response.json();
  if(action==='originals'){await writeFile(options.output,JSON.stringify(result),{mode:0o600,flag:'wx'});return {saved:true}}
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)sentryImportCli(process.argv.slice(2)).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1});
