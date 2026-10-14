import { Hono } from 'hono';
import { deploymentInput } from '../operators/deployments';
import type { Bindings } from '../../auth/bindings';
import { canonical, hash, identity } from '../privacy';
import { validateMap } from '../artifacts';
import { authorizeDeploy, deployBatch } from './deploy.ts';
import { sourceMapMetadata } from './map-metadata.ts';
const routes=new Hono<{Bindings:Bindings}>();
const stmt=(db:D1Database,sql:string,...args:any[])=>db.prepare(sql).bind(...args);
async function readBody(request:Request,limit:number){
  const reader=request.body?.getReader();if(!reader)throw new Error('Missing body');let size=0;const parts:Uint8Array[]=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error('Body exceeds limit')}parts.push(value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
async function failure(c:any,project:string,error:unknown){
  const auth=await authorizeDeploy(c,project);if('response' in auth)return auth.response;
  const message=String((error as Error).message);
  if(message.includes('artifact_budget'))return c.json({error:'Artifact budget exhausted'},429);
  if(message.includes('CHECK constraint failed')||message.includes('UNIQUE constraint failed'))return c.json({error:'Existing release or artifact conflicts'},409);
  throw error;
}
routes.post('/:project/releases',async c=>{
  const project=c.req.param('project'),auth=await authorizeDeploy(c,project);if('response' in auth)return auth.response;
  const b=await readBody(c.req.raw,32768),name=identity(b.name,'release'),build=identity(b.build,'build'),db=c.env.DB,time=Date.now(),manifest=b.manifest===undefined?null:deploymentInput(b.manifest);
  try{
    const result=await deployBatch(c,auth,[
      stmt(db,"INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM releases WHERE project=? AND name=?) OR EXISTS(SELECT 1 FROM releases WHERE project=? AND name=? AND build=?) THEN 1 ELSE 0 END",project,name,project,name,build),
      stmt(db,'INSERT INTO releases(project,name,seq,build,created) SELECT ?,?,(SELECT COALESCE(MAX(seq),0)+1 FROM releases WHERE project=?),?,? WHERE NOT EXISTS(SELECT 1 FROM releases WHERE project=? AND name=?)',project,name,project,build,time,project,name),
      stmt(db,"INSERT INTO audit SELECT ?,?,'release_registered',json_object('name',name,'build',build,'seq',seq),? FROM releases WHERE project=? AND name=? AND changes()=1",crypto.randomUUID(),project,time,project,name),
      ...(manifest?[
       stmt(db,'INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM deployment_manifests WHERE project=? AND release=? AND environment=?) OR EXISTS(SELECT 1 FROM deployment_manifests WHERE project=? AND release=? AND environment=? AND commit_sha=? AND repository=? AND deployed_at=?) THEN 1 ELSE 0 END',project,name,manifest.environment,project,name,manifest.environment,manifest.commit_sha,manifest.repository,manifest.deployed_at),
       stmt(db,'INSERT INTO deployment_manifests VALUES(?,?,?,?,?,?,?) ON CONFLICT(project,release,environment) DO NOTHING',project,name,manifest.environment,manifest.commit_sha,manifest.repository,manifest.deployed_at,time),
       stmt(db,"INSERT INTO audit SELECT ?,?,'deployment_registered',?,? WHERE changes()=1",crypto.randomUUID(),project,JSON.stringify({release:name,environment:manifest.environment}),time),
      ]:[]),
    ]);
    const row=await stmt(db,'SELECT name,build,seq FROM releases WHERE project=? AND name=?',project,name).first();
    return c.json({...row,manifest},result[2].meta.changes?201:200);
  }catch(error){return failure(c,project,error)}
});
routes.post('/:project/artifacts',async c=>{
  const project=c.req.param('project'),auth=await authorizeDeploy(c,project);if('response' in auth)return auth.response;
  const b=await readBody(c.req.raw,300000),release=identity(b.release,'release'),build=identity(b.build,'build'),metadata=sourceMapMetadata(b.map,b.debugId),debug=metadata.debugId;
  const payload=validateMap(JSON.parse(canonical(metadata.map))),digest=await hash(payload),db=c.env.DB;
  try{
    const existing=await stmt(db,'SELECT digest FROM artifacts WHERE project=? AND release=? AND build=? AND debug=?',project,release,build,debug).first<{digest:string}>();
    if(existing){await deployBatch(c,auth,[]);return existing.digest===digest?c.json({digest,bytes:new TextEncoder().encode(payload).length},200):c.json({error:'Artifact identity conflicts'},409)}
    try{
      await deployBatch(c,auth,[
        stmt(db,'INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM releases WHERE project=? AND name=? AND build=?) THEN 1 ELSE 0 END',project,release,build),
        stmt(db,'INSERT INTO artifacts(project,release,build,debug,payload,digest,created,occurrence) VALUES(?,?,?,?,?,?,?,?)',project,release,build,debug,payload,digest,Date.now(),crypto.randomUUID()),
        stmt(db,'INSERT INTO audit VALUES(?,?,?,?,?)',crypto.randomUUID(),project,'artifact_uploaded',JSON.stringify({release,build,debug,digest}),Date.now()),
      ]);
      return c.json({digest,bytes:new TextEncoder().encode(payload).length},201);
    }catch(error){
      const retry=await stmt(db,'SELECT digest FROM artifacts WHERE project=? AND release=? AND build=? AND debug=?',project,release,build,debug).first<{digest:string}>();
      if(retry){const current=await authorizeDeploy(c,project);if('response' in current)return current.response;await deployBatch(c,current,[]);return retry.digest===digest?c.json({digest,bytes:new TextEncoder().encode(payload).length},200):c.json({error:'Artifact identity conflicts'},409)}
      throw error;
    }
  }catch(error){return failure(c,project,error)}
});
export default routes;
