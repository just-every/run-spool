import { Hono } from 'hono';
import { Buffer } from 'node:buffer';
import { ownerSession, ownerWrite } from '../../auth/session.server';
import { deniedResponse } from '../denied-response';
import type { Bindings } from '../../auth/bindings';
import { createD1ImportJob, applyD1ImportBatches, readD1ImportJob, resumeD1Import, undoD1Import, readD1ImportOriginals, readD1PersistedImport, type D1ImportContext } from '../../modules/import-kit/src/d1/index.ts';
import { readAtomic } from '../../modules/import-kit/src/d1/database.ts';
import { buildImportPlan } from '../../modules/import-kit/src/plan/index.ts';
import { readSentryOrganization, mappingVersion, sourceText } from './source.ts';
import { organizationMapping } from './mapping.ts';
import { sentryTargets } from './targets.ts';
const routes=new Hono<{Bindings:Bindings}>();
async function body(request:Request){
  if(!request.body)throw new Error('Import body required');
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>3*1024*1024){await reader.cancel();throw new Error('Import body exceeds limit')}chunks.push(value)}}finally{reader.releaseLock()}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function context(env:Bindings,session:any,organization:string):D1ImportContext{
  return {destination:'spool-owner',namespace:`sentry-org:${sourceText(organization,'organization')}`,mappingVersion,batchSize:10,maxBatches:1,
    storage:{database:env.DB,targets:sentryTargets},authorization:{principalId:session.operator.id,predicate(){
      return {sql:"EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=? AND s.operator_id=? AND s.revoked_at IS NULL AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) AND o.status='active' AND o.role='owner' AND s.operator_version=o.version)",params:[session.id,session.operator.id]};
    }}};
}
async function owner(c:any,write:boolean){
  const session=await ownerSession(c.req.raw,c.env);
  if(!session)return {response:await deniedResponse(c.req.raw,c.json({error:'Owner sign-in required'},401))};
  if(write&&!ownerWrite(c.req.raw,c.env))return {response:await deniedResponse(c.req.raw,c.json({error:'Same-origin owner request required'},403))};
  return {session};
}
routes.on(['POST'],'/:mode',async c=>{
  if(!['plan','apply'].includes(c.req.param('mode')))return c.notFound();
  const auth=await owner(c,true);if(auth.response)return auth.response;
  const input=await body(c.req.raw);
  const allowed=c.req.param('mode')==='plan'?['source','operationKey']:['source','reviewedFingerprint','operationKey'];
  if(!input||Object.keys(input).some(key=>!allowed.includes(key))||typeof input.source!=='string'||!input.source)throw new Error('Invalid import request');
  const bytes=Buffer.from(input.source,'base64');if(bytes.toString('base64')!==input.source||bytes.byteLength>2*1024*1024)throw new Error('Invalid import source bytes');
  const {source,organization}=await readSentryOrganization(bytes),scope=context(c.env,auth.session,organization);
  await readAtomic(scope,[]);
  const operationKey=sourceText(input.operationKey??(c.req.param('mode')==='plan'?crypto.randomUUID():undefined),'import operation key');
  const plan=buildImportPlan(source,organizationMapping(source,operationKey),scope);
  if(c.req.param('mode')==='plan'){
    await readAtomic(scope,[]);
    return c.json({organization,operationKey,fingerprint:plan.fingerprint,counts:plan.counts,diagnostics:plan.diagnostics,entries:plan.entries.map(entry=>({kind:entry.source.kind,sourceId:entry.source.sourceId,effects:entry.effects.map(effect=>({kind:effect.targetKind,id:effect.targetId,value:effect.value})),unmapped:entry.unmapped,rejection:entry.rejection})),dryRun:true});
  }
  if(typeof input.reviewedFingerprint!=='string'||typeof input.operationKey!=='string')throw new Error('Reviewed fingerprint and operation key required');
  const applying={...scope,reviewedFingerprint:input.reviewedFingerprint,operationKey};
  const job=await createD1ImportJob(plan,applying);
  const result=job.state==='completed'?job:await applyD1ImportBatches(job.id,applying);
  return c.json({organization,job:result},201);
});
routes.get('/:organization/:job',async c=>{
  const auth=await owner(c,false);if(auth.response)return auth.response;
  const scope=context(c.env,auth.session,c.req.param('organization')),job=await readD1ImportJob(c.req.param('job'),scope);
  const snapshot=await readD1PersistedImport(scope),provenance=snapshot.provenance.filter(row=>row.jobId===job.id);
  const identities=new Set(provenance.map(row=>JSON.stringify([row.targetKind,row.targetId])));
  return c.json({job,rows:snapshot.rows.filter(row=>identities.has(JSON.stringify([row.targetKind,row.targetId]))),provenance});
});
routes.get('/:organization/:job/originals',async c=>{
  const auth=await owner(c,false);if(auth.response)return auth.response;
  return c.json(await readD1ImportOriginals(c.req.param('job'),context(c.env,auth.session,c.req.param('organization'))));
});
routes.post('/:organization/:job/:action',async c=>{
  const auth=await owner(c,true);if(auth.response)return auth.response;
  const scope=context(c.env,auth.session,c.req.param('organization')),action=c.req.param('action');
  if(action==='resume')return c.json({job:await resumeD1Import(c.req.param('job'),scope)});
  if(action==='undo')return c.json({job:await undoD1Import(c.req.param('job'),scope)});
  return c.notFound();
});
export default routes;
