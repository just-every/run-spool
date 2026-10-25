import {ScrubbingRefusal,refusalCode} from './refusal';
import type {ScrubbingPolicy,ScrubbingRule} from './policy';
import {patternMatches} from './patterns';
import {identityField,namedFields,selectorFields,type FieldRef} from './selectors';

type Result<T>={document:T;matches:{selector:string;fields:number}[];fields:{path:string;selector:string;method:ScrubbingRule['method']}[]};
const secretName=/^(?:password|passwd|pwd|secret|api[_-]?key|auth(?:orization)?[_-]?token|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret)$/i;
const value=(ref:FieldRef):unknown=>(ref.parent as any)[ref.key];
const present=(ref:FieldRef):boolean=>Object.prototype.hasOwnProperty.call(ref.parent,ref.key);
const refs=(doc:unknown,selector:string):FieldRef[]=>selector.startsWith('$')?selectorFields(doc,selector):namedFields(doc,selector);
const comparable=(input:unknown):string=>typeof input==='string'?input:JSON.stringify(input)??String(input);

function messageAliases(doc:unknown):FieldRef[]{
 const out=selectorFields(doc,'$message');
 // Native message can be derived from an exception value. Preserve the same
 // redaction across both copies when their original text is identical.
 out.push(...selectorFields(doc,'$exception.value'));
 return out;
}
function withAliases(doc:unknown,ref:FieldRef):FieldRef[]{
 if(!/^(?:message$|sentry\.message$|(?:sentry\.)?logentry\.(?:message|formatted)$|(?:sentry\.)?(?:exceptions|exception)\.)/.test(ref.path))return [ref];
 const text=value(ref);
 if(typeof text!=='string')return [ref];
 return [...new Map([ref,...messageAliases(doc).filter(other=>value(other)===text)].map(item=>[item.path,item])).values()];
}
async function transform(doc:unknown,ref:FieldRef,method:ScrubbingRule['method'],replacement:string|undefined,hashValue:(value:string)=>Promise<string>,preview:boolean):Promise<FieldRef[]>{
 const group=withAliases(doc,ref).filter(present).filter(item=>!identityField(item.path));
 if(!group.length)return [];
 const old=value(ref);
 const next=preview?'[matched]':method==='mask'?'[redacted]':method==='replace'?replacement:method==='hash'?await hashValue(comparable(old)):undefined;
 for(const item of group){
  if(method==='remove'){
   if(Array.isArray(item.parent)) (item.parent as unknown[]).splice(Number(item.key),1);
   else if(item.path==='message') (item.parent as Record<string,unknown>)[item.key as string]='';
   else delete (item.parent as Record<string,unknown>)[item.key as string];
  }else (item.parent as any)[item.key]=next;
 }
 return group;
}
export async function applyScrubbingDocument<T>(document:T,installation:ScrubbingPolicy,project:ScrubbingPolicy,hashValue:(value:string)=>Promise<string>,options?:{preview?:boolean}):Promise<Result<T>> {
 const cloned=structuredClone(document);
 const counts=new Map<string,Set<string>>(),fields=new Map<string,{path:string;selector:string;method:ScrubbingRule['method']}>();
 const protectedPaths=new Set<string>();
 const preview=options?.preview===true;
 const protectedOverlap=(path:string)=>[...protectedPaths].some(existing=>path===existing||path.startsWith(`${existing}.`)||existing.startsWith(`${path}.`));
 const record=(selector:string,changed:FieldRef[],protect:boolean,method:ScrubbingRule['method']='mask')=>{
  if(!changed.length)return;
  let paths=counts.get(selector);if(!paths){paths=new Set();counts.set(selector,paths)}
  for(const ref of changed){paths.add(ref.path);fields.set(ref.path,{path:ref.path,selector,method});if(protect)protectedPaths.add(ref.path)}
 };
 const applyField=async(selector:string,policy:ScrubbingPolicy,protect:boolean)=>{
  const safe=new Set(policy.safeFields.flatMap(field=>refs(cloned,field).map(ref=>ref.path)));
  for(const ref of refs(cloned,selector)){
   if(!present(ref)||identityField(ref.path)||safe.has(ref.path)||!protect&&protectedOverlap(ref.path))continue;
   record(selector,await transform(cloned,ref,'mask',undefined,hashValue,preview),protect);
  }
 };
 const applyRule=async(rule:ScrubbingRule,protect:boolean)=>{
  // Reverse array-indexed references so removing several context lines does
  // not shift later references before they are visited.
  for(const ref of selectorFields(cloned,rule.selector).reverse()){
   if(!present(ref)||identityField(ref.path)||!protect&&protectedOverlap(ref.path))continue;
   try{if(!patternMatches(comparable(value(ref)),rule.pattern,rule.regex))continue}catch(error){throw new ScrubbingRefusal(refusalCode(error),{kind:'rule',ruleId:rule.id})}
   record(rule.selector,await transform(cloned,ref,rule.method,rule.replacement,hashValue,preview),protect,rule.method);
  }
 };
 // Default named-secret protection is independent of either policy's safe list.
 const defaultPaths=new Set<string>();
 const scan=(node:unknown,path:string,depth:number)=>{
  if(depth>24)return;
  if(Array.isArray(node)){node.forEach((part,i)=>scan(part,`${path}.${i}`,depth+1));return}
  if(!node||typeof node!=='object')return;
  for(const [key,part] of Object.entries(node)){
   const current=path?`${path}.${key}`:key;
   if(secretName.test(key)&&!identityField(current))defaultPaths.add(key);
   scan(part,current,depth+1);
  }
 };
 // Complete each scope before the next. Methods see original values; stronger
 // additional/default masking still applies to every field that remains.
 for(const rule of installation.rules)await applyRule(rule,true);
 for(const selector of installation.sensitiveFields)await applyField(selector,installation,true);
 for(const rule of project.rules)await applyRule(rule,false);
 for(const selector of project.sensitiveFields)await applyField(selector,project,false);
 scan(cloned,'',0);
 for(const name of defaultPaths){
  for(const ref of namedFields(cloned,name))if(present(ref)&&!identityField(ref.path))record(name,await transform(cloned,ref,'mask',undefined,hashValue,preview),true);
 }
 return {document:cloned,fields:[...fields.values()],matches:[...counts].map(([selector,paths])=>({selector,fields:paths.size}))};
}
