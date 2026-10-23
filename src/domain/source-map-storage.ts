import { ownerProjectRouter, ownerWrites, jsonBody } from './owner-router';
import { auditCommit } from './audit/context';
export const artifactStorageTables = { artifact_storage_settings: ['project','artifact_storage_cap','revision','updated'] };
export function validateArtifactStorage(data: any) {
 for(const row of data.artifact_storage_settings) if((row.artifact_storage_cap!==null&&(!Number.isSafeInteger(row.artifact_storage_cap)||row.artifact_storage_cap<0))||!Number.isSafeInteger(row.revision)||row.revision<1||!Number.isSafeInteger(row.updated)||row.updated<0)throw new Error('Archive artifact storage setting');
}
export async function artifactStorage(db:D1Database, project:string) {
 const setting=await db.prepare('SELECT artifact_storage_cap,revision FROM artifact_storage_settings WHERE project=?').bind(project).first<{artifact_storage_cap:number|null;revision:number}>();
 const usage=await db.prepare('SELECT COUNT(*) count,COALESCE(SUM(length(CAST(payload AS BLOB))),0) bytes FROM artifacts WHERE project=?').bind(project).first<{count:number;bytes:number}>();
 return {...{artifact_storage_cap:null,revision:0},...setting,...usage};
}
export async function artifactCapReason(db:D1Database, project:string) {
 const setting=await artifactStorage(db,project);
 return `storage cap ${setting.artifact_storage_cap} bytes; ${setting.bytes} bytes already stored`;
}
export const artifactStorageRoutes=ownerProjectRouter();
artifactStorageRoutes.get('/',async c=>c.json(await artifactStorage(c.env.DB,c.req.param('project')!)));
artifactStorageRoutes.put('/',async c=>{
 let input:any;
 try{input=await jsonBody(c.req.raw,1024);if(Object.keys(input).sort().join()!=='artifact_storage_cap,revision'||!Number.isSafeInteger(input.revision)||input.revision<0||input.revision>=Number.MAX_SAFE_INTEGER||(input.artifact_storage_cap!==null&&(!Number.isSafeInteger(input.artifact_storage_cap)||input.artifact_storage_cap<0)))throw new Error('Expected current revision and a nonnegative byte cap, or null');}catch(error){return c.json({error:(error as Error).message},400)}
 const project=c.req.param('project')!;
 const result=await ownerWrites(c,[c.env.DB.prepare(`INSERT INTO artifact_storage_settings(project,artifact_storage_cap,revision,updated) SELECT ?,?,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM artifact_storage_settings WHERE project=? AND revision=?) ON CONFLICT(project) DO UPDATE SET artifact_storage_cap=excluded.artifact_storage_cap,revision=excluded.revision,updated=excluded.updated WHERE artifact_storage_settings.revision=? RETURNING revision`).bind(project,input.artifact_storage_cap,input.revision+1,Date.now(),input.revision,project,input.revision,input.revision),auditCommit(c.env.DB,'changes()=1')]);
 return result[0].results.length?c.json(await artifactStorage(c.env.DB,project)):c.json({error:'artifact_storage_revision_conflict',...await artifactStorage(c.env.DB,project)},409);
});
