import { ruleConfig } from './filters';
import { scrub } from '../privacy';
import type { AlertEnvironment } from './types';
export function ruleInput(input:unknown,env:AlertEnvironment,project:string,editing:boolean) {
 const b=input as any,fields=['name','enabled','channel','destination','kinds','windowMs','threshold',...(editing?['revision']:[])];
 if(!b||typeof b!=='object'||Array.isArray(b)||fields.some(k=>!(k in b))||Object.keys(b).some(k=>![...fields,'config','previewToken'].includes(k)))throw new Error('Invalid alert rule fields');
 if(typeof b.name!=='string'||!b.name.trim()||b.name.length>100||scrub(b.name)!==b.name||typeof b.enabled!=='boolean'||!['mail','webhook'].includes(b.channel)||typeof b.destination!=='string')throw new Error('Invalid alert rule');
 if(!Array.isArray(b.kinds)||!b.kinds.length||b.kinds.length>4||new Set(b.kinds).size!==b.kinds.length||b.kinds.some((k:unknown)=>!['new_issue','regression','reactivation','spike'].includes(k as string)))throw new Error('Invalid alert event selection');
 if(!Number.isSafeInteger(b.windowMs)||b.windowMs<60000||b.windowMs>86400000||b.windowMs%60000||!Number.isSafeInteger(b.threshold)||b.threshold<2||b.threshold>10000||editing&&(!Number.isSafeInteger(b.revision)||b.revision<1))throw new Error('Invalid alert window or revision');
 // Destination authority is checked asynchronously by the owner route.
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(b.destination))throw new Error('Invalid destination identity');
 const config=ruleConfig(b.config);if(config.metric==='session_percent'&&b.threshold>100)throw new Error('Session percent threshold must be at most 100');
 return {...b,config:JSON.stringify(config),kinds:JSON.stringify([...b.kinds].sort())};
}
