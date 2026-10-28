import { ToolRefusal } from '../../modules/agent-door/index.ts';
import type { ResourceContext, ToolContext } from '../../modules/agent-door/types.ts';
import type { Bindings } from '../../auth/bindings';
import { proposalStale } from '../proposals/lifecycle';
import { issuePacket } from '../packet';
import { issueProjection, outcomeProjection } from '../agent-projection';
import { resolveIssue } from '../short-ids/lookup';
import { reproducerView } from '../reproducers/view';
import { repairView } from '../repairs/view';
import { workflowView } from '../fixes/workflow';
import { nativeAuthority, projectPath, segment } from './native';

export async function readRecord(env: Bindings, kind: string, args: Record<string, unknown>, ctx: ResourceContext | ToolContext): Promise<any> {
 const project = String(args.project), root = projectPath(args);
 const path = root + ({proposals:'/grouping-proposals',reproducers:'/reproducers',repairs:'/repairs',fixes:'/fixes',releases:'/releases',deployments:'/deployments',alerts:'/alerting/rules'}[kind] ?? '/issues');
 await nativeAuthority(env, path, 'GET', ctx);
 if (!await env.DB.prepare('SELECT 1 FROM projects WHERE id=?').bind(project).first()) throw new ToolRefusal('not_found');
 const rows = async (table: string, columns = '*') => (await env.DB.prepare(`SELECT ${columns} FROM ${table} WHERE project=? ORDER BY 1 LIMIT 100`).bind(project).all<any>()).results;
 if (kind === 'issues' || kind === 'packets') {
  if (args.issue) {
   const found = await resolveIssue(env.DB,project,String(args.issue));
   if (!found) throw new ToolRefusal('not_found');
   const value = await issuePacket(env.DB,project,found.issue,found.requested);
   if (!value) throw new ToolRefusal('not_found');
   return JSON.parse(value);
  }
  return (await rows('issues')).filter(row => args.state !== 'open' || row.state === 'open').slice(0,Number(args.limit ?? 100)).map(issueProjection);
 }
 if (kind === 'outcomes') return {window:'last 24 hours',coverage:'Server admission and SDK-reported discards; unreported pre-transport loss remains unknown',rows:(await env.DB.prepare('SELECT reason,SUM(count) count FROM outcomes WHERE project=? AND window>=? GROUP BY reason').bind(project,Date.now()-86400000).all<any>()).results.map(outcomeProjection)};
 if (kind === 'proposals') {
  const all = await rows('grouping_proposals');
  const selected = args.id ? all.filter(row => row.id === args.id) : all;
  const values = await Promise.all(selected.map(async row => ({id:row.id,kind:row.kind,state:['proposed','approved'].includes(row.state)&&await proposalStale(env.DB,row)?'stale':row.state,actor:row.actor,label:`proposed by agent ${row.actor}`,input:JSON.parse(row.input),revisions:JSON.parse(row.revisions),created:row.created,updated:row.updated})));
  if (args.id && !values.length) throw new ToolRefusal('not_found');
  return args.id ? values[0] : values;
 }
 if (['reproducers','repairs','fixes'].includes(kind)) {
  if(args.issue&&!await env.DB.prepare('SELECT 1 FROM issues WHERE project=? AND id=?').bind(project,args.issue).first())throw new ToolRefusal('not_found');
  const table = kind === 'fixes' ? 'fix_workflows' : kind;
  const all = (await rows(table)).filter(row => args.id ? row.id === args.id : row.issue === args.issue);
  let values = await Promise.all(all.map(row => kind === 'reproducers' ? reproducerView(env.DB,row) : kind === 'repairs' ? repairView(env.DB,row) : workflowView(env.DB,env,row)));
  if(kind==='reproducers'&&args.observed==='reproduced')values=values.filter((value:any)=>value.runs.some((run:any)=>run.outcome==='reproduced'));
  if (args.id && !values.length) throw new ToolRefusal('not_found');
  return args.id ? values[0] : kind === 'repairs' ? {repairs:values,available:values.length} : kind === 'reproducers' ? {reproducers:values} : {workflows:values};
 }
 if (kind === 'releases') {
  const all = await rows('releases','project,name,seq,build,created');
  if (args.id && !all.some(row => row.name === args.id)) throw new ToolRefusal('not_found');
  return args.id ? all.find(row => row.name === args.id) : all;
 }
 if (kind === 'deployments') {
  const all = await rows('deployment_runs','project,id,release,build,environment,repository,commit_sha,started_at,deadline,actor,created,historical');
  if (args.id && !all.some(row => row.id === args.id)) throw new ToolRefusal('not_found');
  return args.id ? all.find(row => row.id === args.id) : {rows:all,provenance:'Recorded deployment facts do not perform a deployment.'};
 }
 if (kind === 'alerts') return rows('alert_rules');
 throw new ToolRefusal('not_found');
}

/** Read-only projections of every store changed by the registry. No source,
 * credentials, native sessions, tokens, recipient bodies or provider calls. */
export async function witness(env: Bindings, args: Record<string, unknown>, ctx: ResourceContext) {
 await nativeAuthority(env,'/api/organization','GET',ctx);
 const project = String(args.project), result: Record<string, unknown> = {};
 const columns: Record<string,string> = {
  issues:'id,state,revision,count',grouping_proposals:'id,state,input,revisions,updated',grouping_corrections:'id,state,plan,updated',event_grouping:'event,occurrence,correction,direction',
  reproducers:'id,issue,support,created',reproducer_runs:'id,reproducer,state,outcome,created,finished',repairs:'id,issue,revision,link,note',repair_checks:'id,repair,name,outcome,note',
  fix_workflows:'id,revision,approved,expires,pull_number,head_sha',fix_receipts:'id,workflow,step,outcome,status',releases:'name,seq,build',deployment_runs:'id,release,commit_sha',
  alert_rules:'id,revision,enabled,destination',alert_intents:'id,state,expanded',alert_mail_jobs:'id,state,code',follow_up_settings:'revision,destination,channel',
  retention_policies:'revision,windows,held',follow_up_notices:'id,state,attempts,code',credentials:'hash,kind,revoked,minted_by,minted_version',
 };
 for (const [table, projection] of Object.entries(columns)) result[table] = (await env.DB.prepare(`SELECT ${projection} FROM ${table} ORDER BY 1 LIMIT 500`).all()).results;
 result.members=(await env.DB.prepare('SELECT id,operator_id,role,state,version FROM spool_members ORDER BY id LIMIT 500').all()).results;
 result.grants=(await env.DB.prepare('SELECT member,project,role FROM spool_project_grants ORDER BY member,project LIMIT 500').all()).results;
 return result;
}
