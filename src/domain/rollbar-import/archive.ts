import { canonical } from '../privacy.ts';
import { eventId, fingerprint, issueId, projectId, sourceId } from './identity.ts';
export const importedAlgorithm=(algorithm:unknown)=>algorithm==='sentry-import-v1'||algorithm==='rollbar-import-v1';
/** Validate the vendor-qualified lineage in portable native history. */
export async function validateRollbarTarget(row:any,source:any,data:any) {
 if(Object.keys(source).sort().join()!=='id,organization,project,vendor' || source.organization!=='rollbar' || typeof source.id!=='string' || !source.id || source.id.length>200 || canonical(source)!==row.source)throw new Error('Archive Rollbar source');
 const project=projectId(sourceId(source.project));
 let exists=false;
 if(row.kind==='project')exists=source.id===source.project && row.id===project && data.projects.some((p:any)=>p.id===project);
 if(row.kind==='release')exists=row.id===JSON.stringify([project,source.id]) && data.releases.some((r:any)=>r.project===project&&r.name===source.id);
 if(row.kind==='issue')exists=row.id===issueId(source.project,sourceId(source.id)) && data.issues.some((i:any)=>i.id===row.id&&i.project===project&&i.algorithm==='rollbar-import-v1'&&i.fingerprint===fingerprint(source.project,source.id));
 if(row.kind==='event')exists=row.id===JSON.stringify([project,eventId(source.project,sourceId(source.id))]) && data.events.some((e:any)=>e.project===project&&e.id===eventId(source.project,source.id)&&e.historical===1);
 if(!exists)throw new Error('Archive Rollbar native reference');
}
