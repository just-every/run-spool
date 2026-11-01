import type { WireResponse, Outcome } from '../../modules/integrations/core/types';
import { retryAfter } from '../../modules/integrations/core/webhook';
import type { AlertEnvironment } from './types';
export const slackEndpoint = 'https://slack.com/api/chat.postMessage';
export type SlackDestination = { token?: string; channelId?: string };
export const slackSummary = (payload: any) => payload.test ? 'Spool TEST — destination check. No issue or alert was created.'+(payload.preparedBy?.label?` Prepared by ${payload.preparedBy.label}.`:'')+(payload.approvers?.length?` Approved by ${payload.approvers.map((p:any)=>p.name).join(', ')}.`:'') : `Spool ${String(payload.kind).replaceAll('_',' ')}: ${payload.title}\n${payload.issueUrl ?? 'Issue link unavailable: configure an HTTPS installation origin.'}`;
export function slackPayload(destination: SlackDestination, payload: any) {
 const text=slackSummary(payload);
 if (text.length>3500 || !destination.channelId || !destination.token) throw new Error('slack_configuration');
 return JSON.stringify({channel:destination.channelId,text,mrkdwn:false,parse:'none',unfurl_links:false,unfurl_media:false});
}
const knownErrors = new Set(['channel_not_found','invalid_auth','not_in_channel','missing_scope','is_archived','account_inactive','token_revoked','no_text','msg_too_long']);
export function slackOutcome(response: WireResponse, now: number): {outcome:Outcome;messageId?:string} {
 const status=response.status;
 if(status===429)return {outcome:{kind:'retryable',code:'slack_rate_limited',status,retryAfterMs:retryAfter(response,now)}};
 if(status<200||status>=300)return {outcome:{kind:status>=400&&status<500&&status!==408?'rejected':'uncertain',code:`slack_http_${status}`,status}};
 if(new TextEncoder().encode(response.body).byteLength>16384)return {outcome:{kind:'uncertain',code:'slack_response_too_large',status}};
 let value:any;try{value=JSON.parse(response.body)}catch{return {outcome:{kind:'uncertain',code:'slack_response_invalid',status}}}
 if(value.ok===true && typeof value.ts==='string' && /^\d{1,16}\.\d{1,10}$/.test(value.ts))return {outcome:{kind:'accepted',code:'slack_posted',status},messageId:value.ts};
 if(value.ok===false)return {outcome:{kind:'rejected',code:knownErrors.has(value.error)?'slack_'+value.error:'slack_api_error',status}};
 return {outcome:{kind:'uncertain',code:'slack_response_invalid',status}};
}
export async function sendSlack(env:AlertEnvironment,destination:SlackDestination,payload:any,now:()=>number) {
 if(!env.INTEGRATION_EGRESS)throw new Error('egress_unconfigured');
 const timeoutValue=Number(env.SLACK_TIMEOUT_MS??4000),timeout=Number.isFinite(timeoutValue)?Math.max(20,Math.min(10000,timeoutValue)):4000;
 let timer:ReturnType<typeof setTimeout>|undefined;
 try {
  const response=await Promise.race([env.INTEGRATION_EGRESS.send({url:slackEndpoint,headers:{'content-type':'application/json',authorization:`Bearer ${destination.token}`},body:slackPayload(destination,payload)}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('slack_timeout')),timeout)})]);
  return {response,...slackOutcome(response,now())};
 }finally{clearTimeout(timer)}
}
