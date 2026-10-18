import { AuthError } from '../../modules/operator-auth/index.mjs';
import { ownerProjectRouter,ownerWrites,jsonBody } from '../owner-router';
import { canonical,hash } from '../privacy';
import { readReleasePolicy,validateReleasePolicy } from './policy';
import { releaseVersionKey } from './identity';
export const releasePolicyRoutes=ownerProjectRouter();
releasePolicyRoutes.onError((e,c)=>{if(e instanceof AuthError)return c.json({error:e.code},e.status as any);throw e});
releasePolicyRoutes.get('/',async c=>{const project=c.req.param('project')!;const [snapshot,counts]=await Promise.all([readReleasePolicy(c.env.DB,project),c.env.DB.prepare("SELECT COUNT(*) count FROM events WHERE project=? AND release=''").bind(project).first<any>()]);return c.json({...snapshot,noReleaseEvents:counts.count})});
releasePolicyRoutes.post('/preview',async c=>{
 let input:any,policy;
 try{input=await jsonBody(c.req.raw,2000);policy=validateReleasePolicy(input.policy);if(input.after!==undefined&&(typeof input.after!=='string'||!/^[a-f0-9]{0,64}$/.test(input.after)))throw new Error('Invalid preview cursor');}catch(e){return c.json({error:(e as Error).message},400)}
 const project=c.req.param('project')!,current=await readReleasePolicy(c.env.DB,project);
 const [issues,releases]=await Promise.all([
 c.env.DB.prepare("SELECT i.id,COALESCE(z.boundary_seq,i.resolved_seq) resolved_seq,z.mode,r.name boundary FROM issues i LEFT JOIN issue_resolutions z ON z.project=i.project AND z.issue=i.id LEFT JOIN releases r ON r.project=i.project AND r.seq=COALESCE(z.boundary_seq,i.resolved_seq) WHERE i.project=? AND i.state='resolved' AND i.id>? ORDER BY i.id LIMIT 101").bind(project,input.after??'').all<any>(),
 c.env.DB.prepare('SELECT name,seq FROM releases WHERE project=? ORDER BY seq').bind(project).all<any>()]);
 const rows=issues.results.slice(0,100).map(issue=>{const boundary=issue.boundary?releaseVersionKey(issue.boundary):null;const changed=issue.mode==='plain'?[]:releases.results.filter(r=>{
  const key=releaseVersionKey(r.name),sequence=r.seq>issue.resolved_seq,semantic=boundary&&key?key>boundary:sequence;
  return (policy.order==='sentry'?semantic:sequence)!==(current.policy.order==='sentry'?semantic:sequence);
 });return {issue:issue.id,boundary:issue.boundary??'none',changedReleaseComparisons:changed.map(r=>r.name)}});
 return c.json({revision:current.revision,rows,next:issues.results.length>100?rows.at(-1)!.issue:null,behavior:'Applies to later events only. Plain resolution regresses on any next event regardless of this rule. Native v1 always uses registered sequence. Automatic creation patterns affect unseen names only.'});
});
releasePolicyRoutes.put('/',async c=>{
 let input:any,policy;
 try{input=await jsonBody(c.req.raw,2000);policy=validateReleasePolicy(input.policy);if(!Number.isSafeInteger(input.revision)||input.revision<0||input.revision>=Number.MAX_SAFE_INTEGER)throw new Error('Expected current revision');}catch(e){return c.json({error:(e as Error).message},400)}
 const project=c.req.param('project')!,revision=input.revision+1,time=Date.now(),detail=JSON.stringify({previousRevision:input.revision,revision,policyDigest:await hash(canonical(policy))});
 const result=await ownerWrites(c,[c.env.DB.prepare('INSERT INTO release_policies SELECT ?,?,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM release_policies WHERE project=? AND revision=?) ON CONFLICT(project) DO UPDATE SET revision=excluded.revision,policy=excluded.policy,updated=excluded.updated WHERE release_policies.revision=? RETURNING revision').bind(project,revision,JSON.stringify(policy),time,input.revision,project,input.revision,input.revision),c.env.DB.prepare("INSERT INTO audit SELECT ?,?,'release_policy_changed',?,? WHERE changes()=1").bind(crypto.randomUUID(),project,detail,time)]);
 return result[0].results.length?c.json({revision,policy}):c.json({error:'Release policy revision conflict'},409);
});
