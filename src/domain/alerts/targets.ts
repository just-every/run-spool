import { scrub } from '../privacy';
import { statement as s, type AlertEnvironment, type Intent } from './types';
export type Recipient={member:string;email:string;reason:string};
export type TargetDestination={id:string;project:string;label:string;channel:'mail';kind:'target';targetType:'team'|'member'|'issue_owners';target:string|null;fallthrough:'active_members'|'no_one';editable:true;recipient?:undefined;url?:undefined;key?:undefined;token?:undefined;channelId?:undefined};
// Match the native permission model, including organization role overrides and
// active identity. A team label on another project confers no recipient access.
const authorizedMembers=`SELECT m.id member,m.email,m.name FROM spool_members m
 JOIN oa_operators o ON o.id=m.operator_id AND o.status='active'
 JOIN spool_project_teams t ON t.organization=m.organization
 LEFT JOIN spool_project_grants g ON g.project=t.project AND g.member=m.id
 WHERE t.project=? AND m.state='active' AND (m.role='admin' OR (m.role='member' AND g.role IN ('maintainer','member')))`;
export async function recipientChoices(env:AlertEnvironment,project:string){
 const members=(await s(env.DB,authorizedMembers+' ORDER BY m.email',project).all()).results;
 const teams=(await s(env.DB,'SELECT team FROM spool_project_teams WHERE project=?',project).all()).results;
 return {members,teams,issueOwnersAvailable:false};
}
export async function findTarget(env:AlertEnvironment,project:string,id:string):Promise<TargetDestination|null>{
 const row=await s(env.DB,'SELECT id,project,label,target_type targetType,target,fallthrough FROM alert_target_destinations WHERE project=? AND id=?',project,id).first<any>();
 return row?{...row,channel:'mail',kind:'target',editable:true}:null;
}
export async function targetChoices(env:AlertEnvironment,project:string){
 const rows=(await s(env.DB,'SELECT id FROM alert_target_destinations WHERE project=? ORDER BY created,id',project).all<{id:string}>()).results;
 return Promise.all(rows.map(row=>findTarget(env,project,row.id))) as Promise<TargetDestination[]>;
}
export function targetInput(input:any){
 const t=input?.target;
 if(!input||Object.keys(input).sort().join()!=='label,target'||typeof input.label!=='string'||!input.label.trim()||input.label.length>100||scrub(input.label)!==input.label||/[\x00-\x1f\x7f]/.test(input.label))throw new Error('Use a destination name and notify target');
 if(!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).some(k=>!['type','id','fallthrough'].includes(k))||!['team','member','issue_owners'].includes(t.type)||!['active_members','no_one'].includes(t.fallthrough??'no_one'))throw new Error('Choose a team, member or issue owners');
 if(t.type==='issue_owners'?t.id!==undefined:typeof t.id!=='string'||!t.id||t.id.length>100||scrub(t.id)!==t.id)throw new Error('Choose an authorized project target');
 return {label:input.label.trim(),type:t.type,id:t.id??null,fallthrough:t.fallthrough??'no_one'};
}
export async function resolveTarget(env:AlertEnvironment,project:string,d:TargetDestination):Promise<Recipient[]>{
 const members=(await s(env.DB,authorizedMembers,project).all<Recipient>()).results;
 let chosen:Recipient[]=[];
 if(d.targetType==='team'&&await s(env.DB,'SELECT 1 FROM spool_project_teams WHERE project=? AND team=?',project,d.target).first())chosen=members;
 if(d.targetType==='member')chosen=members.filter(m=>m.member===d.target);
 // Assignment is an operator label, not a verified member identity. Until native
 // ownership rules exist it cannot authorize mail: use the explicit fallthrough.
 const fallback=!chosen.length&&d.fallthrough==='active_members';
 return (fallback?members:chosen).map(({member,email})=>({member,email,reason:fallback?'no authorized target; active project members':d.targetType}));
}
export async function keptRecipients(env:AlertEnvironment,intent:Pick<Intent,'id'|'project'>):Promise<Recipient[]|null>{
 const row=await s(env.DB,'SELECT recipients FROM alert_intent_recipients WHERE intent=? AND project=?',intent.id,intent.project).first<{recipients:string}>();
 return row?JSON.parse(row.recipients):null;
}
export async function intentRecipients(env:AlertEnvironment,intent:Intent,d:TargetDestination,time:number){
 let rows=await keptRecipients(env,intent);
 if(rows===null){
  const recipients=await resolveTarget(env,intent.project,d);
  await s(env.DB,`INSERT INTO alert_intent_recipients SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM alert_intents i JOIN alert_rules r ON r.id=i.rule_id AND r.project=i.project AND r.revision=i.rule_revision AND r.enabled=1 WHERE i.id=? AND i.project=? AND i.destination=? AND i.state IN ('pending','blocked') AND i.code IS NOT 'retention_removed') AND NOT EXISTS(SELECT 1 FROM json_each(?) candidate WHERE NOT EXISTS(SELECT 1 FROM (${authorizedMembers}) eligible WHERE eligible.member=json_extract(candidate.value,'$.member') AND eligible.email=json_extract(candidate.value,'$.email'))) ON CONFLICT(intent) DO NOTHING`,intent.id,intent.project,JSON.stringify(recipients),time,intent.id,intent.project,d.id,JSON.stringify(recipients),intent.project).run();
  rows=await keptRecipients(env,intent);
 }
 if(!rows?.length)throw new Error('no_recipients');
 await authorizeRecipients(env,intent.project,rows);
 return rows;
}
export async function authorizeRecipients(env:AlertEnvironment,project:string,rows:Recipient[]){
 const current=(await s(env.DB,authorizedMembers,project).all<Recipient>()).results;
 if(rows.some(row=>!current.some(member=>member.member===row.member&&member.email===row.email)))throw new Error('recipient_authority_changed');
}
