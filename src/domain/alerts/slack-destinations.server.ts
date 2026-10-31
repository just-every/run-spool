import { ownerBatch, type OwnerSession } from '../owner-authority';
import { auditCommit } from '../audit/context';
import { scrub } from '../privacy';
import { statement as s, type AlertEnvironment } from './types';
export async function savedSlack(env:AlertEnvironment,project:string,id:string) {
 const row=await s(env.DB,'SELECT id,project,label,channel_id channelId,bot_token token FROM slack_destinations WHERE project=? AND id=?',project,id).first<any>();
 return row?{...row,kind:'slack' as const,channel:'webhook' as const,editable:true}:null;
}
export async function saveSlack(env:AlertEnvironment,session:OwnerSession,project:string,previous:string|undefined,input:any) {
 if(!input||Object.keys(input).sort().join()!=='channelId,kind,label,token'||input.kind!=='slack'||typeof input.label!=='string'||!input.label.trim()||input.label.length>100||scrub(input.label)!==input.label||/[\x00-\x1f\x7f]/.test(input.label)||typeof input.channelId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(input.channelId)||typeof input.token!=='string'||input.token.length<16||input.token.length>512||/[\s\x00-\x1f\x7f]/.test(input.token))throw new Error('Supply a Slack destination name, channel identifier and bot token (16–512 characters without whitespace)');
 if(previous&&!await savedSlack(env,project,previous))throw new Error('Slack destination not found');
 const id='ui-slack-'+crypto.randomUUID(),time=Date.now();
 const result=await ownerBatch(env.DB,session,[
  ...(previous?[s(env.DB,"INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM slack_destinations WHERE project=? AND id=?) THEN 1 ELSE 0 END",project,previous),s(env.DB,'DELETE FROM slack_destinations WHERE project=? AND id=? RETURNING id',project,previous)]:[]),
  s(env.DB,`INSERT INTO slack_destinations(id,project,label,channel_id,bot_token,created) SELECT ?,?,?,?,?,? ${previous?'WHERE changes()=1':''} RETURNING id`,id,project,input.label.trim(),input.channelId,input.token,time),
  ...(previous?retireSlack(env,project,previous,time,id):[]),auditCommit(env.DB,'EXISTS(SELECT 1 FROM slack_destinations WHERE project=? AND id=?)',project,id),
 ]);
 if(!result[previous?2:0].results.length)throw new Error('Slack destination changed; refresh');
 return {id,kind:'slack',tokenSaved:true};
}
function retireSlack(env:AlertEnvironment,project:string,previous:string,time:number,replacement?:string) {
 return [
  s(env.DB,"UPDATE alert_intents SET state='cancelled',code='rule_revised' WHERE project=? AND destination=? AND expanded=0 AND code IS NOT 'retention_removed'",project,previous),
  s(env.DB,`UPDATE alert_rules SET ${replacement?'destination=?,':''}enabled=0,revision=revision+1,updated=? WHERE project=? AND destination=?`,...replacement?[replacement]:[],time,project,previous),
  s(env.DB,'DELETE FROM alert_destination_tests WHERE project=? AND destination=?',project,previous),
  s(env.DB,"UPDATE follow_up_notices SET state='canceled',code='destination_retired' WHERE project=? AND destination=? AND channel='webhook' AND state='queued'",project,previous),
  s(env.DB,'DELETE FROM alert_cursors WHERE project=? AND rule_id IN(SELECT id FROM alert_rules WHERE project=? AND destination=?)',project,project,replacement??previous),
 ];
}
export async function revokeSlack(env:AlertEnvironment,session:OwnerSession,project:string,id:string) {
 if(!await savedSlack(env,project,id))throw new Error('Slack destination not found');
 await ownerBatch(env.DB,session,[s(env.DB,"INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM slack_destinations WHERE project=? AND id=?) THEN 1 ELSE 0 END",project,id),s(env.DB,'DELETE FROM slack_destinations WHERE project=? AND id=?',project,id),...retireSlack(env,project,id,Date.now()),auditCommit(env.DB)]);
 return {revoked:true};
}
