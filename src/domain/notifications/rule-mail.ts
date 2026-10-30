import { s } from '../operators/common';
import { hash,token } from '../privacy';
import type { AlertEnvironment } from '../alerts/types';
import { personalBatch } from './delivery';

/** A configured team mailbox stays a rule destination. A native person's
 * mailbox additionally obeys their current personal choice and membership. */
export async function personalRuleRecipient(env:AlertEnvironment,intent:any,email:string) {
 const prior=await s(env.DB,'SELECT personal_operator,personal_member_version,personal_operator_version FROM alert_mail_jobs WHERE id=?',intent.id).first<any>();
 const row=await s(env.DB,`SELECT o.id operator_id,o.email,o.version operator_version,m.id member,m.version member_version,m.state,m.role,o.role native_role,o.status,
 p.email preferences,p.actor_label FROM spool_members m JOIN oa_operators o ON o.id=m.operator_id
 LEFT JOIN spool_notification_preferences p ON p.operator_id=o.id AND p.project=? AND p.historical=0
 WHERE lower(m.email)=lower(?) ${prior?.personal_operator?'AND o.id=?':''} ORDER BY m.created DESC LIMIT 1`,intent.project,email,...prior?.personal_operator?[prior.personal_operator]:[]).first<any>();
 if(!row){if(prior?.personal_operator)throw new Error('personal_recipient_unavailable');return null;}
 const allowed=await s(env.DB,`SELECT 1 FROM spool_project_teams t WHERE t.project=? AND EXISTS(SELECT 1 FROM spool_members m WHERE m.id=? AND m.organization=t.organization AND
 (m.role='admin' OR ?='owner' OR m.role IN('member','read-only') AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=t.project)))`,intent.project,row.member,row.native_role).first();
 if(!allowed||row.state!=='active'||row.status!=='active'||prior?.personal_operator&&(prior.personal_member_version!==row.member_version||prior.personal_operator_version!==row.operator_version))throw new Error('personal_recipient_unavailable');
 const mandatory=!!await s(env.DB,'SELECT 1 FROM spool_personal_rule_settings WHERE project=? AND rule_id=? AND mandatory=1 AND historical=0',intent.project,intent.rule_id).first();
 if(!mandatory&&!JSON.parse(row.preferences??'{}').issue_alert)throw new Error('personal_opt_out');
 return {...row,mandatory};
}
export async function personalRuleMessage(env:AlertEnvironment,intent:any,email:string) {
 const recipient=await personalRuleRecipient(env,intent,email);if(!recipient)return null;
 const db=env.DB,alert=await s(db,'SELECT issue FROM alerts WHERE project=? AND id=?',intent.project,intent.alert_id).first<any>();if(!alert)throw new Error('personal_alert_unavailable');
 const existing=await s(db,"SELECT recipient_label FROM spool_personal_mail WHERE project=? AND source=? AND type='issue_alert' AND operator_id=? AND historical=0",intent.project,intent.alert_id,recipient.operator_id).first<any>();
 const alias=existing?.recipient_label??recipient.actor_label??(await s(db,"SELECT label FROM audit_actor_links WHERE owner_id=? AND kind IN('owner','member') AND project IS NULL LIMIT 1",recipient.operator_id).first<any>())?.label??'audit:'+crypto.randomUUID().replaceAll('-','');
 await personalBatch(env,intent.project,[s(db,`INSERT INTO spool_personal_mail(id,project,source,type,issue,operator_id,recipient_label,member_version,operator_version,state,created,updated,rule_delivery)
 VALUES(?,?,?,'issue_alert',?,?,?,?,?,'delegated',?,?,?) ON CONFLICT(project,source,type,recipient_label) DO UPDATE SET state='delegated',rule_delivery=excluded.rule_delivery WHERE spool_personal_mail.state='queued' OR spool_personal_mail.rule_delivery=excluded.rule_delivery`,crypto.randomUUID().replaceAll('-',''),intent.project,intent.alert_id,alert.issue,recipient.operator_id,alias,recipient.member_version,recipient.operator_version,Date.now(),Date.now(),intent.id)]);
 const delivery=await s(db,'SELECT id,rule_delivery FROM spool_personal_mail WHERE project=? AND source=? AND type=\'issue_alert\' AND recipient_label=?',intent.project,intent.alert_id,alias).first<any>();
 if(delivery?.rule_delivery!==intent.id)throw new Error('personal_already_routed');
 const stored=await s(db,'SELECT message FROM alert_mail_jobs WHERE id=?',intent.id).first<any>();
 if(stored){const text=JSON.parse(stored.message).text,at=text.indexOf('\nSettings:');if(at<0)throw new Error('personal_message_identity');return {recipient,text:text.slice(at)};}
 const raw=token(),origin=new URL(env.ALERT_PUBLIC_ORIGIN||env.AUTH_ORIGIN!);if(origin.protocol!=='https:'||origin.username||origin.password)throw new Error('personal_origin_unavailable');
 await personalBatch(env,intent.project,[s(db,'INSERT INTO spool_personal_unsubscribe VALUES(?,?,?,?,?,?,?,?)',await hash(raw),delivery.id,intent.project,recipient.operator_id,'issue_alert',recipient.member_version,recipient.operator_version,Date.now())]);
 return {recipient,text:`\nSettings: ${new URL('/projects/'+encodeURIComponent(intent.project)+'/settings',origin)}\nUnsubscribe from optional personal issue alerts: ${new URL('/notifications/unsubscribe/'+raw,origin)}${recipient.mandatory?'\nThis rule is mandatory under the organization administrator’s settings. Optional alerts can be stopped; ask an administrator to change mandatory delivery.':''}`};
}
