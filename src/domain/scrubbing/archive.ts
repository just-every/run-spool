import {scrubbingPolicy} from './policy';
import {policyId} from './model';
export const scrubbingTables={scrubbing_policies:['id','project','revision','policy','updated'],scrubbing_changes:['id','project','scope','revision','detail','created']};
export const scrubbingDefaults=(data:any)=>({scrubbing_policies:[],scrubbing_changes:[],...data});
export function validateScrubbingArchive(data:any){
 const ids=new Set<string>();
 for(const row of data.scrubbing_policies){
  if(row.id!==policyId(row.project)||ids.has(row.id)||!Number.isSafeInteger(row.revision)||row.revision<1||!Number.isSafeInteger(row.updated)||row.updated<0)throw new Error('Archive scrubbing policy');
  ids.add(row.id);const policy=scrubbingPolicy(JSON.parse(row.policy));if(JSON.stringify(policy)!==row.policy)throw new Error('Archive scrubbing policy encoding');
 }
 for(const row of data.audit.filter((r:any)=>r.kind==='scrubbing_policy_changed')){
  const detail=JSON.parse(row.detail);if(Object.keys(detail).sort().join()!=='revision,rules'||!Number.isSafeInteger(detail.revision)||detail.revision<1||!Array.isArray(detail.rules)||detail.rules.some((r:any)=>Object.keys(r).sort().join()!=='id,method,selector'||typeof r.id!=='string'||typeof r.selector!=='string'||!['remove','mask','hash','replace'].includes(r.method)))throw new Error('Archive scrubbing audit');
 }
 for(const row of data.scrubbing_changes){
  const detail=JSON.parse(row.detail);
  if(row.scope!==policyId(row.project)||!Number.isSafeInteger(row.revision)||row.revision<1||!Number.isSafeInteger(row.created)||row.created<0||!Array.isArray(detail.rules)||!Array.isArray(detail.sensitiveFields)||!Array.isArray(detail.safeFields)||Object.keys(detail).sort().join()!=='rules,safeFields,sensitiveFields')throw new Error('Archive scrubbing change');
  for(const rule of detail.rules)if(Object.keys(rule).sort().join()!=='id,method,selector'||typeof rule.id!=='string'||typeof rule.selector!=='string'||!['remove','mask','hash','replace'].includes(rule.method))throw new Error('Archive scrubbing change rule');
 }
}
