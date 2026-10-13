import { scrub } from '../privacy';
import { findDestination } from './destinations.server';
import type { AlertEnvironment } from './types';
export function ruleInput(input:unknown,env:AlertEnvironment,project:string,editing:boolean) {
 const b=input as any,fields=['name','enabled','channel','destination','kinds','windowMs','threshold',...(editing?['revision']:[])];
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).length!==fields.length||Object.keys(b).some(k=>!fields.includes(k)))throw new Error('Invalid alert rule fields');
 if(typeof b.name!=='string'||!b.name.trim()||b.name.length>100||scrub(b.name)!==b.name||typeof b.enabled!=='boolean'||!['mail','webhook'].includes(b.channel)||typeof b.destination!=='string')throw new Error('Invalid alert rule');
 if(!Array.isArray(b.kinds)||!b.kinds.length||b.kinds.length>3||new Set(b.kinds).size!==b.kinds.length||b.kinds.some((k:unknown)=>!['new_issue','regression','spike'].includes(k as string)))throw new Error('Invalid alert event selection');
 if(!Number.isSafeInteger(b.windowMs)||b.windowMs<60000||b.windowMs>86400000||b.windowMs%60000||!Number.isSafeInteger(b.threshold)||b.threshold<2||b.threshold>10000||editing&&(!Number.isSafeInteger(b.revision)||b.revision<1))throw new Error('Invalid alert window or revision');
 // Even disabled writes select only this project's deployment-owned destination.
 if(b.enabled||!editing)findDestination(env,project,b.destination,b.channel);
 else if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(b.destination))throw new Error('Invalid destination identity');
 return {...b,kinds:JSON.stringify([...b.kinds].sort())};
}
