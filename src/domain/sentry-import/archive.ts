import { canonical, hash, identity } from '../privacy';
export const importedTables:Record<string,string[]>={sentry_project_aliases:['id','project'],sentry_import_targets:['kind','id','revision','source']};
export function legacyImportDefaults(data:any){return {...data,events:data.events.map((event:any)=>({...event,historical:0})),sentry_project_aliases:data.projects.map((project:any,index:number)=>({id:index+1,project:project.id})),sentry_import_targets:[]}}
export async function validateImportedRows(data:any){
  const projects=new Set(data.projects.map((p:any)=>p.id)),aliases=new Set(),projectAliases=new Set(),metadata=new Map<string,any>();
  for(const row of data.sentry_project_aliases){if(!Number.isSafeInteger(row.id)||row.id<1||!projects.has(row.project)||aliases.has(row.id)||projectAliases.has(row.project))throw new Error('Archive Sentry alias');aliases.add(row.id);projectAliases.add(row.project)}
  if(projectAliases.size!==projects.size)throw new Error('Archive project alias coverage');
  for(const row of data.sentry_import_targets){
    if(!['project','release','issue','event'].includes(row.kind)||typeof row.id!=='string'||typeof row.revision!=='string'||!row.revision||row.revision.length>100)throw new Error('Archive import identity');
    const source=JSON.parse(row.source);
    if(!source||Object.keys(source).sort().join()!=='id,organization,project'||Object.values(source).some(value=>typeof value!=='string'||!value||value.length>200))throw new Error('Archive import source');
    if(canonical(source)!==row.source)throw new Error('Archive import source encoding');
    const key=JSON.stringify([row.kind,row.id]);if(metadata.has(key))throw new Error('Archive duplicate import target');metadata.set(key,source);
    const project='sentry-'+(await hash(JSON.stringify([source.organization,source.project]))).slice(0,32);
    let exists=false;
    if(row.kind==='project')exists=row.id===project&&data.projects.some((p:any)=>p.id===project);
    if(row.kind==='release'){const id=JSON.parse(row.id);exists=Array.isArray(id)&&id.length===2&&id[0]===project&&id[1]===source.id&&data.releases.some((r:any)=>r.project===project&&r.name===source.id)}
    if(row.kind==='issue')exists=row.id===await hash(JSON.stringify(['sentry',source.organization,source.project,source.id]))&&data.issues.some((i:any)=>i.id===row.id&&i.project===project);
    if(row.kind==='event'){const id=JSON.parse(row.id);exists=Array.isArray(id)&&id.length===2&&id[0]===project&&id[1]===source.id.toLowerCase()&&data.events.some((e:any)=>e.project===project&&e.id===id[1]&&e.historical===1)}
    if(!exists)throw new Error('Archive imported native reference');
  }
  for(const issue of data.issues.filter((row:any)=>row.algorithm==='sentry-import-v1')){
    const source=metadata.get(JSON.stringify(['issue',issue.id]));
    if(!source||issue.fingerprint!==await hash(JSON.stringify(['sentry-import',source.organization,source.project,source.id])))throw new Error('Archive imported issue grouping');
  }
  for(const event of data.events){
    if(![0,1].includes(event.historical))throw new Error('Archive event history marker');
    const imported=data.issues.find((issue:any)=>issue.id===event.issue)?.algorithm==='sentry-import-v1';
    if((event.historical===1)!==imported)throw new Error('Archive imported event grouping');
    if(imported&&!metadata.has(JSON.stringify(['event',JSON.stringify([event.project,event.id])]))){throw new Error('Archive imported event provenance')}
  }
}
export function importedDiagnostic(value:any,event:any){
  if(!Array.isArray(value)||value.length!==event.frames.length)throw new Error('Archive imported diagnostic');
  for(const [index,diagnostic] of value.entries())if(!diagnostic||Object.keys(diagnostic).sort().join()!=='generated,source,status'||!['imported_raw_stack','imported_symbolicated_stack'].includes(diagnostic.status)||diagnostic.source!=='sentry-api-export'||canonical(diagnostic.generated)!==canonical(event.frames[index]))throw new Error('Archive imported diagnostic');
}
