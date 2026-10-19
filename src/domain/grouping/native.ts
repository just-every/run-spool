import type { Envelope } from '../privacy';
import { classifyFrame, fingerprintRule, parseFingerprintRules, parseStackRules } from './rules.ts';

/** Native stacks are newest-first. Keep the first contributing frame and the v1
 * identity unless an explicit project rule changes its contribution. */
export function nativeGroupingInfo(event: Envelope) {
 const family=event.language??'javascript',algorithm=event.language?`${event.language}-frame-v1`:'js-frame-v1';
 const basisFor=(index:number)=>{const frame=event.frames[index];return JSON.stringify([...(event.language?[event.language]:[]),event.type,frame.file,frame.function,frame.line]);};
 const defaultBasis=basisFor(0),rules=parseStackRules(event.grouping?.policy.stack??'');
 const classified=event.frames.map(frame=>classifyFrame({filename:frame.file,function:frame.function,lineno:frame.line},family,rules));
 const hasApp=classified.some(frame=>frame.group&&frame.inApp);
 const selected=classified.findIndex(frame=>frame.group&&(!hasApp||frame.inApp));
 const stackBasis=selected<0?JSON.stringify(['native-rule-v1',family,event.type,event.message]):basisFor(selected);
 const projectRule=fingerprintRule({version:1,platform:family,exceptions:[{type:event.type,value:event.message}],message:event.message,truncation:[]},parseFingerprintRules(event.grouping?.policy.fingerprint??''));
 const isDefault=(value:string)=>/^\{\{\s*default\s*\}\}$/.test(value);
 const custom=!!projectRule&&!(projectRule.values.length===1&&isDefault(projectRule.values[0]));
 const replaces=custom&&!projectRule!.values.some(isDefault);
 const basis=custom?JSON.stringify(['native-fingerprint-v1',family,projectRule!.values.map(value=>isDefault(value)?stackBasis:value)]):stackBasis;
 const frames=classified.map((frame,index)=>({index,contributes:!replaces&&index===selected,inApp:frame.inApp,rules:frame.rules,reason:replaces?'Project fingerprint replaces native grouping':!frame.group?'hidden by a -group rule':hasApp&&!frame.inApp?'not in-app':index===selected?'first contributing native frame':'later native frame'}));
 return {algorithm,basis,defaultBasis,revision:event.grouping?.revision??0,projectFingerprintRule:projectRule?.line??null,variant:custom?'custom fingerprint':selected<0?'exception value':'native frame',frames,message:{contributes:!replaces&&selected<0},fingerprint:projectRule?.values??null};
}
