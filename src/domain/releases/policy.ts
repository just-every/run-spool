import { wildcardMatch } from '../filters/matcher';
import { scrub } from '../scrub';
export interface ReleasePolicy{version:1;order:'sentry'|'registered';pattern:string}
export const defaultReleasePolicy=():ReleasePolicy=>({version:1,order:'sentry',pattern:'*'});
export function validateReleasePolicy(v:any):ReleasePolicy{
 if(!v||Object.keys(v).sort().join()!=='order,pattern,version'||v.version!==1||!['sentry','registered'].includes(v.order)||typeof v.pattern!=='string'||!v.pattern||v.pattern.length>200||/[\u0000-\u001f\u007f]/.test(v.pattern)||scrub(v.pattern)!==v.pattern)throw new Error('Expected release ordering rule and sanitized automatic-release pattern (at most 200 characters)');
 return {version:1,order:v.order,pattern:v.pattern};
}
export async function readReleasePolicy(db:D1Database,project:string){
 const row=await db.prepare('SELECT revision,policy FROM release_policies WHERE project=?').bind(project).first<any>();
 return row?{revision:row.revision,policy:validateReleasePolicy(JSON.parse(row.policy))}:{revision:0,policy:defaultReleasePolicy()};
}
export const autoReleaseAllowed=(name:string,policy:ReleasePolicy)=>wildcardMatch(name,policy.pattern);
export const releasePolicyFence=(db:D1Database,project:string,revision:number)=>db.prepare('INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN COALESCE((SELECT revision FROM release_policies WHERE project=?),0)=? THEN 1 ELSE 0 END').bind(project,revision);
