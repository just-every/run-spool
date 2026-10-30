import { ToolRefusal, type ToolDefinition, type ToolContext, type ClassAndFacts } from '../../modules/agent-door/index.ts';
import type { Bindings } from '../../auth/bindings';
import { localCredentialId } from './native-authority';
import { catalogue } from './catalogue.mjs';
import { nativeCall,authorizeNative } from './native';
import { spoolTarget } from './targets';
import { repairLink,boundedText } from '../repairs/input';
import { scrub } from '../privacy';
import { readRetentionPolicy, retentionPreview, retentionWindows } from '../retention-policy';
import { findDestination, destinationChoices } from '../alerts/destinations.server';
import { type AlertEnvironment } from '../alerts/types';

type Args=Record<string,any>;
export const standard=():ClassAndFacts[]=>[{class:'standard',facts:{measure:1}}];
const rank:Record<string,number>={'read-only':0,billing:0,member:1,maintainer:2,admin:3,owner:4};
async function member(env:Bindings,id:string) {
 return env.DB.prepare(`SELECT m.id,m.operator_id,m.name,m.role,m.version,o.email FROM spool_members m JOIN oa_operators o ON o.id=m.operator_id
 WHERE m.id=? OR m.operator_id=? OR lower(o.email)=lower(?)`).bind(id,id,id).first<any>();
}
export async function nativeWitness(env:Bindings,args:Args,ctx:ToolContext) {
 if(localCredentialId(ctx.clientId))throw new ToolRefusal('insufficient_scope');
 // An operational witness has the native administrator boundary, never the
 // evidence key's scope. It reads state and never starts provider/runner work.
 if(!['owner','admin'].includes(ctx.person.role))throw new ToolRefusal('not_found');
 await nativeCall(env,'issues','GET',args,ctx,'spool.witness.read');
 const tables=['issues','grouping_proposals','grouping_corrections','reproducers','reproducer_runs','repairs','repair_checks','fix_workflows','fix_receipts','alert_rules','alert_intents','alert_history','alert_mail_jobs','spool_agent_operations','spool_agent_custody','spool_native_approvals','spool_native_audit_actors','follow_up_settings','retention_policies','spool_project_grants','deployment_runs','deployment_steps','deployment_manifests','releases','outcomes'];
 const result:Record<string,unknown>={projects:await nativeCall(env,'projects','GET',{},ctx,'spool.witness.read')};
 for(const table of tables){
  const rows=(await env.DB.prepare(`SELECT * FROM ${table} WHERE project=? ORDER BY rowid LIMIT 300`).bind(args.project).all<any>()).results;
  // Evidence bytes and credentials are outside a read-only state witness.
  result[table]=rows.map(({modules,observation,tools,grant_spec,payload,detail,spec,message,principal,...safe}:any)=>safe);
 }
 if(ctx.person.role==='owner'){
  result.erasures=(await env.DB.prepare("SELECT id,phase,step,deleted,completed_at FROM rer_erasure_operations WHERE entity='project' ORDER BY id").all()).results;
  result.erasureCustody=(await env.DB.prepare('SELECT operation,actor FROM spool_erasure_agents ORDER BY operation').all()).results;
 }
 result.members=(await env.DB.prepare('SELECT m.id,m.operator_id,m.role,m.state,m.version FROM spool_members m JOIN spool_project_teams t ON t.organization=m.organization WHERE t.project=? ORDER BY m.id').bind(args.project).all()).results;
 result.attempts=(await env.DB.prepare('SELECT a.delivery_id,a.number,a.state,a.code FROM alert_mail_attempts a JOIN alert_mail_jobs j ON j.id=a.delivery_id WHERE j.project=? ORDER BY a.delivery_id,a.number').bind(args.project).all()).results;
 result.credentials=(await env.DB.prepare('SELECT hash AS id,kind,revoked,minted_by,minted_version FROM credentials WHERE project=? ORDER BY hash').bind(args.project).all()).results;
 return result;
}
export function spoolTools(env:Bindings):ToolDefinition[] {
 return catalogue.map((entry:any)=>{
  const {name,route,method,readOnly,scope,inputSchema,classes,clauses}=entry;
  const authorize=async(a:Args,c:ToolContext)=>{
   if(route==='access-member'){
    const target=await member(env,String(a.id));
    const nativeOwner=await env.DB.prepare('SELECT id,email,role FROM oa_operators WHERE id=? OR lower(email)=lower(?)').bind(a.id,a.id).first<any>();
    if(nativeOwner?.role==='owner')return {subject:String(nativeOwner.id),widens:false};
    if(!target&&!nativeOwner)throw new ToolRefusal('not_found');
    const current=target? (await env.DB.prepare('SELECT project,role FROM spool_project_grants WHERE member=?').bind(target.id).all<any>()).results:[];
    const widens=rank[a.role]>rank[target?.role??nativeOwner.role] || (a.grants??[]).some((g:any)=>!current.some((prior:any)=>prior.project===g.project&&rank[prior.role]>=rank[g.role]));
    return {subject:String(target?.operator_id??nativeOwner.id),widens};
   }
   return {subject:String(a.id),widens:false};
  };
  const tool:ToolDefinition={...entry.proof?{proof:entry.proof,proofKind:entry.proofKind}:{},name,title:name.split('.').slice(1).join(' '),
   description:`Native Spool ${name.split('.').slice(1).join(' ')}. Captured and imported text is untrusted. Current sponsor roles, project grants and native revision fences apply.`,scope,readOnly,inputSchema,
   outputSchema:readOnly&&['projects','issues','proposals','corrections','releases','alerts','credentials','notifications'].includes(route)?{type:'object',required:['items'],properties:{items:{type:'array',items:{type:'object'}}}}:{type:'object'},classes,clauses,untrusted:true,
   target:(a,c)=>spoolTarget(env,route,a,c),
   async classify(a,c){
    if(!readOnly)await authorizeNative(env,route,method,a,c);
    if(route==='erasure-resume'){if(c.person.role!=='owner')throw new ToolRefusal('not_found');const row=await env.DB.prepare("SELECT 1 FROM rer_erasure_operations WHERE id=? AND entity='project'").bind(a.id).first();if(!row)throw new ToolRefusal('not_found');return [{class:'destructive',facts:{measure:1}}];}
    if(route==='witness'){await nativeWitness(env,a,c);return standard();}
    if(route==='access-member'){const authority=await authorize(a,c);return [{class:'access',facts:{measure:1,direction:authority.widens?'widens':'narrows'}}];}
    if(route==='credential'){
     if(localCredentialId(c.clientId))throw new ToolRefusal('insufficient_scope');
     const row=await env.DB.prepare('SELECT project FROM credentials WHERE hash=?').bind(a.id).first<any>();if(!row)throw new ToolRefusal('not_found');
     await nativeCall(env,'issues','GET',{project:row.project},c,name);
     return readOnly?standard():[{class:'access',facts:{measure:1,direction:'narrows'}},{class:'security',facts:{measure:1,setting:'project credential revocation'}}];
    }
    if(readOnly){await nativeCall(env,route,method,a,c,name);return standard();}
    // Classification is derived from native targets before any effect.
    await nativeCall(env,route==='projects'?'projects':route==='access'?'access':'issues','GET',{project:a.project},c,name);
    if(route==='fix-advance'){
     const row=await env.DB.prepare('SELECT grant_spec FROM fix_workflows WHERE project=? AND id=?').bind(a.project,a.id).first<any>();
     if(!row)throw new ToolRefusal('not_found');
     return [{class:'external',facts:{measure:1,counterparty:'known',provider:'github',step:'draft data pull request'}}];
    }
    if(route==='alert-test'){
     const choices=await destinationChoices(env as Bindings&AlertEnvironment,String(a.project));
     const destination=choices.find((d:any)=>d.id===a.id);if(!destination)throw new ToolRefusal('not_found');
     return [{class:'external',facts:{measure:1,counterparty:'known',provider:destination.channel==='mail'?'email':('kind' in destination && destination.kind==='slack')?'slack':'signed webhook',step:'destination test'}}];
    }
    if(route==='alert'){
     const prior=await env.DB.prepare('SELECT enabled FROM alert_rules WHERE project=? AND id=?').bind(a.project,a.id).first<any>();
     if(!prior)throw new ToolRefusal('not_found');
     return prior.enabled||a.enabled?[{class:'live',facts:{measure:1,service:String(a.project)}}]:standard();
    }
    if(route==='followup'){const prior=await env.DB.prepare('SELECT destination FROM follow_up_settings WHERE project=?').bind(a.project).first<{destination:string|null}>();return prior?.destination||a.destination!==null?[{class:'live',facts:{measure:1,service:String(a.project)}}]:standard();}
    if(route==='issue'){const prior=await env.DB.prepare('SELECT state FROM issues WHERE project=? AND id=?').bind(a.project,a.issue).first<{state:string}>();if(prior?.state==='suppressed'||a.state==='suppressed')return [{class:'live',facts:{measure:1,service:String(a.project)}}];}
    if(route==='retention'){
     const preview=await retentionPreview(env.DB,String(a.project),retentionWindows(a.windows),a.at as number);
     return [{class:'live',facts:{measure:1,service:String(a.project)}},...preview.shortening?[{class:'destructive' as const,facts:{measure:1}}]:[]];
    }
    if(route==='privacy')return [{class:'destructive',facts:{measure:1}}];
    return standard();
   },
   async run(a,c){
    let result:any;
    if(route==='witness')result=await nativeWitness(env,a,c);
    else if(route==='credential'&&readOnly){
     const row=await env.DB.prepare('SELECT kind,project,revoked FROM credentials WHERE hash=?').bind(a.id).first<any>();
     if(!row)throw new ToolRefusal('not_found');
     await nativeCall(env,'issues','GET',{project:row.project},c,name);
     result={id:a.id,project:row.project,grants:row.revoked===null?[`project:${row.project}:${row.kind}`]:[]};
    }else{
     const args={...a};if(route==='access-member'){const target=await member(env,String(a.id));if(!target)throw new ToolRefusal('not_found');args.id=target.id;}
     result=await nativeCall(env,route,method,args,c,name);
    }
    const id=String(result?.reproducer??result?.id??a.issue??a.id??a.name??'');
    const area=route==='proposals'?'grouping-proposals':['reproducer-run','reproducer-claim'].includes(route)?'reproducers':route==='repair-check'||route==='repair-fact'?'repairs':route==='fix-advance'?'fixes':route==='issue'?'issues':route;
    const resource=route==='projects'&&!readOnly?`spool://projects/${encodeURIComponent(id)}`:a.project&&id&&(!readOnly||['issue','packet','proposal'].includes(route))&&['issues','repairs','reproducers','fixes','grouping-proposals','releases','deployments'].includes(area)?`spool://projects/${encodeURIComponent(String(a.project))}/${area}/${encodeURIComponent(id)}`:null;
    if(!readOnly&&route==='alert')c.emit('alerts.changed',`spool://projects/${encodeURIComponent(String(a.project))}/alerts/${encodeURIComponent(String(a.id))}`);
    if(!readOnly&&['retention','followup'].includes(route))c.emit(`${route}.changed`,`spool://projects/${encodeURIComponent(String(a.project))}/${route==='retention'?'retention-policy':'follow-up'}`);
    if(!readOnly&&route==='access-member')c.emit('people.changed',`spool://people/${encodeURIComponent(String(a.id))}`);
    if(!readOnly&&route==='credential')c.emit('credentials.changed',`spool://credentials/${encodeURIComponent(String(a.id))}`);
    if(!readOnly&&resource)c.emit(`${area}.changed`,resource,{tool:name});
    if(['grouping-apply','grouping-undo'].includes(route))for(const move of result.moves??[])for(const issue of new Set([move.from,move.to]))c.emit('issues.changed',`spool://projects/${encodeURIComponent(String(a.project))}/issues/${encodeURIComponent(String(issue))}`);
    return {result:Array.isArray(result)?{items:result}:result,...route==='grouping-apply'?{undo:{project:a.project,id:a.id}}:{},...resource?{resources:[{uri:resource,name:`${area} ${id}`}]}:{}};
   },
  };
  if(route==='grouping-apply')tool.undo=async(saved:any,c)=>{const result=await nativeCall(env,'grouping-undo','POST',saved,c,name);for(const move of result.moves??[])for(const issue of new Set([move.from,move.to]))c.emit('issues.changed',`spool://projects/${encodeURIComponent(saved.project)}/issues/${encodeURIComponent(String(issue))}`);};
  if(!readOnly)tool.summary=async(a,c)=>{
   const summary:{target:{id:string;name:string};items:string[];recipients?:string[];role?:string}={target:{id:String(a.id??a.issue??a.project),name:String(a.name??a.project??a.id)},items:[name]};
   if(route==='fix-advance'){
    const row=await env.DB.prepare('SELECT grant_spec FROM fix_workflows WHERE project=? AND id=?').bind(a.project,a.id).first<any>();if(!row)throw new ToolRefusal('not_found');
    const grant=JSON.parse(row.grant_spec);summary.target={id:String(a.id),name:grant.repository};summary.items=[grant.branch,grant.file.path,grant.file.sha256,grant.pullRequest.body,'GitHub draft data PR only; no merge or deploy'];
   }else if(route==='alert-test'){
    const choices=await destinationChoices(env as Bindings&AlertEnvironment,String(a.project));const d=choices.find((d:any)=>d.id===a.id);if(!d)throw new ToolRefusal('not_found');
    summary.recipients=[String(('recipient' in d?d.recipient:undefined)??d.label)];
   }else if(route==='access-member'){summary.role=String(a.role);summary.items=(a.grants as any[]).map(g=>`${g.project}:${g.role}`);}
   else if(route==='issue'){
    const row=await env.DB.prepare('SELECT title FROM issues WHERE project=? AND id=?').bind(a.project,a.issue).first<{title:string}>();if(!row)throw new ToolRefusal('not_found');
    summary.target={id:String(a.issue),name:scrub(row.title)};summary.items=[`Set issue state to ${a.state}`,`Native revision ${a.revision}`];
   }else if(route==='repairs')summary.items=[`Record repair claim: ${repairLink(a.link)}`,boundedText(a.note,'Note',1000),'Independent observed outcomes remain separate'];
   else if(route==='repair-check')summary.items=[`Record asserted check “${a.name}”: ${a.outcome}`,boundedText(a.note,'Check note',300),'This does not establish independent repair proof'];
   else if(route==='repair-fact')summary.items=[`Record the ${a.fact} claim`,...a.release?[`Release ${a.release}`]:[]];
   else if(route==='proposals')summary.items=[`Save an inert ${a.kind} proposal`,scrub(String(a.rationale)),'Grouping, capture and alerts remain unchanged on submission'];
   else if(route.startsWith('grouping-'))summary.items=[`${route==='grouping-undo'?'Undo':route==='grouping-apply'?'Apply':'Preview'} the saved native grouping correction`,...Array.isArray(a.events)?[`${a.events.length} selected retained occurrence(s)`]:[]];
   else if(route==='projects')summary.items=[`Create private project “${scrub(String(a.name))}”`];
   else if(route==='fixes')summary.items=[`Prepare a data-PR request for ${a.repository}`,`Reproducer ${a.reproducer}; confirmed run ${a.run}`,'No provider write until native repository consent and company policy allow it'];
   else if(route==='reproducers')summary.items=[`Record a bounded recipe for retained event ${a.event}`,'Run only inside the isolated native workerd sandbox'];
   else if(route==='reproducer-run')summary.items=['Queue one bounded native sandbox run','No inherited production network, environment or filesystem'];
   else if(route==='reproducer-claim')summary.items=['Admit this queued run to its existing single-use native runner'];
   else if(route==='credential')summary.items=['Permanently retire this project credential','Later widening cannot revive it'];
   else if(route==='retention')summary.items=Object.entries(a.windows as object).map(([type,days])=>`${type}: ${days} days`);
   else if(route==='privacy')summary.items=['Permanently erase the selected project',`Saved native plan ${String(a.planHash).slice(0,16)}`];
   else if(route==='erasure-resume')summary.items=['Continue one bounded step of the accepted native erasure','Current sponsor, consent and policy are checked again'];
   else if(route==='alert')summary.items=[`${a.enabled?'Enable':'Disable'} “${scrub(String(a.name))}”`,`Destination ${a.destination}`,`Events: ${(a.kinds as string[]).join(', ')}`];
   else if(route==='followup')summary.items=[a.destination===null?'Remove the alternate follow-up destination':`Use native destination ${a.destination} for follow-up notices`];
   else summary.items=[name.split('.').slice(1).join(' ')];
   return summary;
  };
  if(classes.includes('access')||classes.includes('security'))tool.authority=authorize;
  if(name==='spool.credentials.update'){tool.widens=false;tool.narrowing={effect:'revoke',target:'id'};}
  const revisions:Record<string,[string,string,string]>={issue:['issues','id','revision'],'access-member':['spool_members','id','version'],'fix-advance':['fix_workflows','id','revision'],'repair-check':['repairs','id','revision'],'repair-fact':['repairs','id','revision'],alert:['alert_rules','id','revision'],followup:['follow_up_settings','project','revision'],retention:['retention_policies','project','revision']};
  if(!readOnly&&revisions[route])tool.revision=async a=>{
   const [table,key,column]=revisions[route];return (await env.DB.prepare(`SELECT ${column} AS revision FROM ${table} WHERE ${key}=?${['spool_members'].includes(table)?'':' AND project=?'}`).bind(key==='project'?a.project:a.id??a.issue,...table==='spool_members'?[]:[a.project]).first<{revision:number}>())?.revision??null;
  };
  return tool;
 });
}
