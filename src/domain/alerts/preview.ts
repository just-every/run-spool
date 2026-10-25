import {primaryShortIdSql} from '../short-ids/lookup';
import {scrubbingSnapshot,scrubbingFence} from '../scrubbing/model';
import { canonical,hash } from '../privacy';
import { readIdentityPolicy,identityFields } from '../identities/policy';
import { identityPolicyFence } from '../identities/policy';
import { ownerBatch,type OwnerSession } from '../owner-authority';
import { statement as s,type AlertEnvironment } from './types';
import { ruleInput } from './rules';
import { eventFilter,eligibleEvent,ruleConfig,userKey } from './filters';
import { decision } from './measure';
export const configSql="COALESCE((SELECT config FROM alert_rule_configs cfg WHERE cfg.rule_id=r.id),'{\"metric\":\"count\",\"filters\":{},\"tagKeys\":[]}')";
export async function ruleDigest(b:any,revisions?:unknown){const {previewToken,...value}=b;return hash(canonical({value,...revisions?{scrubbing:revisions}:{}}))}
export async function previewRule(env:AlertEnvironment,session:OwnerSession,project:string,raw:any){
 const {ruleId,...value}=raw,b=ruleInput(value,env,project,!!ruleId),config=ruleConfig(JSON.parse(b.config)),policy=await readIdentityPolicy(env.DB,project),time=Date.now(),end=Math.floor(time/b.windowMs)*b.windowMs,from=end-90*86400000;
 const f=eventFilter(config),rows=(await s(env.DB,`SELECT e.issue,CAST(e.received/? AS INTEGER)*? start,COUNT(*) count FROM events e WHERE e.project=? AND e.received>=? AND e.received<? AND ${eligibleEvent()} AND ${f.sql} GROUP BY e.issue,start ORDER BY start DESC,e.issue LIMIT 100`,b.windowMs,b.windowMs,project,from,end,...f.args).all<any>()).results;
 let refusal:string|null=null;
 if(config.metric==='users'){
  if(identityFields.every(k=>policy.policy[k]==='drop'))refusal='User condition unavailable: identity policy drops every user key';
  else if(!(await s(env.DB,`SELECT 1 FROM events e LEFT JOIN event_identities x ON x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence WHERE e.project=? AND ${userKey} IS NOT NULL LIMIT 1`,project).first()))refusal='User condition unavailable: retained events have no user key';
 }
 if(config.metric==='session_percent'&&!await s(env.DB,'SELECT 1 FROM health_sessions WHERE project=? UNION ALL SELECT 1 FROM health_aggregates WHERE project=? LIMIT 1',project,project).first())refusal='Session condition unavailable: project has no session data';
 const decisions=[];
 if(b.kinds.includes('spike'))for(const row of rows)decisions.push(await decision(env.DB,project,config,row.issue,row.start,row.start+b.windowMs,b.threshold));
 const transitions=decisions.filter(d=>d.fired);
 if(JSON.parse(b.kinds).some((k:string)=>k!=='spike')){
  const facts=(await s(env.DB,`SELECT a.issue,a.kind,a.created,e.payload FROM alerts a JOIN events e ON e.project=a.project AND e.id=json_extract(a.payload,'$.trigger.event') AND e.occurrence=json_extract(a.payload,'$.trigger.occurrence') WHERE a.project=? AND a.kind IN (SELECT value FROM json_each(?)) AND e.received>=? AND e.received<? AND ${eligibleEvent()} AND ${f.sql} GROUP BY a.id ORDER BY a.created DESC LIMIT 100`,project,b.kinds,from,end,...f.args).all<any>()).results;
  for(const fact of facts)transitions.push({start:Math.floor(fact.created/b.windowMs)*b.windowMs,end:Math.floor(fact.created/b.windowMs)*b.windowMs+b.windowMs,issue:fact.issue,count:1,reason:fact.kind,fired:true} as any);
 }
 const named=(await s(env.DB,`SELECT i.id,i.title,${primaryShortIdSql('i')} short_id FROM issues i WHERE i.project=? AND i.id IN (SELECT value FROM json_each(?))`,project,JSON.stringify([...new Set([...transitions,...decisions].map(row=>row.issue))])).all<any>()).results;
 for(const row of new Set([...transitions,...decisions])){const issue=named.find(issue=>issue.id===row.issue);Object.assign(row,{issue_short_id:issue?.short_id??null,issue_title:issue?.title??'Removed issue'})}
 const scrubbing=await scrubbingSnapshot(env.DB,project),revisions={project:scrubbing.revision,installation:scrubbing.installationRevision};
 const token=refusal?null:crypto.randomUUID();
 await ownerBatch(env.DB,session,[scrubbingFence(env.DB,project,revisions.project),scrubbingFence(env.DB,null,revisions.installation),identityPolicyFence(env.DB,project,policy.revision),s(env.DB,'DELETE FROM alert_rule_previews WHERE project=? AND created<?',project,time-86400000),...token?[s(env.DB,'INSERT INTO alert_rule_previews VALUES(?,?,?,?,?,?)',token,project,ruleId??null,await ruleDigest(b,revisions),policy.revision,time)]:[]]);
 return {token,refusal,owner:'Installation owner',destination:b.destination,window:{from,to:end,durationMs:b.windowMs},matchedEvents:rows.reduce((n,r)=>n+r.count,0),transitions,decisions,coverage:'Retained complete windows, at most 100 issue/windows; transition history requires its retained trigger occurrence; historical imports never dispatch'};
}
export async function previewGuard(env:AlertEnvironment,project:string,id:string|null,b:any){
 if(!b.enabled)return [];
 const scrubbing=await scrubbingSnapshot(env.DB,project),revisions={project:scrubbing.revision,installation:scrubbing.installationRevision};
 const policy=await readIdentityPolicy(env.DB,project),digest=await ruleDigest(b,revisions);
 const preview=await s(env.DB,'SELECT id FROM alert_rule_previews WHERE id=? AND project=? AND rule_id IS ? AND digest=? AND policy_revision=? AND created>=?',b.previewToken??'',project,id,digest,policy.revision,Date.now()-86400000).first();
 if(!preview)throw new Error('Preview required or stale: rule or capture policy changed; preview again before enabling');
 return [scrubbingFence(env.DB,project,revisions.project),scrubbingFence(env.DB,null,revisions.installation),identityPolicyFence(env.DB,project,policy.revision),s(env.DB,'INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM alert_rule_previews WHERE id=? AND project=? AND rule_id IS ? AND digest=? AND policy_revision=?) THEN 1 ELSE 0 END',b.previewToken,project,id,digest,policy.revision),s(env.DB,'DELETE FROM alert_rule_previews WHERE id=?',b.previewToken)];
}
