import { file } from '../privacy';
/** A matching path is evidence of overlap, never repository read-back or demonstrated causality. */
export async function sourceMatch(db:D1Database,project:string,issue:string,release:string,sha:string){
 const receipt=await db.prepare('SELECT files,received FROM suspect_commit_files WHERE project=? AND sha=?').bind(project,sha).first<any>();
 if(!receipt)return {available:false,reason:'Recorded commit receipts contain no changed-file list. Source matching is unavailable; no path or ancestry is inferred.'};
 const files:string[]=JSON.parse(receipt.files),matches:any[]=[];
 const rows=(await db.prepare('SELECT id,occurrence,payload,diagnostic FROM events WHERE project=? AND issue=? AND release=? ORDER BY received DESC,id DESC LIMIT 100').bind(project,issue,release).all<any>()).results;
 const path=(value:string)=>file(value).replace(/^\.\//,'');
 for(const row of rows){
  const event=JSON.parse(row.payload),diagnostic=JSON.parse(row.diagnostic);
  for(const [index,frame] of event.frames.entries()){
   const admitted=diagnostic[index],source=admitted?.status==='mapped'?admitted.original?.file:frame.file;
   if(typeof source==='string'&&files.includes(path(source))&&matches.length<30)matches.push({event:row.id,occurrence:row.occurrence,frame:index,file:path(source),basis:admitted?.status==='mapped'?'mapped_at_admission':'reported_frame'});
  }
 }
 return {available:true,recordedFiles:files.length,received:receipt.received,matches,bounds:{eventLimit:100,matchLimit:30},
  reason:matches.length?'Caller-recorded changed paths overlap retained frame paths. Correlation, not a demonstrated cause.':'Caller-recorded changed paths have no exact retained frame match. No suffix, ancestry or source-content match is inferred.'};
}
