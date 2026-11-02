export interface FieldRef { parent: Record<string, unknown> | unknown[]; key: string | number; path: string }

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const at = (parent: Record<string, unknown> | unknown[], key: string | number, path: string): FieldRef => ({parent,key,path});
const field = (value: unknown, key: string, path: string): FieldRef[] => object(value) && Object.prototype.hasOwnProperty.call(value,key) ? [at(value,key,path)] : [];
const values = (value: unknown): unknown[] => Array.isArray(value) ? value : object(value) && Array.isArray(value.values) ? value.values : [];
const roots = (doc: unknown): Record<string, unknown>[] => {
 const root = object(doc) ? doc : null;
 return root ? [root,...(object(root.sentry) ? [root.sentry] : [])] : [];
};
const entries = (value: unknown, prefix: string): FieldRef[] => object(value) ? Object.keys(value).map(key=>at(value,key,`${prefix}.${key}`)) : Array.isArray(value) ? value.flatMap(pair=>Array.isArray(pair)&&pair.length===2&&typeof pair[0]==='string'?[at(pair,1,`${prefix}.${pair[0]}`)]:[]) : [];
const matchKey = (value: unknown, name: string, prefix: string): FieldRef[] => entries(value,prefix).filter(ref=>ref.path.slice(prefix.length+1).toLowerCase()===name.toLowerCase());
// Resolve from the original object so the returned reference can be mutated.
function resolvePath(value: unknown, prefix: string, path: string): FieldRef[] {
 const exact=matchKey(value,path,prefix);
 if(exact.length)return exact;
 let current:{value:unknown;prefix:string}[]=[{value,prefix}];
 const parts=path.split('.');
 for(let i=0;i<parts.length;i++){
  const part=parts[i]; const last=i===parts.length-1;
  if(part==='**') return current.flatMap(item=>entries(item.value,item.prefix));
  if(last)return current.flatMap(item=>matchKey(item.value,part,item.prefix));
  current=current.flatMap(item=>matchKey(item.value,part,item.prefix).map(ref=>({value:(ref.parent as any)[ref.key],prefix:ref.path})));
 }
 return [];
}
function stacks(root:Record<string,unknown>,prefix:string):{value:unknown;prefix:string}[]{
 const result:{value:unknown;prefix:string}[]=[];
 const add=(stack:unknown,path:string)=>{if(object(stack))result.push({value:stack,prefix:path})};
 const p=prefix?`${prefix}.`:'';
 add(root.stacktrace,`${p}stacktrace`);
 for(const [name,source] of [['exceptions',root.exceptions],['threads',root.threads]] as const){
  for(const [i,item] of values(source).entries())if(object(item))add(item.stacktrace,`${p}${name}.${i}.stacktrace`);
 }
 for(const [i,item] of values(root.exception).entries())if(object(item))add(item.stacktrace,`${p}exception.${i}.stacktrace`);
 return result;
}
function frames(doc:unknown):{value:Record<string,unknown>;prefix:string}[]{
 const result:{value:Record<string,unknown>;prefix:string}[]=[];
 for(const [i,root] of roots(doc).entries()){
  const prefix=i?'sentry':'';
  for(const [j,frame] of values(root.frames).entries())if(object(frame))result.push({value:frame,prefix:`${prefix?`${prefix}.`:''}frames.${j}`});
  for(const stack of stacks(root,prefix))for(const [j,frame] of values(stack.value && (stack.value as any).frames).entries())if(object(frame))result.push({value:frame,prefix:`${stack.prefix}.frames.${j}`});
 }
 return result;
}
function aliases(doc:unknown):FieldRef[]{
 const result:FieldRef[]=[];
 for(const [i,root] of roots(doc).entries()){
  const p=i?'sentry.':'';
  result.push(...field(root,'message',`${p}message`));
  if(object(root.logentry))for(const key of ['message','formatted'])result.push(...field(root.logentry,key,`${p}logentry.${key}`));
 }
 return result;
}
export function selectorFields(doc:unknown,selector:string):FieldRef[]{
 const out:FieldRef[]=[];
 const add=(refs:FieldRef[])=>out.push(...refs);
 if(selector==='$message')add(aliases(doc));
 else if(selector==='$exception.value')for(const [i,root] of roots(doc).entries()){
  const p=i?'sentry.':'';
  for(const [j,e] of values(root.exceptions).entries())add(field(e,'value',`${p}exceptions.${j}.value`));
  for(const [j,e] of values(root.exception).entries())add(field(e,'value',`${p}exception.${j}.value`));
 }
 else if(selector.startsWith('$frame.'))for(const frame of frames(doc)){
  const tail=selector.slice(7);
  if(tail==='context')for(const key of ['pre_context','context_line','post_context']){
   const lines=frame.value[key];
   if(Array.isArray(lines)){
    for(const [index,line] of lines.entries())if(typeof line==='string')add([at(lines,index,`${frame.prefix}.${key}.${index}`)]);
   }else add(field(frame.value,key,`${frame.prefix}.${key}`));
  }
  else if(tail.startsWith('vars.'))add(resolvePath(frame.value.vars,`${frame.prefix}.vars`,tail.slice(5)));
 }
 else {
  const match=/^\$(request\.headers|logentry|extra|contexts|tags|breadcrumbs|user|log\.attributes)\.(.+)$/.exec(selector);
  if(match){const [,section,key]=match;
   for(const [i,root] of roots(doc).entries()){
    const p=i?'sentry.':'';
    if(section==='breadcrumbs')for(const [j,crumb] of values(root.breadcrumbs).entries()){
      if(key==='message'){
       if(typeof crumb==='string'&&Array.isArray(root.breadcrumbs))add([at(root.breadcrumbs,j,`${p}breadcrumbs.${j}`)]);
       else add(field(crumb,'message',`${p}breadcrumbs.${j}.message`));
      }
      else if(key.startsWith('data.'))add(resolvePath(object(crumb)?crumb.data:undefined,`${p}breadcrumbs.${j}.data`,key.slice(5)));
    }
    else if(section==='logentry'){const params=object(root.logentry)?root.logentry.params:undefined;if(key==='params'&&Array.isArray(params))for(const [index] of params.entries())add([at(params,index,`${p}logentry.params.${index}`)]);else add(resolvePath(root.logentry,`${p}logentry`,key));}
    else if(section==='request.headers')add(resolvePath(object(root.request)?root.request.headers:undefined,`${p}request.headers`,key));
    else if(section==='log.attributes'){add(resolvePath(object(root.log)?root.log.attributes:root.attributes,`${p}${object(root.log)?'log.':''}attributes`,key));if(object(root.extra))add(resolvePath(root.extra.log_attributes,`${p}extra.log_attributes`,key));}
    else add(resolvePath(root[section],`${p}${section}`,key));
   }
  }
 }
 const seen=new Map<FieldRef['parent'],Set<FieldRef['key']>>();
 return out.filter(ref=>{
  let keys=seen.get(ref.parent);
  if(!keys){keys=new Set();seen.set(ref.parent,keys)}
  if(keys.has(ref.key))return false;
  keys.add(ref.key);return true;
 });
}

