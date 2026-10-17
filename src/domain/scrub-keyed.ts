export const REDACTED='[redacted]';
// A secret name's last word, after id/key/hash qualifiers, is the secret term.
// Its value is always redacted, except that a session or a plural name (tokens,
// sessions) keeps a word or a count, so "Session: expired" and "tokens: 4096"
// stay readable.
const secretTerm=/^[a-z0-9]*(?:password|passwd|secret|token|apikey|privatekey|cookie|authorization)(?:id|key|hash)?$|^(?:pwd|pass|passphrase|auth|credentials?)$/;
const statusTerm=/^[a-z0-9]*(?:session|sessid)(?:id|key|hash)?$|^[a-z0-9]*(?:password|passwd|secret|token|apikey|privatekey|session|cookie)s$/;
const qualifier=/^(?:id|ids|key|keys|hash|value|access)$/;
// An error type (TokenExpiredError) names a failure and a source file
// (token.js:12) names a location; neither is a credential.
const notCredential=/^(?:error|exception|warning|[cm]?[jt]sx?|json|map|py|rb|go|java|kt|swift|php|cs|vue|svelte|html?|css)$/;
const words=(name:string)=>name.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g,'$1 $2').toLowerCase().split(/[\s_.-]+/).filter(Boolean);
type Strength='secret'|'status';
function secretName(name:string):Strength|null{
  const parts=words(name);
  if(notCredential.test(parts.at(-1)??''))return null;
  let end=parts.length;
  while(end>1&&qualifier.test(parts[end-1]))end--;
  const term=parts[end-1];
  if(parts[end]==='key'&&(term==='api'||term==='private'))return 'secret';
  return secretTerm.test(term)?'secret':statusTerm.test(term)?'status':null;
}
export const secretField = (name:string) => secretName(name) !== null;
// No value at all is not a secret; a status keeps a word or a small count.
const empty=/^(?:null|undefined|none|nil|nan|true|false)$/i;
const plain=/^(?:[A-Za-z][a-z]+(?:-[a-z]+)*|\d{1,6})$/;
const kept=(strength:Strength,raw:string)=>empty.test(raw)||(strength==='status'&&plain.test(raw));
// Two or more lowercase words are a sentence about the header, not its value.
const prose=/^(?:[a-z]+(?:-[a-z]+)*[.,:!?]?(?:[ \t]+|$)){2,}$/;

const schemes='basic|bearer|token|digest|negotiate|ntlm|apikey|key|aws4-hmac-sha256';
// The credential after a scheme is the secret; the scheme word stays as evidence.
const scheme=new RegExp(`^(?:${schemes})(?=\\s|$)`,'i');
const value=(raw:string)=>{const word=scheme.exec(raw)?.[0];return word?`${word} ${REDACTED}`:REDACTED;};

const name=String.raw`(?<![A-Za-z0-9_.\-/\\])((?:(?:api|private) +)?[A-Za-z0-9_.-]*[A-Za-z0-9])`;
// An unquoted Authorization or Cookie header value runs to the end of its line
// and over folded continuation lines (one token, or cookie pairs).
const headerLine=new RegExp(String.raw`(?<![A-Za-z0-9_.\-/\\])([A-Za-z0-9_.-]*?(?:authorization|cookies?))([ \t]*[:=][ \t]*)(?![\s"'\\])([^\n"'\\]*[^\s"'\\])((?:\r?\n[ \t]+[^\s;]+(?:;[ \t]*[^\s;]+)*;?[ \t]*(?=\r?\n|$))*)`,'gi');
// A value left alone on its line by a bare scheme word (or by the scrubber
// before 12 Oct 2026, which wrote "Authorization: [redacted]") is on the next line.
const nextLineToken=/^\r?\n[ \t]*([^\s]+)[ \t]*(?=\r?\n|$)/;
const isHeader=(name:string)=>/^(?:authorization|cookies?)$/.test(words(name).at(-1)??'');
const headerProse=(raw:string)=>{const word=scheme.exec(raw)?.[0];return !raw.includes('=')&&prose.test(word?raw.slice(word.length).trim():raw);};
function header(text:string,match:RegExpExecArray){
  const [whole,key,separator,raw,folded]=match;
  if(!isHeader(key))return null;
  if(!folded&&headerProse(raw))return null;
  const word=scheme.exec(raw)?.[0];
  let end=match.index+whole.length;
  const next=!folded&&(word===raw||raw===REDACTED)?nextLineToken.exec(text.slice(end)):null;
  if(next&&!plain.test(next[1]))end+=next[0].length;
  return {text:key+separator+value(raw),end};
}

