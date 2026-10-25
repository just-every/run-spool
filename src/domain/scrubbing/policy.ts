import {isSelector} from './selectors';
import {safeRegex,type PatternName} from './patterns';

export interface ScrubbingRule {
 id:string; selector:string; pattern:PatternName; regex?:string;
 method:'remove'|'mask'|'hash'|'replace'; replacement?:string;
}
export interface ScrubbingPolicy {version:1; sensitiveFields:string[];safeFields:string[];rules:ScrubbingRule[]}
export const emptyScrubbingPolicy=():ScrubbingPolicy=>({version:1,sensitiveFields:[],safeFields:[],rules:[]});
const obj=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const field=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=128&&(value.startsWith('$')?isSelector(value):/^[\w-]+$/.test(value));
const overlap=(a:string,b:string):boolean=>{
 const x=a.toLowerCase(),y=b.toLowerCase();
 if(x===y)return true;
 const messageAlias=(s:string)=>['$message','$logentry.message','$logentry.formatted','$exception.value'].includes(s);
 if(messageAlias(x)&&messageAlias(y))return true;
 if(!x.startsWith('$')||!y.startsWith('$')){
  const name=x.startsWith('$')?y:x,selector=x.startsWith('$')?x:y;
  if(selector==='$frame.context'&&['pre_context','context_line','post_context'].includes(name))return true;
  if(selector==='$message'&&['message','formatted','value'].includes(name))return true;
  return selector.slice(1).split('.').includes(name)||selector.endsWith('.**');
 }
 return x.startsWith(`${y}.`)||y.startsWith(`${x}.`)||x.endsWith('.**')&&y.startsWith(x.slice(0,-2))||y.endsWith('.**')&&x.startsWith(y.slice(0,-2));
};
export function scrubbingPolicy(value:unknown,installation?:ScrubbingPolicy):ScrubbingPolicy {
 if(!obj(value)||value.version!==1||!Array.isArray(value.sensitiveFields)||!Array.isArray(value.safeFields)||!Array.isArray(value.rules))throw new Error('invalid_scrubbing_policy');
 if(Object.keys(value).some(key=>!['version','sensitiveFields','safeFields','rules'].includes(key)))throw new Error('invalid_scrubbing_policy');
 if(value.sensitiveFields.length+value.safeFields.length>40)throw new Error('scrubbing_field_limit');
 if(!value.sensitiveFields.every(field)||!value.safeFields.every(field))throw new Error('invalid_scrubbing_field');
 if(value.rules.length>20)throw new Error('scrubbing_rule_limit');
 const ids=new Set<string>();
 const rules=value.rules.map((raw:unknown)=>{
  if(!obj(raw)||Object.keys(raw).some(key=>!['id','selector','pattern','regex','method','replacement'].includes(key))||
   typeof raw.id!=='string'||!/^[\w-]{1,64}$/.test(raw.id)||ids.has(raw.id)||
   typeof raw.selector!=='string'||!isSelector(raw.selector)||
   !['credit_card','ip_address','email','password','auth_token','us_ssn','regex'].includes(String(raw.pattern))||
   !['remove','mask','hash','replace'].includes(String(raw.method)))throw new Error('invalid_scrubbing_rule');
  ids.add(raw.id);
  if(raw.pattern==='regex'){
   if(typeof raw.regex!=='string'||!raw.regex)throw new Error('regex_required');
   safeRegex(raw.regex);
  }else if(raw.regex!==undefined)throw new Error('regex_not_allowed');
  if(raw.method==='replace'){
   if(typeof raw.replacement!=='string'||raw.replacement.length>256)throw new Error('replacement_required');
  }else if(raw.replacement!==undefined)throw new Error('replacement_not_allowed');
  return raw as unknown as ScrubbingRule;
 });
 const result:ScrubbingPolicy={version:1,sensitiveFields:[...value.sensitiveFields],safeFields:[...value.safeFields],rules};
 if(installation){
  const protectedSelectors=[...installation.sensitiveFields,...installation.rules.map(rule=>rule.selector)];
  for(const safe of result.safeFields)if(protectedSelectors.some(protectedField=>overlap(safe,protectedField)))throw new Error('project_safe_conflicts_with_installation');
  for(const rule of result.rules)if(protectedSelectors.some(protectedField=>overlap(rule.selector,protectedField)))throw new Error('project_rule_conflicts_with_installation');
 }
 return result;
}
