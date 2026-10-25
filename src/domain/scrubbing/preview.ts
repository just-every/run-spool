import {emptyScrubbingPolicy,type ScrubbingPolicy} from './policy';
import {applyScrubbingDocument} from './apply';
export async function scrubbingPreview(db:D1Database,project:string|null,policy:ScrubbingPolicy,installation:ScrubbingPolicy){
 const where=project===null?'':'WHERE e.project=?',args=project===null?[]:[project];
 const total=await db.prepare(`SELECT COUNT(*) n FROM events e ${where}`).bind(...args).first<{n:number}>();
 const rows=(await db.prepare(`SELECT e.payload,e.received,x.payload identity_values FROM events e LEFT JOIN event_identities x ON x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence ${where} ORDER BY e.received DESC,e.id LIMIT 100`).bind(...args).all<{payload:string;received:number;identity_values:string|null}>()).results;
 const counts=new Map<string,number>(),sample:unknown[]=[];
 for(const row of rows){
  const document=JSON.parse(row.payload),retained=JSON.parse(row.identity_values??'{}');
  const user=Object.fromEntries(Object.entries(retained).filter(([,value]:[string,any])=>value.mode==='keep').map(([key,value]:[string,any])=>[key,value.value]));
  if(Object.keys(user).length)document.user=user;
  const result=await applyScrubbingDocument(document,project===null?policy:installation,project===null?emptyScrubbingPolicy():policy,async()=> '[matched]',{preview:true});
  for(const match of result.matches)counts.set(match.selector,(counts.get(match.selector)??0)+match.fields);
  if(result.matches.length&&sample.length<3)sample.push({received:row.received,fields:result.fields});
 }
 return {matches:[...counts].map(([selector,fields])=>({selector,fields})),sample,coverage:{scanned:rows.length,total:total?.n??0}};
}
