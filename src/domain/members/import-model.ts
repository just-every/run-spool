import { canonicalJson, sha256 } from '../../modules/import-kit/src/provenance/identity';
import { normalizeEmail } from '../../modules/operator-auth/policy.mjs';
import { sourceText } from '../sentry-import/source';

export const proposalColumns=['id','project','kind','payload','state','version','created'];
export const proposalId=(organization:string,kind:string,id:string)=>sha256(canonicalJson(['sentry',organization,kind,id]));
export const timestamp=(value:unknown)=>{const n=typeof value==='string'?Date.parse(value):NaN;if(!Number.isSafeInteger(n)||n<0)throw new Error('Source timestamp required');return n};
export function rosterRole(role:unknown):{role:string;projectRole:string|null;notice:string} {
 switch(role){
  case 'owner':return {role:'admin',projectRole:null,notice:'Source owner maps to admin only. Installation ownership and verification are never imported.'};
  case 'admin':return {role:'admin',projectRole:null,notice:'Organization admin requires separate owner approval.'};
  case 'manager':return {role:'member',projectRole:'maintainer',notice:'Manager maps only to explicit project maintainer scopes.'};
  case 'billing':return {role:'billing',projectRole:null,notice:'Billing has no project grants.'};
  case 'member':return {role:'member',projectRole:'member',notice:'Only exported team project scopes are proposed.'};
  default:throw new Error('Unsupported source organization role: '+sourceText(role,'organization role')+'; no native authority proposed');
 }
}
export function memberIdentity(data:any){
 const email=normalizeEmail(data.email),name=sourceText(data.name,'member name');
 if(typeof data.pending!=='boolean'||typeof data.expired!=='boolean')throw new Error('Source pending and expired flags required');
 return {email,name,sourceState:data.expired?'expired':data.pending?'pending':'active',sourceCreated:timestamp(data.dateCreated),...rosterRole(data.orgRole)};
}
// Preview only: bounded glob matching, with source order as a deterministic
// proposal precedence. Unsupported schema/matchers remain explicitly unresolved.
export function ownershipPreview(value:any,samples:any[]) {
 const schema=value?.schema,rules=Array.isArray(schema?.rules)?schema.rules:[];
 const supported=(rule:any)=>schema?.$version===1&&['path','url','tags.environment'].includes(rule?.matcher?.type)&&typeof rule.matcher.pattern==='string'&&Array.isArray(rule.owners);
 const glob=(pattern:string,text:string)=>new RegExp('^'+pattern.split('*').map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$').test(text);
 return {enabled:false,precedence:'source-order-first-match-proposal',sourceRevision:value.lastUpdated??null,
  rules:rules.map((rule:any,index:number)=>({index,matcher:rule.matcher,owners:rule.owners,supported:supported(rule),reason:supported(rule)?null:'Unsupported schema or matcher; retained without activation.'})),
  samples:samples.map(sample=>{
   const matches=rules.flatMap((rule:any,index:number)=>supported(rule)&&typeof sample[rule.matcher.type]==='string'&&glob(rule.matcher.pattern,sample[rule.matcher.type])?[index]:[]);
   return {sample,matches,winner:matches[0]??null,overlap:matches.length>1,unmatched:matches.length===0};
  })};
}
