import { Field } from '../workbench/shared';
export const issueTagOps=['eq','ne','contains','not_contains','starts_with','ends_with','is_set','not_set'];
export function TagFilters({keys,tags,ops=issueTagOps,disabled,onChange}:{keys:string[];tags:Record<string,any>;ops?:string[];disabled:boolean;onChange:(tags:Record<string,any>)=>void}){
 return <>{keys.map(key=>{const match=tags[key],op=typeof match==='object'?match.op:'eq',value=typeof match==='object'?match.value??'':match??'';return <div className="form-grid" key={key}>
 <label className="form-field">{key} comparison<select aria-label={`${key} comparison`} value={op} disabled={disabled} onChange={e=>onChange({...tags,[key]:{op:e.target.value,...['is_set','not_set'].includes(e.target.value)?{}:{value}}})}>{ops.map(o=><option key={o} value={o}>{o.replaceAll('_',' ')}</option>)}</select></label>
 {!['is_set','not_set'].includes(op)&&<Field label={`Tag ${key}`} value={value} disabled={disabled} placeholder="Any value" onChange={e=>onChange({...tags,[key]:{op,value:e.target.value}})}/>}
 </div>})}</>;
}
