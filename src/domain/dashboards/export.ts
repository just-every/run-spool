import {fail} from './input';

const limit=10000,maxBytes=8*1024*1024;
const cell=(value:any)=>{
 const text=String(value??'');
 return '"'+(/^[\s\p{Cc}]*[=+\-@]/u.test(text)?"'"+text:text).replaceAll('"','""')+'"';
};
function flatten(value:any,path:string,rows:any[]){
 if(value===null||typeof value!=='object')rows.push({field:path,value});
 else for(const [key,child] of Object.entries(value))flatten(child,path?`${path}.${key}`:key,rows);
 if(rows.length>limit)fail('reporting_export_limit: more than 10000 export rows; narrow the query, project scope or window',413);
}
export function itemExport(item:any,format:string){
 if(!['csv','json'].includes(format))fail('Export format must be json or csv');
 const rows:any[]=[];
 for(const widget of item.widgets){
  if(widget.data.bounds?.complete===false)fail('reporting_export_limit: grouped values exceed the display cap; narrow the query or grouping before exporting',413);
  const common={kind:item.kind,item:item.name,widget:widget.name,project:widget.project,from:widget.config.from,to:widget.config.to};
  if(item.kind==='table')for(const row of widget.data.rows)rows.push({...common,...row});
  else if(item.kind==='dashboard'){
   rows.push({...common,metric:widget.data.metric,group:null,value:widget.data.value,matchedEvents:widget.data.matchedEvents,unattributed:widget.data.unattributed??null});
   for(const group of widget.data.groups)rows.push({...common,metric:widget.data.metric,...group});
  }else{
   const facts:any[]=[];flatten(widget.data,'',facts);for(const fact of facts)rows.push({...common,...fact});
  }
 }
 if(rows.length>limit)fail('reporting_export_limit: more than 10000 export rows; narrow the query, project scope or window',413);
 const bounds={limit,rows:rows.length,complete:true,notice:'Only the explicit per-widget windows and currently accessible projects are exported. Occurrence rows contain safe metadata only; all user metrics are count-only.'};
 const safe={...item,shares:undefined,bounds},keys=[...new Set(rows.flatMap(row=>Object.keys(row)))];
 // CSV includes a metadata row even for empty results, so bounds and omissions
 // remain explicit outside the application as they do in JSON.
 const csvRows=[{record:'metadata',item:item.name,omittedProjects:item.omittedProjects,bounds:JSON.stringify(bounds),windows:JSON.stringify(item.widgets.map((w:any)=>({widget:w.name,from:w.config.from,to:w.config.to}))),coverage:JSON.stringify(item.widgets.map((w:any)=>({widget:w.name,noReleaseEvents:w.data.noReleaseEvents??null,metadata:w.data.metadata,definition:w.data.definition,bounds:w.data.bounds})))},...rows.map(row=>({record:'data',...row}))];
 const csvKeys=[...new Set(['record','omittedProjects','bounds','windows','coverage',...keys])];
 const body=format==='csv'?[csvKeys.map(cell).join(','),...csvRows.map(row=>csvKeys.map(key=>cell((row as any)[key])).join(','))].join('\r\n'):JSON.stringify(safe);
 if(new TextEncoder().encode(body).byteLength>maxBytes)fail('reporting_export_bytes: export exceeds 8 MiB; narrow the query, project scope or window',413);
 return new Response(body,{headers:{'Content-Type':format==='csv'?'text/csv; charset=utf-8':'application/json','Content-Disposition':`attachment; filename="spool-${item.kind}.${format}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
