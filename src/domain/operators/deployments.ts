import { pathMappings } from '../path-mappings';
import { scrub } from '../privacy';
import { s } from './common';
export async function observedDeployment(db:D1Database,project:string,row:any){
 if(!row)return null;
 const run=await s(db,"SELECT r.*,s.exposure FROM deployment_runs r JOIN deployment_steps s ON s.project=r.project AND s.deployment=r.id WHERE r.project=? AND r.release=? AND r.environment=? AND s.state='succeeded' AND NOT EXISTS(SELECT 1 FROM deployment_steps later WHERE later.project=s.project AND later.deployment=s.deployment AND later.sequence>s.sequence) ORDER BY s.recorded DESC,r.id DESC LIMIT 1",project,row.release,row.environment).first<any>();
 if(run)return {release:row.release,environment:row.environment,manifest:{environment:run.environment,commit_sha:run.commit_sha,repository:run.repository,deployed_at:(await s(db,"SELECT occurred FROM deployment_steps WHERE project=? AND deployment=? AND state='succeeded'",project,run.id).first<any>())!.occurred},deployment:run.id,exposure:run.exposure,source:'owner_or_deploy_key_recorded'};
 const manifest=await s(db,'SELECT environment,commit_sha,repository,deployed_at,(SELECT payload FROM deployment_path_mappings m WHERE m.project=deployment_manifests.project AND m.release=deployment_manifests.release AND m.environment=deployment_manifests.environment) path_mappings FROM deployment_manifests WHERE project=? AND release=? AND environment=?',project,row.release,row.environment).first();
 return {release:row.release,environment:row.environment,manifest:manifest?{environment:scrub(String((manifest as any).environment)),commit_sha:String((manifest as any).commit_sha),repository:scrub(String((manifest as any).repository)),deployed_at:(manifest as any).deployed_at,...((manifest as any).path_mappings?{pathMappings:pathMappings(JSON.parse((manifest as any).path_mappings))}:{})}:null,source:manifest?'owner_or_deploy_key_recorded':'unknown'};
}
