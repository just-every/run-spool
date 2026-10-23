import { savedSlack } from './slack-destinations.server';
import { localDevelopmentEnabled } from '../../auth/local.server.mjs';
import { productionMailConfig } from '../../auth/mail.server.mjs';
import { validateConfig, parseAddress } from '../../modules/mail/src/core/validation.mjs';
import { identity, scrub } from '../privacy';
import { validateDestination } from '../../modules/integrations/core/destination';
import { hmac } from '../../modules/integrations/core/crypto';
import type { AlertEnvironment, Intent } from './types';
import { statement as s } from './types';
export type Destination = {id:string;project:string;label:string;channel:'mail'|'webhook';kind?:'slack';token?:string;channelId?:string;url?:string;key?:string;recipient?:string;editable?:boolean};
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
export async function findDestination(env:AlertEnvironment,project:string,id:string,channel:string) {
 const slack=channel==='webhook'?await savedSlack(env,project,id):null;if(slack)return slack;
 const saved=channel==='mail'?await s(env.DB,'SELECT id,project,label,recipient FROM alert_destinations WHERE project=? AND id=?',project,id).first<any>():null;
 const found=saved?{...saved,channel:'mail' as const,editable:true}:destinations(env).find(d=>d.id===id&&d.project===project&&d.channel===channel);if(!found)throw new Error('destination_unconfigured');return found;
}
export async function authorizedDestination(env:AlertEnvironment,intent:Intent) {
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
 const rows:Destination[]=[...slack.map(d=>({...d,project,kind:'slack' as const,channel:'webhook' as const,editable:true})),...destinations(env).filter(d=>d.project===project),...saved.map(d=>({...d,project,channel:'mail' as const,editable:true}))];
 const tests=(await s(env.DB,'SELECT * FROM alert_destination_tests WHERE project=?',project).all<any>()).results;
 return Promise.all(rows.map(async d=>{const privateDestination=d.kind==='slack'?await savedSlack(env,project,d.id):d;const fingerprint=hashConfigured?await destinationFingerprint(env,privateDestination!):null;return ({id:d.id,label:d.label,channel:d.channel,editable:!!d.editable,...(d.kind==='slack'?{kind:'slack',channelId:d.channelId,tokenSaved:true}:d.editable?{recipient:d.recipient}:{}),test:tests.find(t=>t.destination===d.id&&t.fingerprint===fingerprint)??null,configured:hashConfigured&&(d.channel==='webhook'?!!env.INTEGRATION_EGRESS:mailConfigured)}); }));
}

export const destinationFingerprint = (env:AlertEnvironment,d:Destination) => destinationHash(env,JSON.stringify(d.kind==='slack'?['slack',d.channelId,d.token]:[d.channel,d.recipient??d.url,d.key??null,env.MAIL_PROVIDER??null,env.MAIL_FROM??null]));
