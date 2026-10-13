export async function projectDsn(db:D1Database,serviceOrigin:string,project:string,key:string){
  const row=await db.prepare('SELECT id FROM sentry_project_aliases WHERE project=?').bind(project).first<{id:number}>();
  if(!row)throw new Error('Project alias missing');
  const url=new URL(serviceOrigin);url.username=key;url.pathname=`/${row.id}`;url.search='';url.hash='';return url.toString();
}
