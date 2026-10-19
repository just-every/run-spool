import { Buffer } from 'node:buffer';
import type { Edge } from '../../modules/erasure/index.mjs';
import { nativeProject } from '../sentry-import/mapping';

/** The door retains a second private copy of the raw bundle and plan. Withdraw
 * that snapshot lineage with affected kit originals; peer native projects stay.
 * Resolve bundle membership without relying on caller-selected namespaces. */
export async function businessCustodyEdges(db: D1Database): Promise<Edge[]> {
 type Held={id:string;installation_id:string;namespace:string;total_bytes:number;total_chunks:number};
 const membership:{upload?:string;archive?:string;project:string;installation:string;namespace:string}[]=[];
 // The door holds a bundle as an upload and, once archived, as a tool's archive.
 // Each names its projects in its own bytes, whichever namespace it sits in.
 async function members(kind:'upload'|'archive',held:Held,chunkSql:string) {
  // Larger or incomplete bundles cannot yet have passed Spool's bounded parser.
  if(held.total_bytes>2*1024*1024)return;
  const chunks=(await db.prepare(chunkSql).bind(held.id).all<{base64:string}>()).results;
  if(chunks.length!==held.total_chunks)return;
  let bundle;
  try { bundle=JSON.parse(Buffer.concat(chunks.map(c=>Buffer.from(c.base64,'base64'))).toString('utf8')); } catch { return; }
  if(typeof bundle?.organization?.slug!=='string'||!Array.isArray(bundle.collections))return;
  for(const collection of bundle.collections) {
   if(collection?.kind!=='projects'||!Array.isArray(collection.pages))continue;
   for(const page of collection.pages)for(const row of Array.isArray(page?.response)?page.response:[]) {
    if(typeof row?.slug==='string')membership.push({[kind]:held.id,project:nativeProject(bundle.organization.slug,row.slug),installation:held.installation_id,namespace:held.namespace});
   }
  }
 }
 for(const upload of (await db.prepare('SELECT id,installation_id,namespace,total_bytes,total_chunks FROM ik_door_uploads').all<Held>()).results)
  await members('upload',upload,'SELECT base64 FROM ik_door_chunks WHERE upload_id=? ORDER BY ordinal');
 for(const archive of (await db.prepare('SELECT id,installation_id,namespace,total_bytes,total_chunks FROM ik_door_archives').all<Held>()).results)
  await members('archive',archive,'SELECT base64 FROM ik_door_archive_chunks WHERE archive_id=? ORDER BY ordinal');
 // Encode membership as a quoted JSON literal; all bundle strings remain data.
 const encoded=JSON.stringify(membership).replaceAll("'","''");
 return [
  {table:'ik_door_uploads',from:'projects',where:`id IN (SELECT json_extract(value,'$.upload') FROM json_each('${encoded}') WHERE json_extract(value,'$.project')=?)`,params:['id']},
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
  {table:'ik_door_archives',from:'projects',where:`id IN (SELECT json_extract(value,'$.archive') FROM json_each('${encoded}') WHERE json_extract(value,'$.project')=?)`,params:['id']},
  {table:'ik_door_archive_chunks',from:'ik_door_archives',on:{archive_id:'id'}},
 ];
}
