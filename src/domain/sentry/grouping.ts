import { classifyFrame,parseStackRules,parseFingerprintRules,fingerprintRule,type StackRule } from '../grouping/rules.ts';
import { bundleFile } from '../grouping-path.ts';
import type { SentryEvidence, SentryFrame } from './evidence-types.ts';
export interface FrameContribution { index:number; contributes:boolean; reason:string; inApp:boolean; hidden:boolean; rules:number[] }
export interface ExceptionContribution { index:number; type?:string; value?:string; valueContributes:boolean; reason:string; frames:FrameContribution[] }
export function tracebackHidden(frame:SentryFrame):boolean {
 const value=frame.vars?.__traceback_hide__;
 return value===true||value==='True'||value==='true';
}
function stackBasis(frames:SentryFrame[],platform?:string,rules:StackRule[]=[]){
 const classified=frames.map(frame=>classifyFrame(frame,platform,rules));
 const hasApp=frames.some((frame,index)=>!tracebackHidden(frame)&&classified[index].group&&classified[index].inApp);
 const contributions:FrameContribution[]=frames.map((frame,index)=>{
  const hidden=tracebackHidden(frame),{inApp,group,rules:applied}=classified[index],contributes=!hidden&&group&&(!hasApp||inApp);
  return {index,contributes,reason:hidden?'__traceback_hide__':!group?'hidden by a -group rule':!contributes?'not in-app':!hasApp?'no in-app frames; stack fallback':'in-app',inApp,hidden,rules:applied};
 });
 const basis=frames.flatMap((frame,index)=>{
  if(!contributions[index].contributes)return [];
  const path=frame.abs_path??frame.filename??'';
  return [[platform==='javascript'||platform==='node'||!platform?bundleFile(path):path,frame.module??'',frame.package??'',frame.function??frame.raw_function??frame.symbol??'',frame.lineno??null,...(!path?[frame.instruction_addr??null]:[])]];
 });
 return {basis,frames:contributions};
}
/** Pure grouping explanation for the owner event detail. No stored input is executed. */
export function sentryGroupingInfo(sentry:SentryEvidence){
 const stackRules=parseStackRules(sentry.grouping?.policy.stack??'');
 const ids=new Map(sentry.exceptions.map((e,index)=>[e.mechanism?.exception_id,index]));
 const exceptions:ExceptionContribution[]=[],chains:any[]=[];
 for(const [index,e] of sentry.exceptions.entries()){
  const stack=stackBasis(e.stacktrace?.frames??[],sentry.platform,stackRules),valueContributes=stack.basis.length===0;
  exceptions.push({index,type:e.type,value:e.value,valueContributes,reason:valueContributes?'no contributing frames; exception value':'exception type and stack; value excluded',frames:stack.frames});
  chains.push([e.type??'',valueContributes?e.value??'':null,stack.basis,e.mechanism?.is_exception_group===true,e.mechanism?.parent_id===undefined?null:ids.get(e.mechanism.parent_id)??null]);
 }
 const standalone=stackBasis(sentry.stacktrace?.frames??[],sentry.platform,stackRules);
 const template=sentry.logentry?.message??sentry.message??sentry.logentry?.formatted??'';
 let variant:'exception chain'|'stack'|'message'|'custom fingerprint'=sentry.exceptions.length?'exception chain':standalone.basis.length?'stack':'message';
 const defaultBasis=JSON.stringify(['sentry-chain-v1',sentry.platform??'javascript',variant,chains,standalone.basis,variant==='message'?template:null]);
 const projectRule=fingerprintRule(sentry,parseFingerprintRules(sentry.grouping?.policy.fingerprint??''));
 const fp=projectRule?.values??sentry.fingerprint?.filter(value=>value.length);
 const isDefault=(value:string)=>/^\{\{\s*default\s*\}\}$/.test(value);
 const custom=!!fp?.length&&!(fp.length===1&&isDefault(fp[0]));
 const basis=custom?JSON.stringify(['sentry-fingerprint-v1',fp!.map(value=>isDefault(value)?defaultBasis:value)]):defaultBasis;
 if(custom){variant='custom fingerprint';if(!fp!.some(isDefault))for(const e of exceptions){e.valueContributes=false;e.reason='Custom fingerprint replaces default grouping';e.frames=e.frames.map(f=>({...f,contributes:false,reason:'Custom fingerprint replaces default grouping'}));}}
 return {algorithm:'sentry-chain-v1' as const,revision:sentry.grouping?.revision??0,projectFingerprintRule:projectRule?.line??null,variant,basis,exceptions,stack:standalone.frames,message:{template,contributes:!custom&&!sentry.exceptions.length&&!standalone.basis.length},fingerprint:fp??null};
}
