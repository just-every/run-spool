import {scrub} from '../privacy';
export function validateDecision(d:any){
 const require=(v:unknown)=>{if(!v)throw new Error('Invalid alert window decision')};
 require(d&&typeof d==='object'&&!Array.isArray(d)&&d.fired===true&&['count','users','session_percent','baseline'].includes(d.metric));
 const common=['start','end','issue','count','users','unattributed','threshold','metric','fired','reason'],extra=d.metric==='session_percent'?['denominator','affected','value']:d.metric==='baseline'?['baseline','value','denominator','sampleRate','history','excluded','loss']:[];
 require(Object.keys(d).sort().join()===[...common,...extra].sort().join());
 require(typeof d.reason==='string'&&d.reason.length<2000&&scrub(d.reason)===d.reason&&typeof d.issue==='string'&&/^[a-f0-9]{64}$/.test(d.issue));
 for(const key of ['start','end','count','users','unattributed','threshold','denominator','affected'])if(key in d)require(Number.isSafeInteger(d[key])&&d[key]>=0);
 require(d.end>d.start&&d.count>=d.users&&d.count>=d.unattributed);
 for(const key of ['baseline','value','sampleRate'])if(key in d)require(d[key]===null||typeof d[key]==='number'&&Number.isFinite(d[key])&&d[key]>=0);
 if(d.metric==='baseline'){
  require(Array.isArray(d.history)&&d.history.length<=8&&Array.isArray(d.excluded)&&d.excluded.length<=8&&Array.isArray(d.loss)&&d.loss.length<=100);
  for(const w of [...d.history,...d.excluded])require(Number.isSafeInteger(w.start)&&Number.isSafeInteger(w.end)&&w.end>w.start);
  for(const w of d.history)require(Object.keys(w).sort().join()==='end,rate,start'&&Number.isFinite(w.rate)&&w.rate>=0);
  for(const w of d.excluded)require(Object.keys(w).sort().join()==='end,reasons,start'&&Array.isArray(w.reasons)&&w.reasons.length<=100&&w.reasons.every((r:any)=>typeof r==='string'&&/^[a-z_]+(?::[a-z_]+)*$/.test(r)));
  for(const loss of d.loss)require(Object.keys(loss).sort().join()==='count,reason'&&typeof loss.reason==='string'&&/^[a-z_]+(?::[a-z_]+)*$/.test(loss.reason)&&Number.isSafeInteger(loss.count)&&loss.count>0);
 }
}
