import { normalize,scrub,type Envelope } from '../privacy';
import { sentryRelease,releaseVersionKey } from './identity';
import { readReleasePolicy,autoReleaseAllowed,releasePolicyFence } from './policy';
export async function prepareRelease(db:D1Database,project:string,input:Envelope,sentryIntake:boolean){
 const snapshot=await readReleasePolicy(db,project),sentry=sentryIntake&&!!input.sentry,jobs:D1PreparedStatement[]=[],notes:string[]=input.sentry?.truncation.some(n=>n.path==='release'&&n.reason==='invalid_release_name')?['invalid_release_name']:[];let event=input;
 const existing=event.release?await db.prepare('SELECT * FROM releases WHERE project=? AND name=?').bind(project,event.release).first<any>():null;
 const metadata=existing?await db.prepare('SELECT auto_created FROM release_metadata WHERE project=? AND release=?').bind(project,event.release).first<any>():null;
 const registeredBuild=existing&&(metadata?await db.prepare('SELECT 1 FROM release_builds WHERE project=? AND release=? AND build=? AND registered=1').bind(project,event.release,event.build).first():existing.build===event.build);
 if(!sentry||snapshot.policy.order==='registered'){
  if(!event.release)return {refusal:'missing_release_register_required'};
  if(!registeredBuild)return {refusal:'unregistered_release_or_build'};
 }else{
  const identity=sentryRelease(event.release||undefined);
  if(!identity.name&&event.release)notes.push('invalid_release_name');
  if(identity.name&&!existing&&!autoReleaseAllowed(identity.name,snapshot.policy)){identity.name='';notes.push('automatic_release_pattern')}
  if(identity.name!==event.release)event=normalize({...event,release:identity.name,sentry:{...event.sentry!,release:identity.name||undefined,truncation:[...event.sentry!.truncation,...notes.map(reason=>({path:'release',reason}))],tags:Object.fromEntries(Object.entries(event.sentry?.tags??{}).filter(([key])=>key!=='release'))}});
  if(event.release){
   const time=Date.now(),sdk=scrub(JSON.stringify(event.sentry?.sdk??{}));
   jobs.push(db.prepare('INSERT INTO releases(project,name,seq,build,created) SELECT ?,?,COALESCE(MAX(seq),0)+1,?,? FROM releases WHERE project=? HAVING NOT EXISTS(SELECT 1 FROM releases WHERE project=? AND name=?)').bind(project,event.release,event.build,time,project,project,event.release));
   jobs.push(db.prepare('INSERT INTO release_metadata(project,release,first_seen,environment,sdk,auto_created,version_key) SELECT ?,?,?,?,?,?,? ON CONFLICT(project,release) DO NOTHING').bind(project,event.release,existing?.created??time,event.environment,sdk,existing?0:1,releaseVersionKey(event.release)));
   jobs.push(db.prepare('INSERT INTO release_builds VALUES(?,?,?,0) ON CONFLICT DO NOTHING').bind(project,event.release,event.build));
  }
 }
 return {event,jobs:[releasePolicyFence(db,project,snapshot.revision),...jobs],notes};
}
