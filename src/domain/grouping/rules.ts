import { wildcardMatch } from '../filters/matcher.ts';
import { scrub } from '../scrub.ts';
import type { SentryEvidence, SentryFrame } from '../sentry/evidence-types.ts';

export interface GroupingPolicy { version:1; stack:string; fingerprint:string }
export interface GroupingSnapshot { revision:number; policy:GroupingPolicy }
type Matcher={key:string;pattern:string;negative:boolean};
export type StackRule={matchers:Matcher[];actions:string[];line:number};
export type FingerprintRule={matchers:Matcher[];values:string[];line:number};
export const emptyGroupingPolicy=():GroupingPolicy=>({version:1,stack:'',fingerprint:''});
const stackKeys=['stack.abs_path','stack.module','stack.package','stack.function','family'];
const fingerprintKeys=['error.type','error.value','message','level','logger','sdk.name','family'];
function matchers(text:string,stack:boolean):Matcher[]{
 const rows:Matcher[]=[];let remaining=text.trim();
 while(remaining){
  const token=/^(!?)([\w.]+):(?:"((?:[^"\\]|\\["\\])*)"|([^\s]+))(?:\s+|$)/.exec(remaining);
  if(!token)throw new Error('Expected field:pattern matchers (quote patterns containing spaces)');
  const key=token[2],pattern=token[3]===undefined?token[4]:token[3].replace(/\\(["\\])/g,'$1');
  if(!(stack?stackKeys.includes(key):fingerprintKeys.includes(key)||/^tags\.[\w.-]+$/.test(key))||!pattern)throw new Error(`Unsupported grouping matcher: ${key}`);
  rows.push({key,pattern,negative:token[1]==='!'});remaining=remaining.slice(token[0].length);
 }
 if(!rows.length||rows.length>10)throw new Error('Use 1 to 10 matchers per rule');
 return rows;
}
function lines(text:string){return text.split('\n').map((text,index)=>({text:text.trim(),line:index+1})).filter(r=>r.text&&!r.text.startsWith('#'));}
export function parseStackRules(text:string):StackRule[]{return lines(text).map(({text,line})=>{
 const match=/^(.*?)\s+((?:[+-](?:app|group)(?:\s+|$))+)$/.exec(text);
 if(!match)throw new Error(`Stack rule ${line}: expected +app, -app, +group or -group`);
 return {matchers:matchers(match[1],true),actions:match[2].trim().split(/\s+/),line};
});}
export function parseFingerprintRules(text:string):FingerprintRule[]{return lines(text).map(({text,line})=>{
 const at=text.indexOf('->');if(at<0)throw new Error(`Fingerprint rule ${line}: expected ->`);
 const values=text.slice(at+2).split(',').map(v=>v.trim().replace(/^"(.*)"$/,'$1'));
 if(!values.length||values.length>10||values.some(v=>!v||v.length>200||v.includes('{{')&&!/^\{\{\s*(default|error.type|error.value|message|level|logger)\s*\}\}$/.test(v)))throw new Error(`Fingerprint rule ${line}: invalid fingerprint value or substitution`);
 return {matchers:matchers(text.slice(0,at),false),values,line};
});}
export function validateGroupingPolicy(value:any):GroupingPolicy{
 if(!value||Object.keys(value).sort().join()!=='fingerprint,stack,version'||value.version!==1||typeof value.stack!=='string'||typeof value.fingerprint!=='string')throw new Error('Expected version 1, stack and fingerprint rules');
 for(const text of [value.stack,value.fingerprint])if(text.length>16000||lines(text).length>50||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(text)||scrub(text)!==text)throw new Error('Rules must be sanitized text, at most 50 lines and 16 KiB per kind');
 parseStackRules(value.stack);parseFingerprintRules(value.fingerprint);
 return {version:1,stack:value.stack,fingerprint:value.fingerprint};
}
export function validateGroupingSnapshot(value:any):GroupingSnapshot{
 if(!value||Object.keys(value).sort().join()!=='policy,revision'||!Number.isSafeInteger(value.revision)||value.revision<0)throw new Error('Invalid grouping snapshot');
 return {revision:value.revision,policy:validateGroupingPolicy(value.policy)};
}
function family(platform:string|undefined){return ['javascript','node','nodejs'].includes(platform??'javascript')?'javascript':['java','jvm'].includes(platform??'')?'java':platform??'javascript';}
function matches(rule:Matcher[],read:(key:string)=>string[]){return rule.every(m=>{const found=read(m.key).some(value=>wildcardMatch(value,m.pattern));return m.negative?!found:found});}
export function classifyFrame(frame:SentryFrame,platform:string|undefined,rules:StackRule[]){
 let inApp=frame.in_app!==false,group=true;const applied:number[]=[];
 for(const rule of rules)if(matches(rule.matchers,key=>[key==='family'?family(platform):key==='stack.abs_path'?frame.abs_path??frame.filename??'':key==='stack.function'?frame.function??frame.raw_function??frame.symbol??'':key==='stack.module'?frame.module??'':frame.package??''])){
  applied.push(rule.line);for(const action of rule.actions){if(action.endsWith('app'))inApp=action[0]==='+';else group=action[0]==='+';}
 }
 return {inApp,group,rules:applied};
}
export function fingerprintRule(sentry:SentryEvidence,rules:FingerprintRule[]){
 const read=(key:string):string[]=>key==='family'?[family(sentry.platform)]:key==='error.type'||key==='error.value'?sentry.exceptions.map(e=>e[key==='error.type'?'type':'value']??''):key==='message'?[sentry.message??sentry.logentry?.formatted??sentry.logentry?.message??'']:key==='sdk.name'?[String(sentry.sdk?.name??'')]:key.startsWith('tags.')?[sentry.tags?.[key.slice(5)]??'']:[String(sentry[key as 'level'|'logger']??'')];
 const rule=rules.find(rule=>matches(rule.matchers,read));
 return rule?{line:rule.line,values:rule.values.map(v=>v.replace(/^\{\{\s*(error.type|error.value|message|level|logger)\s*\}\}$/,(_,key)=>read(key).filter(Boolean)[0]??''))}:null;
}
