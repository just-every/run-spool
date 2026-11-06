export type PatternName='credit_card'|'ip_address'|'email'|'password'|'auth_token'|'us_ssn'|'regex';

const builtins:Record<Exclude<PatternName,'regex'>,RegExp>={
 credit_card:/(?:\d[ -]?){13,19}/,
 ip_address:/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b|\b(?:[a-f\d]{0,4}:){2,7}[a-f\d]{0,4}\b/i,
 email:/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
 password:/\b(?:password|passwd|pwd)\s*[:=]\s*\S+/i,
 auth_token:/\b(?:authorization|auth[_-]?token|api[_-]?key|access[_-]?token|bearer)\s*[:= ]\s*\S+/i,
 us_ssn:/\b(?!000|666|9\d\d)\d{3}[- ]?(?!00)\d{2}[- ]?(?!0000)\d{4}\b/,
};

export function safeRegex(source:string):RegExp {
 if(source.length>256)throw new Error('regex_too_long');
 if(/\\(?:[1-9]|k<|g<)/.test(source))throw new Error('regex_backreference');
 if(/\(\?(?:[=!]|<[=!])/.test(source))throw new Error('regex_lookaround');
 if(/\)(?:\*|\+|\?|\{\d+(?:,\d*)?\})/.test(source))throw new Error('regex_quantified_group');
 if(/(?:\*|\+|\?|\{\d+(?:,\d*)?\})(?:\*|\+|\?|\{\d+(?:,\d*)?\})/.test(source))throw new Error('regex_nested_quantifier');
 if(/\{\d{4,}(?:,\d*)?\}|\{\d+,\d{4,}\}/.test(source))throw new Error('regex_large_repeat');
 let variable=0,inClass=false,escaped=false,group=false,alternative=false;
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(escaped){escaped=false;continue}
  if(c==='\\'){escaped=true;continue}
  if(c==='['){inClass=true;continue}
  if(c===']'){inClass=false;continue}
  if(inClass)continue;
  if(c==='('||c===')')group=true;
  if(c==='|')alternative=true;
  if(c==='*'||c==='+')variable++;
  if(c==='?'&&source[i-1]!=='(')variable++;
  if(c==='{'){
   const end=source.indexOf('}',i+1);
   if(end>i){const quantifier=/^(\d+)(?:,(\d*))?$/.exec(source.slice(i+1,end));
    if(quantifier){const low=Number(quantifier[1]),high=quantifier[2]===undefined?(source.slice(i+1,end).includes(',')?Infinity:low):Number(quantifier[2]);
     if(high>999||low>999)throw new Error('regex_large_repeat');
     if(high!==low)variable++;
     i=end;
    }
   }
  }
 }
 if(group)throw new Error('regex_groups_not_supported');
 if(variable>1)throw new Error('regex_multiple_quantifiers');
 if(variable&&(!source.startsWith('^')||!source.endsWith('$')))throw new Error('regex_quantifier_requires_anchors');
 if(variable&&(group||alternative))throw new Error('regex_ambiguous_quantifier');
 try{return new RegExp(source,'i')}catch{throw new Error('regex_invalid')}
}

export function patternMatches(value:string,pattern:PatternName,regex?:string):boolean {
 // JavaScript regex has no runtime budget; refuse unbounded candidate text.
 if(value.length>8192)throw new Error('scrubbing_text_limit');
 return (pattern==='regex'?safeRegex(regex??''):builtins[pattern]).test(value);
}
