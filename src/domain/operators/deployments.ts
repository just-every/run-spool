import { identity, scrub } from '../privacy';
import { s } from './common';
export function deploymentInput(input:any){
 if(!input||Object.keys(input).sort().join()!=='commitSha,deployedAt,environment,repository')throw new Error('Manifest requires commitSha, repository, deployedAt and environment');
 if(typeof input.commitSha!=='string'||!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(input.commitSha))throw new Error('Full lowercase commit SHA required');
 const environment=identity(input.environment,'environment');
 if(typeof input.repository!=='string'||input.repository.length>512)throw new Error('HTTPS repository URL required');
 const url=new URL(input.repository);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||input.repository.includes('?')||input.repository.includes('#')||url.href!==input.repository||scrub(input.repository)!==input.repository)throw new Error('Canonical HTTPS repository URL without userinfo, query or fragment required');
 const time=typeof input.deployedAt==='string'?Date.parse(input.deployedAt):NaN;if(!Number.isSafeInteger(time)||time<0||new Date(time).toISOString()!==input.deployedAt)throw new Error('Canonical ISO deployedAt timestamp required');
 return {commit_sha:input.commitSha,repository:url.href,deployed_at:time,environment};
}
export async function observedDeployment(db:D1Database,project:string,row:any){
 if(!row)return null;
 const manifest=await s(db,'SELECT environment,commit_sha,repository,deployed_at FROM deployment_manifests WHERE project=? AND release=? AND environment=?',project,row.release,row.environment).first();
 return {release:row.release,environment:row.environment,manifest:manifest?{environment:scrub(String((manifest as any).environment)),commit_sha:String((manifest as any).commit_sha),repository:scrub(String((manifest as any).repository)),deployed_at:(manifest as any).deployed_at}:null,source:manifest?'owner_or_deploy_key_recorded':'unknown'};
}
