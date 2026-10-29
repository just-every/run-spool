import api from '../api';
import type { Bindings } from '../../auth/bindings';
import { ToolRefusal, type ToolContext,type UndoContext } from '../../modules/agent-door/index.ts';
import { withAgentAuthority,withReviewerAuthority,requestAuthority } from './native-authority';
import { runAuditScope } from '../audit/context';
import { auditActor, auditLabel, subjectBinding, projectAuditLabel } from '../audit/identity';
import { classifyRequest } from '../audit/classify';
import { issueProjection } from '../agent-projection';

type Args=Record<string,any>;
const e=(value:unknown)=>encodeURIComponent(String(value));
export function nativePath(route:string,a:Args) {
 const p=`/api/projects/${e(a.project)}`;
 switch(route){
 case 'projects': return '/api/projects';
 case 'issues':case 'outcomes':case 'releases':case 'deployments':return `${p}/${route}`;
 case 'issue':return `${p}/issues/${e(a.issue)}`;
 case 'packet':return `${p}/issues/${e(a.issue)}/packet`;
 case 'proposals':return `${p}/grouping-proposals`;
 case 'proposal':return `${p}/grouping-proposals/${e(a.id)}`;
 case 'grouping-preview':return `${p}/corrections/preview`;
 case 'grouping-apply':case 'grouping-undo':return `${p}/corrections/${e(a.id)}/${route.split('-')[1]}`;
 case 'reproducers':case 'repairs':case 'fixes':return `${p}/${route}${a.issue?'?issue='+e(a.issue):''}`;
 case 'reproducer-claim':return `${p}/reproducers/${e(a.id)}/claim`;
 case 'reproducer-run':return `${p}/reproducers/${e(a.id)}/runs`;
 case 'repair-check':return `${p}/repairs/${e(a.id)}/checks`;
 case 'repair-fact':return `${p}/repairs/${e(a.id)}/facts`;
 case 'fix-advance':return `${p}/fixes/${e(a.id)}/advance`;
 case 'issue-search':case 'issue-export':case 'occurrences':case 'feedback-reports':case 'release-health':return `${p}/${route}`;
 case 'affected-users':return `${p}/issues/${e(a.issue)}/affected-users`;
 case 'notifications':return `${p}/alerts`;
 case 'destinations':return `${p}/alerting/destinations`;
 case 'alerts':return `${p}/alerting/rules`;
 case 'alert':return `${p}/alerting/rules/${e(a.id)}`;
 case 'alert-test':return `${p}/alerting/destinations/${e(a.id)}/test`;
 case 'followup':return `${p}/follow-up/alternate`;
 case 'access':return '/api/organization';
 case 'access-member':return `/api/organization/members/${e(a.id)}`;
 case 'credentials':return `${p}/keys`;
 case 'credential':return `${p}/keys/${e(a.id)}`;
 case 'retention-preview':return `${p}/retention-policy/preview`;
 case 'retention':return `${p}/retention-policy`;
 case 'erasure-resume':return `/api/erasures/${e(a.id)}/resume`;
 case 'privacy':return `${p}/erasure`;
 default:throw new ToolRefusal('tool_not_found');
 }
}
/** Read current native route authority without executing its handler. This
 * also guards retained idempotent results after a sponsor's role narrows. */
