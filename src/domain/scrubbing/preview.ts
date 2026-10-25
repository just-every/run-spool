import {emptyScrubbingPolicy,type ScrubbingPolicy} from './policy';
import {applyScrubbingDocument} from './apply';
export async function scrubbingPreview(db:D1Database,project:string|null,policy:ScrubbingPolicy,installation:ScrubbingPolicy){
 const where=project===null?'':'WHERE project=?',args=project===null?[]:[project];
 const total=await db.prepare(`SELECT COUNT(*) n FROM events ${where}`).bind(...args).first<{n:number}>();
 const rows=(await db.prepare(`SELECT payload FROM events ${where} ORDER BY received DESC,id LIMIT 100`).bind(...args).all<{payload:string}>()).results;
 const counts=new Map<string,number>(),sample:unknown[]=[];
 for(const row of rows){
  const result=await applyScrubbingDocument(JSON.parse(row.payload),project===null?policy:installation,project===null?emptyScrubbingPolicy():policy,async()=> '[matched]',{preview:true});
  for(const match of result.matches)counts.set(match.selector,(counts.get(match.selector)??0)+match.fields);
  if(result.matches.length&&sample.length<3)sample.push(result.document);
 }
 return {matches:[...counts].map(([selector,fields])=>({selector,fields})),sample,coverage:{scanned:rows.length,total:total?.n??0}};
}
