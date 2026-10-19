import { identity } from '../privacy';
import { storedBuild } from '../releases/build';
import { deploymentInput } from '../operators/validation';
export function timestamp(value:unknown) {
 const time=typeof value==='string'?Date.parse(value):NaN;
 if(!Number.isSafeInteger(time)||time<0||new Date(time).toISOString()!==value)throw new Error('Canonical ISO timestamp required');
 return time;
}
export function startInput(b:any) {
 const manifest=deploymentInput({commitSha:b.commitSha,repository:b.repository,environment:b.environment,deployedAt:b.startedAt});
 const id=identity(b.id,'deployment'),build=storedBuild(b.build),deadline=timestamp(b.deadline);
 if(deadline<manifest.deployed_at)throw new Error('Deadline must follow deployment start');
 const previous=b.previousCommit??null,commits=b.includedCommits;
 if(previous!==null&&!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(previous))throw new Error('Full previous commit SHA required');
 if(!Array.isArray(commits)||commits.length<1||commits.length>500||commits.some(v=>typeof v!=='string'||!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(v))||new Set(commits).size!==commits.length||commits.at(-1)!==manifest.commit_sha)throw new Error('Supply the ordered included commit SHAs ending at the deployment commit (1–500); ancestry is caller recorded');
 const destination=identity(b.destination,'email destination');
 return {id,build,...manifest,deadline,previous_commit:previous,included_commits:JSON.stringify(commits),destination};
}
export function stepInput(b:any) {
 if(!['progress','succeeded','failed','rolled_back'].includes(b.state))throw new Error('Expected progress, succeeded, failed or rolled_back');
 if(!Number.isInteger(b.exposure)||b.exposure<0||b.exposure>100)throw new Error('Exposure must be an integer percentage');
 if(b.state==='rolled_back'&&typeof b.rollbackRelease!=='string'||b.state!=='rolled_back'&&b.rollbackRelease!==undefined)throw new Error('Rollback names the registered target release');
 return {callback:identity(b.callback,'callback'),state:b.state,exposure:b.exposure,occurred:timestamp(b.at),rollback_release:b.rollbackRelease??null};
}
