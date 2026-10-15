// Pure operator input validation shared by HTTP routes and the Node archive worker.
import { pathMappings } from '../path-mappings';
import { identity, scrub } from '../privacy';
export function deploymentInput(input:any){
 if(!input||Object.keys(input).filter(k=>k!=='pathMappings').sort().join()!=='commitSha,deployedAt,environment,repository')throw new Error('Manifest requires commitSha, repository, deployedAt and environment');
 if(typeof input.commitSha!=='string'||!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(input.commitSha))throw new Error('Full lowercase commit SHA required');
 const environment=identity(input.environment,'environment');
 if(typeof input.repository!=='string'||input.repository.length>512)throw new Error('HTTPS repository URL required');
 const url=new URL(input.repository);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||input.repository.includes('?')||input.repository.includes('#')||url.href!==input.repository||scrub(input.repository)!==input.repository)throw new Error('Canonical HTTPS repository URL without userinfo, query or fragment required');
 const time=typeof input.deployedAt==='string'?Date.parse(input.deployedAt):NaN;if(!Number.isSafeInteger(time)||time<0||new Date(time).toISOString()!==input.deployedAt)throw new Error('Canonical ISO deployedAt timestamp required');
 return {commit_sha:input.commitSha,repository:url.href,deployed_at:time,environment,...(input.pathMappings !== undefined ? {pathMappings:pathMappings(input.pathMappings)} : {})};
}
export function policyInput(b:any){
 if(!['fingerprint','release','message'].includes(b.field)||!['exact','substring'].includes(b.mode)||typeof b.value!=='string'||!b.value.trim()||b.value.length>160||scrub(b.value)!==b.value||typeof b.enabled!=='boolean')throw new Error('A bounded scrubbed exact or substring policy is required');
 if(b.field==='fingerprint'&&(b.mode!=='exact'||!/^[a-f0-9]{64}$/.test(b.value)))throw new Error('Fingerprint policies require an exact fingerprint');
 return {field:b.field,mode:b.mode,value:b.value,enabled:b.enabled};
}
