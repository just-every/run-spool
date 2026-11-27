import { targetChoices,type TargetDestination } from './targets';
import { savedSlack } from './slack-destinations.server';
import { localDevelopmentEnabled } from '../../auth/local.server.mjs';
import { productionMailConfig } from '../../auth/mail.server.mjs';
import { validateConfig, parseAddress } from '../../modules/mail/src/core/validation.mjs';
import { identity, scrub } from '../privacy';
import { validateDestination } from '../../modules/integrations/core/destination';
import { hmac } from '../../modules/integrations/core/crypto';
import type { AlertEnvironment, Intent } from './types';
import { statement as s } from './types';
export type Destination = TargetDestination | {id:string;project:string;label:string;channel:'mail'|'webhook';kind?:'slack';token?:string;channelId?:string;url?:string;key?:string;recipient?:string;editable?:boolean};
const label=/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/;
export function keyBytes(value?:string) {
 if(!value || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw new Error('destination_configuration');
 const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));if(bytes.length<32)throw new Error('destination_configuration');return bytes;
}
export function destinations(env:AlertEnvironment):Destination[] {
 try {
  const rows=JSON.parse(env.ALERT_DESTINATIONS??'[]');if(!Array.isArray(rows)||rows.length>200)throw 0;
  const ids=new Set();for(const row of rows){if(!row||Object.keys(row).some(k=>!['id','project','label','channel','url','key','recipient'].includes(k))||typeof row.id!=='string'||!label.test(row.id)||identity(row.project,'project')!==row.project||typeof row.label!=='string'||row.label.length>100||scrub(row.label)!==row.label||/[\x00-\x1f]/.test(row.label)||ids.has(row.id))throw 0;ids.add(row.id);
   if(row.channel==='webhook'){validateDestination(row.url);keyBytes(row.key);if(row.recipient!==undefined)throw 0}
   else if(row.channel==='mail'){if(typeof row.recipient!=='string'||parseAddress(row.recipient).email!==row.recipient||row.url!==undefined||row.key!==undefined)throw 0}
   else throw 0;
  }return rows;
 }catch{throw new Error('destination_configuration')}
}
function configuredDestination(env:AlertEnvironment,project:string,id:string,channel:string) {
 const found=destinations(env).find(d=>d.id===id&&d.project===project&&d.channel===channel);
 if(!found)throw new Error('destination_unconfigured');
 return found;
}

type MailDestinationLookup = {
 target_label:string|null; targetType:TargetDestination['targetType']; target:string|null; fallthrough:TargetDestination['fallthrough'];
 label:string; recipient:string|null;
};

async function findMailDestination(env:AlertEnvironment,project:string,id:string,rule?:Pick<Intent,'rule_id'|'rule_revision'>):Promise<Destination> {
 const row=await s(env.DB,`SELECT t.label target_label,t.target_type targetType,t.target,t.fallthrough,d.label,d.recipient
  FROM (SELECT ? project,? destination) scope
  LEFT JOIN alert_target_destinations t ON t.project=scope.project AND t.id=scope.destination
  LEFT JOIN alert_destinations d ON d.project=scope.project AND d.id=scope.destination
  ${rule?'WHERE EXISTS(SELECT 1 FROM alert_rules r WHERE r.project=scope.project AND r.id=? AND r.revision=? AND r.enabled=1 AND r.channel=\'mail\' AND r.destination=scope.destination)':''}`,
  project,id,...(rule?[rule.rule_id,rule.rule_revision]:[])).first<MailDestinationLookup>();
 if(!row)throw new Error('rule_revoked');
 if(row.target_label!==null)return {id,project,label:row.target_label,channel:'mail',kind:'target',targetType:row.targetType,target:row.target,fallthrough:row.fallthrough,editable:true};
 if(row.recipient!==null)return {id,project,label:row.label,recipient:row.recipient,channel:'mail',editable:true};
 return configuredDestination(env,project,id,'mail');
}

export async function findDestination(env:AlertEnvironment,project:string,id:string,channel:string) {
 if(channel==='mail')return findMailDestination(env,project,id);
 const slack=channel==='webhook'?await savedSlack(env,project,id):null;
 return slack??configuredDestination(env,project,id,channel);
}
export async function authorizedDestination(env:AlertEnvironment,intent:Intent) {
 if(intent.channel==='mail')return findMailDestination(env,intent.project,intent.destination,intent);
 const allowed=await s(env.DB,'SELECT 1 FROM alert_rules WHERE project=? AND id=? AND revision=? AND enabled=1 AND channel=? AND destination=?',intent.project,intent.rule_id,intent.rule_revision,intent.channel,intent.destination).first();
 if(!allowed)throw new Error('rule_revoked');return findDestination(env,intent.project,intent.destination,intent.channel);
}
export async function destinationHash(env:AlertEnvironment,value:string) { return `hmac:${await hmac(keyBytes(env.ALERT_DESTINATION_HASH_KEY),value)}`; }
export async function destinationChoices(env:AlertEnvironment,project:string) {
 let hashConfigured=false,mailConfigured=false;
 try {keyBytes(env.ALERT_DESTINATION_HASH_KEY);hashConfigured=true}catch{}
 try {
  parseAddress(env.MAIL_FROM);
  if(env.MAIL_PROVIDER==='development')mailConfigured=env.RER_DEMO==='1'||localDevelopmentEnabled(env);
  else {validateConfig(productionMailConfig(env));mailConfigured=true;}
 }catch{}
 const saved=(await s(env.DB,'SELECT id,label,recipient FROM alert_destinations WHERE project=? ORDER BY created,id',project).all<any>()).results;
 const slack=(await s(env.DB,'SELECT id,label,channel_id channelId FROM slack_destinations WHERE project=? ORDER BY created,id',project).all<any>()).results;
 const rows:Destination[]=[...await targetChoices(env,project),...slack.map(d=>({...d,project,kind:'slack' as const,channel:'webhook' as const,editable:true})),...destinations(env).filter(d=>d.project===project),...saved.map(d=>({...d,project,channel:'mail' as const,editable:true}))];
 const tests=(await s(env.DB,'SELECT * FROM alert_destination_tests WHERE project=?',project).all<any>()).results;
 return Promise.all(rows.map(async d=>{const privateDestination=d.kind==='slack'?await savedSlack(env,project,d.id):d;const fingerprint=hashConfigured?await destinationFingerprint(env,privateDestination!):null;return ({id:d.id,label:d.label,channel:d.channel,editable:!!d.editable,...(d.kind==='target'?{kind:'target',targetType:d.targetType,target:d.target,fallthrough:d.fallthrough}:d.kind==='slack'?{kind:'slack',channelId:d.channelId,tokenSaved:true}:d.editable?{recipient:d.recipient}:{}),test:tests.find(t=>t.destination===d.id&&t.fingerprint===fingerprint)??null,configured:hashConfigured&&(d.channel==='webhook'?!!env.INTEGRATION_EGRESS:mailConfigured)}); }));
}

export const destinationFingerprint = (env:AlertEnvironment,d:Destination) => destinationHash(env,JSON.stringify(d.kind==='target'?['target',d.targetType,d.target,d.fallthrough,env.MAIL_PROVIDER??null,env.MAIL_FROM??null]:d.kind==='slack'?['slack',d.channelId,d.token]:[d.channel,d.recipient??d.url,d.key??null,env.MAIL_PROVIDER??null,env.MAIL_FROM??null]));
