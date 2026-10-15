import { localDevelopmentEnabled } from '../../auth/local.server.mjs';
import { validateConfig, parseAddress } from '../../modules/mail/src/core/validation.mjs';
import { identity, scrub } from '../privacy';
import { validateDestination } from '../../modules/integrations/core/destination';
import { hmac } from '../../modules/integrations/core/crypto';
import type { AlertEnvironment, Intent } from './types';
import { statement as s } from './types';
type Destination = {id:string;project:string;label:string;channel:'mail'|'webhook';url?:string;key?:string;recipient?:string};
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
export function findDestination(env:AlertEnvironment,project:string,id:string,channel:string) {
 const found=destinations(env).find(d=>d.id===id&&d.project===project&&d.channel===channel);if(!found)throw new Error('destination_unconfigured');return found;
}
export async function authorizedDestination(env:AlertEnvironment,intent:Intent) {
 const allowed=await s(env.DB,'SELECT 1 FROM alert_rules WHERE project=? AND id=? AND revision=? AND enabled=1 AND channel=? AND destination=?',intent.project,intent.rule_id,intent.rule_revision,intent.channel,intent.destination).first();
 if(!allowed)throw new Error('rule_revoked');return findDestination(env,intent.project,intent.destination,intent.channel);
}
export async function destinationHash(env:AlertEnvironment,value:string) { return `hmac:${await hmac(keyBytes(env.ALERT_DESTINATION_HASH_KEY),value)}`; }
export function destinationChoices(env:AlertEnvironment,project:string) {
 let hashConfigured=false,mailConfigured=false;
 try {keyBytes(env.ALERT_DESTINATION_HASH_KEY);hashConfigured=true}catch{}
 try {
  parseAddress(env.MAIL_FROM);
  if(env.MAIL_PROVIDER==='development')mailConfigured=env.RER_DEMO==='1'||localDevelopmentEnabled(env);
  else {validateConfig({provider:env.MAIL_PROVIDER,mode:'production',apiKey:env.MAIL_API_KEY,...(env.MAIL_PROVIDER==='cloudflare'?{accountId:env.MAIL_ACCOUNT_ID}:{})});mailConfigured=true;}
 }catch{}
 return destinations(env).filter(d=>d.project===project).map(d=>({id:d.id,label:d.label,channel:d.channel,configured:hashConfigured&&(d.channel==='webhook'?!!env.INTEGRATION_EGRESS:mailConfigured)}));
}
