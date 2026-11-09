import { Hono } from 'hono';
import type { ManagedBindings } from '../../editor/bindings';
import { ownerSession } from '../../auth/session.server';
import { readD1ImportOriginals } from '../../modules/import-kit/src/d1/index.ts';
import { DoorError } from '../../modules/import-kit/src/door/protocol.ts';
import { loadSnapshot, planRow } from '../../modules/import-kit/src/door/store.ts';
import { sentryTargets } from '../sentry-import/targets.ts';
import { doorKey, ownerReadRequest } from '../sentry-import/door.server.ts';
import { finishOwnerRead } from '../sentry-import/owner-reads.server.ts';
import { mappingVersion, sourceId } from './identity.ts';
const routes=new Hono<{Bindings:ManagedBindings}>();
/** The original is the verified private capture, not a newly serialized export. */
routes.get('/:project/:plan/originals',async c=>{
 const session=await ownerSession(c.req.raw,c.env);
 if(!session)return c.json({error:'owner_required'},401);
 try {
  const project=sourceId(c.req.param('project'));
  const request=await ownerReadRequest(c.env,session,await doorKey(c.env),'rollbar-project:'+project);
  const row=await planRow(request,c.req.param('plan'));
  // A withdrawn source never becomes readable by following the old job ID.
  const snapshot=await loadSnapshot(request,row);
  if(!row.job_id)throw new DoorError('import_not_applied',409);
  const originals=await readD1ImportOriginals(row.job_id,{destination:'spool-owner',namespace:snapshot.kitNamespace,mappingVersion,
   storage:{database:c.env.DB,targets:sentryTargets},authorization:{principalId:session.operator.id,predicate:()=>request.authority}});
  await finishOwnerRead(request);
  return c.json({originals},200,{'Cache-Control':'no-store','Content-Disposition':'attachment; filename="rollbar-originals.json"'});
 } catch(error) {
  if(error instanceof DoorError)return c.json({error:error.code},error.status as any);
  return c.json({error:'original_custody_unavailable'},409);
 }
});
export default routes;
