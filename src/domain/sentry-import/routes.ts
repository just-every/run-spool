import { Hono } from 'hono';
import { ownerSession, ownerWrite } from '../../auth/session.server';
import { deniedResponse } from '../denied-response';
import type { Bindings } from '../../auth/bindings';
import { readD1ImportJob, resumeD1Import, undoD1Import, readD1ImportOriginals, readD1PersistedImport } from '../../modules/import-kit/src/d1/index.ts';
import { sourceText } from './source.ts';
import { ownerImportContext } from './context';
// Sentry organization imports run through the import door (door.server.ts).
// These routes only keep jobs the owner-session importer created before it:
// their journal, private originals, resume and guarded undo.
const routes=new Hono<{Bindings:Bindings}>();
async function owner(c:any,write:boolean){
  const session=await ownerSession(c.req.raw,c.env);
  if(!session)return {response:await deniedResponse(c.req.raw,c.json({error:'Owner sign-in required'},401))};
  if(write&&!ownerWrite(c.req.raw,c.env))return {response:await deniedResponse(c.req.raw,c.json({error:'Same-origin owner request required'},403))};
  return {session};
}
routes.get('/:organization/:job',async c=>{
  const auth=await owner(c,false);if(auth.response)return auth.response;
  const scope=ownerImportContext(c.env,auth.session,`sentry-org:${sourceText(c.req.param('organization'),'organization')}`),job=await readD1ImportJob(c.req.param('job'),scope);
  const snapshot=await readD1PersistedImport(scope),provenance=snapshot.provenance.filter(row=>row.jobId===job.id);
  const identities=new Set(provenance.map(row=>JSON.stringify([row.targetKind,row.targetId])));
  return c.json({job,rows:snapshot.rows.filter(row=>identities.has(JSON.stringify([row.targetKind,row.targetId]))),provenance});
});
routes.get('/:organization/:job/originals',async c=>{
  const auth=await owner(c,false);if(auth.response)return auth.response;
  return c.json(await readD1ImportOriginals(c.req.param('job'),ownerImportContext(c.env,auth.session,`sentry-org:${sourceText(c.req.param('organization'),'organization')}`)));
});
routes.post('/:organization/:job/:action',async c=>{
  const auth=await owner(c,true);if(auth.response)return auth.response;
  const scope=ownerImportContext(c.env,auth.session,`sentry-org:${sourceText(c.req.param('organization'),'organization')}`),action=c.req.param('action');
  if(action==='resume')return c.json({job:await resumeD1Import(c.req.param('job'),scope)});
  if(action==='undo')return c.json({job:await undoD1Import(c.req.param('job'),scope)});
  return c.notFound();
});
export default routes;
