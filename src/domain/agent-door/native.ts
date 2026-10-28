import api from '../api';
import type { Bindings } from '../../auth/bindings';
import { ToolRefusal, type ToolContext } from '../../modules/agent-door/index.ts';
import { withAgentAuthority } from './native-authority';
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
 case 'reproducer-run':return `${p}/reproducers/${e(a.id)}/runs`;
 case 'repair-check':return `${p}/repairs/${e(a.id)}/checks`;
 case 'repair-fact':return `${p}/repairs/${e(a.id)}/facts`;
 case 'fix-advance':return `${p}/fixes/${e(a.id)}/advance`;
 case 'alerts':return `${p}/alerting/rules`;
 case 'alert':return `${p}/alerting/rules/${e(a.id)}`;
 case 'alert-test':return `${p}/alerting/destinations/${e(a.id)}/test`;
 case 'followup':return `${p}/follow-up/alternate`;
 case 'access':return '/api/organization';
 case 'access-member':return `/api/organization/members/${e(a.id)}`;
 case 'credential':return `${p}/keys/${e(a.id)}`;
 case 'retention':return `${p}/retention-policy`;
 case 'privacy':return `${p}/erasure`;
 default:throw new ToolRefusal('tool_not_found');
 }
}
export async function nativeCall(env: Bindings, route:string,method:string,args:Args,ctx:ToolContext,tool:string):Promise<any> {
 const a={...args};
 if(route==='credential'){
  const row=await env.DB.prepare('SELECT project FROM credentials WHERE hash=?').bind(a.id).first<{project:string}>();
  if(!row)throw new ToolRefusal('not_found');a.project=row.project;
 }
 const path=route==='issue'&&method==='GET'?nativePath('issues',a):nativePath(route,a);
 const url=new URL(path,env.AUTH_ORIGIN);
 if(route==='issues')for(const key of ['state','limit'])if(a[key]!==undefined)url.searchParams.set(key,String(a[key]));
 const {project:_,id:_id,issue:_issue,...body}=a;
 if(route==='deployments'&&method==='POST')body.id=a.id;
 if(['repairs','fixes'].includes(route)&&method!=='GET'&&a.issue)body.issue=a.issue;
 if(['grouping-apply','grouping-undo'].includes(route))body.confirm=true;
 if(route==='privacy'&&method==='POST'){body.confirm=a.project;body.planHash=a.planHash;}
 if(route==='retention'&&method==='PUT')body.confirmation='SHORTEN RETENTION';
 const request=new Request(url,{method,headers:{'content-type':'application/json'},...method==='GET'?{}:{body:JSON.stringify(body)}});
 const operation={id:crypto.randomUUID(),tool,project:a.project??null,target:String(a.issue??a.id??a.name??a.project??'installation')};
 const door=classifyRequest(request);
 const actor=await auditActor(env.DB,{kind:'agent',authority:ctx.agent.id,owner:ctx.person.id,project:a.project});
 const subject=door?{kind:door.kind,label:await auditLabel(env.DB,subjectBinding(door.kind,door.project?JSON.stringify([door.project,door.subject]):door.subject,door.project))}: {kind:'project' as const,label:await auditLabel(env.DB,subjectBinding('project',String(a.project??'installation'),a.project))};
 const response=await withAgentAuthority(request,env,ctx,operation,()=>runAuditScope({actor,action:door?.action??'private.action',subject,projectLabel:null},()=>Promise.resolve(api.fetch(request,env))));
 let value:any;try{value=await response.json();}catch{throw new ToolRefusal('native_unavailable');}
 if(!response.ok)throw new ToolRefusal(response.status===401?'unauthenticated':response.status===403||response.status===404?'not_found':response.status===409?'revision_conflict':'native_refused','Native action refused',{status:response.status,reason:typeof value?.error==='string'?value.error:undefined});
 if(route==='issue'&&method==='GET'){
  value=value.find((row:any)=>row.id===a.issue);if(!value)throw new ToolRefusal('not_found');
 }
 if(route==='issues')value=value.map(issueProjection);
 if(route==='issue'&&method==='GET')value=issueProjection(value);
 // Run tokens and source modules remain in the native connector door.
 if(route==='reproducer-run')value={run:value.run,url:value.url,expires:value.expires,state:'queued',execution:'Requires the native single-use isolated runner; queued is not reproduced.'};
 return value;
}
