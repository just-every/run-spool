import { notificationTool } from './notification-tool';
import { ToolRefusal } from '../../modules/agent-door/index.ts';
import type { ClassAndFacts, ToolDefinition, ResourceDefinition, ToolContext } from '../../modules/agent-door/types.ts';
import type { Bindings } from '../../auth/bindings';
import { operations, operationDeclaration, witnessDeclaration, resourceTemplates, schemaObject, type NativeOperation } from './catalogue';
import { nativeAuthority, nativeCall, projectPath, segment } from './native';
import { readRecord, witness } from './records';
import { findDestination } from '../alerts/destinations.server';
import { readRetentionPolicy } from '../retention-policy';

export function operationPath(op: NativeOperation,args: Record<string, unknown>) {
 const path = op.path.replace(/\{(\w+)\}/g,(_,key) => segment(args[key]));
 return path.startsWith('@') ? path.slice(1) : projectPath(args)+path;
}
export function spoolTools(env: Bindings): ToolDefinition[] {
 const tools: ToolDefinition[] = operations.map(op => {
  const readOnly = op.readOnly ?? op.method === 'GET', scope = op.name === 'spool.proposals.create' ? 'spool:propose' : readOnly ? 'spool:read' : 'spool:write';
  const tool: ToolDefinition = {
   ...operationDeclaration(op),untrusted:true,
   async classify(args,ctx) {
    await nativeAuthority(env,operationPath(op,args),op.method,ctx);
    if (op.name === 'spool.issues.update') {const current=await env.DB.prepare('SELECT state FROM issues WHERE project=? AND id=?').bind(args.project,args.issue).first<{state:string}>();const live=args.state==='suppressed'||current?.state==='suppressed';return [{class:live?'live':'standard',facts:{measure:1,...live?{service:String(args.project)}:{}}}];}
    if (op.name === 'spool.alerts.update') {
     const previous = await env.DB.prepare('SELECT enabled,destination,channel FROM alert_rules WHERE project=? AND id=?').bind(args.project,args.id).first<any>();
     return [{class:args.enabled || previous?.enabled ? 'live' : 'standard',facts:{measure:1,...args.enabled || previous?.enabled?{service:String(args.project)}:{}}}];
    }
    if (op.name === 'spool.fixes.advance') {
     const row = await env.DB.prepare('SELECT grant_spec FROM fix_workflows WHERE project=? AND id=?').bind(args.project,args.id).first<{grant_spec:string}>();
     if (!row) throw new ToolRefusal('not_found');
     const grant = JSON.parse(row.grant_spec);
     return [{class:'external',facts:{measure:1,counterparty:'known',provider:'github',step:'draft_data_pull_request'}}];
    }
    if (op.name === 'spool.alerts.test') {
     const destination = await findDestination(env,String(args.project),String(args.id),'mail').catch(() => findDestination(env,String(args.project),String(args.id),'webhook'));
     return [{class:'external',facts:{measure:1,counterparty:'known',provider:destination.kind === 'slack'?'slack':destination.channel,step:'test'}}];
    }
    if(op.name==='spool.credentials.update') {const key=await env.DB.prepare('SELECT kind FROM credentials WHERE project=? AND hash=?').bind(args.project,args.id).first<{kind:string}>();if(!key)throw new ToolRefusal('not_found');return [{class:'security',facts:{measure:1,setting:'project credential'}},...key.kind==='ingest'?[{class:'live' as const,facts:{measure:1,service:String(args.project)}}]:[]];}
    if(op.name==='spool.retention.update') {const current=await readRetentionPolicy(env.DB,String(args.project));const windows=args.windows as Record<string,number>;return [{class:'live',facts:{measure:1,service:String(args.project)}},...Object.entries(current.windows).some(([key,days])=>windows[key]<days)?[{class:'destructive' as const,facts:{measure:1}}]:[]];}
    const authority=await tool.authority?.(args,ctx);
    return op.classes.map(cls => ({class:cls,facts:{measure:1,...cls === 'live'?{service:String(args.project)}:{},...cls === 'security'?{setting:'project credential'}:{},...cls === 'access'?{direction:authority?.widens?'widens':'narrows'}:{}}} as ClassAndFacts));
   },
   async summary(args,ctx) {
    await nativeAuthority(env,operationPath(op,args),op.method,ctx);
    let target = {id:String(args.id ?? args.issue ?? args.source ?? args.project),name:String(args.project)};
    if (op.name === 'spool.fixes.advance') {const row=await env.DB.prepare('SELECT grant_spec FROM fix_workflows WHERE project=? AND id=?').bind(args.project,args.id).first<any>();if(!row)throw new ToolRefusal('not_found');const grant=JSON.parse(row.grant_spec);target={id:String(args.id),name:grant.repository};return {target,items:[grant.branch,grant.file.path,grant.pullRequest.title,'Draft data PR only; no code, merge or deploy']};}
    if (op.name === 'spool.alerts.test') {const d=await findDestination(env,String(args.project),String(args.id),'mail').catch(()=>findDestination(env,String(args.project),String(args.id),'webhook'));return {target,recipients:[d.recipient ?? d.label],items:['Spool TEST — destination check']};}
    return {target,items:Object.entries(args).filter(([key])=>key!=='project').map(([key,value])=>`${key}: ${JSON.stringify(value)}`),...(args.role?{role:String(args.role)}:{})};
   },
   async run(args,ctx) {
    if(readOnly && op.name !== 'spool.access.read' && !op.nativeRead) return {result:await readRecord(env,op.name.split('.')[1],args,ctx)};
    const routeKeys = [...op.path.matchAll(/\{(\w+)\}/g)].map(match=>match[1]);
    const body = Object.fromEntries(Object.entries(args).filter(([key])=>key!=='project'&&!routeKeys.includes(key)));
    if(op.name === 'spool.grouping.apply') body.confirm=true;
    if(op.name === 'spool.privacy.erase') body.confirm=args.project;
    let path=operationPath(op,args);if(op.method==='GET'){const query=new URLSearchParams(Object.entries(body).map(([key,value])=>[key,String(value)]));if(query.size)path+='?'+query;}
    const result=await nativeCall(env,path,op.method,op.method==='GET'?undefined:body,ctx);
    if(op.name === 'spool.reproducers.run') {result.authority={purpose:'single-use isolated sandbox run',run:result.run,expires:result.expires};result.state='queued';result.outcome=null;}
    if(!readOnly && op.name!=='spool.privacy.erase') {
     const resource = resourceFor(op.name,args,result);
     ctx.emit(op.name+'.changed',resource);
     await env.DB.prepare('INSERT INTO spool_agent_activity(id,project,uri,tool,agent,agent_name,sponsor,sponsor_name,approvers,created) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),String(args.project),resource,op.name,ctx.agent.id,ctx.agent.name,ctx.person.id,ctx.person.name,JSON.stringify(ctx.approvers),Date.now()).run();
    }
    return {result};
   },
  };
  if(op.table && op.key && op.nativeRevision) tool.revision=async(args,ctx)=>{
   await nativeAuthority(env,operationPath(op,args),op.method,ctx);
   const row = await env.DB.prepare(`SELECT ${op.nativeRevision} revision FROM ${op.table} WHERE ${op.table === 'spool_members'?'1=1':'project=?'} AND id=?`).bind(...op.table === 'spool_members'?[]:[args.project],args[op.key!]).first<{revision:number}>();
   return row?.revision ?? null;
  };
  if(op.classes.some(cls=>['access','security'].includes(cls))) tool.authority=async(args,ctx)=>{
   if(op.name==='spool.credentials.update') {const credential=await env.DB.prepare('SELECT minted_by FROM credentials WHERE project=? AND hash=?').bind(args.project,args.id).first<{minted_by:string}>();if(!credential)throw new ToolRefusal('not_found');return {subject:credential.minted_by,widens:false};}
   const member=await env.DB.prepare('SELECT operator_id,role FROM spool_members WHERE id=?').bind(args.id).first<any>();
   const subject=member?.operator_id ?? String(args.id);
   const old=(await env.DB.prepare('SELECT project,role FROM spool_project_grants WHERE member=?').bind(args.id).all<{project:string;role:string}>()).results;
   const levels:Record<string,number>={'read-only':0,member:1,maintainer:2,admin:3,billing:0};
   const grants=Array.isArray(args.grants)?args.grants as any[]:[];
   return {subject,widens:!member || levels[String(args.role)]>levels[member.role] || args.role==='billing'&&member.role!=='billing'&&member.role!=='admin' || grants.some(grant=>!old.some(previous=>previous.project===grant.project && levels[previous.role]>=levels[grant.role]))};
  };
  return tool;
 });
 tools.push({...witnessDeclaration,classify:async(args,ctx)=>{await nativeAuthority(env,projectPath(args)+'/retention-policy','GET',ctx);return [{class:'standard',facts:{measure:1}}];},run:async(args,ctx)=>({result:await witness(env,args,ctx)})});
 tools.push(notificationTool(env));
 return tools;
}

function resourceFor(name:string,args:Record<string,unknown>,result:any) {
 const family=name.split('.')[1],kind=family==='proposals'?'grouping-proposals':family;
 return `spool://projects/${segment(args.project)}/${kind}/${segment(result?.id ?? args.id ?? args.issue ?? args.source ?? 'current')}`;
}
export function spoolResources(env:Bindings): ResourceDefinition[] {
 return resourceTemplates.map(([kind,path])=>({uriTemplate:`spool://projects/{project}/${path}`,name:`Spool ${kind}`,mimeType:'application/json',scope:'spool:read',classes:['standard'],classify:()=>[{class:'standard',facts:{measure:1}}],async read(uri,ctx){
  const match = new RegExp('^spool://projects/([^/]+)/'+path.replace('{issue}','([^/]+)').replace('{id}','([^/]+)')+'$').exec(uri);if(!match)return null;
  try {return {json:await readRecord(env,kind,{project:decodeURIComponent(match[1]),...[...path.matchAll(/\{(\w+)\}/g)].map((m,i)=>({[m[1]]:decodeURIComponent(match[i+2])})).reduce((all,part)=>({...all,...part}),{})},ctx),untrusted:true};}catch{return null;}
 }}));
}
