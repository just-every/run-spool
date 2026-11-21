import { useState } from 'react';
import { ownerFetch } from './client';
import { download, type Run } from './shared';

export function DownloadBackup({busy,run,label='Download private archive'}:{busy:boolean;run:Run;label?:string}) {
 const [preparing,setPreparing]=useState(false),[notice,setNotice]=useState('');
 return <div><button className="text-button" disabled={busy||preparing} onClick={()=>{
  setPreparing(true);setNotice('');
  void run(async()=>{try{
   const response=await ownerFetch('/api/archive',{credentials:'same-origin'});
   if(!response.ok)throw new Error('Backup download failed. Sign in and try again.');
   const text=await response.text(),manifest=JSON.parse(text.split('\n')[0]);
   const projects=manifest.tables.find((table:{name:string})=>table.name==='projects')?.count;
   const day=new Date(manifest.exportedAt).toISOString().slice(0,10),name=`spool-private-archive-${day}.jsonl`;
   download(text,name);setNotice(`Downloaded ${name}${Number.isSafeInteger(projects)?` (${projects} ${projects===1?'project':'projects'})`:''}`);
  }finally{setPreparing(false);}});
 }}>{preparing?'Preparing your backup…':label}</button>{notice&&<p role="status">{notice}</p>}</div>;
}
