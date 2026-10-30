import { ToolRefusal, type NativeTarget, type ToolContext } from '../../modules/agent-door/index.ts';
import type { Bindings } from '../../auth/bindings';
import { nativeCall } from './native';
import { localCredentialId } from './native-authority';

/** Resolve audit identities from visible native records. A proposed identifier
 * alone never proves a record exists or grants access to it. */
export async function spoolTarget(env: Bindings, route: string, args: Record<string, any>, ctx: ToolContext): Promise<NativeTarget | null> {
 if(route==='access-member'){
  if(args.id!==ctx.person.id&&String(args.id).toLowerCase()!==ctx.person.email.toLowerCase())await nativeCall(env,'access','GET',{},ctx,'target');
  const row=await env.DB.prepare('SELECT id FROM spool_members WHERE id=? OR operator_id=? OR operator_id IN (SELECT id FROM oa_operators WHERE lower(email)=lower(?))').bind(args.id,args.id,args.id).first<{id:string}>();
  if(!row)throw new ToolRefusal('not_found');
  return {kind:'member',id:row.id};
 }
 if(route==='credential'){
  if(localCredentialId(ctx.clientId))throw new ToolRefusal('insufficient_scope');
  const row=await env.DB.prepare('SELECT hash,project FROM credentials WHERE hash=?').bind(args.id).first<{hash:string;project:string}>();
  if(!row)throw new ToolRefusal('not_found');
  await nativeCall(env,'issues','GET',{project:row.project},ctx,'target');
  return {kind:'credential',id:row.hash};
 }
 if(route==='erasure-resume'){
  if(ctx.person.role!=='owner')throw new ToolRefusal('not_found');
  const row=await env.DB.prepare("SELECT id FROM rer_erasure_operations WHERE id=? AND entity='project'").bind(args.id).first<{id:string}>();
  if(!row)throw new ToolRefusal('not_found');
  return {kind:'project_erasure',id:row.id};
 }
 if(!args.project)return null;
 await nativeCall(env,'issues','GET',{project:args.project},ctx,'target');
 if(args.issue||(['proposals','grouping-preview'].includes(route)&&args.source)){
  const packet=await nativeCall(env,'packet','GET',{project:args.project,issue:args.issue??args.source},ctx,'target');
  return {kind:'issue',id:packet.issue.id};
 }
 const records:Record<string,[string,string]>={proposal:['grouping_proposals','grouping_proposal'],'grouping-apply':['grouping_corrections','grouping_correction'],'grouping-undo':['grouping_corrections','grouping_correction'],'reproducer-run':['reproducers','reproducer'],'reproducer-claim':['reproducer_runs','reproducer_run'],'repair-check':['repairs','repair'],'repair-fact':['repairs','repair'],'fix-advance':['fix_workflows','fix'],alert:['alert_rules','alert_rule']};
 if(args.id&&records[route]){
  const [table,kind]=records[route],row=await env.DB.prepare('SELECT id FROM '+table+' WHERE project=? AND id=?').bind(args.project,args.id).first<{id:string}>();
  if(!row)throw new ToolRefusal('not_found');
  return {kind,id:row.id};
 }
 if(route==='alert-test'){
  const rows=await nativeCall(env,'destinations','GET',{project:args.project},ctx,'target');
  const row=rows.rows.find((record:any)=>record.id===args.id);
  if(!row)throw new ToolRefusal('not_found');
  return {kind:'alert_destination',id:row.id};
 }
 const project=await env.DB.prepare('SELECT id FROM projects WHERE id=?').bind(args.project).first<{id:string}>();
 if(!project)throw new ToolRefusal('not_found');
 return {kind:'project',id:project.id};
}