// A name, an optional closing quote (escaped any number of times) and a separator.
const keyed=new RegExp(name+String.raw`(\\*["']?[ \t]*(?::=|=>|[:=])[ \t]*)`,'gi');
const bare=new RegExp(String.raw`^((?:(?:${schemes})[ \t]+)?)(\[redacted\]|[^\s,;&"'<>()[\]{}\\]+)`,'i');
const structured=/^(?:\[[^\]\n]*\]|\{[^}\n]*\})/;
// A value alone on the next, indented line (YAML, pretty-printed JSON).
const continued=/^\r?\n[ \t]+(?=(?:\\*["'][^\r\n]*|[^\s]+)[ \t]*,?[ \t]*(?:\r?\n|$))/;
// The end of a quoted value opened by a quote behind `opener` backslashes. Each
// level of string escaping turns a run of k backslashes before a quote into
// 2k+1; a quote closes the value when the run decodes to an even count at the
// opener's level, or ends an enclosing string sooner. Unclosed, the value runs
// to the end of its line.
function quotedEnd(text:string,start:number,quote:string,opener:number){
  let level=0;
  for(let run=opener;run%2===1;run=(run-1)/2)level++;
  for(let index=start;index<text.length;){
    const character=text[index];
    if(character==='\n'||character==='\r')return {close:index,end:index};
    if(character!=='\\'&&character!==quote){index++;continue;}
    let run=0;
    while(text[index+run]==='\\')run++;
    if(text[index+run]!==quote){index+=run||1;continue;}
    let decoded=run,closes=false;
    for(let n=0;n<level&&!closes;n++){if(decoded%2===0)closes=true;else decoded=(decoded-1)/2;}
    if(closes||decoded%2===0)return {close:index+run-Math.min(run,opener),end:index+run+1};
    index+=run+1;
  }
  return {close:text.length,end:text.length};
}
function keyedValue(text:string,match:RegExpExecArray){
  const [whole,key]=match;
  const strength=secretName(key);
  if(!strength)return null;
  let start=match.index+whole.length;
  if(isHeader(key)&&headerProse(/^[^\n]*/.exec(text.slice(start))![0]))return null;
  const lead=continued.exec(text.slice(start))?.[0]??'';
  start+=lead.length;
  const rest=text.slice(start);
  const quoted=/^(\\*)(["'])/.exec(rest);
  if(quoted){
    const open=start+quoted[0].length,{close,end}=quotedEnd(text,open,quoted[2],quoted[1].length),inner=text.slice(open,close);
    if(!inner||kept(strength,inner)||inner===REDACTED)return null;
    return {text:whole+lead+quoted[0]+value(inner)+text.slice(close,end),end};
  }
  const block=structured.exec(rest)?.[0];
  if(block)return {text:whole+lead+REDACTED,end:start+block.length};
  const word=bare.exec(rest);
  if(!word||word[2]===REDACTED||kept(strength,word[2]))return null;
  return {text:whole+lead+word[1]+REDACTED,end:start+word[0].length};
}
// A secret-named word, then a long letter-and-digit value with no separator.
const spaced=new RegExp(name+String.raw`([ \t]+)((?=[A-Za-z0-9_+/=.-]*\d)(?=[A-Za-z0-9_+/=.-]*[A-Za-z])[A-Za-z0-9_+/=.-]{20,})`,'g');
function spacedValue(_text:string,match:RegExpExecArray){
  const [whole,key,space]=match;
  return secretName(key)?{text:key+space+REDACTED,end:match.index+whole.length}:null;
}
// A match that is not a secret is skipped up to its value, so that value is
// still read as a possible name: "TypeError: password=x" redacts x.
type Replace=(text:string,match:RegExpExecArray)=>{text:string,end:number}|null;
function replaceNamed(text:string,pattern:RegExp,replace:Replace){
  let result='',last=0,match:RegExpExecArray|null;
  pattern.lastIndex=0;
  while((match=pattern.exec(text))){
    const replacement=replace(text,match);
    if(replacement===null){pattern.lastIndex=match.index+match[1].length+match[2].length;continue;}
    result+=text.slice(last,match.index)+replacement.text;last=pattern.lastIndex=replacement.end;
  }
  return result+text.slice(last);
}
export function keyedSecrets(text:string){
  return replaceNamed(replaceNamed(replaceNamed(text,headerLine,header),keyed,keyedValue),spaced,spacedValue);
}
