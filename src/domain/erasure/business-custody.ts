import { Buffer } from 'node:buffer';
import type { Edge } from '../../modules/erasure/index.mjs';
import { nativeProject } from '../sentry-import/mapping';
import { parseSentryOrganization, sourceText } from '../sentry-import/source';
import { sha256 } from '../../modules/import-kit/src/provenance/identity';

/** The door retains a second private copy of the raw bundle and plan. Withdraw
 * that snapshot lineage with affected kit originals; peer native projects stay.
 * Resolve bundle membership without relying on caller-selected namespaces. */
export async function businessCustodyEdges(db: D1Database): Promise<Edge[]> {
 type Held={id:string;installation_id:string;namespace:string;total_bytes:number;total_chunks:number;bundle_sha256:string};
 type Chunk={ordinal:number;size:number;sha256:string;base64:string};
 const membership:{upload?:string;archive?:string;project:string|null;installation:string;namespace:string}[]=[];
 // Trust complete verified contents, never a caller-selected namespace or a
 // readable prefix. Null membership withdraws uncertain bytes for any project.
 async function members(kind:'upload'|'archive',held:Held,chunkSql:string) {
  const remember=(project:string|null)=>membership.push({[kind]:held.id,project,installation:held.installation_id,namespace:held.namespace});
  if(held.total_bytes>2*1024*1024){remember(null);return;}
  const chunks=(await db.prepare(chunkSql).bind(held.id).all<Chunk>()).results;
  // Planned uploads may have deliberately withheld credentials and no bytes.
  if(kind==='upload'&&!chunks.length)return;
  try {
   if(chunks.length!==held.total_chunks)throw new Error('Incomplete custody');
   const parts=chunks.map((chunk,index)=>{
    const bytes=Buffer.from(chunk.base64,'base64');
    if(chunk.ordinal!==index||bytes.length!==chunk.size||sha256(bytes)!==chunk.sha256)throw new Error('Unverified chunk');
    return bytes;
   });
   const bytes=Buffer.concat(parts);
   if(bytes.length!==held.total_bytes||sha256(bytes)!==held.bundle_sha256)throw new Error('Unverified bundle');
   const records=parseSentryOrganization(JSON.parse(bytes.toString('utf8')));
   const organization=(records[0].payload as any).organization.slug,projects=new Set<string>();
   let uncertain=false;
   for(const record of records) {
    try {
     const payload=record.payload as any;
     if(record.kind==='projects')projects.add(sourceText(payload.data.slug,'project slug'));
     else if(record.kind==='releases') {
      if(!Array.isArray(payload.data.projects)||!payload.data.projects.length)throw new Error('Unknown release membership');
      for(const project of payload.data.projects)projects.add(sourceText(project?.slug,'release project'));
     } else if(record.kind==='issues'||record.kind==='events')projects.add(sourceText(payload.project,'collection project'));
     else if(record.kind!=='manifest')uncertain=true;
    } catch { uncertain=true; }
   }
   if(!projects.size||uncertain)remember(null);
   for(const project of projects)remember(nativeProject(organization,project));
  } catch { remember(null); }
 }
 for(const upload of (await db.prepare('SELECT id,installation_id,namespace,total_bytes,total_chunks,bundle_sha256 FROM ik_door_uploads').all<Held>()).results)
  await members('upload',upload,'SELECT ordinal,size,sha256,base64 FROM ik_door_chunks WHERE upload_id=? ORDER BY ordinal');
 for(const archive of (await db.prepare('SELECT id,installation_id,namespace,total_bytes,total_chunks,bundle_sha256 FROM ik_door_archives').all<Held>()).results)
  await members('archive',archive,'SELECT ordinal,size,sha256,base64 FROM ik_door_archive_chunks WHERE archive_id=? ORDER BY ordinal');
 // Encode membership as a quoted JSON literal; all bundle strings remain data.
 const encoded=JSON.stringify(membership).replaceAll("'","''");
 return [
  {table:'ik_door_uploads',from:'projects',where:`id IN (SELECT json_extract(value,'$.upload') FROM json_each('${encoded}') WHERE json_extract(value,'$.project') IS NULL OR json_extract(value,'$.project')=?)`,params:['id']},
  {table:'ik_door_namespaces',from:'projects',where:`EXISTS(SELECT 1 FROM json_each('${encoded}') m WHERE json_extract(m.value,'$.project')=? AND json_extract(m.value,'$.installation')=ik_door_namespaces.installation_id AND json_extract(m.value,'$.namespace')=ik_door_namespaces.namespace)`,params:['id']},
  // A lineage snapshot can repeat the same private fields across catch-ups.
  {table:'ik_door_uploads',from:'ik_door_namespaces',where:'installation_id=? AND namespace=?',params:['installation_id','namespace']},
  {table:'ik_door_chunks',from:'ik_door_uploads',on:{upload_id:'id'}},
  {table:'ik_door_scopes',from:'ik_door_namespaces',where:'installation_id=? AND namespace=?',params:['installation_id','namespace']},
  {table:'ik_door_plans',from:'ik_door_namespaces',where:'installation_id=? AND namespace=?',params:['installation_id','namespace']},
  {table:'ik_door_apply_failures',from:'ik_door_plans',on:{plan_id:'id'}},
  {table:'ik_door_plan_chunks',from:'ik_door_plans',on:{plan_id:'id'}},
  {table:'ik_door_approvals',from:'ik_door_plans',on:{plan_id:'id'}},
  // A tool's archive is a third private copy of a bundle in the namespace: header and bytes go with it.
  {table:'ik_door_archives',from:'ik_door_namespaces',where:'installation_id=? AND namespace=?',params:['installation_id','namespace']},
  // An archive in a namespace no plan ever opened (Business's own `sentry`) is reached through the projects its bytes name.
  {table:'ik_door_archives',from:'projects',where:`id IN (SELECT json_extract(value,'$.archive') FROM json_each('${encoded}') WHERE json_extract(value,'$.project') IS NULL OR json_extract(value,'$.project')=?)`,params:['id']},
  {table:'ik_door_archive_chunks',from:'ik_door_archives',on:{archive_id:'id'}},
 ];
}