export async function authorizeNative(env: Bindings, route:string,method:string,args:Args,ctx:ToolContext):Promise<void> {
 const a={...args};
 if(route==='credential'){
  const row=await env.DB.prepare('SELECT project FROM credentials WHERE hash=?').bind(a.id).first<{project:string}>();
  if(!row)throw new ToolRefusal('not_found');a.project=row.project;
 }
 if(['privacy','erasure-resume'].includes(route)&&ctx.person.role!=='owner')throw new ToolRefusal('not_found');
 const request=new Request(new URL(nativePath(route,a),env.AUTH_ORIGIN),{method});
 try{
  const permitted=await withAgentAuthority(request,env,ctx,{id:ctx.operationId,tool:'admission',project:a.project??null,target:''},()=>requestAuthority(request,env));
  if(!permitted)throw new ToolRefusal('not_found');
 }catch(cause){if(cause instanceof ToolRefusal)throw cause;throw new ToolRefusal('not_found');}
}
export async function nativeCall(env: Bindings, route:string,method:string,args:Args,ctx:ToolContext|UndoContext,tool:string):Promise<any> {
 const a={...args};
 if(route==='credential'){
  const row=await env.DB.prepare('SELECT project FROM credentials WHERE hash=?').bind(a.id).first<{project:string}>();
  if(!row)throw new ToolRefusal('not_found');a.project=row.project;
 }
 const path=route==='issue'&&method==='GET'?nativePath('issues',a):route==='deployments'&&method==='POST'?nativePath('releases',a):route==='followup'&&method==='GET'?`/api/projects/${e(a.project)}/follow-up`:nativePath(route,a);
 const url=new URL(path,env.AUTH_ORIGIN);
 if(method==='GET')for(const key of ['state','limit','q','sort','cursor','order','from','to','environment','format',...['occurrences','feedback-reports'].includes(route)?['issue']:[]])if(a[key]!==undefined)url.searchParams.set(key,String(a[key]));
 const {project:_,id:_id,issue:_issue,...body}=a;
 if(route==='fix-advance'){const row=await env.DB.prepare('SELECT revision FROM fix_workflows WHERE project=? AND id=?').bind(a.project,a.id).first<{revision:number}>();if(!row)throw new ToolRefusal('not_found');body.revision=row.revision;}
 if(route==='projects'&&method==='POST')body.id=crypto.randomUUID();
 if(route==='deployments'&&method==='POST'){for(const key of Object.keys(body))delete body[key];Object.assign(body,{name:a.release,build:a.build,manifest:a.manifest});}
 if(['repairs','fixes'].includes(route)&&method!=='GET'&&a.issue)body.issue=a.issue;
 if(['grouping-apply','grouping-undo'].includes(route))body.confirm=true;
 if(route==='privacy'&&method==='POST'){body.confirm=a.project;body.planHash=a.planHash;}
 if(route==='retention'&&method==='PUT')body.confirmation='SHORTEN RETENTION';
 const request=new Request(url,{method,headers:{'content-type':'application/json'},...method==='GET'?{}:{body:JSON.stringify(body)}});
 const operation={id:crypto.randomUUID(),tool,project:a.project??null,target:String(a.issue??a.id??a.name??a.project??'installation')};
 const door=classifyRequest(request);
 const actor=await auditActor(env.DB,{kind:ctx.agent?'agent':ctx.person.role==='owner'?'owner':'member',authority:ctx.agent?.id??ctx.person.id,owner:ctx.person.id,project:a.project});
 const subject=door?{kind:door.kind,label:await auditLabel(env.DB,subjectBinding(door.kind,door.project?JSON.stringify([door.project,door.subject]):door.subject,door.project))}: {kind:'project' as const,label:await auditLabel(env.DB,subjectBinding('project',String(a.project??'installation'),a.project))};
 const work=()=>runAuditScope({actor,action:door?.action??'private.action',subject,projectLabel:null},()=>Promise.resolve(api.fetch(request,env)));
 const response=ctx.agent?await withAgentAuthority(request,env,ctx as ToolContext,operation,work):await withReviewerAuthority(request,env,ctx.person.id,work);
 if(response.ok&&route==='issue-export'&&a.format==='csv')return {format:'csv',content:await response.text()};
 let value:any;try{value=await response.json();}catch{throw new ToolRefusal('native_unavailable');}
 if(!response.ok)throw new ToolRefusal([401,403,404].includes(response.status)?'not_found':response.status===409?'revision_conflict':'native_refused','Native action refused',{status:response.status,reason:typeof value?.error==='string'?value.error:undefined});
 if(route==='issue'&&method==='GET'){
  value=value.find((row:any)=>row.id===a.issue);if(!value)throw new ToolRefusal('not_found');
 }
 if(route==='issues')value=value.map(issueProjection);
 if(['issue-search','issue-export'].includes(route)&&Array.isArray(value.rows))value={...value,rows:value.rows.map(issueProjection)};
 if(route==='repairs'&&method==='GET'&&a.id){
  const repair=value.repairs.find((row:any)=>row.id===a.id);if(!repair)throw new ToolRefusal('not_found');
  value={available:1,repairs:[repair]};
 }
 if(route==='affected-users'){const {rows,...counts}=value;value=counts;}
 if(route==='issue'&&method==='GET')value=issueProjection(value);
 if(route==='projects'&&method==='POST'){const {ingestKey,dsn,...safe}=value;value=safe;}
 if(route==='credentials')value=value.filter((row:any)=>row.revoked===null&&!row.stopped);
 if(route==='deployments'&&method==='GET'){
  const releases=await nativeCall(env,'releases','GET',a,ctx,tool);
  const observed=releases.flatMap((release:any)=>JSON.parse(release.deployments??'[]').map((manifest:any)=>({id:`${release.name}:${manifest.environment}`,release:release.name,manifest,kind:'observed_deployment',authority:'Records an observed fact; does not deploy.'})));
  value={...value,rows:[...(value.rows??[]),...observed]};
 }
 if(route==='deployments'&&method==='POST')value={id:`${a.release}:${a.manifest.environment}`,release:a.release,manifest:value.manifest,kind:'observed_deployment',authority:'Records an observed fact; does not deploy.'};
 // Run tokens and source modules remain in the native connector door.
 if(route==='reproducer-run')value={...value,state:'queued',execution:'Use only this native single-use isolated runner handoff. Queued is not reproduced.'};
 return value;
}