export function namedFields(doc:unknown,name:string):FieldRef[]{
 const out:FieldRef[]=[];const lower=name.toLowerCase();
 const visit=(value:unknown,path:string,depth:number)=>{
  if(depth>24)return;
  if(Array.isArray(value)){value.forEach((v,i)=>{if(Array.isArray(v)&&v.length===2&&typeof v[0]==='string'){const p=path?`${path}.${v[0]}`:v[0];if(v[0].toLowerCase()===lower)out.push(at(v,1,p));visit(v[1],p,depth+1)}else visit(v,`${path}.${i}`,depth+1)});return}
  if(!object(value))return;
  for(const key of Object.keys(value)){
   const p=path?`${path}.${key}`:key;
   if(key.toLowerCase()===lower)out.push(at(value,key,p));
   visit(value[key],p,depth+1);
  }
 };visit(doc,'',0);return out;
}

export const isSelector = (value:string):boolean => /^\$(?:message|exception\.value|frame\.(?:context|vars\.(?:\*\*|[\w-]+(?:\.[\w-]+)*))|(?:request\.headers|extra|contexts|tags|user|log\.attributes|logentry)\.[\w-]+(?:\.[\w-]+)*|breadcrumbs\.(?:message|data\.[\w-]+(?:\.[\w-]+)*))$/.test(value);
export const identityField = (path:string):boolean => /^(?:release|build|environment|eventId|event_id|id|status|version|sentry\.(?:release|dist|environment|event_id|id|status|version))$/i.test(path);
